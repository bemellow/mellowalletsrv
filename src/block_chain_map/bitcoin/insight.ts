import * as winston from 'winston';
import {Injectable, HttpService} from '@nestjs/common';
import {Observable, zip, of} from 'rxjs';
import {map, flatMap} from 'rxjs/operators';
import {
    BtcIndexerService,
    BtcTransactionParams,
    UtxoDto,
    BtcTransactionHistory,
    BtcFee
} from '../interfaces/indexer.interface';
import {parallelRequests} from '../../common/helpers';
import {
    TransactionHash,
    Balance,
    BCTransactionData,
    BCBlockData
} from '../interfaces/blockChain.interface';
import BigNumber from 'bignumber.js';
import {AxiosRequestConfig} from 'axios';
import {ConfigService} from '../../config/config.service';
import {BitcoinIndexerConfig} from './bitcoin.module';

interface InsightTransactionEntryDao {
    txid: string;
    version: string;
    locktime: string;
    vin: {
        txid: string;
        vout: string;
        sequence: string;
        n: string;
        scriptSig: {
            hex: string;
            asm: string;
        };
        addr: string;
        valueSat: string;
        value: string;
        doubleSpentTxID: string;
    }[];
    vout: {
        value: string;
        n: string;
        scriptPubKey: {
            hex: string;
            asm: string;
            addresses: string[];
            type: string;
        };
        spentTxId: string;
        spentIndex: string;
        spentHeight: string;
    }[];
    blockhash: string;
    blockheight: string;
    confirmations: string;
    time: string;
    blocktime: string;
    valueOut: string;
    size: string;
    valueIn: string;
    fees: string;
}

interface InsighBlockEntryDao {
    hash: string;
    size: string;
    height: string;
    version: string;
    merkleroot: string;
    tx: string[];
    time: string;
    nonce: string;
    bits: string;
    difficulty: string;
    chainwork: string;
    confirmations: string;
    previousblockhash: string;
    nextblockhash: string;
    reward: string;
    isMainChain: string;
    poolInfo: any;
}

interface InsightTransactionHistoryDao {
    totalItems: string;
    from: string;
    to: string;
    items: InsightTransactionEntryDao[];
}

/*
{
    pagesTotal: string;
    txs: InsightTransactionHistoryEntryDao[]
};
*/

@Injectable()
export class InsighService implements BtcIndexerService {
    readonly nBlocks = '2';
    readonly digits: BigNumber = new BigNumber(1e8);

    private url: string;

    constructor(config: BitcoinIndexerConfig,
                private readonly httpService: HttpService) {
        this.url = this.url;
        winston.debug('InsighService url ' + this.url);
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
        return parallelRequests(addrs, a =>
            this.callApi<string>('addr', a, 'balance').pipe(
                map(ax => ({
                    addr: a,
                    quantity: new BigNumber(ax).toFixed()
                }))
            )
        );
    }

    getFee(): Observable<BtcFee> {
        const u = this.url + '/utils/estimatefee?nbBlocks=' + this.nBlocks;
        const estimatedFees = this.httpService.get<{ [k: string]: string }>(u).pipe(
            map(ax => {
                if (ax.data && ax.data[this.nBlocks]) {
                    const ef = new BigNumber(ax.data[this.nBlocks]);
                    return {
                        lowFee: ef
                            .multipliedBy(this.digits)
                            .multipliedBy(0.8)
                            .toFixed(0),
                        mediumFee: ef.multipliedBy(this.digits).toFixed(0),
                        highFee: ef
                            .multipliedBy(this.digits)
                            .multipliedBy(1.2)
                            .toFixed(0)
                    };
                }
                throw new Error('Error getting estimated fee ' + ax);
            })
        );
        return estimatedFees;
    }

    getTransactionParams(addrs: string[]): Observable<BtcTransactionParams> {
        // let u = this.url + '/utils/estimatefee?nbBlocks=' + this.nBlocks;
        const estimatedFees: Observable<BtcFee> = this.getFee();
        // let utxos = parallelRequests(addrs, addr => this.callApi<UtxoDto[]>('addr', addr, 'utxo'));
        const utxos = this.callApi<UtxoDto[]>('addrs', addrs.join(','), 'utxo');
        return zip(estimatedFees, utxos).pipe(
            map(zipped => ({
                utxos: zipped[1],
                ...zipped[0]
            }))
        );
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: 'asc' | 'desc'
    ): Observable<BtcTransactionHistory[]> {
        const PAGE_SIZE = 50;
        return this.getTransactionHistoryInt(addrs, 0, PAGE_SIZE)
            .pipe(
                flatMap(ax => {
                    const total = parseInt(ax.totalItems, 10);
                    if (total < ax.items.length) {
                        return of([ax]);
                    }
                    cant = cant || total;
                    let start;
                    if (sort === 'desc') {
                        start = 0;
                    } else {
                        start = Math.max(total - cant, 0);
                    }
                    const end = Math.min(start + cant, total);
                    const r = Math.ceil((end - start) / PAGE_SIZE);
                    const range = Array.from(Array(r).keys()).map(x => [
                        x * PAGE_SIZE,
                        (x + 1) * PAGE_SIZE
                    ]);
                    // TODO: Serial is better ?
                    return parallelRequests(range, res =>
                        this.getTransactionHistoryInt(addrs, res[0], res[1])
                    );
                })
            )
            .pipe<InsightTransactionEntryDao[]>(
                map(ax => [].concat(...ax.map(x => [].concat(...x.items))))
            )
            .pipe(
                map(txs =>
                    txs.map(tx => ({
                        txId: tx.txid,
                        blockHash: tx.blockhash,
                        blockNumber: tx.blockheight,
                        timestamp: tx.time,
                        input: tx.vin
                            .filter(v => v.addr)
                            .map(v => ({
                                address: v.addr,
                                value: new BigNumber(v.value).multipliedBy(this.digits).toFixed(0) // statoshis
                            })),
                        output: tx.vout
                            .filter(
                                v => v.scriptPubKey.addresses && v.scriptPubKey.addresses.length > 0
                            )
                            .map(v => ({
                                address: v.scriptPubKey.addresses[0], // TODO: ???
                                value: new BigNumber(v.value).multipliedBy(this.digits).toFixed(0) // statoshis
                            }))
                    }))
                )
            );
    }

    getTransactionHistoryInt(
        addrs: string[],
        from: number,
        to: number
    ): Observable<InsightTransactionHistoryDao> {
        // ACCORDING TO THE DOCS THE API ALLWAYS SORT BY TIMESTAMP DESC.
        return this.callApi<InsightTransactionHistoryDao>('addrs', addrs.join(','), 'txs', {
            params: {
                from,
                to,
                noAsm: 1,
                noScriptSig: 1,
                noSpent: 1
            }
        });
    }

    sendRawTransaction(tx: string): Observable<TransactionHash> {
        const u = this.url + '/tx/send';
        return this.httpService.post<{ txid: string }>(u, {rawtx: tx}).pipe(
            map(ax => {
                if (ax.data !== undefined && ax.data !== null) {
                    return ax.data.txid;
                }
                throw new Error('Error sending transaction ' + ax);
            })
        );
    }

    getTransactionData(txHash: string): Observable<BCTransactionData> {
        return this.callApi<InsightTransactionEntryDao>('tx', txHash, null, {}).pipe(
            map(ax => ({
                from: ax.vin.map(x => x.addr),
                to: [].concat(...ax.vout.map(o => o.scriptPubKey.addresses)),
                hash: ax.txid
            }))
        );
    }

    getBlockData(blockHash: string): Observable<BCBlockData> {
        // TODO: Better use Transactions by Block /txs/?block=HASH
        /*return this.callApi<InsighBlockEntryDao>('block', blockHash, null, {})
            .pipe(flatMap(ax => parallelRequests(ax.tx, a => this.getTransactionData(a))))
            .pipe(
                map(ax => ({
                    txs: ax
                }))
            );
        */
        return this.callApi<InsighBlockEntryDao>('txs', null, null, {
            params: {block: blockHash}
        })
            .pipe(flatMap(ax => parallelRequests(ax.tx, a => this.getTransactionData(a))))
            .pipe(
                map(ax => ({
                    txs: ax
                }))
            );
    }

    private callApi<T>(
        type: string,
        addr: string,
        method: string,
        config?: AxiosRequestConfig
    ): Observable<T> {
        let u = this.url + '/' + type;
        if (addr) {
            u += '/' + addr;
        }
        if (method) {
            u += '/' + method;
        }
        winston.debug('Insight Calling ' + u);
        return this.httpService.get<T>(u, config).pipe(
            map(ax => {
                if (ax.data !== undefined && ax.data !== null) {
                    return ax.data;
                }
                throw new Error(
                    'Insight error calling api ' +
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
