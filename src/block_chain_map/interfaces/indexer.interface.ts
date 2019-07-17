import { Observable } from 'rxjs';
import { TransactionParams, TransactionHistory, Balance, Fee } from './blockChain.interface';
import BigNumber from 'bignumber.js';

export const MAX_INDEXER_TRANSACTIONS = 10000;
export interface IndexerService {
    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]>;
}

export interface UtxoDto {
    address: string;
    satoshis: string;
    txid: string;
    vout: string;
}

export interface BtcFee extends TransactionParams {
    lowFee: string;
    mediumFee: string;
    highFee: string;
}

export interface BtcTransactionParams extends TransactionParams {
    lowFee: string;
    mediumFee: string;
    highFee: string;
    utxos: UtxoDto[];
}

export interface BtcInputOutput {
    address: string;
    value: string; // statoshis
}

export interface BtcTransactionHistory extends TransactionHistory {
    input: BtcInputOutput[];
    output: BtcInputOutput[];
}

export interface EthFee extends Fee {
    gasPrice: string;
}

export interface EthTransactionHistory extends TransactionHistory {
    input: string;
    output: string;
    value: string; // wei
}

export interface BtcIndexerService extends IndexerService {
    getBalance(addrs: string[]): Observable<BigNumber>;
    getBalances(addrs: string[]): Observable<Balance[]>;
    getTransactionParams(addrs: string[]): Observable<BtcTransactionParams>;
    getFee(): Observable<BtcFee>;
}

export interface EthIndexerService extends IndexerService {
    getTransactionHistoryForToken(
        contractAddr: string,
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<any>;
}
