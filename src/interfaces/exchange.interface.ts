import BigNumber from 'bignumber.js';
import { CoinValidator } from './coin_validator.interface';
import { Observable } from 'rxjs';

export interface Exchange extends CoinValidator {
    getExchangeAmount(fromCoin: string, toCoin: string, amount: BigNumber): Observable<BigNumber>;

    createTransaction(
        fromCoin: string,
        toCoin: string,
        destAddr: string,
        amount: BigNumber
    ): Observable<string>;
}
