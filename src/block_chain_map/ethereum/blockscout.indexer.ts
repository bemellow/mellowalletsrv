import { Injectable, HttpService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IndexerService } from '../interfaces/indexer.interface';
import { parallelRequests } from '../../common/helpers';
import { ConfigService } from '../../config/config.service';
import { TransactionHistory, Balance } from '../interfaces/blockChain.interface';
import BigNumber from 'bignumber.js';

@Injectable()
export class BlockscoutIndexerService implements IndexerService {
    readonly url: string;
    constructor(private readonly httpService: HttpService, config: ConfigService) {
        this.url = config.get('app.servers.eth.indexer');
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
        return parallelRequests(addrs, a => this.getBalanceInt(a));
    }

    getTransactionHistory(addrs: string[]): Observable<TransactionHistory[]> {
        throw new Error('Unimplemented');
    }

    private getBalanceInt(addr: string): Observable<Balance> {
        return this.httpService
            .get<{
                message: string;
                result: string;
                status: string;
            }>(this.url + '/api', {
                params: {
                    module: 'account',
                    action: 'balance',
                    address: addr
                }
            })
            .pipe(
                map(ax => {
                    if (ax.data.message && ax.data.message === 'OK') {
                        return {
                            addr,
                            quantity: ax.data.result
                        };
                    }
                    throw new Error('Error getting balance for ' + addr + ' ' + ax.data.message);
                })
            );
    }
}
