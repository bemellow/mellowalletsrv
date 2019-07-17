import * as winston from 'winston';
import {Injectable, OnModuleInit} from '@nestjs/common';
import Client = require('bitcoin-core');
import {Observable, bindNodeCallback, zip} from 'rxjs';
import {BtcNodeService} from '../interfaces/node.interface';
import {
    TransactionHash,
    BCTransactionData,
    BCBlockData
} from '../interfaces/blockChain.interface';
import {map, filter, flatMap} from 'rxjs/operators';
import {parallelRequests} from '../../common/helpers';
import {ConfigService} from '../../config/config.service';
import {BitcoinNodeConfig} from './bitcoin.module';

// This is missing the input address, we don't use it right now, the options
// are: using the indexer (the choosen one), turn on indexing in the node?,
// do the input parsing our self.
interface CoinbaseInput {
    coinbase: string;
    sequence: string;
}

interface OtherTxInput {
    txid: string;
    vout: string;
    scriptSig: {
        asm: string;
        hex: string;
    };
    txinwitness?: string;
    sequence: string;
}

interface GetTransactionByHashDto {
    txid: string;
    hash: string;
    version: string;
    size: string;
    vsize: string;
    weight: string;
    locktime: string;
    vin: (OtherTxInput | CoinbaseInput)[];
    vout: [
        {
            value: string;
            n: string;
            scriptPubKey: {
                asm: string;
                hex: string;
                reqSigs: string;
                type: 'pubkeyhash';
                addresses: string[];
            };
        }
        ];
    hex: string;
}

interface GetBlockByHashDto {
    hash: string;
    confirmations: string;
    strippedsize: string;
    size: string;
    weight: string;
    height: string;
    version: string;
    versionHex: string;
    merkleroot: string;
    tx: {
        txid: string;
        hash: string;
        version: string;
        size: string;
        vsize: string;
        weight: string;
        locktime: string;
        vin: {
            coinbase: string;
            sequence: string;
        }[];
        vout: {
            value: string;
            n: string;
            scriptPubKey: {
                asm: string;
                hex: string;
                reqSigs: string;
                type: string;
                addresses: string[];
            };
        }[];
        hex: string;
    }[];
    time: string;
    mediantime: string;
    nonce: string;
    bits: string;
    difficulty: string;
    chainwork: string;
    nTx: string;
    previousblockhash: string;
    nextblockhash: string;
}

/*
getBlockByHash
getBlockHeadersByHash
getBlockchainInformation
getMemoryPoolContent
getMemoryPoolInformation
getTransactionByHash
getUnspentTransactionOutputs
 */
@Injectable()
export class BitcoinCoreNodeService implements BtcNodeService, OnModuleInit {

    constructor(private readonly config: BitcoinNodeConfig) {
    }

    onModuleInit() {
        winston.debug('bitcoin node config ' + JSON.stringify(this.config));
        this.client = new Client(this.config);
    }

    private client: {
        sendRawTransaction(data: string, cb: (error, response) => void);
        getInfo(): Promise<any>;
        getTransactionByHash(
            hash: string,
            options: {
                summary?: boolean;
                extension?: 'json' | 'bin' | 'hex';
            },
            callback?: (err: any, data: GetTransactionByHashDto) => void
        ): Promise<GetTransactionByHashDto>;
        getBlockByHash(
            hash: string,
            options: {
                extension?: 'json' | 'bin' | 'hex';
            },
            callback?: (err: any, data: GetBlockByHashDto) => void
        ): Promise<GetBlockByHashDto>;
    };

    getTransactionData(txHash: string): Observable<BCTransactionData> {
        const getData = bindNodeCallback<string, GetTransactionByHashDto>(
            (t: string, cb: (error: Error | undefined, response) => void) => {
                if (
                    t
                        .substring(0, 2)
                        .toLowerCase()
                        .startsWith('0x')
                ) {
                    t = t.substring(2);
                }
                this.client.getTransactionByHash(
                    t,
                    {extension: 'json', summary: false},
                    (error, tx) => {
                        cb(error, tx);
                    }
                );
            }
        );
        const tData = getData(txHash);
        const d1 = tData.pipe(
            map(ax => ({
                to: [].concat(...ax.vout.map(x => x.scriptPubKey.addresses)),
                hash: ax.txid
            }))
        );
        const d2 = tData
            .pipe(
                flatMap(ax => {
                    const prevTxs = ax.vin.filter(
                        val =>
                            (val as OtherTxInput).txid != null && (val as OtherTxInput).vout != null
                    );
                    return parallelRequests(prevTxs, (prevTx: OtherTxInput) => {
                        return getData(prevTx.txid)
                            .pipe(filter(y => parseInt(prevTx.vout, 10) < y.vout.length))
                            .pipe(
                                map(
                                    (prevTxData: GetTransactionByHashDto): string[] =>
                                        // TODO: What to do if there are more than one address ?
                                        [].concat(
                                            ...prevTxData.vout[parseInt(prevTx.vout, 10)].scriptPubKey
                                                .addresses
                                        )
                                )
                            );
                    });
                })
            )
            .pipe(map(ax => [].concat(...ax)));
        return zip(d1, d2).pipe(
            map(ax => ({
                from: ax[1],
                to: ax[0].to,
                hash: ax[0].hash
            }))
        );
    }

    getBlockData(txHash: string): Observable<BCBlockData> {
        const o = bindNodeCallback(
            (t: string, cb: (error: Error | undefined, response: GetBlockByHashDto) => void) => {
                if (
                    t
                        .substring(0, 2)
                        .toLowerCase()
                        .startsWith('0x')
                ) {
                    t = t.substring(2);
                }
                this.client.getBlockByHash(t, {extension: 'json'}, (error, response) => {
                    cb(error, response);
                });
            }
        );
        // TODO: The node doesn't give input addresses....
        return o(txHash).pipe(
            map(ax => ({
                txs: ax.tx.map(x => ({
                    from: x.vin.map(i => 'i.addr'),
                    to: [].concat(...x.vout.map(_o => _o.scriptPubKey.addresses)),
                    hash: x.txid
                }))
            }))
        );
    }

    sendRawTransaction(tx: string): Observable<TransactionHash> {
        const o = bindNodeCallback(
            (t: string, cb: (error: Error | undefined, response: TransactionHash) => void) => {
                if (
                    t
                        .substring(0, 2)
                        .toLowerCase()
                        .startsWith('0x')
                ) {
                    t = t.substring(2);
                }
                return this.client.sendRawTransaction(t, (error, response) => {
                    cb(error, response);
                });
            }
        );
        return o(tx);
    }
}
