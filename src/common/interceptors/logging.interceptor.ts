import * as winston from 'winston';
import { Injectable, NestInterceptor, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, call$: Observable<any>): Observable<any> {
        winston.debug('Before...');
        const now = Date.now();
        // tslint:disable-next-line:no-console
        return call$.pipe(tap(() => console.log(`After... ${Date.now() - now}ms`)));
    }
}
