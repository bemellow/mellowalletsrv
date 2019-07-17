import * as winston from 'winston';
import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { PriceEstimator, PriceVariation } from '../interfaces/price_estimator.interface';
import { Observable, timer, of, forkJoin } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import BigNumber from 'bignumber.js';
import { ConfigService } from '../config/config.service';

interface V2CandlesDto {
    mts: string; // int millisecond time stamp
    open: string; // float First execution during the time frame
    close: string; // float Last execution during the time frame
    high: string; // float Highest execution during the time frame
    log: string; // float Lowest execution during the timeframe
    volume: string; // float Quantity of symbol traded within the timeframe
}

@Injectable()
export class BitfinexV1Service implements OnModuleInit, PriceEstimator {
    readonly url: string;
    readonly fromSpecies: { [k: string]: { symbol: string; digits: BigNumber } };
    readonly toSpecies: { [k: string]: { symbol: string; digits: BigNumber } };
    readonly speciesMap: { [k: string]: { op: () => Observable<BigNumber> } } = {};
    constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
        this.url = config.get('app.servers.bitfinex.url');
        const fromCfg: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.bitfinex.fromSpecies'
        );
        this.fromSpecies = Object.keys(fromCfg).reduce((acc, val) => {
            acc[val] = {
                symbol: fromCfg[val].symbol,
                digits: new BigNumber(10).exponentiatedBy(fromCfg[val].digits)
            };
            return acc;
        }, {});
        const toCfg: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.bitfinex.toSpecies'
        );
        this.toSpecies = Object.keys(toCfg).reduce((acc, val) => {
            acc[val] = {
                symbol: toCfg[val].symbol,
                digits: new BigNumber(10).exponentiatedBy(toCfg[val].digits)
            };
            return acc;
        }, {});
        winston.debug('Bitfinex from species ' + JSON.stringify(this.fromSpecies));
        winston.debug('Bitfinex to species ' + JSON.stringify(this.toSpecies));
    }

    /*
     * Bitfinex api support some pairs like ethbtc but not btceth so we do
     * the calculation.
     */
    async onModuleInit() {
        winston.debug('Bitfinex module initialization, getting symbols');
        let symbols: string[];
        if (this.config.isProduction()) {
            symbols = await this.getSymbols().toPromise();
        } else {
            // This is to avoid the request to bitfinex every restart.
            symbols = [
                'btcusd',
                'ltcusd',
                'ltcbtc',
                'ethusd',
                'ethbtc',
                'etcbtc',
                'etcusd',
                'rrtusd',
                'rrtbtc',
                'zecusd',
                'zecbtc',
                'xmrusd',
                'xmrbtc',
                'dshusd',
                'dshbtc',
                'btceur',
                'btcjpy',
                'xrpusd',
                'xrpbtc',
                'iotusd',
                'iotbtc',
                'ioteth',
                'eosusd',
                'eosbtc',
                'eoseth',
                'sanusd',
                'sanbtc',
                'saneth',
                'omgusd',
                'omgbtc',
                'omgeth',
                'neousd',
                'neobtc',
                'neoeth',
                'etpusd',
                'etpbtc',
                'etpeth',
                'qtmusd',
                'qtmbtc',
                'qtmeth',
                'avtusd',
                'avtbtc',
                'avteth',
                'edousd',
                'edobtc',
                'edoeth',
                'btgusd',
                'btgbtc',
                'datusd',
                'datbtc',
                'dateth',
                'qshusd',
                'qshbtc',
                'qsheth',
                'yywusd',
                'yywbtc',
                'yyweth',
                'gntusd',
                'gntbtc',
                'gnteth',
                'sntusd',
                'sntbtc',
                'snteth',
                'ioteur',
                'batusd',
                'batbtc',
                'bateth',
                'mnausd',
                'mnabtc',
                'mnaeth',
                'funusd',
                'funbtc',
                'funeth',
                'zrxusd',
                'zrxbtc',
                'zrxeth',
                'tnbusd',
                'tnbbtc',
                'tnbeth',
                'spkusd',
                'spkbtc',
                'spketh',
                'trxusd',
                'trxbtc',
                'trxeth',
                'rcnusd',
                'rcnbtc',
                'rcneth',
                'rlcusd',
                'rlcbtc',
                'rlceth',
                'aidusd',
                'aidbtc',
                'aideth',
                'sngusd',
                'sngbtc',
                'sngeth',
                'repusd',
                'repbtc',
                'repeth',
                'elfusd',
                'elfbtc',
                'elfeth',
                'btcgbp',
                'etheur',
                'ethjpy',
                'ethgbp',
                'neoeur',
                'neojpy',
                'neogbp',
                'eoseur',
                'eosjpy',
                'eosgbp',
                'iotjpy',
                'iotgbp',
                'iosusd',
                'iosbtc',
                'ioseth',
                'aiousd',
                'aiobtc',
                'aioeth',
                'requsd',
                'reqbtc',
                'reqeth',
                'rdnusd',
                'rdnbtc',
                'rdneth',
                'lrcusd',
                'lrcbtc',
                'lrceth',
                'waxusd',
                'waxbtc',
                'waxeth',
                'daiusd',
                'daibtc',
                'daieth',
                'cfiusd',
                'cfibtc',
                'cfieth',
                'agiusd',
                'agibtc',
                'agieth',
                'bftusd',
                'bftbtc',
                'bfteth',
                'mtnusd',
                'mtnbtc',
                'mtneth',
                'odeusd',
                'odebtc',
                'odeeth',
                'antusd',
                'antbtc',
                'anteth',
                'dthusd',
                'dthbtc',
                'dtheth',
                'mitusd',
                'mitbtc',
                'miteth',
                'stjusd',
                'stjbtc',
                'stjeth',
                'xlmusd',
                'xlmeur',
                'xlmjpy',
                'xlmgbp',
                'xlmbtc',
                'xlmeth',
                'xvgusd',
                'xvgeur',
                'xvgjpy',
                'xvggbp',
                'xvgbtc',
                'xvgeth',
                'bciusd',
                'bcibtc',
                'mkrusd',
                'mkrbtc',
                'mkreth',
                'kncusd',
                'kncbtc',
                'knceth',
                'poausd',
                'poabtc',
                'poaeth',
                'lymusd',
                'lymbtc',
                'lymeth',
                'utkusd',
                'utkbtc',
                'utketh',
                'veeusd',
                'veebtc',
                'veeeth',
                'dadusd',
                'dadbtc',
                'dadeth',
                'orsusd',
                'orsbtc',
                'orseth',
                'aucusd',
                'aucbtc',
                'auceth',
                'poyusd',
                'poybtc',
                'poyeth',
                'fsnusd',
                'fsnbtc',
                'fsneth',
                'cbtusd',
                'cbtbtc',
                'cbteth',
                'zcnusd',
                'zcnbtc',
                'zcneth',
                'senusd',
                'senbtc',
                'seneth',
                'ncausd',
                'ncabtc',
                'ncaeth',
                'cndusd',
                'cndbtc',
                'cndeth',
                'ctxusd',
                'ctxbtc',
                'ctxeth',
                'paiusd',
                'paibtc',
                'seeusd',
                'seebtc',
                'seeeth',
                'essusd',
                'essbtc',
                'esseth',
                'atmusd',
                'atmbtc',
                'atmeth',
                'hotusd',
                'hotbtc',
                'hoteth',
                'dtausd',
                'dtabtc',
                'dtaeth',
                'iqxusd',
                'iqxbtc',
                'iqxeos',
                'wprusd',
                'wprbtc',
                'wpreth',
                'zilusd',
                'zilbtc',
                'zileth',
                'bntusd',
                'bntbtc',
                'bnteth',
                'absusd',
                'abseth',
                'xrausd',
                'xraeth',
                'manusd',
                'maneth',
                'bbnusd',
                'bbneth',
                'niousd',
                'nioeth',
                'dgxusd',
                'dgxeth',
                'vetusd',
                'vetbtc',
                'veteth',
                'utnusd',
                'utneth',
                'tknusd',
                'tkneth',
                'gotusd',
                'goteur',
                'goteth',
                'xtzusd',
                'xtzbtc',
                'cnnusd',
                'cnneth',
                'boxusd',
                'boxeth',
                'trxeur',
                'trxgbp',
                'trxjpy',
                'mgousd',
                'mgoeth',
                'rteusd',
                'rteeth',
                'yggusd',
                'yggeth',
                'mlnusd',
                'mlneth',
                'wtcusd',
                'wtceth',
                'csxusd',
                'csxeth',
                'omnusd',
                'omnbtc',
                'intusd',
                'inteth',
                'drnusd',
                'drneth',
                'pnkusd',
                'pnketh',
                'dgbusd',
                'dgbbtc',
                'bsvusd',
                'bsvbtc',
                'babusd',
                'babbtc',
                'wlousd',
                'wloxlm',
                'vldusd',
                'vldeth',
                'enjusd',
                'enjeth',
                'onlusd',
                'onleth',
                'rbtusd',
                'rbtbtc',
                'ustusd',
                'euteur',
                'eutusd',
                'gsdusd',
                'udcusd',
                'tsdusd',
                'paxusd'
            ];
        }
        for (const from in this.fromSpecies) {
            if (!this.fromSpecies.hasOwnProperty(from)) continue;
            for (const to in this.toSpecies) {
                if (!this.toSpecies.hasOwnProperty(to)) continue;
                const fromVal: string = this.fromSpecies[from].symbol;
                const toVal: string = this.toSpecies[to].symbol;
                const digits = this.toSpecies[to].digits;
                if (fromVal === toVal) {
                    this.speciesMap[from + to] = {
                        op: () => of(new BigNumber(1))
                    };
                } else if (symbols.indexOf(fromVal + toVal) >= 0) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            this.callPubTickerApi(fromVal + toVal).pipe(
                                map(x => x.multipliedBy(digits))
                            )
                    };
                } else if (symbols.indexOf(toVal + fromVal) >= 0) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            this.callPubTickerApi(fromVal + toVal).pipe(
                                map(x => digits.dividedBy(x))
                            )
                    };
                } else if (
                    symbols.indexOf(fromVal + 'btc') >= 0 &&
                    symbols.indexOf('btc' + toVal) >= 0
                ) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            forkJoin([
                                this.callPubTickerApi(fromVal + 'btc'),
                                this.callPubTickerApi('btc' + toVal)
                            ]).pipe(
                                map(cs => {
                                    return cs[0].multipliedBy(cs[1]).multipliedBy(digits);
                                })
                            )
                    };
                } else {
                    // try to get other combination.
                    throw new Error('Bitfinex ticker is missing pair ' + fromVal + '-' + toVal);
                }
            }
        }
        winston.debug('Bitfinex from species ' + JSON.stringify(this.fromSpecies));
        winston.debug('Bitfinex to species ' + JSON.stringify(this.toSpecies));
        winston.debug('Bitfinex to specieMap ' + JSON.stringify(this.speciesMap));
    }

    isValidCoin(coin: string): boolean {
        return coin in this.toSpecies;
    }

    getSymbols(): Observable<string[]> {
        return this.callApi<string[]>(this.url + '/v1/symbols');
    }

    getCurrencyPrice(fromCoin: string, toCoin: string): Observable<BigNumber> {
        const cp = fromCoin + toCoin;
        if (!(cp in this.speciesMap) || !this.speciesMap[cp]) {
            throw new Error('Invalid coinpair ' + cp);
        }
        const s = this.speciesMap[cp];
        return s.op();
    }

    getPriceVariation(): Observable<PriceVariation> {
        throw new Error('Unimplemented');
    }

    callPubTickerApi(search: string): Observable<BigNumber> {
        const url = this.url + '/v1/pubticker/' + search;
        return this.callApi<{
            mid: string;
            bid: string;
            ask: string;
            last_price: string;
            low: string;
            high: string;
            volume: string;
            timestamp: string;
        }>(url).pipe(
            map(ax => {
                if (ax.last_price) {
                    return new BigNumber(ax.last_price);
                }
                throw new Error('Error getting currency price V1 ' + ax);
            })
        );
    }

    callV2CandlesApi(search: string): Observable<V2CandlesDto> {
        const url = this.url + '/v2/candles/trade:1D:' + search + '/last';
        return this.callApi<V2CandlesDto>(url);
    }

    // TODO: This can be generalized somehow independently of the service that gets
    // the prices.
    private cache: Map<[string, string], Observable<BigNumber>> = new Map();
    private readonly REFRESH_INTERVAL = 1000;
    private readonly CACHE_SIZE = 1;
    // https://blog.thoughtram.io/angular/2018/03/05/advanced-caching-with-rxjs.html#implementing-a-basic-cache
    getCurrencyPriceCached(fromCoin: string, toCoin: string): Observable<BigNumber> {
        const cp: [string, string] = [fromCoin, toCoin];
        if (!this.cache.has(cp)) {
            // Set up timer that ticks every X milliseconds
            const timer$ = timer(0, this.REFRESH_INTERVAL);
            // For each tick make an http request to fetch new data
            this.cache.set(
                cp,
                timer$.pipe(
                    switchMap(_ => this.getCurrencyPrice(fromCoin, toCoin)),
                    shareReplay(this.CACHE_SIZE)
                )
            );
        }
        return this.cache.get(cp);
    }

    private callApi<T>(url: string): Observable<T> {
        winston.debug('Bitfinex calling ' + url);
        return this.httpService.get<T>(url).pipe(
            map(ax => {
                if (ax.data !== undefined && ax.data !== null) {
                    winston.debug(
                        'Bitfinex calling ' + url + ' response ' + JSON.stringify(ax.data)
                    );
                    return ax.data;
                }
                throw new Error(
                    'Bitfinex error calling api ' +
                        ax.status +
                        ' ' +
                        ax.statusText +
                        ' ' +
                        JSON.stringify(ax.data)
                );
            })
        );
    }
}
