import { Injectable, NotImplementedException } from '@nestjs/common';
import {
    BlockChain,
    TransactionHash,
    TransactionParams,
    TransactionHistory,
    Balance,
    Fee,
    WSService,
    BCTransactionData
} from '../interfaces/blockChain.interface';
import { Observable } from 'rxjs';
import { NodeService } from '../interfaces/node.interface';
import { BtcIndexerService } from '../interfaces/indexer.interface';
import { map } from 'rxjs/operators';
import BigNumber from 'bignumber.js';

@Injectable()
export class BitcoinService implements BlockChain {
    constructor(
        private readonly name,
        private readonly node: NodeService,
        private readonly indexer: BtcIndexerService,
        private readonly ws: WSService
    ) {}

    getName(): string {
        return this.name;
    }

    getInfo(): string {
        return 'Bitcoin Blockchain';
    }

    getBalance(addrs: string[]): Observable<BigNumber> {
        // return await this.node.getBalance(addr);
        return this.indexer.getBalance(addrs);
    }

    getBalances(addrs: string[]): Observable<Balance[]> {
        return this.indexer.getBalances(addrs);
    }

    getFee(): Observable<Fee> {
        return this.indexer.getFee();
    }

    getTransferGas(): Observable<BigNumber> {
        throw new Error('This block chain doesn\'t support contracts calls');
    }

    getTransactionParams(addrs: string[]): Observable<TransactionParams> {
        return this.indexer.getTransactionParams(addrs);
    }

    checkAddrs(addrs: string[]): Observable<boolean[]> {
        // This uses utxo, so an address that has balance in the past but right
        // now doesn't have any is considered unused by recoverWallet.
        return this.indexer.getTransactionParams(addrs).pipe(
            map(ax => {
                const m = ax.utxos.reduce((acc: { [k: string]: boolean }, val) => {
                    acc[val.address] = true;
                    return acc;
                }, {});
                return addrs.map(_ax => m[_ax]);
            })
        );
    }

    sendRawTransaction(buf: string): Observable<TransactionHash> {
        return this.node.sendRawTransaction(buf);
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]> {
        return this.indexer.getTransactionHistory(addrs, cant, sort);
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.ws.subscribe(addrs);
    }

    resolveName(name: string): Observable<string> {
        throw new NotImplementedException('Name resolution not enabled in bitcoin');
    }
}
