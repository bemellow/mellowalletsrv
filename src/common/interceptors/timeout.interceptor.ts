import {Injectable, NestInterceptor, ExecutionContext} from '@nestjs/common';
import {Observable} from 'rxjs';
import {timeout} from 'rxjs/operators';
import {Reflector} from '@nestjs/core';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {

    constructor(private readonly reflector: Reflector) {
    }

    intercept(context: ExecutionContext, call$: Observable<any>): Observable<any> {
        let t = this.reflector.get<number>('timeout', context.getHandler());
        if (!t) {
            // default timeout.
            t = 10 * 60 * 1000;
        }
        return call$.pipe(timeout(t));
    }
}
