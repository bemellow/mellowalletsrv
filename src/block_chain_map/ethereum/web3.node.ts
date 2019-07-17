import * as winston from 'winston';
import {GatewayTimeoutException, HttpService, Injectable, OnModuleInit} from '@nestjs/common';
import Web3 = require('web3');
import {Observable, defer, zip, bindNodeCallback, from, of, merge} from 'rxjs';
import {concatAll, concatMap, flatMap, map, toArray} from 'rxjs/operators';
import {EthNodeService, EthTransactionParams, NonceDto} from '../interfaces/node.interface';
import {TransactionHash, BCTransactionData, Balance} from '../interfaces/blockChain.interface';
import {jsonRPC, parallelRequests} from '../../common/helpers';
import {EthFee} from '../interfaces/indexer.interface';
import Contract from 'web3/eth/contract';
import BigNumber from 'bignumber.js';
import {ENS, RESOLVER} from './ns.abi';
import {hash as namehash} from 'eth-ens-namehash';
import {EthereumNodeConfig} from './ethereum.module';
import {AbstractWeb3Module} from 'web3-core';

interface Method {
    toPayload(any): any;

    requestManager: any;
}

interface Resolver {
    // address: string;
    node: string;
    resolver: Contract;
}

@Injectable()
export class Web3NodeService implements EthNodeService, OnModuleInit {
    private web3: Web3;
    private readonly url: string;
    private readonly ensAddress: string;
    private readonly defaultResolverAddress: string;
    private ensContract: Contract;
    private ignoreChecksums = false;

    constructor(config: EthereumNodeConfig, private readonly httpService: HttpService) {
        this.url = config.url;
        this.ignoreChecksums = config.ignoreChecksums;
        this.ensAddress = config.ns.address;
        this.defaultResolverAddress = config.ns.pub_resolver;
    }

    onModuleInit() {
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.url));
        this.ensContract = this.compile(this.ensAddress, ENS);
    }

    getResolver(node: string): Observable<Resolver> {
        return defer(async () => {
            let resolver: string = this.defaultResolverAddress;
            try {
                resolver = await this.ensContract.methods.resolver(node).call();
            } catch (err) {
                // asume no contract defined for node
            }
            if (resolver === '0x0000000000000000000000000000000000000000') {
                resolver = this.defaultResolverAddress;
            }
            return {node, resolver: this.compile(resolver, RESOLVER)};
        });
    }

    resolveName(name: string): Observable<string> {
        const node = namehash(name);
        return this.getResolver(node).pipe(
            flatMap(prev => {
                return defer(
                    async (): Promise<string> => {
                        return await prev.resolver.methods.addr(node).call();
                    }
                );
            })
        );
    }

    getBalance(addrs: string[]): Observable<BigNumber> {
        return this.getBalances(addrs).pipe(
            map(a => {
                return a.reduce(
                    (acc, val) => acc.plus(new BigNumber(val.quantity)),
                    new BigNumber(0)
                );
            })
        );
    }

    getBalances(addrs: string[]): Observable<Balance[]> {
        /* Serializable version in case we have a rate limit in the node
        const r = from(addrs).pipe(

            concatMap(a => defer(async () => {
                    const ret = await this.web3.eth.getBalance(a);
                    return ret;
                }
            ).pipe(
                map(ax => ({
                    addr: a,
                    quantity: new BigNumber(ax.toString()).toFixed()
                }))
            ))
        );
        return r.pipe(toArray());
         */
        return parallelRequests(addrs, a =>
            defer(async () => this.web3.eth.getBalance(a)).pipe(
                map(ax => ({
                    addr: a,
                    quantity: new BigNumber(ax.toString()).toFixed()
                }))
            )
        );
    }

    getTransactionData(txHash: string): Observable<BCTransactionData> {
        return defer(async () => this.web3.eth.getTransaction(txHash)).pipe(
            map(ax => ({
                from: [ax.from],
                to: [ax.to],
                hash: ax.hash
            }))
        );
    }

    getFee(): Observable<EthFee> {
        return defer(async () => {
            const ret: string = String(await this.web3.eth.getGasPrice());
            if (ret === '0') {
                winston.warn('Server returned zero gas price, returning one');
                return '1';
            }
            winston.debug('GOT GAS PRICE:', ret);
            return ret;
        }).pipe(map(a => ({gasPrice: a})));
    }

    getTransactionParams(addrs: string[]): Observable<EthTransactionParams> {
        // nonce, gasPrice
        const gasPrice: Observable<EthFee> = this.getFee();
        const utxos: Observable<NonceDto[]> = parallelRequests(addrs, addr =>
            defer(async () => {
                    const ret = await this.web3.eth.getTransactionCount(addr);
                    winston.debug('GOT NONCE for addr', addrs, ret);
                    return ret;
                }
            ).pipe(
                map(nonce => ({
                    addr,
                    nonce
                }))
            )
        );
        return zip(gasPrice, utxos).pipe(
            map(zipped => ({
                ...zipped[0],
                nonces: zipped[1]
            }))
        );
    }

    sendRawTransaction(tx: string): Observable<TransactionHash> {
        if (!tx.substring(0, 2).toLowerCase().startsWith('0x')) {
            tx = '0x' + tx;
        }

        // Web3 wait for a receipt and fails catching error too.
        // Do the request directly using axis.
        return jsonRPC<string>(this.httpService, this.url, 'eth_sendRawTransaction', [tx]);
        /*return defer(async () => {
            return await this.web3.eth.sendSignedTransaction(tx);
        }).pipe(
            map(x => x.transactionHash)
        );
         */
    }

    compile(contractAddr: string, contractAbi: any[]): Contract {
        return new this.web3.eth.Contract(contractAbi, contractAddr);
    }
}
