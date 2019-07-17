import * as winston from 'winston';
import {Injectable, HttpService, CACHE_MANAGER, OnModuleInit} from '@nestjs/common';
import {Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';
import {
    EthTransactionHistory,
    EthIndexerService,
    MAX_INDEXER_TRANSACTIONS
} from '../interfaces/indexer.interface';
import BigNumber from 'bignumber.js';
import {ConfigService} from '../../config/config.service';
import {EthNodeService} from '../interfaces/node.interface';
import {EthereumIndexerConfig} from './ethereum.module';

@Injectable()
export class NktEthIndexerService implements EthIndexerService {
    private readonly url: string;

    constructor(config: EthereumIndexerConfig,
                private readonly httpService: HttpService) {
        this.url = config.url;
        winston.debug('NktEthIndexerService url ' + this.url);
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: 'asc' | 'desc'
    ): Observable<EthTransactionHistory[]> {
        cant = cant ? cant : MAX_INDEXER_TRANSACTIONS;
        return this.callApi<{ addresses: string[]; max_txs: number; sort: 0 | 1 },
            EthTransactionHistory[]>('history', {
            addresses: addrs,
            max_txs: cant,
            sort: sort === 'asc' ? 1 : 0
        });
    }

    getTransactionHistoryForToken(
        contractaddress: string,
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<EthTransactionHistory[]> {
        cant = cant ? cant : MAX_INDEXER_TRANSACTIONS;
        return this.callApi<{ addresses: string[]; max_txs: number; sort: 0 | 1 },
            EthTransactionHistory[]>(contractaddress + '/history', {
            addresses: addrs,
            max_txs: cant,
            sort: sort === 'asc' ? 1 : 0
        });
    }

    private callApi<R, T>(type: string, params: R): Observable<T> {
        const u = this.url + '/' + type;
        winston.debug('NktEthIndexerService Calling ' + u + ' with params ' + JSON.stringify(params));
        return this.httpService.post<T>(u, params).pipe(
            map(ax => {
                winston.debug('NktEthIndexerService for ' + u + ' GOT ' + JSON.stringify(ax.data, null, 4));
                if (ax.data !== undefined && ax.data !== null) {
                    return ax.data;
                }
                throw new Error(
                    'NktEthIndexerService error calling api ' +
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
