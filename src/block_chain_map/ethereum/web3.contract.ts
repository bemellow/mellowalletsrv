import * as winston from 'winston';
import { Observable, defer } from 'rxjs';
import { EthNodeService, EthWSService, EthContractService } from '../interfaces/node.interface';
import { WSService, BCTransactionData, BCContract } from '../interfaces/blockChain.interface';
import { Injectable, Inject } from '@nestjs/common';
import Contract from 'web3/eth/contract';
import BigNumber from 'bignumber.js';

export class Web3Contract implements BCContract, WSService {
    private readonly contract: Contract;
    constructor(
        private readonly node: EthNodeService,
        private readonly ws: EthWSService,
        private readonly contractAddr: string,
        private readonly contractAbi: any[]
    ) {
        winston.debug('Connected to contract at: ' + contractAddr);
        this.contract = this.node.compile(contractAddr, contractAbi);
    }

    call(from: string, func: string, args: any[]): Observable<any> {
        return defer(async () => {
            const r = await this.contract.methods[func](...args).call({ from });
            winston.debug(
                'FUNC ' + func + ' ARGS ' + JSON.stringify(args) + ' RET ' + JSON.stringify(r)
            );
            return r;
        });
    }

    getTransferGas(from: string, func: string, args: any[]): Observable<BigNumber> {
        return defer(async () => {
            const r = await this.contract.methods[func](...args).estimateGas({ from });
            winston.debug(
                'FUNC ' + func + ' ARGS ' + JSON.stringify(args) + ' RET ' + JSON.stringify(r)
            );
            return new BigNumber(r);
        });
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.ws.contractSubscribe(this.contractAddr, this.contractAbi, addrs);
    }
}

@Injectable()
export class Web3ContractService implements EthContractService {
    constructor(private readonly node: EthNodeService, private readonly ws: EthWSService) {}

    compile(contractAddr: string, contractAbi: any[]): BCContract {
        return new Web3Contract(this.node, this.ws, contractAddr, contractAbi);
    }
}
