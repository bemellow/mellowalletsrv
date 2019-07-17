import { BigNumber } from 'bignumber.js';

export abstract class IBalanceGetter {
    abstract get_balances(network: string, addresses: string[]): Promise<BigNumber[]>;
}
