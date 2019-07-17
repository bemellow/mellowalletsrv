import * as winston from 'winston';
import {HttpModule, DynamicModule, HttpService} from '@nestjs/common';
import {BitcoinService} from './bitcoin.service';
import {InsighService} from './insight';
import {BitcoinCoreNodeService} from './bitcoin-core.node';
import {InsighWSService} from './insight.ws';
import {NodeService, BtcNodeService} from '../interfaces/node.interface';
import {BtcIndexerService} from '../interfaces/indexer.interface';
import {WSService} from '../interfaces/blockChain.interface';
import {ConfigService} from '../../config/config.service';
import {ConfigModule} from '../../config/config.module';
import {NktBtcIndexerService} from './nkt_btc_indexer';
import {BlockchainInfoIndexerService} from './blockchain_info';

export interface BitcoinNodeConfig {
}

export interface BitcoinIndexerConfig {
    type: string;
    url: string;
    apiKey?: string;
}

export type BitcoinWsConfig = string;

export class BitcoinModule {
    static create(...names: string[]): DynamicModule {
        const providers = [];
        for (const serviceName of names) {
            providers.push({
                provide: serviceName + '_BitcoinNodeService',
                useFactory: (config: ConfigService) => {
                    winston.debug('Creating service ' + serviceName + '_BitcoinNodeService');
                    const clientConfig = config.coin(serviceName, 'servers.client');
                    return new BitcoinCoreNodeService(clientConfig);
                },
                inject: ['ConfigService']
            });
            providers.push({
                provide: serviceName + '_BitcoinIndexerService',
                useFactory: (
                    node: BtcNodeService,
                    httpService: HttpService,
                    config: ConfigService
                ) => {
                    winston.debug('Creating service ' + serviceName + '_BitcoinIndexerService');
                    const conf: BitcoinIndexerConfig = config.coin(serviceName, 'servers.indexer');
                    switch (conf.type) {
                        case 'nkt':
                            return new NktBtcIndexerService(serviceName, conf, httpService);
                        case 'blockchain_info':
                            return new BlockchainInfoIndexerService(conf, httpService);
                        case 'insight':
                            return new InsighService(conf, httpService);
                        default:
                            throw new Error('Invalid indexer type ' + conf.type);
                    }
                },
                inject: [serviceName + '_BitcoinNodeService', HttpService, ConfigService]
            });
            providers.push({
                provide: serviceName + '_BitcoinWSService',
                useFactory: (config: ConfigService, node: BtcNodeService) => {
                    winston.debug('Creating service ' + serviceName + '_BitcoinWSService');
                    const conf: BitcoinWsConfig = config.coin(serviceName, 'servers.indexer_ws');
                    return new InsighWSService(conf, node);
                },
                inject: [ConfigService, serviceName + '_BitcoinNodeService']
            });
        }
        const services = names.map(serviceName => ({
            provide: serviceName,
            useFactory: (node: NodeService, indexer: BtcIndexerService, ws: WSService) => {
                winston.debug('Creating service ' + serviceName);
                return new BitcoinService(serviceName, node, indexer, ws);
            },
            inject: [
                serviceName + '_BitcoinNodeService',
                serviceName + '_BitcoinIndexerService',
                serviceName + '_BitcoinWSService'
            ]
        }));
        return {
            module: BitcoinModule,
            imports: [HttpModule, ConfigModule],
            providers: [...providers, ...services],
            exports: services
        };
    }
}
