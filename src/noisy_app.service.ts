import * as winston from 'winston';
import { Injectable } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { Observable, of, throwError } from 'rxjs';
import { BalanceDto } from './dto/balance.dto';
import { AppService } from './app.service';
import { MockAppService } from './mock_app.service';
import { delay } from 'rxjs/operators';

@Injectable()
export class NoisyAppService {
    constructor(readonly appService: AppService) {
        // tslint:disable-next-line:no-console
        console.log('USING NOISY APP SERVICE!!!!');
        let obj: object = appService;
        obj = Reflect.getPrototypeOf(obj);
        const keys = Reflect.ownKeys(obj);
        for (const k of keys) {
            if (k === 'constructor') {
                continue;
            }
            this[k] = <T>(...args: any[]): Observable<T> => {
                const rand = Math.random();
                if (rand < 0.33) {
                    winston.debug('NOISY APP SERVICE THROW');
                    return throwError('Just testing noisyAppService').pipe(delay(10 * 1000));
                } else {
                    // delegate call to true service
                    const r: Observable<T> = appService[k].apply(appService, args);
                    if (rand < 0.66) {
                        winston.debug('NOISY APP SERVICE DELAY');
                        return r.pipe(delay(30 * 1000));
                    }
                    winston.debug('NOISY APP SERVICE DELEGATE');
                    return r;
                }
            };
        }
    }
}
