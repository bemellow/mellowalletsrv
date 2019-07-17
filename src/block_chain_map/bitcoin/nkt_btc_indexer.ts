import * as winston from 'winston';
import {Injectable, HttpService, OnModuleInit} from '@nestjs/common';
import {Observable, zip} from 'rxjs';
import {map} from 'rxjs/operators';
import {
    BtcIndexerService,
    BtcTransactionParams,
    BtcTransactionHistory,
    BtcFee,
    UtxoDto,
    MAX_INDEXER_TRANSACTIONS
} from '../interfaces/indexer.interface';
import {Balance} from '../interfaces/blockChain.interface';
import BigNumber from 'bignumber.js';
import {NktBtcTxRecord} from '../interfaces/nkt_indexer';
import {ConfigService} from '../../config/config.service';
import {BitcoinIndexerConfig} from './bitcoin.module';

@Injectable()
export class NktBtcIndexerService implements BtcIndexerService {
    private url: string;

    constructor(private readonly  serviceName: string,
                private readonly config: BitcoinIndexerConfig,
                private readonly httpService: HttpService) {
        this.url = this.config.url;
        winston.debug('NktBtcIndexerService url ' + this.url);
    }

    getBalance(addrs: string[]): Observable<BigNumber> {
        return this.callApi<string[], string>('balance', addrs).pipe(map(ax => new BigNumber(ax)));
    }

    getBalances(addrs: string[]): Observable<Balance[]> {
        return this.callApi<string[], { [k: string]: string }>('balances', addrs).pipe(
            map(ax =>
                addrs.map(x => ({
                    addr: x,
                    quantity: (new BigNumber(((x in ax) ? ax[x] : 0)).toFixed())
                }))
            )
        );
    }

    getFee(): Observable<BtcFee> {
        const u = this.url + '/fees';
        const estimatedFees = this.httpService
            .get<{ low: string; normal: string; high: string }>(u)
            .pipe(
                map(ax => {
                    if (ax.data) {
                        return {
                            lowFee: new BigNumber(ax.data.low).toFixed(0),
                            mediumFee: new BigNumber(ax.data.normal).toFixed(0),
                            highFee: new BigNumber(ax.data.high).toFixed(0)
                        };
                    }
                    throw new Error('Error getting estimated fee ' + ax);
                })
            );
        return estimatedFees;
    }

    getTransactionParams(addrs: string[]): Observable<BtcTransactionParams> {
        const estimatedFees: Observable<BtcFee> = this.getFee();
        const utxos = this.callApi<string[], UtxoDto[]>('utxo', addrs);
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
        cant = cant ? cant : MAX_INDEXER_TRANSACTIONS;
        return this.callApi<{ addresses: string[]; max_txs: number }, NktBtcTxRecord[]>('history', {
            addresses: addrs,
            max_txs: cant
        }).pipe(
            map(ax => {
                if (sort === 'asc') {
                    ax.sort((a, b) =>
                        new BigNumber(a.timestamp).comparedTo(new BigNumber(b.timestamp))
                    );
                }
                return ax.map(x => ({
                    txId: x.hash,
                    blockHash: x.block_hash,
                    blockNumber: x.block_index,
                    timestamp: x.timestamp,
                    input: x.inputs.map(y => ({address: y.addresses[0], value: y.value})),
                    output: x.outputs.map(y => ({address: y.addresses[0], value: y.value}))
                }));
            })
        );
    }

    private callApi<R, T>(type: string, params: R): Observable<T> {
        const u = this.url + '/' + type;
        winston.debug('NktBtcIndexerService Calling ' + u + ' params ' + JSON.stringify(params));
        return this.httpService.post<T>(u, params).pipe(
            map(ax => {
                winston.debug('NktBtcIndexerService GOT', JSON.stringify(ax.data, null, 4));
                if (ax.data !== undefined && ax.data !== null) {
                    return ax.data;
                }
                throw new Error(
                    'NktBtcIndexerService error calling api ' +
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
