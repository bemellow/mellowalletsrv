import * as crypto from 'crypto';
import * as winston from 'winston';
import {HttpService, Injectable, OnModuleInit} from '@nestjs/common';
import BigNumber from 'bignumber.js';
import {Exchange} from '../interfaces/exchange.interface';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ConfigService} from '../config/config.service';
import {getRandomId} from '../common/helpers';

@Injectable()
export class ChangelyService implements OnModuleInit, Exchange {
    readonly url: string;
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly coinToSpecies: { [k: string]: { symbol: string; digits: BigNumber } };

    constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
        this.url = config.get('app.servers.changely.url');
        this.apiKey = config.get('app.servers.changely.apiKey');
        this.apiSecret = config.get('app.servers.changely.apiSecret');
        const cts: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.changely.coinToSpecies'
        );
        this.coinToSpecies = Object.keys(cts).reduce((acc, val) => {
            acc[val] = {
                symbol: cts[val].symbol,
                digits: new BigNumber(10).exponentiatedBy(cts[val].digits)
            };
            return acc;
        }, {});
        winston.debug('Changely species ' + JSON.stringify(this.coinToSpecies));
    }

    async onModuleInit() {
        if (this.config.isProduction()) {
            winston.debug('Changelly module initialization');
            const cs = await this.getCurrencies().toPromise();
            for (const x in this.coinToSpecies) {
                if (cs.indexOf(this.coinToSpecies[x].symbol) < 0) {
                    throw new Error('Error changely don\'t support ' + x);
                }
            }
        }
    }

    isValidCoin(coin: string): boolean {
        return coin in this.coinToSpecies;
    }

    getCurrencies(): Observable<string[]> {
        return this.jsonRPC<string[]>('getCurrencies', {});
    }

    getExchangeAmount(fromCoin: string, toCoin: string, amount: BigNumber): Observable<BigNumber> {
        const to = this.coinToSpecies[toCoin];
        return this.jsonRPC<string>('getExchangeAmount', {
            from: this.coinToSpecies[fromCoin].symbol,
            to: to.symbol,
            amount: amount.toFixed()
        }).pipe(map(s => new BigNumber(s).multipliedBy(to.digits)));
    }

    createTransaction(
        fromCoin: string,
        toCoin: string,
        destAddr: string,
        amount: BigNumber
    ): Observable<string> {
        return this.jsonRPC<{
            id: string;
            apiExtraFee: string;
            changellyFee: string;
            payinExtraId: string;
            amountExpectedFrom: string;
            status: 'new';
            currencyFrom: string;
            currencyTo: string;
            amountTo: string;
            payinAddress: string;
            payoutAddress: string;
            createdAt: string;
            kycRequired: string;
        }>('createTransaction', {
            from: this.coinToSpecies[fromCoin].symbol,
            to: this.coinToSpecies[toCoin].symbol,
            address: destAddr,
            // extraId: null,
            amount: amount.toFixed()
        }).pipe(map(x => x.payinAddress));
    }

    private jsonRPC<T>(method: string, args: any): Observable<T> {
        const message = JSON.stringify({
            jsonrpc: '2.0',
            id: getRandomId(),
            method,
            params: args
        });
        winston.debug('Changelly calling ' + this.url + ' ' + message);
        winston.debug('Changelly keys ' + this.apiKey + ' ' + this.apiSecret);
        return this.httpService
            .post<{
                jsonrpc: string;
                id: string;
                result: T;
            }>(this.url, message, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey,
                    'sign': this.sign(message)
                }
            })
            .pipe(
                map(ax => {
                    if (ax.data && ax.data.result !== undefined && ax.data.result !== null) {
                        winston.debug('Changelly ret ' + JSON.stringify(ax.data.result));
                        return ax.data.result;
                    }
                    throw new Error('Error calling changely ' + JSON.stringify(ax.data));
                })
            );
    }

    private sign(message) {
        return crypto
            .createHmac('sha512', this.apiSecret)
            .update(message)
            .digest('hex');
    }
}
