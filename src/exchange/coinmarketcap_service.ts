import * as winston from 'winston';
import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { PriceEstimator, PriceVariation } from '../interfaces/price_estimator.interface';
import { Observable, timer, of } from 'rxjs';
import { map, switchMap, shareReplay } from 'rxjs/operators';
import BigNumber from 'bignumber.js';
import { ConfigService } from '../config/config.service';

interface CoinMarketCapSymbolDTO {
    status: {
        timestamp: string;
        error_code: string;
        error_message: string;
        elapsed: string;
        credit_count: string;
    };
    data: {
        id: string;
        name: string;
        symbol: string;
        slug: string;
        circulating_supply: string;
        total_supply: string;
        max_supply: string;
        date_added: string;
        num_market_pairs: string;
        tags: string[];
        platform: string;
        cmc_rank: string;
        last_updated: string;
        quote: {
            [k: string]: {
                price: string;
                volume_24h: string;
                percent_change_1h: string;
                percent_change_24h: string;
                percent_change_7d: string;
                market_cap: string;
                last_updated: string;
            };
        };
    }[];
}

// Coinmarket cap fails with the sanbox and I don't want to pay just to test it!!!!
@Injectable()
export class CoinMarketCapService implements OnModuleInit, PriceEstimator {
    readonly url: string;
    readonly apiKey: string;
    readonly coinToSpecies: { [k: string]: { symbol: string; digits: BigNumber } };
    readonly speciesMap: Map<
        string,
        { search: string; op: (x: BigNumber) => BigNumber }
    > = new Map();
    constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
        this.url = config.get('app.servers.coinMarketCap.url');
        this.apiKey = config.get('app.servers.coinMarketCap.apiKey');
        winston.debug('CoinMarketCap apiKey ' + this.apiKey);
        const cts: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.coinMarketCap.coinToSpecies'
        );
        this.coinToSpecies = Object.keys(cts).reduce((acc, val) => {
            acc[val] = {
                symbol: cts[val].symbol,
                digits: new BigNumber(10).exponentiatedBy(cts[val].digits)
            };
            return acc;
        }, {});
        winston.debug('CoinMarketCap species ' + JSON.stringify(this.coinToSpecies));
    }

    /*
     * Bitfinex api support some pairs like ethbtc but not btceth so we do
     * the calculation.
     */
    async onModuleInit() {
        winston.debug('CoinMarketCap module initialization, getting symbols');
        let symbols: string[];
        // if (this.config.isProduction()) {
        symbols = await this.getSymbols().toPromise();
        winston.debug(symbols);
        // } else {
        // This is to avoid the request to bitfinex every restart.
        // symbols = [];
        // }
        for (const x in this.coinToSpecies) {
            if (!this.coinToSpecies.hasOwnProperty(x)) continue;
            for (const y in this.coinToSpecies) {
                if (!this.coinToSpecies.hasOwnProperty(y)) continue;
                const xv: string = this.coinToSpecies[x].symbol;
                const yv: string = this.coinToSpecies[y].symbol;
                const digits = this.coinToSpecies[y].digits;
                if (xv === yv) {
                    this.speciesMap.set(x + y, {
                        search: undefined,
                        op: _x => new BigNumber(1)
                    });
                } else if (symbols.indexOf(xv + yv) >= 0) {
                    this.speciesMap.set(x + y, {
                        search: xv + yv,
                        op: _x => _x.multipliedBy(digits)
                    });
                } else if (symbols.indexOf(yv + xv) >= 0) {
                    this.speciesMap.set(x + y, {
                        search: yv + xv,
                        op: _x => digits.dividedBy(new BigNumber(_x))
                    });
                } else {
                    throw new Error('CoinMarketCap ticker is missing pair ' + [xv, yv]);
                }
            }
        }
    }

    isValidCoin(coin: string): boolean {
        return coin in this.coinToSpecies;
    }

    getSymbols(): Observable<string[]> {
        // This doesn't give pairs but coins.
        const works = '/cryptocurrency/listings/latest';
        /*let fails1_403 = '/cryptocurrency/market-pairs/latest';
        let fails2_403 = '/exchange/info';*/
        const uri = works;
        return this.callApi<CoinMarketCapSymbolDTO>(this.url + uri, {}).pipe(
            map(a => a.data.map(d => d.symbol))
        );
    }

    getCurrencyPrice(fromCoin: string, toCoin: string): Observable<BigNumber> {
        throw new Error('Unimplemented');
    }

    getPriceVariation(): Observable<PriceVariation> {
        throw new Error('Unimplemented');
    }
    private callApi<T>(url: string, params: { [k: string]: string }) {
        winston.debug('CoinMarketCap calling ' + url);
        return this.httpService
            .get<T>(url, {
                params,
                headers: {
                    'X-CMC_PRO_API_KEY': this.apiKey
                }
            })
            .pipe(
                map(ax => {
                    if (ax.data != null ) {
                        winston.debug('CoinMarketCap response ' + JSON.stringify(ax.data));
                        return ax.data;
                    }
                    throw new Error('CoinMarketCap error calling api ' + ax);
                })
            );
    }
}
