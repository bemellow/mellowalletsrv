import {Injectable} from '@nestjs/common';
import {
    TransactionHash,
    TransactionParams,
    TransactionHistory,
    Balance,
    Fee,
    BCTransactionData,
    BCContract,
    BlockChainWithVM
} from '../interfaces/blockChain.interface';
import {Observable} from 'rxjs';
import {EthNodeService, EthContractService, EthWSService} from '../interfaces/node.interface';
import {EthIndexerService} from '../interfaces/indexer.interface';
import {map} from 'rxjs/operators';
import BigNumber from 'bignumber.js';

@Injectable()
export class EthereumService implements BlockChainWithVM {
    constructor(
        private readonly name,
        private readonly node: EthNodeService,
        private readonly indexer: EthIndexerService,
        private readonly ws: EthWSService,
        private readonly contractService: EthContractService,
        private readonly ignoreChecksums: boolean
    ) {
    }

    getName(): string {
        return this.name;
    }

    getInfo(): string {
        return 'Ethereum Blockchain';
    }

    getBalance(addrs: string[]): Observable<BigNumber> {
        return this.node.getBalance(this.removeChecksumFromAddr(addrs));
    }

    getBalances(addrs: string[]): Observable<Balance[]> {
        return this.node.getBalances(this.removeChecksumFromAddr(addrs));
    }

    getFee(): Observable<Fee> {
        return this.node.getFee();
    }

    getTransferGas(): Observable<BigNumber> {
        throw new Error('This block chain doesn\'t support contracts calls');
    }

    getTransactionParams(addrs: string[]): Observable<TransactionParams> {
        return this.node.getTransactionParams(this.removeChecksumFromAddr(addrs));
    }

    checkAddrs(addrs: string[]): Observable<boolean[]> {
        return this.node.getBalances(this.removeChecksumFromAddr(addrs)).pipe(map(ax => ax.map(x => x.quantity !== '0')));
    }

    sendRawTransaction(buf: string): Observable<TransactionHash> {
        return this.node.sendRawTransaction(buf);
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]> {
        return this.indexer.getTransactionHistory(this.removeChecksumFromAddr(addrs), cant, sort);
    }

    getTransactionHistoryForToken(
        contractAddr: string,
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]> {
        return this.indexer.getTransactionHistoryForToken(contractAddr, this.removeChecksumFromAddr(addrs), cant, sort);
    }

    compile(contractAddr: string, contractAbi: any[]): BCContract {
        return this.contractService.compile(contractAddr, contractAbi);
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.ws.subscribe(this.removeChecksumFromAddr(addrs));
    }

    resolveName(name: string): Observable<string> {
        return this.node.resolveName(name);
    }

    removeChecksumFromAddr(addrs: string[]): string[] {
        if (this.ignoreChecksums) {
            return addrs.map(x => x.toLocaleLowerCase());
        }
        return addrs;
    }
}
