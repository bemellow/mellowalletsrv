import * as winston from 'winston';

export type NktTxAddress = string;
export interface NktTxOutput {
    txo_index: string;
    value: string;
    required_spenders: string;
    spent_by: string;
    addresses: NktTxAddress[];
}

export interface NktTxInput {
    txi_index: string;
    value: string;
    addresses: NktTxAddress[];
}

export interface NktBtcTxRecord {
    hash: string;
    whash: string;
    locktime: string;
    block_hash: string;
    block_height: string;
    block_index: string;
    timestamp: string;
    inputs: NktTxInput[];
    outputs: NktTxOutput[];
}

export interface NktUtxo {
    value: string;
    txid: string;
    output_index: string;
    min_sigs: string;
}

export interface NktEthTxRecord {
    hash: string;
    sender: string;
    receiver: string;
    value: string;
    timestamp: string;
    block_hash: string;
    block_height: string;
}
