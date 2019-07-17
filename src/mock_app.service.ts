/* tslint:disable:no-console */
import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { Observable, of } from 'rxjs';
import { BalanceDto } from './dto/balance.dto';

@Injectable()
export class MockAppService {
    constructor() {
        console.log('USING MOCK APP SERVICE!!!!');
    }

    getExchangeAmount(fromCoin: string, toCoin: string, amount: BigNumber): Observable<string> {
        console.log('getExchangeAmount ' + fromCoin + ' ' + toCoin + ' ' + amount.toFixed());
        return of('10');
    }

    createTransaction(
        fromCoin: string,
        toCoin: string,
        destAddr: string,
        amount: BigNumber
    ): Observable<string> {
        console.log('createTransaction ' + fromCoin + ' ' + toCoin + ' ' + amount.toFixed());
        return of('10');
    }

    getCurrencyPrice(fromCoin: string, toCoin: string): Observable<string> {
        console.log('getCurrencyPrice ' + fromCoin + ' ' + toCoin);
        return of('10');
    }

    getBalance(coin: string, addresses: string[]): Observable<BalanceDto[]> {
        console.log('getBalance ' + coin + ' ' + addresses);
        return of(
            addresses.map(a => ({
                addr: a,
                quantity: '10'
            }))
        );
    }

    sendRawTransaction(coin: string, buf: string): Observable<boolean> {
        console.log('Send transaction ' + coin + ' ' + buf);
        return of(true);
    }
}
