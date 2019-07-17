import * as winston from 'winston';
import {Injectable, Inject, OnModuleInit} from '@nestjs/common';
import {BlockChainMapService} from './block_chain_map/block_chain_map.service';
import {Exchange} from './interfaces/exchange.interface';
import {PriceEstimator, PriceVariation} from './interfaces/price_estimator.interface';
import BigNumber from 'bignumber.js';
import {Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';
import {BalanceDto} from './dto/balance.dto';
import {GlobalHistoryDto} from './dto/global_history.dto';
import {TransactionHistory, Fee} from './block_chain_map/interfaces/blockChain.interface';
import {getSortFn, parallelRequests} from './common/helpers';
import {ConfigService} from './config/config.service';
import {RecoveredNetworkDto} from './dto/recovered_network.dto';
import {WalletRecoverService} from './wallet_recover/wallet_recover.service';
import {NetworkPathKeyDto} from './dto/path_key_pair.dto';

@Injectable()
export class AppService implements OnModuleInit {
    constructor(
        private readonly config: ConfigService,
        private readonly bcMap: BlockChainMapService,
        @Inject('Exchange') private readonly exchange: Exchange,
        @Inject('PriceEstimator') private readonly priceEstimator: PriceEstimator,
        private readonly walletRecoverService: WalletRecoverService
    ) {
    }

    async onModuleInit() {
        winston.info('APP RUNNING IN ' + this.config.envName().toUpperCase() + ' mode!!!');
    }

    getExchangeAmount(fromCoin: string, toCoin: string, amount: BigNumber): Observable<BigNumber> {
        return this.exchange.getExchangeAmount(fromCoin, toCoin, amount);
    }

    createTransaction(
        fromCoin: string,
        toCoin: string,
        destAddr: string,
        amount: BigNumber
    ): Observable<string> {
        return this.exchange.createTransaction(fromCoin, toCoin, destAddr, amount);
    }

    getCurrencyPrice(fromCoin: string, toCoin: string): Observable<BigNumber> {
        return this.priceEstimator.getCurrencyPrice(fromCoin, toCoin);
    }

    getPriceVariation(): Observable<PriceVariation> {
        return this.priceEstimator.getPriceVariation();
    }

    resolveName(coin: string, name: string): Observable<string> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.resolveName(name);
    }

    getBalance(coin: string, addresses: string[]): Observable<BigNumber> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.getBalance(addresses);
    }

    getBalances(coin: string, addresses: string[]): Observable<BalanceDto[]> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.getBalances(addresses);
    }

    getFee(coin: string): Observable<Fee> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.getFee();
    }

    getTransferGas(
        coin: string,
        from: string,
        to: string,
        quantity: BigNumber
    ): Observable<BigNumber> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.getTransferGas(from, to, quantity);
    }

    getTransactionParams(coin: string, addrs: string[]): Observable<any> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.getTransactionParams(addrs);
    }

    getTransactionHistory(
        coin: string,
        addrs: string[],
        offset: number,
        limit: number,
        sort: string
    ): Observable<TransactionHistory[]> {
        const bc = this.bcMap.getBlockChain(coin);
        const [sKey, sFn] = getSortFn(sort);
        offset = offset || 0;
        // this is problematic, we can not take a lot of records anyway.
        limit = limit || this.config.get('DEFAULT_TRANSACION_HISTORY_LIMIT');
        const maxRecods = Math.min(limit + offset, this.config.get('MAX_TRANSACTION_HISTORY'));
        const ret: Observable<TransactionHistory[]> = bc.getTransactionHistory(addrs, maxRecods, sKey);
        return ret.pipe(map(a => a.sort(sFn).slice(offset, offset + maxRecods)));
    }

    getGlobalTransactionHistory(data: GlobalHistoryDto): Observable<TransactionHistory[]> {
        const maxRecods = Math.min(data.take, this.config.get('MAX_GLOBAL_TRANSACTION_HISTORY'));
        const [sKey, sFn] = getSortFn('desc');
        return parallelRequests(data.data, d => {
            const bc = this.bcMap.getBlockChain(d.coin);
            return bc.getTransactionHistory(d.addrs, maxRecods, sKey).pipe(
                map(a =>
                    a.map((e: TransactionHistory) => ({
                        coin: d.coin,
                        ...e
                    }))
                )
            );
        })
            .pipe(map(x => [].concat(...x)))
            .pipe(map(a => a.sort(sFn).slice(data.skip, maxRecods)));
    }

    sendRawTransaction(coin: string, buf: string): Observable<string> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.sendRawTransaction(buf);
    }

    recoverWallet(data: NetworkPathKeyDto[]): Observable<RecoveredNetworkDto[]> {
        return this.walletRecoverService.recoverAllWallets(data);
    }
}
