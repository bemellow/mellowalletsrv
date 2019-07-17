import * as winston from 'winston';
import {Injectable, HttpService, HttpStatus} from '@nestjs/common';
import {Observable, zip, of, throwError} from 'rxjs';
import {map, catchError, flatMap} from 'rxjs/operators';
import {
    BtcIndexerService,
    BtcTransactionParams,
    BtcTransactionHistory,
    BtcFee
} from '../interfaces/indexer.interface';
import {TransactionHash, Balance} from '../interfaces/blockChain.interface';
import BigNumber from 'bignumber.js';
import {parallelRequests} from '../../common/helpers';
import {AxiosError} from 'axios';
import {ConfigService} from '../../config/config.service';
import {BitcoinIndexerConfig} from './bitcoin.module';

interface BCIInputDTO {
    sequence: string;
    witness: string;
    script: string;
    prev_out: {
        type: string;
        spent: string;
        value: string;
        spending_outpoints: {
            tx_index: string;
            n: string;
        }[];
        script: string;
        tx_index: string;
        n: string;
        addr: string;
    };
}

interface BCIOutputDTO {
    type: string;
    spent: string;
    value: string;
    spending_outpoints: {
        tx_index: string;
        n: string;
    }[];
    script: string;
    tx_index: string;
    n: string;
    addr: string;
}

interface BCITxDTO {
    hash: string;
    ver: string;
    vin_sz: string;
    vout_sz: string;
    size: string;
    weight: string;
    fee: string;
    relayed_by: string;
    lock_time: string;
    tx_index: string;
    double_spend: string;
    result: string;
    balance: string;
    time: string;
    block_index: string;
    block_height: string;
    inputs: BCIInputDTO[];
    out: BCIOutputDTO[];
}

interface BCIRawAddrDTO {
    hash160: string;
    address: string;
    n_tx: string;
    n_unredeemed: string;
    total_received: string;
    total_sent: string;
    final_balance: string;
    txs: BCITxDTO[];
}

interface BCIMultiAddrDTO {
    address: string;
    n_tx: string;
    total_received: string;
    total_sent: string;
    final_balance: string;
    change_index: string;
    account_index: string;
}

interface BCIMultiDTO {
    addresses: BCIMultiAddrDTO[];
    wallet: {
        n_tx: string;
        n_tx_filtered: string;
        total_received: string;
        total_sent: string;
        final_balance: string;
    };
    txs: BCITxDTO[];
    info: {
        nconnected: string;
        conversion: string;
        symbol_local: {
            code: string;
            symbol: string;
            name: string;
            conversion: string;
            symbolAppearsAfter: string;
            local: string;
        };
        symbol_btc: {
            code: string;
            symbol: string;
            name: string;
            conversion: string;
            symbolAppearsAfter: string;
            local: string;
        };
        latest_block: {
            block_index: string;
            hash: string;
            height: string;
            time: string;
        };
    };
    recommend_include_fee: string;
}

interface BCIUnspentEntryDTO {
    tx_hash: string;
    tx_hash_big_endian: string;
    tx_output_n: string;
    script: string;
    value: string;
    value_hex: string;
    confirmations: string;
    tx_index: string;
}

interface BCIUnspentDTO {
    unspent_outputs: BCIUnspentEntryDTO[];
}

// unspent_outputs:

interface BCIBalanceDTO {
    [k: string]: {
        final_balance: string;
        n_tx: string;
        total_received: string;
    };
}

@Injectable()
export class BlockchainInfoIndexerService implements BtcIndexerService {
    private url: string;

    constructor(config: BitcoinIndexerConfig,
                private readonly httpService: HttpService) {
        this.url = config.url;
        winston.debug('BlockchainInfoIndexerService url ' + this.url);
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
        return this.callApi<BCIBalanceDTO>('balance', {
            active: addrs.join('|')
        }).pipe(
            map(ax =>
                Object.keys(ax).map(x => ({
                    addr: x,
                    quantity: new BigNumber(ax[x].final_balance).toFixed()
                }))
            )
        );
    }

    getFee(): Observable<BtcFee> {
        // TODO: Move this elsewhere!!!.
        const estimatedFees = this.httpService
            .get<{
                fastestFee: string;
                halfHourFee: string;
                hourFee: string;
            }>('https://bitcoinfees.earn.com/api/v1/fees/recommended')
            .pipe(
                map(ax => {
                    if (ax.data) {
                        return {
                            lowFee: new BigNumber(ax.data.hourFee).toFixed(0),
                            mediumFee: new BigNumber(ax.data.halfHourFee).toFixed(0),
                            highFee: new BigNumber(ax.data.fastestFee).toFixed(0)
                        };
                    }
                    throw new Error('Error getting estimated fee ' + ax);
                })
            );
        return estimatedFees;
    }

    getTransactionParams(addrs: string[]): Observable<BtcTransactionParams> {
        const utxos = parallelRequests(addrs, a =>
            this.callApi<BCIUnspentDTO>('unspent', {
                active: a
            })
                .pipe(
                    catchError(err => {
                        const axErr = err as AxiosError;
                        if (
                            axErr.response.status === HttpStatus.INTERNAL_SERVER_ERROR &&
                            axErr.response.data === 'No free outputs to spend'
                        ) {
                            return of({
                                unspent_outputs: []
                            } as BCIUnspentDTO);
                        }
                        throw err;
                    })
                )
                .pipe(
                    map(ax =>
                        ax.unspent_outputs.map(x => ({
                            address: a,
                            satoshis: x.value,
                            txid: x.tx_hash,
                            vout: x.tx_output_n
                        }))
                    )
                )
        ).pipe(map(x => [].concat(...x)));
        const estimatedFees: Observable<BtcFee> = this.getFee();
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
        return this.getTransactionHistoryInt(addrs, 0, cant)
            .pipe(
                flatMap(ax => {
                    const total = parseInt(ax.wallet.n_tx, 10);
                    if (total < ax.txs.length) {
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
            .pipe<BCITxDTO[]>(map(ax => [].concat(...ax.map(x => [].concat(...x.txs)))))
            .pipe(
                map(txs =>
                    txs.map(tx => ({
                        txId: tx.hash,
                        blockHash: tx.block_index,
                        blockNumber: tx.block_height,
                        timestamp: tx.time,
                        input: tx.inputs
                            .filter(v => v.prev_out)
                            .map(v => ({
                                address: v.prev_out.addr,
                                value: new BigNumber(v.prev_out.value).toFixed(0)
                            })),
                        output: tx.out.map(v => ({
                            address: v.addr,
                            value: new BigNumber(v.value).toFixed(0)
                        }))
                    }))
                )
            );
    }

    getTransactionHistoryInt(addrs: string[], from: number, to: number): Observable<BCIMultiDTO> {
        return this.callApi<BCIMultiDTO>('multiaddr', {
            active: addrs.join('|'),
            limit: to,
            offset: from
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

    private callApi<T>(action: string, args: any): Observable<T> {
        winston.debug(
            'BlockchainInfoIndexerService calling ' + action + ' ' + JSON.stringify(args)
        );
        const u = this.url + '/' + action;
        return this.httpService.get<T>(u, {params: {...args}}).pipe(
            map(ax => {
                if (ax != null && ax.status === 200 && ax.data != null) {
                    winston.debug(
                        'BlockchainInfoIndexerService for call ' +
                        action +
                        ' ' +
                        JSON.stringify(args) +
                        ' got result ' +
                        JSON.stringify(ax.data)
                    );
                    return ax.data;
                }
                // console.log("------>", ax.status, ax.data);
                throw new Error(
                    'BlockchainInfoIndexerService error calling api ' +
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
