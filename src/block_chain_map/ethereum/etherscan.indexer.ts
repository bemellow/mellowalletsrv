import * as winston from 'winston';
import {Injectable, HttpService, OnModuleInit} from '@nestjs/common';
import {Observable} from 'rxjs';
import {map, reduce} from 'rxjs/operators';
import {EthTransactionHistory, EthIndexerService} from '../interfaces/indexer.interface';
import {parallelRequests} from '../../common/helpers';
import {Balance} from '../interfaces/blockChain.interface';
import BigNumber from 'bignumber.js';
import {ConfigService} from '../../config/config.service';
import {EthNodeService} from '../interfaces/node.interface';
import {EthereumIndexerConfig} from './ethereum.module';

interface EtherscanTransactionHistoryDao {
    blockNumber: string;
    blockHash: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    txreceipt_status: string;
    gasUsed: string;
    confirmations: string;
    isError: string;
}

interface EtherscanTransactionHistoryForTokenDao {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    from: string;
    contractAddress: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
    transactionIndex: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    input: string;
    confirmations: string;
}

@Injectable()
export class EtherscanIndexerService implements EthIndexerService {
    private readonly url: string;
    private readonly apiKey?: string;

    constructor(config: EthereumIndexerConfig,
                private readonly httpService: HttpService) {
        this.apiKey = config.apiKey;
        this.url = config.url;
        winston.debug('EtherscanIndexerService url ' + this.url);
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<EthTransactionHistory[]> {
        return parallelRequests(addrs, addr =>
            this.callApi<EtherscanTransactionHistoryDao[]>('account', 'txlist', {
                address: addr,
                sort,
                page: 1,
                offset: cant,
                apikey: this.apiKey
            }).pipe(
                map(ax =>
                    ax.map(a => ({
                        txId: a.hash,
                        blockHash: a.blockHash,
                        blockNumber: a.blockNumber,
                        timestamp: a.timeStamp,
                        input: a.from,
                        output: a.to,
                        value: a.value // wei
                    }))
                )
            )
        ).pipe(map(ax => [].concat(...ax)));
    }

    // Get contract transfer events.
    //
    // https://api-ropsten.etherscan.io/api?module=account&action=tokentx&contractaddress=0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2
    // &page=1
    // &offset=100
    // &sort=asc
    // &apikey=YourApiKeyToken
    getTransactionHistoryForToken(
        contractaddress: string,
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<EthTransactionHistory[]> {
        return parallelRequests(addrs, addr =>
            this.callApi<EtherscanTransactionHistoryForTokenDao[]>('account', 'tokentx', {
                contractaddress,
                address: addr,
                page: 1,
                offset: cant,
                sort,
                apikey: this.apiKey
            }).pipe(
                map(ax =>
                    ax.map(a => ({
                        txId: a.hash,
                        blockHash: a.blockHash,
                        blockNumber: a.blockNumber,
                        timestamp: a.timeStamp,
                        input: a.from,
                        output: a.to,
                        value: a.value // wei
                    }))
                )
            )
        ).pipe(map(ax => [].concat(...ax)));
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
        return this.callApi<{ account: string; balance: string }[]>('account', 'balancemulti', {
            address: addrs.join(','),
            tag: 'latest'
        }).pipe(
            map(ax =>
                ax.map(x => ({
                    addr: x.account,
                    quantity: x.balance
                }))
            )
        );
    }

    callApi<T>(module: string, action: string, args: any): Observable<T> {
        winston.debug('EtherScan calling ' + module + ' ' + action + ' ' + JSON.stringify(args));
        return this.httpService
            .get<{
                status: string;
                message: string;
                result: T;
            }>(this.url, {
                params: {
                    module,
                    action,
                    apikey: this.apiKey,
                    ...args
                }
            })
            .pipe(
                map(ax => {
                    if (
                        ax != null &&
                        ax.status === 200 &&
                        ax.data != null &&
                        ax.data.result != null
                    ) {
                        winston.debug(
                            'EtherScan for call ' +
                            module +
                            ' ' +
                            action +
                            ' ' +
                            JSON.stringify(args) +
                            ' got result ' +
                            JSON.stringify(ax.data.result)
                        );
                        return ax.data.result;
                    }
                    // console.log("------>", ax.status, ax.data, ax.data.result, ax.data.message);
                    throw new Error(
                        'EtherScan error calling api ' +
                        ax.status +
                        ' ' +
                        ax.statusText +
                        ' ' +
                        JSON.stringify(ax.data)
                    );
                })
            );
    }
}
