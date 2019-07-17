import 'reflect-metadata';
import { DynamicModule, Module, Global } from '@nestjs/common';
import { ConfigService } from './config.service';

// Static constants used for swagger ui (controller), still
// need to figure out how to initialize them dynamically.
export const WalletCoins = [
    'ETH-Ropsten',
    'BTC-Testnet',
    'DAI-Ropsten',
    'RSK-Testnet',
    'RIF-Testnet',
    'ETH',
    'BTC',
    'DAI',
    'RSK',
    'RIF'
];
export const TokenCoins = ['DAI-Ropsten', 'RIF-Testnet', 'DAI', 'RIF'];
export const ExchangeCoins = ['USD', 'EUR', 'JPY', 'GBP', 'ETH', 'BTC', 'RSK', 'DAI', 'RIF'];

@Global()
@Module({})
export class ConfigModule {
    static load(): DynamicModule {
        const configProvider = {
            provide: ConfigService,
            useFactory: async (): Promise<ConfigService> => {
                return ConfigService.load();
            }
        };
        return {
            module: ConfigModule,
            providers: [configProvider],
            exports: [configProvider]
        };
    }
}
