import * as winston from 'winston';
import {Injectable, OnModuleDestroy} from '@nestjs/common';
import Web3 = require('web3');
import {Observable} from 'rxjs';
import {EthNodeService, EthWSService} from '../interfaces/node.interface';
import {WSService, BCTransactionData} from '../interfaces/blockChain.interface';
import {Subscribe, Log} from 'web3/types';
import {WebSocketHelper} from '../ws.helper';
import {map, filter, tap} from 'rxjs/operators';
import {ConfigService} from '../../config/config.service';
import {EthereumWsConfig} from './ethereum.module';

abstract class Web3WSBaseHelper<T, S> extends WebSocketHelper<S> implements OnModuleDestroy {
    protected subscription: Subscribe<T> = null;

    constructor(readonly web3: Web3) {
        super();
    }

    async onModuleDestroy() {
        winston.debug('Web3WSBaseHelper onModuleDestroy');
        if (!this.subscription) {
            return;
        }
        const s = this.subscription;
        this.subscription = null;
        // TODO: Some timeout ?
        return new Promise<boolean>((resolve, reject) => {
            s.subscription.unsubscribe((error: Error, result: boolean) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    protected abstract initSubscription();

    connect() {
        this.initSubscription();
        this.subscription.on('error', (err: Error) => {
            // TODO: Retry.
            winston.error('Web3WSBaseHelper Subscription error ' + err.name + '  ' + err.message);
            this.subject.error(err);
        });
        /*this.web3.eth.net
            .isListening()
            .then(() => winston.debug('Web3 socket is connected'))
            .catch(e => winston.error('Web3 socket error ' + e));
           */
    }
}

type TxHash = string;

class Web3WSPendingTransactionHelper extends Web3WSBaseHelper<TxHash, BCTransactionData>
    implements WSService, OnModuleDestroy {
    constructor(readonly node: EthNodeService, readonly web3: Web3) {
        super(web3);
    }

    initSubscription() {
        const s: any = this.web3.eth.subscribe('pendingTransactions');
        this.subscription = s;
        this.subscription.on('data', (data: TxHash) => {
            return this.node.getTransactionData(data).subscribe(this.subject);
        });
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        const addresses = new Set(addrs);
        return super
            .observe()
            .pipe(
                filter(
                    ax => ax.from.some(x => addresses.has(x)) || ax.to.some(x => addresses.has(x))
                )
            );
    }
}

class Web3WSLogHelper extends Web3WSBaseHelper<Log, Log> implements OnModuleDestroy {
    protected subscription: Subscribe<Log> = null;

    constructor(readonly node: EthNodeService, readonly web3: Web3) {
        super(web3);
    }

    initSubscription() {
        const s: any = this.web3.eth.subscribe('logs', {});
        this.subscription = s;
        this.subscription.on('data', (data: Log) => {
            this.subject.next(data);
        });
    }

    subscribe(
        contractAddr: string,
        contractAbi: { name: string; type: string; inputs: any[] }[],
        addrs: string[]
    ): Observable<BCTransactionData> {
        const addresses = new Set(addrs);
        return super
            .observe()
            .pipe(filter(ax => ax.address === contractAddr))
            .pipe(
                map(ax => {
                    const iface = contractAbi.find(
                        o => o.name === 'Transfer' && o.type === 'event'
                    );
                    if (!iface) {
                        throw new Error(
                            'event Transfer missing in contract ' +
                            contractAddr +
                            ' abi' +
                            JSON.stringify(contractAbi)
                        );
                    }
                    const eventInfo: any = this.web3.eth.abi.decodeLog(
                        iface.inputs,
                        ax.data,
                        ax.topics.slice(1)
                    );
                    return {
                        hash: ax.transactionHash,
                        from: [eventInfo.from],
                        to: [eventInfo.to]
                    };
                })
            )
            .pipe(
                filter(
                    ax => ax.from.some(x => addresses.has(x)) || ax.to.some(x => addresses.has(x))
                )
            );
    }
}

@Injectable()
export class Web3WSService implements EthWSService, OnModuleDestroy {
    private readonly transaction_ws: Web3WSPendingTransactionHelper;
    private readonly log_ws: Web3WSLogHelper;

    constructor(config: EthereumWsConfig, private readonly  node: EthNodeService) {
        const providerUrl = config.ws_url;
        const web3 = new Web3(new Web3.providers.WebsocketProvider(providerUrl));
        this.transaction_ws = new Web3WSPendingTransactionHelper(node, web3);
        this.log_ws = new Web3WSLogHelper(node, web3);
    }

    onModuleDestroy() {
        this.transaction_ws.onModuleDestroy();
        this.log_ws.onModuleDestroy();
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.transaction_ws.subscribe(addrs);
    }

    contractSubscribe(
        contractAddr: string,
        contractAbi: any[],
        addrs: string[]
    ): Observable<BCTransactionData> {
        return this.log_ws.subscribe(contractAddr, contractAbi, addrs);
    }
}
