import * as path from 'path';
import { Module, HttpModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { BlockChainMapModule } from './block_chain_map/block_chain_map.module';
import { ChangelyService } from './exchange/changely_service';
import { MockAppService } from './mock_app.service';
import { AppService } from './app.service';
import { BlockChainMapService } from './block_chain_map/block_chain_map.service';
import { PriceEstimator } from './interfaces/price_estimator.interface';
import { Exchange } from './interfaces/exchange.interface';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/error.filter';
import { ConfigService } from './config/config.service';
import { ConfigModule } from './config/config.module';
import { NoisyAppService } from './noisy_app.service';
import { WSModule } from './websocket/ws.module';
import { BitfinexV2Service } from './exchange/bitfinex_v2_service';
import { WalletRecoverService } from './wallet_recover/wallet_recover.service';
import { WalletRecoverModule } from './wallet_recover/wallet_recover.module';

const exchangeServiceProvider = {
    provide: 'Exchange',
    useClass: ChangelyService
};

const priceEstimatorServiceProvider = {
    provide: 'PriceEstimator',
    useClass: BitfinexV2Service
    // useClass: CoinMarketCapService
};

const appServiceProvider = {
    provide: 'AppService',
    useFactory: (
        config: ConfigService,
        bcMap: BlockChainMapService,
        ex: Exchange,
        pe: PriceEstimator,
        wr: WalletRecoverService
    ) => {
        if (config.get('app.mock')) {
            return new MockAppService();
        } else if (config.get('app.noisy')) {
            return new NoisyAppService(new AppService(config, bcMap, ex, pe, wr));
        }
        return new AppService(config, bcMap, ex, pe, wr);
    },
    inject: [
        ConfigService,
        BlockChainMapService,
        'Exchange',
        'PriceEstimator',
        WalletRecoverService
    ]
};

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 2
        }),
        ConfigModule.load(),
        BlockChainMapModule,
        WSModule,
        WalletRecoverModule
        // CacheModule.register()
    ],
    controllers: [AppController],

    providers: [
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter
        },
        appServiceProvider,
        exchangeServiceProvider,
        priceEstimatorServiceProvider
    ]
})
export class ApplicationModule {}
