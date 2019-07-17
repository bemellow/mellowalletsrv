import * as winston from 'winston';
import {
    BlockChain,
    TransactionHash,
    TransactionParams,
    TransactionHistory,
    Fee,
    Balance,
    BCTransactionData,
    BlockChainWithVM,
    BCContract
} from '../interfaces/blockChain.interface';
import * as W3Utils from 'web3-utils';
import {defer, from, Observable, of} from 'rxjs';
import {map, flatMap, shareReplay, concatMap, toArray} from 'rxjs/operators';
import {parallelRequests} from '../../common/helpers';
import BigNumber from 'bignumber.js';

export class ERC20Token implements BlockChain {
    private readonly contract: BCContract;
    private decimals: Observable<BigNumber> = undefined;
    private readonly contractAddr: string;

    constructor(
        readonly name: string,
        private readonly eth: BlockChainWithVM,
        tokenConfig: { addr: string; decimals?: number }
    ) {
        const minABI = [
            // balanceOf
            {
                constant: true,
                inputs: [{name: '_owner', type: 'address'}],
                name: 'balanceOf',
                outputs: [{name: 'balance', type: 'uint256'}],
                type: 'function'
            },
            {
                constant: false,
                inputs: [
                    {
                        name: '_to',
                        type: 'address'
                    },
                    {
                        name: '_value',
                        type: 'uint256'
                    }
                ],
                name: 'transfer',
                outputs: [
                    {
                        name: '',
                        type: 'bool'
                    }
                ],
                payable: false,
                stateMutability: 'nonpayable',
                type: 'function'
            },
            // decimals
            {
                constant: true,
                inputs: [],
                name: 'decimals',
                outputs: [{name: '', type: 'uint8'}],
                type: 'function'
            },
            {
                anonymous: false,
                inputs: [
                    {
                        indexed: true,
                        name: 'from',
                        type: 'address'
                    },
                    {
                        indexed: true,
                        name: 'to',
                        type: 'address'
                    },
                    {
                        indexed: false,
                        name: 'value',
                        type: 'uint256'
                    }
                ],
                name: 'Transfer',
                type: 'event'
            }
        ];
        this.contract = this.eth.compile(tokenConfig.addr, minABI);
        this.contractAddr = tokenConfig.addr;
        if (tokenConfig.decimals) {
            this.decimals = of(new BigNumber(tokenConfig.decimals));
        }
    }

    getName(): string {
        return this.name;
    }

    getInfo(): string {
        return 'Token ' + this.name + ' addr ' + this.contractAddr;
    }

    getBalance(addrs: string[]): Observable<BigNumber> {
        return this.getBalances(addrs).pipe(
            map(a => {
                return a.reduce(
                    (acc, val) => acc.plus(new BigNumber(val.quantity)),
                    new BigNumber(0)
                );
            })
        );
    }

    getBalances(addrs: string[]): Observable<Balance[]> {
        if (!this.decimals) {
            this.decimals = this.contract
                .call(this.contractAddr, 'decimals', [])
                .pipe(map(d => new BigNumber(d)))
                .pipe(shareReplay(1));
        }
        return this.decimals.pipe(
            flatMap(d => parallelRequests(this.eth.removeChecksumFromAddr(addrs), a => this.getBalanceInt(d, a)))
        );
    }

    resolveName(name: string): Observable<string> {
        return this.eth.resolveName(name);
    }

    getFee(): Observable<Fee> {
        return this.eth.getFee();
    }

    getTransferGas(fromAddr: string, toAddr: string, quantity: BigNumber): Observable<BigNumber> {
        const hexq = W3Utils.toHex(quantity.toString(10));
        winston.debug(
            'Trying to get transfer gas limit of ' +
            this.contractAddr +
            ' from ' +
            fromAddr +
            ' to ' +
            toAddr +
            ' value ' +
            hexq
        );
        return this.contract.getTransferGas(this.eth.removeChecksumFromAddr([fromAddr])[0], 'transfer', [this.eth.removeChecksumFromAddr([toAddr])[0], hexq]);
    }

    getTransactionHistory(
        addrs: string[],
        cant: number,
        sort: string
    ): Observable<TransactionHistory[]> {
        return this.eth.getTransactionHistoryForToken(this.contractAddr, addrs, cant, sort);
    }

    private getBalanceInt(decimals: BigNumber, addr: string): Observable<Balance> {
        return this.contract.call(addr, 'balanceOf', [addr]).pipe(
            map(balance => {
                winston.debug('GOT balance of ' + addr + ' ' + balance);
                // let b = new BigNumber(balance);
                // b = b.div(new BigNumber(10).exponentiatedBy(decimals)).toFixed();
                return {
                    addr,
                    quantity: new BigNumber(balance).toFixed(0)
                };
            })
        );
    }

    getTransactionParams(addrs: string[]): Observable<TransactionParams> {
        return this.eth.getTransactionParams(addrs);
    }

    checkAddrs(addrs: string[]): Observable<boolean[]> {
        /* Serializable version in case we have a rate limit in the node.
            const r = from(this.eth.removeChecksumFromAddr(addrs)).pipe(
            concatMap(a => this.getBalanceInt(new BigNumber(0), a)));
        return r.pipe(toArray()).pipe(
            map(ax => ax.map(x => new BigNumber(x.quantity).isGreaterThan(0)))
        );
        */
        return parallelRequests(this.eth.removeChecksumFromAddr(addrs), a => this.getBalanceInt(new BigNumber(0), a)).pipe(
            map(ax => ax.map(x => new BigNumber(x.quantity).isGreaterThan(0)))
        );
    }

    sendRawTransaction(buf: string): Observable<TransactionHash> {
        return this.eth.sendRawTransaction(buf);
    }

    subscribe(addrs: string[]): Observable<BCTransactionData> {
        return this.contract.subscribe(this.eth.removeChecksumFromAddr(addrs));
    }
}
