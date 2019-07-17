import * as winston from 'winston';
import {Injectable, Inject, OnModuleDestroy, HttpService, OnModuleInit} from '@nestjs/common';
import {Observable, of} from 'rxjs';
import {WSService, BCTransactionData} from '../interfaces/blockChain.interface';
import * as io from 'socket.io-client';
import {ConfigService} from '../../config/config.service';
import {WebSocketHelper} from '../ws.helper';
import {map, filter, catchError} from 'rxjs/operators';
import {BtcNodeService} from '../interfaces/node.interface';
import {BitcoinWsConfig} from './bitcoin.module';

// Retry transaction search
const RETRY_DELAY_MS = 1000 * 60 * 60;

interface InsightWSTransactionDao {
    txid: string;
    valueOut: string;
    vout: [{ [addr: string]: string }];
    isRBF: string;
}

class InsightWSHelper extends WebSocketHelper<BCTransactionData>
    implements WSService, OnModuleDestroy {
    protected socket: SocketIOClient.Socket = null;

    constructor(readonly url: string, readonly node: BtcNodeService) {
        super();
    }

    onModuleDestroy() {
        winston.debug('Web3WSHelper onModuleDestroy');
        if (!this.socket) {
            return;
        }
        const s = this.socket;
        this.socket = null;
        s.disconnect();
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        const addresses = new Set(addrs);
        return super
            .observe()
            .pipe(
                map(ax => {
                    winston.debug(
                        'Btc transaction from ' +
                        JSON.stringify(ax.from) +
                        ' to ' +
                        JSON.stringify(ax.to) +
                        ' hash ' +
                        ax.hash
                    );
                    return ax;
                })
            )
            .pipe(
                filter(
                    ax => ax.from.some(x => addresses.has(x)) || ax.to.some(x => addresses.has(x))
                )
            );
    }

    protected connect() {
        this.socket = io(this.url);
        this.socket.nsp = '/';
        // send a transaction
        this.socket.on('error', err => {
            // TODO: Retry.
            winston.error('Insight socket error ' + err);
            this.subject.error(err);
        });
        this.socket.on('connect', () => {
            winston.debug('Insight socket connected');
            this.socket.emit('subscribe', 'inv');
            this.socket.on('tx', (tx: InsightWSTransactionDao) => {
                winston.debug('Insight new transaction received: ' + tx.txid);
                // publish
                this.node
                    .getTransactionData(tx.txid)
                    .pipe(
                        catchError((err, val) => {
                            if ('code' in err && err.code === 404) {
                                winston.debug('Transaction ' + tx.txid + ' not found, skip');
                                // Some times the transaction is too new for our node, just ignore
                                // val.pipe(delay(RETRY_DELAY_MS));
                                return of(null);
                            } else {
                                throw err;
                            }
                        })
                    )
                    .pipe(filter(ax => ax != null))
                    .pipe(
                        map(ax => {
                            winston.debug('GOT TRANSACTION ' + JSON.parse(ax));
                            return ax;
                        })
                    )
                    .subscribe(this.subject);
            });

            /*this.socket.on('block', block => {
                winston.debug('Insight block received: ' + JSON.stringify(block));
                this.indexer.getBlockData(block)
                    .pipe(flatMap(ax => ax.txs))
                    .subscribe(this.subject);
            });
            */
        });
        this.socket.connect();
    }
}

@Injectable()
export class InsighWSService implements WSService, OnModuleInit {
    private ws: InsightWSHelper;
    private url: string;

    constructor(config: BitcoinWsConfig,
                private readonly  node: BtcNodeService) {
        this.url = config;
    }

    onModuleInit() {
        winston.debug('InsighWSService url ' + this.url);
        this.ws = new InsightWSHelper(this.url, this.node);
    }

    onModuleDestroy() {
        this.ws.onModuleDestroy();
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.ws.subscribe(addrs);
    }
}
