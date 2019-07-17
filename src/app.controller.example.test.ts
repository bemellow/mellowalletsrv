import 'jest';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {Test} from '@nestjs/testing';
import {ChangelyService} from './exchange/changely_service';
import {BlockChainMapModule} from './block_chain_map/block_chain_map.module';
import {ConfigModule} from './config/config.module';
import {BitfinexV2Service} from './exchange/bitfinex_v2_service';
import {ApplicationModule} from './app.module';
import {INestApplication} from '@nestjs/common';
import * as request from 'supertest';

describe('example AppController isolated, no helper null,null,null!!!', () => {
    let appController: AppController;
    let appService: AppService;

    beforeEach(() => {
        appService = new AppService(null, null, null, null, null);
        appController = new AppController(appService);
    });

    describe('getBalance', () => {
        it('an initial example of controller test', async () => {
            const result = [
                {
                    addr: '0x1',
                    quantity: '1'
                },
                {
                    addr: '0x2',
                    quantity: '1'
                }
            ];
            jest.spyOn(appService, 'getBalance').mockImplementation(() => result);
            expect(appController.getBalance('ETC', ['0x1', '0x2'])).toBe(result);
        });
    });
});

describe('example AppController using nest helper', () => {
    let appController: AppController;
    let appService: AppService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            imports: [
                ConfigModule,
                BlockChainMapModule
                // CacheModule.register()
            ],
            controllers: [AppController],
            providers: [
                AppService,
                {
                    provide: 'Exchange',
                    useClass: ChangelyService
                },
                {
                    provide: 'PriceEstimator',
                    useClass: BitfinexV2Service
                }
            ]
        })
            /*.overrideProvider(getModelToken('Auth'))
            .useValue({
                find() {
                    return {};
                }
            })*/
            .compile();

        appService = module.get<AppService>(AppService);
        appController = module.get<AppController>(AppController);
    });

    describe('getBalance', () => {
        it('an initial example of controller test', async () => {
            const result = [
                {
                    addr: '0x1',
                    quantity: '1'
                },
                {
                    addr: '0x2',
                    quantity: '1'
                }
            ];
            jest.spyOn(appService, 'getBalance').mockImplementation(() => result);
            expect(appController.getBalance('ETC', ['0x1', '0x2'])).toBe(result);
        });
    });
});

describe('App', () => {
    let app: INestApplication;
    const appService = {findAll: () => ['test']};

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [ApplicationModule],
        })
            .overrideProvider(AppService)
            .useValue(appService)
            .compile();

        app = module.createNestApplication();
        await app.init();
    });

    it(`/GET cats`, () => {
        return request(app.getHttpServer())
            .get('/cats')
            .expect(200)
            .expect({
                data: appService.findAll(),
            });
    });

    afterAll(async () => {
        await app.close();
    });
});

