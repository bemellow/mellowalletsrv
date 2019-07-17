import { Observable } from 'rxjs';
import {
    TransactionHash,
    TransactionParams,
    WSService,
    BCTransactionData,
    BCBlockData,
    BCContract,
    Balance
} from './blockChain.interface';
import { EthFee } from './indexer.interface';
import { Log } from 'web3/types';
import BigNumber from 'bignumber.js';

export interface NodeService {
    sendRawTransaction(buf: string): Observable<TransactionHash>;
    getTransactionData(txHash: string): Observable<BCTransactionData>;
}

export interface BtcNodeService extends NodeService {
    getBlockData(blockHash: string): Observable<BCBlockData>;
}

export interface NonceDto {
    addr: string;
    nonce: number;
}
export interface EthTransactionParams extends TransactionParams {
    gasPrice: string;
    nonces: NonceDto[];
}

export interface EthContractService {
    compile(contractAddr: string, contractAbi: any[]): BCContract;
}

export interface EthWSService extends WSService {
    contractSubscribe(
        contractAddr: string,
        contractAbi: any[],
        addrs: string[]
    ): Observable<BCTransactionData>;
}

export interface EthNodeService extends NodeService {
    resolveName(name: string): Observable<string>;
    getBalance(addrs: string[]): Observable<BigNumber>;
    getBalances(addrs: string[]): Observable<Balance[]>;
    getTransactionParams(addrs: string[]): Observable<EthTransactionParams>;
    getFee(): Observable<EthFee>;
    compile(contractAddr: string, contractAbi: any[]): any;
}
