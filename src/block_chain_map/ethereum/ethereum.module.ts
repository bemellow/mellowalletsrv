import * as winston from 'winston';
import {HttpModule, DynamicModule, HttpService} from '@nestjs/common';
import {EthereumService} from './ethereum.service';
import {EtherscanIndexerService} from './etherscan.indexer';
import {Web3NodeService} from './web3.node';
import {ConfigService} from '../../config/config.service';
import {EthNodeService, EthWSService, EthContractService} from '../interfaces/node.interface';
import {Web3ContractService} from './web3.contract';
import {EthIndexerService} from '../interfaces/indexer.interface';
import {NktEthIndexerService} from './nkt_eth_indexer';
import {Web3WSService} from './web3.ws';

export interface EthereumNodeConfig {
    type: string;
    url: string;
    ns: {
        address: string;
        pub_resolver: string;
    };
    ignoreChecksums?: boolean;
}

export interface EthereumIndexerConfig {
    type: string;
    url: string;
    apiKey?: string;
}

export interface EthereumWsConfig extends EthereumNodeConfig {
    ws_url: string;
}

export interface EthereumServerConfig {
    ignoreChecksums: boolean;
    node: EthereumNodeConfig;
    indexer: EthereumWsConfig;
}

export class EthereumModule {
    static create(...names: string[]): DynamicModule {
        const providers = [];
        for (const serviceName of names) {
            providers.push({
                provide: serviceName + '_EthereumNodeService',
                useFactory: (config: ConfigService, httpService: HttpService) => {
                    winston.debug('Creating service ' + serviceName + '_EthereumNodeService');
                    const conf: EthereumNodeConfig = config.coin(serviceName, 'servers.node');
                    switch (conf.type) {
                        case 'node':
                            break;
                        case 'infura':
                            break;
                        default:
                            throw new Error('Invalid indexer type ' + conf.type);
                    }
                    return new Web3NodeService(conf, httpService);
                },
                inject: [ConfigService, HttpService]
            });
            providers.push({
                provide: serviceName + '_EthereumIndexerService',
                useFactory: (
                    config: ConfigService,
                    httpService: HttpService
                ) => {
                    winston.debug('Creating service ' + serviceName + '_EthereumIndexerService');
                    const conf: EthereumIndexerConfig = config.coin(serviceName, 'servers.indexer');
                    switch (conf.type) {
                        case 'nkt':
                            return new NktEthIndexerService(conf, httpService);
                        case 'etherscan':
                            return new EtherscanIndexerService(conf, httpService);
                        default:
                            throw new Error('Invalid indexer type ' + conf.type);
                    }
                },
                inject: [ConfigService, HttpService]
            });
            providers.push({
                provide: serviceName + '_EthereumWSService',
                useFactory: (node: EthNodeService, config: ConfigService) => {
                    winston.debug('Creating service ' + serviceName + '_EthereumWSService');
                    const conf = config.coin(serviceName, 'servers.node');
                    switch (conf.type) {
                        case 'node':
                            break;
                        case 'infura':
                            break;
                        default:
                            throw new Error('Invalid indexer type ' + conf.type);
                    }
                    return new Web3WSService(conf, node);
                },
                inject: [serviceName + '_EthereumNodeService', ConfigService]
            });
            providers.push({
                provide: serviceName + '_EthereumContractService',
                useFactory: (node: EthNodeService, ws: EthWSService) => {
                    winston.debug('Creating service ' + serviceName + '_EthereumContractService');
                    // config.coin(name,'servers.node_ws')
                    return new Web3ContractService(node, ws);
                },
                inject: [serviceName + '_EthereumNodeService', serviceName + '_EthereumWSService']
            });
        }
        const services = names.map(serviceName => ({
            provide: serviceName,
            useFactory: (
                config: ConfigService,
                node: EthNodeService,
                indexer: EthIndexerService,
                ws: EthWSService,
                contractService: EthContractService
            ) => {
                winston.debug('Creating service ' + serviceName);
                const conf: EthereumServerConfig = config.coin(serviceName, 'servers');
                return new EthereumService(serviceName, node, indexer, ws, contractService, conf.ignoreChecksums);
            },
            inject: [ConfigService,
                serviceName + '_EthereumNodeService',
                serviceName + '_EthereumIndexerService',
                serviceName + '_EthereumWSService',
                serviceName + '_EthereumContractService'
            ]
        }));
        return {
            module: EthereumModule,
            imports: [HttpModule],
            providers: [...providers, ...services],
            exports: services
        };
    }
}
