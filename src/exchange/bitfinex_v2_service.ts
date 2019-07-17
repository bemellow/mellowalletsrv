import * as winston from 'winston';
import {HttpService, Injectable, OnModuleInit} from '@nestjs/common';
import {PriceEstimator, PriceVariation} from '../interfaces/price_estimator.interface';
import {Observable, of, forkJoin, UnaryFunction} from 'rxjs';
import {
    catchError, map,
    publishReplay,
    refCount,
    take,
    tap
} from 'rxjs/operators';
import BigNumber from 'bignumber.js';
import {ConfigService} from '../config/config.service';

export function catchErrorReturnLastVal(): UnaryFunction<Observable<BigNumber>, Observable<BigNumber>> {
    let lastVal = new BigNumber(0);
    return (source: Observable<BigNumber>) => source.pipe(catchError((e) => {
            winston.error('Error connecting to bitfinex ' + e.toString());
            return of(lastVal);
        }),
        tap(x => {
            lastVal = x;
            return x;
        }));
}

@Injectable()
export class BitfinexV2Service implements OnModuleInit, PriceEstimator {
    readonly url: string;
    readonly fromSpecies: { [k: string]: { symbol: string; digits: BigNumber } };
    readonly toSpecies: { [k: string]: { symbol: string; digits: BigNumber } };
    readonly speciesMap: { [k: string]: { op: () => Observable<BigNumber> } } = {};

    // https://blog.thoughtram.io/angular/2018/03/05/advanced-caching-with-rxjs.html#implementing-a-basic-cache
    // TODO: This can be generalized somehow independently of the service that gets
    // the prices.
    private cache: Map<string, Observable<BigNumber>> = new Map();
    private readonly cacheRefreshInterval;

    constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
        this.url = config.get('app.servers.bitfinex.url');
        let cacheInterval = config.get('app.servers.bitfinex.cacheRefreshInterval');
        if (cacheInterval === null) {
            cacheInterval = '60000';
        }
        this.cacheRefreshInterval = parseInt(cacheInterval, 10);
        winston.debug('Bitfinex cache refresh interval ' + cacheInterval + ' ' + this.cacheRefreshInterval);
        const fromCfg: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.bitfinex.fromSpecies'
        );
        this.fromSpecies = Object.keys(fromCfg).reduce((acc, val) => {
            acc[val] = {
                symbol: fromCfg[val].symbol.toUpperCase(),
                digits: new BigNumber(10).exponentiatedBy(fromCfg[val].digits)
            };
            return acc;
        }, {});
        const toCfg: { [k: string]: { symbol: string; digits: number } } = config.get(
            'app.servers.bitfinex.toSpecies'
        );
        this.toSpecies = Object.keys(toCfg).reduce((acc, val) => {
            acc[val] = {
                symbol: toCfg[val].symbol.toUpperCase(),
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
                'tBTCUSD',
                'tLTCUSD',
                'tLTCBTC',
                'tETHUSD',
                'tETHBTC',
                'tETCBTC',
                'tETCUSD',
                'tRRTUSD',
                'tRRTBTC',
                'tZECUSD',
                'tZECBTC',
                'tXMRUSD',
                'tXMRBTC',
                'tDSHUSD',
                'tDSHBTC',
                'tBTCEUR',
                'tBTCJPY',
                'tXRPUSD',
                'tXRPBTC',
                'tIOTUSD',
                'tIOTBTC',
                'tIOTETH',
                'tEOSUSD',
                'tEOSBTC',
                'tEOSETH',
                'tSANUSD',
                'tSANBTC',
                'tSANETH',
                'tOMGUSD',
                'tOMGBTC',
                'tOMGETH',
                'tNEOUSD',
                'tNEOBTC',
                'tNEOETH',
                'tETPUSD',
                'tETPBTC',
                'tETPETH',
                'tQTMUSD',
                'tQTMBTC',
                'tQTMETH',
                'tAVTUSD',
                'tAVTBTC',
                'tAVTETH',
                'tEDOUSD',
                'tEDOBTC',
                'tEDOETH',
                'tBTGUSD',
                'tBTGBTC',
                'tDATUSD',
                'tDATBTC',
                'tDATETH',
                'tQSHUSD',
                'tQSHBTC',
                'tQSHETH',
                'tYYWUSD',
                'tYYWBTC',
                'tYYWETH',
                'tGNTUSD',
                'tGNTBTC',
                'tGNTETH',
                'tSNTUSD',
                'tSNTBTC',
                'tSNTETH',
                'tIOTEUR',
                'tBATUSD',
                'tBATBTC',
                'tBATETH',
                'tMNAUSD',
                'tMNABTC',
                'tMNAETH',
                'tFUNUSD',
                'tFUNBTC',
                'tFUNETH',
                'tZRXUSD',
                'tZRXBTC',
                'tZRXETH',
                'tTNBUSD',
                'tTNBBTC',
                'tTNBETH',
                'tSPKUSD',
                'tSPKBTC',
                'tSPKETH',
                'tTRXUSD',
                'tTRXBTC',
                'tTRXETH',
                'tRCNUSD',
                'tRCNBTC',
                'tRCNETH',
                'tRLCUSD',
                'tRLCBTC',
                'tRLCETH',
                'tAIDUSD',
                'tAIDBTC',
                'tAIDETH',
                'tSNGUSD',
                'tSNGBTC',
                'tSNGETH',
                'tREPUSD',
                'tREPBTC',
                'tREPETH',
                'tELFUSD',
                'tELFBTC',
                'tELFETH',
                'tBTCGBP',
                'tETHEUR',
                'tETHJPY',
                'tETHGBP',
                'tNEOEUR',
                'tNEOJPY',
                'tNEOGBP',
                'tEOSEUR',
                'tEOSJPY',
                'tEOSGBP',
                'tIOTJPY',
                'tIOTGBP',
                'tIOSUSD',
                'tIOSBTC',
                'tIOSETH',
                'tAIOUSD',
                'tAIOBTC',
                'tAIOETH',
                'tREQUSD',
                'tREQBTC',
                'tREQETH',
                'tRDNUSD',
                'tRDNBTC',
                'tRDNETH',
                'tLRCUSD',
                'tLRCBTC',
                'tLRCETH',
                'tWAXUSD',
                'tWAXBTC',
                'tWAXETH',
                'tDAIUSD',
                'tDAIBTC',
                'tDAIETH',
                'tAGIUSD',
                'tAGIBTC',
                'tAGIETH',
                'tBFTUSD',
                'tBFTBTC',
                'tBFTETH',
                'tMTNUSD',
                'tMTNBTC',
                'tMTNETH',
                'tODEUSD',
                'tODEBTC',
                'tODEETH',
                'tANTUSD',
                'tANTBTC',
                'tANTETH',
                'tDTHUSD',
                'tDTHBTC',
                'tDTHETH',
                'tMITUSD',
                'tMITBTC',
                'tMITETH',
                'tSTJUSD',
                'tSTJBTC',
                'tSTJETH',
                'tXLMUSD',
                'tXLMEUR',
                'tXLMJPY',
                'tXLMGBP',
                'tXLMBTC',
                'tXLMETH',
                'tXVGUSD',
                'tXVGEUR',
                'tXVGJPY',
                'tXVGGBP',
                'tXVGBTC',
                'tXVGETH',
                'tBCIUSD',
                'tBCIBTC',
                'tMKRUSD',
                'tMKRBTC',
                'tMKRETH',
                'tKNCUSD',
                'tKNCBTC',
                'tKNCETH',
                'tPOAUSD',
                'tPOABTC',
                'tPOAETH',
                'tLYMUSD',
                'tLYMBTC',
                'tLYMETH',
                'tUTKUSD',
                'tUTKBTC',
                'tUTKETH',
                'tVEEUSD',
                'tVEEBTC',
                'tVEEETH',
                'tDADUSD',
                'tDADBTC',
                'tDADETH',
                'tORSUSD',
                'tORSBTC',
                'tORSETH',
                'tAUCUSD',
                'tAUCBTC',
                'tAUCETH',
                'tPOYUSD',
                'tPOYBTC',
                'tPOYETH',
                'tFSNUSD',
                'tFSNBTC',
                'tFSNETH',
                'tCBTUSD',
                'tCBTBTC',
                'tCBTETH',
                'tZCNUSD',
                'tZCNBTC',
                'tZCNETH',
                'tSENUSD',
                'tSENBTC',
                'tSENETH',
                'tNCAUSD',
                'tNCABTC',
                'tNCAETH',
                'tCNDUSD',
                'tCNDBTC',
                'tCNDETH',
                'tCTXUSD',
                'tCTXBTC',
                'tCTXETH',
                'tPAIUSD',
                'tPAIBTC',
                'tSEEUSD',
                'tSEEBTC',
                'tSEEETH',
                'tESSUSD',
                'tESSBTC',
                'tESSETH',
                'tATMUSD',
                'tATMBTC',
                'tATMETH',
                'tHOTUSD',
                'tHOTBTC',
                'tHOTETH',
                'tDTAUSD',
                'tDTABTC',
                'tDTAETH',
                'tIQXUSD',
                'tIQXBTC',
                'tIQXEOS',
                'tWPRUSD',
                'tWPRBTC',
                'tWPRETH',
                'tZILUSD',
                'tZILBTC',
                'tZILETH',
                'tBNTUSD',
                'tBNTBTC',
                'tBNTETH',
                'tABSUSD',
                'tABSETH',
                'tXRAUSD',
                'tXRAETH',
                'tMANUSD',
                'tMANETH',
                'tBBNUSD',
                'tBBNETH',
                'tNIOUSD',
                'tNIOETH',
                'tDGXUSD',
                'tDGXETH',
                'tVETUSD',
                'tVETBTC',
                'tVETETH',
                'tUTNUSD',
                'tUTNETH',
                'tTKNUSD',
                'tTKNETH',
                'tGOTUSD',
                'tGOTEUR',
                'tGOTETH',
                'tXTZUSD',
                'tXTZBTC',
                'tCNNUSD',
                'tCNNETH',
                'tBOXUSD',
                'tBOXETH',
                'tTRXEUR',
                'tTRXGBP',
                'tTRXJPY',
                'tMGOUSD',
                'tMGOETH',
                'tRTEUSD',
                'tRTEETH',
                'tYGGUSD',
                'tYGGETH',
                'tMLNUSD',
                'tMLNETH',
                'tWTCUSD',
                'tWTCETH',
                'tCSXUSD',
                'tCSXETH',
                'tOMNUSD',
                'tOMNBTC',
                'tINTUSD',
                'tINTETH',
                'tDRNUSD',
                'tDRNETH',
                'tPNKUSD',
                'tPNKETH',
                'tDGBUSD',
                'tDGBBTC',
                'tBSVUSD',
                'tBSVBTC',
                'tBABUSD',
                'tBABBTC',
                'tWLOUSD',
                'tWLOXLM',
                'tVLDUSD',
                'tVLDETH',
                'tENJUSD',
                'tENJETH',
                'tONLUSD',
                'tONLETH',
                'tRBTUSD',
                'tRBTBTC',
                'tUSTUSD',
                'tEUTEUR',
                'tEUTUSD',
                'tGSDUSD',
                'tUDCUSD',
                'tTSDUSD',
                'tPAXUSD',
                'tRIFUSD',
                'tRIFBTC',
                'tPASUSD',
                'tPASETH',
                'tVSYUSD',
                'tVSYBTC',
                'tZRXDAI',
                'tMKRDAI',
                'tOMGDAI',
                'tBTTUSD',
                'tBTTBTC',
                'tBTCUST',
                'tETHUST',
                'tCLOUSD',
                'tCLOBTC',
                'tIMPUSD',
                'tIMPETH',
                'tLTCUST',
                'tEOSUST',
                'tBABUST',
                'tSCRUSD',
                'tSCRETH',
                'tGNOUSD',
                'tGNOETH',
                'tGENUSD',
                'tGENETH',
                'tATOUSD',
                'tATOBTC',
                'tATOETH',
                'tWBTUSD',
                'tXCHUSD',
                'tEUSUSD',
                'tWBTETH',
                'tXCHETH',
                'tEUSETH'
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
                } else if (symbols.indexOf('t' + fromVal + toVal) >= 0) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            this.getExchangeRate('t' + fromVal + toVal).pipe(
                                map(x => x.multipliedBy(digits))
                            )
                    };
                } else if (symbols.indexOf('t' + toVal + fromVal) >= 0) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            this.getExchangeRate('t' + toVal + fromVal).pipe(
                                map(x => digits.dividedBy(x))
                            )
                    };
                } else if (
                    symbols.indexOf('t' + fromVal + 'BTC') >= 0 &&
                    symbols.indexOf('tBTC' + toVal) >= 0
                ) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            forkJoin([
                                this.getExchangeRate('t' + fromVal + 'BTC'),
                                this.getExchangeRate('tBTC' + toVal)
                            ]).pipe(
                                map(cs => {
                                    return cs[0].multipliedBy(cs[1]).multipliedBy(digits);
                                })
                            )
                    };
                } else if (
                    symbols.indexOf('t' + fromVal + 'BTC') >= 0 &&
                    symbols.indexOf('t' + toVal + 'BTC') >= 0
                ) {
                    this.speciesMap[from + to] = {
                        op: () =>
                            forkJoin([
                                this.getExchangeRate('t' + fromVal + 'BTC'),
                                this.getExchangeRate('t' + toVal + 'BTC')
                            ]).pipe(
                                map(cs => {
                                    return cs[0].dividedBy(cs[1]).multipliedBy(digits);
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
        return this.callApi<string[][]>(this.url + '/v2/tickers?symbols=ALL').pipe(
            map(ax => ax.map(x => x[0]).filter(y => y.startsWith('t')))
        );
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
        // get the right names from coin to dollar.
        const species = Object.keys(this.fromSpecies);
        const pairs = species.reduce((acc, coin) => {
            const fromVal: string = this.fromSpecies[coin].symbol;
            const toVal: string = this.toSpecies.USD.symbol;
            const p = 't' + fromVal + toVal;
            const _data: string[] = acc[p] ? acc[p] : [];
            _data.push(coin);
            acc[p] = _data;
            return acc;
        }, {});
        const data: Observable<{ [k: string]: BigNumber }> = this.callPubTickerApi(
            Object.keys(pairs).join(',')
        ).pipe(
            map(ax =>
                ax.reduce((acc, val) => {
                    if (val.length === 11) {
                        for (const x of pairs[val[0]]) {
                            acc[x] = new BigNumber(val[6]);
                        }
                        return acc;
                    }
                    throw new Error('getPriceVariation Error getting price variation ' + ax);
                }, {})
            )
        );
        return data;
    }

    getExchangeRate(search: string): Observable<BigNumber> {
        if (!this.cache.has(search)) {
            // Reuse the last value for X milliseconds.
            // abusing that we know that defer is used.
            const cacheOp = this.getExchangeRateInt(search)
                .pipe(
                    catchErrorReturnLastVal(),
                    publishReplay(1, this.cacheRefreshInterval),
                    refCount()
                );
            // Set up timer that ticks every X milliseconds
            // For each tick make an http request to fetch new data
            /*const cacheOp = timer(0, this.cacheRefreshInterval).pipe(
                switchMap(_ => this.getExchangeRateInt(search)),
                shareReplay(1));*/
            this.cache.set(search, cacheOp);
        }
        return this.cache.get(search).pipe(take(1));
    }

    getExchangeRateInt(search: string): Observable<BigNumber> {
        return this.callPubTickerApi(search).pipe(
            map(ax => {
                if (ax.length === 1 && ax[0].length === 11 && ax[0][0] === search) {
                    return new BigNumber(ax[0][1]);
                }
                throw new Error(
                    'getExchangeRate Error getting currency price ' + JSON.stringify(ax)
                );
            })
        );
    }

    callPubTickerApi(search: string): Observable<string[][]> {
        const url = this.url + '/v2/tickers?symbols=' + search;
        return this.callApi<string[][]>(url);
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
