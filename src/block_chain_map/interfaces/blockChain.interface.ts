import {Observable} from 'rxjs';
import BigNumber from 'bignumber.js';

export interface Balance {
    readonly addr: string;
    readonly quantity: string;
}

export interface BCTransactionData {
    readonly from: string[];
    readonly to: string[];
    readonly hash: string;
}

export interface BCBlockData {
    txs: BCTransactionData[];
}

export interface Fee {
}

export type TransactionHash = string;

export interface TransactionParams {
}

export interface TransactionHistory {
    txId: string;
    blockHash: string;
    blockNumber: string;
    timestamp: string;
}

export interface GlobalTransactionHistory extends TransactionHistory {
    coin: string;
}

export interface WSService {
    subscribe(addrs: string[]): Observable<BCTransactionData>;
}

export interface BlockChain extends WSService {
    getName(): string;

    getInfo(): string;

    getBalance(addrs: string[]): Observable<BigNumber>;

    resolveName(name: string): Observable<string>;

    getBalances(addrs: string[]): Observable<Balance[]>;

    getFee(): Observable<Fee>;

    getTransferGas(from: string, to: string, quantity: BigNumber): Observable<BigNumber>;

    getTransactionParams(addrs: string[]): Observable<TransactionParams>;

    checkAddrs(addrs: string[]): Observable<boolean[]>;

    sendRawTransaction(buf: string): Observable<TransactionHash>;

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]>;
}

export interface BCContract extends WSService {
    call(from: string, func: string, args: any[]): Observable<any>;

    getTransferGas(from: string, func: string, args: any[]): Observable<BigNumber>;
}

export interface BlockChainWithVM extends BlockChain {
    removeChecksumFromAddr(addrs: string[]): string[];

    compile(contractAddr: string, contractAbi: any[]): BCContract;

    getTransactionHistoryForToken(
        contractAddr: string,
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]>;
}
