import * as request from 'supertest';
import {Test} from '@nestjs/testing';
import {INestApplication} from '@nestjs/common';
import {ApplicationModule} from '../src/app.module';
import {AppService} from '../src/app.service';

xdescribe('Example, app testing', () => {
    let app: INestApplication;
    const appService = {getBalance: (coin: string, addresses: string[]) => ['test']};

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

    it(`GET /getBalance?addresses=0x21&coin=ETH`, () => {
        return request(app.getHttpServer())
            .get('/getBalance?addresses=0x21&coin=ETH')
            .expect(200)
            // .expect('Content-Type', /json/)
            // .expect('Content-Length', '15')
            .expect(appService.getBalance('ETH', ['0x21']));

    });

    afterAll(async () => {
        await app.close();
    });
});
