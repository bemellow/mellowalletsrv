/* tslint:disable:no-console */
// Use with --forceExit
import {Test} from '@nestjs/testing';
import {HttpModule, HttpService, INestApplication} from '@nestjs/common';
import {ApplicationModule} from './app.module';
import {AppService} from './app.service';
import {ConfigService} from './config/config.service';
import {AppController} from './app.controller';
import BigNumber from 'bignumber.js';
import {GlobalHistoryDto} from './dto/global_history.dto';

const COIN = 'RSK';

describe('AppService e2e testing', () => {

    let app: INestApplication;
    let mainService: AppService;
    let httpService: HttpService;
    let configService: ConfigService;
    let appContoller: AppController;

    beforeAll(async (done) => {
        const module = await Test.createTestingModule({
            imports: [
                ApplicationModule
            ]
        }).overrideProvider(HttpModule)
            .useValue({
                get: () => {
                },
                post: () => {
                }
            })
            .compile();
        mainService = module.get<AppService>(AppService);
        appContoller = module.get<AppController>(AppController);
        app = module.createNestApplication();
        await app.init();
        done();
    });

    afterAll(async (done) => {
        await app.close();
        done();
    });

    /*xtest('getBalance2', (done) => {
        jest.spyOn(httpService, 'get').mockImplementationOnce((url: string, config?: AxiosRequestConfig) => {
            console.error('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', url, config);
            return of({
                data: 'Components',
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
        });

        jest.spyOn(httpService, 'get').mockImplementation((url: string, config?: AxiosRequestConfig) => {
            console.error('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', url, config);
            return of({
                data: 'Components',
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
        });
        jest.spyOn(httpService, 'post').mockImplementation((url: string, config?: AxiosRequestConfig) => {
            console.error('YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY', url, config);
            return of({
                data: 'Components',
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
        });

        mainService
            .getBalance('ETH', ['0x2663fd83a5b7e386608f5172ab96cc4a63291377'])
            .subscribe({
                next: val => {
                    expect(val).toBe({});
                },
                complete: () => done(),
            });
    });*/

    test('getBalance', (done) => {
        appContoller
            .getBalance(COIN, ['0x2663fd83a5b7e386608f5172ab96cc4a63291377'])
            .subscribe({
                next: val => {
                    expect(val).toBe('0');
                },
                complete: () => done(),
            });
    });

    test('getBalances', (done) => {
        appContoller
            .getBalances(COIN, ['0x2663fd83a5b7e386608f5172ab96cc4a63291377'])
            .subscribe({
                next: val => {
                    expect(val).toEqual([{'addr': '0x2663fd83a5b7e386608f5172ab96cc4a63291377', 'quantity': '0'}]);
                },
                complete: () => done(),
            });
    });

    test('getFee', (done) => {
        appContoller
            .getFee(COIN)
            .subscribe({
                next: val => {
                    expect(val).toEqual(expect.objectContaining({
                        'gasPrice': expect.stringMatching('[0-9]+')
                    }));
                },
                complete: () => done(),
            });
    });

    test('getTransferGas', (done) => {
        appContoller
            .getTransferGas('RIF', '0x2663fd83a5b7e386608f5172ab96cc4a63291377',
                '0x2663fd83a5b7e386608f5172ab96cc4a63291277', new BigNumber(1))
            .subscribe({
                next: val => {
                    expect(val).toBe('25212');
                },
                complete: () => done(),
            });
    });

    /*test('sendRawTransaction', (done) => {
        appContoller
            .sendRawTransaction(COIN, {'tx': 'f8a780808530784e614e94d8c5adcac8d465c5a2d0772b86788e014ddec51680b844a9059cbb0000000000000000000000002663fd83a5b7e386608f5172ab96cc4a632913770000000000000000000000000000000000000000000000008ac39585e521800062a0b6116b531fd74b3f7a3700dbd1d13391de2ec49622cd5ec7a61d5af7cc39a330a074a95d828b86dabedc346e0bf1b317671856917057ea979705e700125ea49d56'})
            .subscribe({
                next: val => {
                    expect(val).toBe('0');
                },
                complete: () => done(),
            });
    });
    */
    test('getCurrencyPrice', (done) => {
        appContoller
            .getCurrencyPrice(COIN, 'USD')
            .subscribe({
                next: val => {
                    expect(val).toEqual(expect.stringMatching('[0-9]+'));
                },
                complete: () => done(),
            });
    });

    test('getPriceVariation', (done) => {
        appContoller
            .getPriceVariation()
            .subscribe({
                next: val => {
                    expect(val).toEqual(expect.objectContaining({
                            'BTC': expect.any(String),
                            'BTC-Testnet': expect.any(String),
                            'DAI': expect.any(String),
                            'DAI-Ropsten': expect.any(String),
                            'ETH': expect.any(String),
                            'ETH-Ropsten': expect.any(String),
                            'RIF': expect.any(String),
                            'RIF-Testnet': expect.any(String),
                            'RSK': expect.any(String),
                            'RSK-Testnet': expect.any(String)
                        }
                    ));
                },
                complete: () => done()
            });
    });

    /*test('exchangeEstimationForm', (done) => {
        appContoller
            .exchangeEstimationForm(COIN, 'USD', new BigNumber(100))
            .subscribe({
                next: val => {
                    expect(val).toBe('0');
                },
                complete: () => done(),
            });
    });

    test('doExchange', (done) => {
        appContoller
            .doExchange(COIN)
            .subscribe({
                next: val => {
                    expect(val).toBe('0');
                },
                complete: () => done(),
            });
    });
    */

    test('resolveName', (done) => {
        appContoller
            .resolveName(COIN, 'martinp.rsk')
            .subscribe({
                next: val => {
                    expect(val).toBe('0x0000000000000000000000000000000000000000');
                },
                complete: () => done(),
            });
    });

    test('getTransactionParams', (done) => {
        appContoller
            .getTransactionParams(COIN, ['0x2663fd83a5b7e386608f5172ab96cc4a63291377'])
            .subscribe({
                next: val => {
                    expect(val).toEqual(expect.objectContaining({
                        'gasPrice': expect.stringMatching('[0-9]+'),
                        'nonces': [{'addr': expect.any(String), 'nonce': 0}]
                    }));
                },
                complete: () => done(),
            });
    });
    test('getTransactionHistory', (done) => {
        appContoller
            .getTransactionHistory(COIN, ['0x2663fd83a5b7e386608f5172ab96cc4a63291377'], 0, 100, 'asc')
            .subscribe({
                next: val => {
                    expect(val).toEqual([]);
                },
                complete: () => done(),
            });
    });
    test('getGlobalTransactionHistory', (done) => {
        let data: GlobalHistoryDto = {
            skip: 0,
            take: 10,
            data: [{
                coin: COIN,
                addrs: ['0x2663fd83a5b7e386608f5172ab96cc4a63291377']
            }]
        };
        appContoller
            .getGlobalTransactionHistory(data)
            .subscribe({
                next: val => {
                    expect(val).toEqual([]);
                },
                complete: () => done(),
            });
    });

    test('recoverWallet', (done) => {
        appContoller
            .recoverWallet({
                'data': [
                    {
                        'network': 'RSK-Testnet',
                        'node': {
                            'path': 'm/44\'/37310\'/0\'',
                            'public_key': '{"puk":"034943cdea13560a310bf7c433ab6000851535cd7380ea749c02b51abb8134e17d","cc":"2cc3d2599967b6917392135cb0447a5354c5d4f8921237e1b7518da3aba5b939"}'
                        }
                    }
                ]
            })
            .subscribe({
                next: val => {
                    expect(val).toEqual([{
                        'network': 'RSK-Testnet',
                        'wallets': [{'subwallet_index': 0, 'used_addresses': [0]}]
                    }]);
                },
                complete: () => done(),
            });
    });

});
