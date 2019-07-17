import {Injectable} from '@nestjs/common';
import {Observable, defer, of} from 'rxjs';
import {RecoveredNetwork, NetworkPathKey, recover_all_wallets} from './wallet_recoverer';
import {BlockChainMapService} from '../block_chain_map/block_chain_map.service';
import {map, delay} from 'rxjs/operators';
import BigNumber from 'bignumber.js';
import * as winston from 'winston';
import {add} from 'winston';

@Injectable()
export class WalletRecoverService {
    constructor(private readonly bcMap: BlockChainMapService) {
    }

    recoverAllWallets(nodes: NetworkPathKey[]): Observable<RecoveredNetwork[]> {
        return defer(async () => {
            const ret = await recover_all_wallets(
                {
                    get_balances: (network: string, addresses: string[]) => {
                        winston.debug('recoverAllWallets Check addr ' + JSON.stringify([network, addresses]));
                        const bc = this.bcMap.getBlockChain(network);
                        /*return bc
                            .getBalance(addresses)
                            .pipe(delay(10000))
                            .pipe(map(ax => ax.map(x => new BigNumber(x.quantity))))
                            .toPromise();
                            */
                        return bc
                            .checkAddrs(addresses)
                            // .pipe(delay(1000))
                            .pipe(map(ax => ax.map(x => (x ? new BigNumber(1) : new BigNumber(0)))))
                            .toPromise().then(x => {
                                winston.debug('recoverAllWallets Check addr ' + JSON.stringify([network, addresses]) + ' ENDED');
                                return x;
                            });
                    }
                },
                nodes
            );
            return ret;
        });
    }
}
