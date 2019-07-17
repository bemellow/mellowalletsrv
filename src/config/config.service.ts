import {Injectable} from '@nestjs/common';
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as Joi from 'joi';
import * as fs from 'fs';

class Environment {
    envConfig;

    init(): void {
        const config = dotenv.parse(fs.readFileSync(path.join(process.cwd(), '.env')));
        /**
         * Ensures all needed variables are set, and returns the validated JavaScript object
         * including the applied default values.
         */
        const envVarsSchema: Joi.ObjectSchema = Joi.object({
            NODE_ENV: Joi.string()
                .valid(['development', 'production', 'test', 'provision'])
                .default('development'),
            EXPRESS_PORT: Joi.number().default(3000),
            MOCK_APP: Joi.boolean().default(false),
            NOISY_APP: Joi.boolean().default(false)
        }).unknown(true);

        const {error, value: validatedEnvConfig} = Joi.validate(config, envVarsSchema);
        if (error) {
            throw new Error(`Config validation error: ${error.message}`);
        }
        this.envConfig = validatedEnvConfig;
    }

    get(key: string, optional: boolean | 'optional' = false): string {
        if (key in this.envConfig) {
            return this.envConfig[key];
        }
        if (optional === 'optional' || optional) {
            winston.warn('Enviroment variable ' + key + ' is missing but optional');
            return null;
        }
        throw new Error('Enviroment variable ' + key + ' is missing');
    }
}

@Injectable()
export class ConfigService {
    private readonly appConf: any;
    private readonly appCoins: { [k: string]: any };

    static async load(): Promise<ConfigService> {
        const environment = new Environment();
        environment.init();
        return new ConfigService(environment);
    }

    constructor(private readonly environment: Environment) {
        this.appCoins = {
            'ETH': {
                servers: {
                    node: {
                        type: this.environment.get('ETH_NODE_TYPE'),
                        url: this.environment.get('ETH_NODE_URL'),
                        ws_url: this.environment.get('ETH_NODE_WS_URL'),
                        ns: {
                            address: this.environment.get('ETH_NS_ADDRESS'),
                            pub_resolver: this.environment.get('ETH_NS_PUB_RESOLVER')
                        }
                    },
                    indexer: {
                        type: this.environment.get('ETH_INDEXER_TYPE'),
                        url: this.environment.get('ETH_INDEXER_URL'),
                        apiKey: this.environment.get('ETH_INDEXER_API_KEY', 'optional')
                    }
                }
            },
            'RSK': {
                servers: {
                    ignoreChecksums: true,
                    node: {
                        type: this.environment.get('RSK_NODE_TYPE'),
                        url: this.environment.get('RSK_NODE_URL'),
                        ws_url: this.environment.get('RSK_NODE_WS_URL'),
                        ns: {
                            address: this.environment.get('RSK_NS_ADDRESS'),
                            pub_resolver: this.environment.get('RSK_NS_PUB_RESOLVER')
                        }
                    },
                    indexer: {
                        type: this.environment.get('RSK_INDEXER_TYPE'),
                        url: this.environment.get('RSK_INDEXER_URL'),
                        apiKey: this.environment.get('RSK_INDEXER_API_KEY', 'optional')
                    }
                }
            },
            'BTC': {
                servers: {
                    indexer: {
                        type: this.environment.get('BTC_INDEXER_TYPE'),
                        url: this.environment.get('BTC_INDEXER_URL')
                    },
                    indexer_ws: this.environment.get('BTC_INDEXER_WS_URL'),
                    client: {
                        host: this.environment.get('BTC_NODE_HOST'),
                        port: this.environment.get('BTC_NODE_PORT'),
                        username: this.environment.get('BTC_NODE_USER'),
                        password: this.environment.get('BTC_NODE_PASS'),
                        network: this.environment.get('BTC_NODE_NETWORK')
                    }
                }
            },
            'DAI': {
                network: 'ETH',
                addr: this.environment.get('DAI_TOKEN_ADDRESS'),
                decimals: 18
            },
            'RIF': {
                network: 'RSK',
                addr: this.environment.get('RIF_TOKEN_ADDRESS'),
                decimals: 18
            },
            'ETH-Ropsten': {
                servers: {
                    node: {
                        type: environment.get('ROPSTEN_NODE_TYPE'),
                        url: environment.get('ROPSTEN_NODE_URL'),
                        ws_url: environment.get('ROPSTEN_NODE_WS_URL'),
                        ns: {
                            address: this.environment.get('ROPSTEN_NS_ADDRESS', 'optional'),
                            pub_resolver: this.environment.get('ROPSTEN_PUB_RESOLVER', 'optional')
                        }
                    },
                    indexer: {
                        type: environment.get('ROPSTEN_INDEXER_TYPE'),
                        url: environment.get('ROPSTEN_INDEXER_URL'),
                        apiKey: environment.get('ROPSTEN_INDEXER_API_KEY', 'optional')
                    }
                }
            },
            'RSK-Testnet': {
                servers: {
                    ignoreChecksums: true,
                    node: {
                        type: this.environment.get('RSK_TESTNET_NODE_TYPE'),
                        url: this.environment.get('RSK_TESTNET_NODE_URL'),
                        ws_url: this.environment.get('RSK_TESTNET_NODE_WS_URL'),
                        ns: {
                            address: this.environment.get('RSK_TESTNET_NS_ADDRESS', 'optional'),
                            pub_resolver: this.environment.get('RSK_TESTNET_PUB_RESOLVER', 'optional')
                        }
                    },
                    indexer: {
                        type: environment.get('RSK_TESTNET_INDEXER_TYPE'),
                        url: environment.get('RSK_TESTNET_INDEXER_URL'),
                        apiKey: environment.get('RSK_TESTNET_INDEXER_API_KEY', 'optional')
                    }
                }
            },
            'BTC-Testnet': {
                servers: {
                    indexer: {
                        type: environment.get('BTC_TESTNET_INDEXER_TYPE'),
                        url: environment.get('BTC_TESTNET_INDEXER_URL')
                    },
                    indexer_ws: environment.get('BTC_TESTNET_INDEXER_WS_URL'),
                    client: {
                        host: environment.get('BTC_TESTNET_NODE_HOST'),
                        port: environment.get('BTC_TESTNET_NODE_PORT'),
                        username: environment.get('BTC_TESTNET_NODE_USER'),
                        password: environment.get('BTC_TESTNET_NODE_PASS'),
                        network: environment.get('BTC_TESTNET_NODE_NETWORK')
                    }
                }
            },
            'DAI-Ropsten': {
                network: 'ETH-Ropsten',
                addr: this.environment.get('DAI_ROPSTEN_TOKEN_ADDRESS'),
                decimals: 18
            },
            'RIF-Testnet': {
                network: 'RSK-Testnet',
                addr: this.environment.get('RIF_TESTNET_TOKEN_ADDRESS'),
                decimals: 18
            }
        };
        this.appConf = {
            DEFAULT_TRANSACION_HISTORY_LIMIT: 10,
            MAX_TRANSACTION_HISTORY: 30,
            MAX_GLOBAL_TRANSACTION_HISTORY: 10,
            mock: environment.get('MOCK_APP'),
            noisy: environment.get('NOISY_APP'),
            servers: {
                changely: {
                    url: environment.get('CHANGELY_URL'),
                    apiKey: environment.get('CHANGELY_KEY'),
                    apiSecret: environment.get('CHANGELY_SECRET'),
                    coinToSpecies: {
                        'BTC': {symbol: 'btc', digits: 8},
                        'ETH': {symbol: 'eth', digits: 18},
                        'DAI': {symbol: 'dai', digits: 18},
                        'RIF': {symbol: 'rif', digits: 18},
                        'BTC-Testnet': {symbol: 'btc', digits: 8},
                        'ETH-Ropsten': {symbol: 'eth', digits: 18},
                        'DAI-Ropsten': {symbol: 'dai', digits: 18},
                        'RIF-Testnet': {symbol: 'rif', digits: 18}
                    }
                },
                bitfinex: {
                    url: environment.get('BITFINEX_URL'),
                    cacheRefreshInterval: environment.get('BITFINEX_CACHE_REFRESH', 'optional'),
                    fromSpecies: {
                        'BTC': {symbol: 'btc', digits: 8},
                        'ETH': {symbol: 'eth', digits: 18},
                        'DAI': {symbol: 'dai', digits: 18},
                        'RSK': {symbol: 'btc', digits: 18},
                        'RIF': {symbol: 'rif', digits: 18},
                        'BTC-Testnet': {symbol: 'btc', digits: 8},
                        'ETH-Ropsten': {symbol: 'eth', digits: 18},
                        'DAI-Ropsten': {symbol: 'dai', digits: 18},
                        'RSK-Testnet': {symbol: 'btc', digits: 8},
                        'RIF-Testnet': {symbol: 'rif', digits: 18}
                    },
                    toSpecies: {
                        USD: {symbol: 'usd', digits: 4},
                        EUR: {symbol: 'eur', digits: 4},
                        JPY: {symbol: 'jpy', digits: 4},
                        GBP: {symbol: 'gbp', digits: 4},
                        BTC: {symbol: 'btc', digits: 8},
                        RSK: {symbol: 'btc', digits: 18},
                        ETH: {symbol: 'eth', digits: 18},
                        DAI: {symbol: 'dai', digits: 18},
                        RIF: {symbol: 'rif', digits: 18}
                    }
                },
                coinMarketCap: {
                    url: environment.get('COINMARKETCAP_URL'),
                    apiKey: environment.get('COINMARKETCAP_KEY'),
                    coinToSpecies: {
                        'BTC': {symbol: 'btc', digits: 8},
                        'ETH': {symbol: 'eth', digits: 18},
                        'DAI': {symbol: 'dai', digits: 18},
                        'BTC-Testnet': {symbol: 'btc', digits: 8},
                        'ETH-Ropsten': {symbol: 'eth', digits: 18},
                        'DAI-Ropsten': {symbol: 'dai', digits: 18}
                    }
                }
            }
        };
    }

    // TODO: End up disliking the official config module, this was inherithed
    // from there, need a better implementation on the long run
    get(_path: string): any {
        if (_path.startsWith('app.')) {
            _path = _path.substring(4);
        }
        let current = this.appConf;
        for (const p of _path.split('.')) {
            if (p in current) {
                current = current[p];
            } else {
                throw new Error('Configuration is missing for ' + _path);
            }
        }
        return current;
    }

    coins() {
        return this.appCoins;
    }

    coin(name: string, _path: string) {
        let current = this.appCoins[name];
        for (const p of _path.split('.')) {
            if (p in current) {
                current = current[p];
            } else {
                throw new Error('Coin ' + name + ' is missing ' + _path);
            }
        }
        return current;
    }

    envName() {
        return this.environment.get('NODE_ENV');
    }

    isProduction() {
        return this.envName() === 'production';
    }
}
