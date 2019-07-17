import { CoinValidator } from './coin_validator.interface';
import { Observable } from 'rxjs';
import BigNumber from 'bignumber.js';

export interface PriceVariation {
    [k: string]: BigNumber;
}

export interface PriceEstimator extends CoinValidator {
    getCurrencyPrice(fromCoin: string, toCoin: string): Observable<BigNumber>;
    getPriceVariation(): Observable<PriceVariation>;
}
