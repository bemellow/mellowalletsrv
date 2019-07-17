import {of, forkJoin, Observable, throwError, timer} from 'rxjs';
import * as winston from 'winston';
import {finalize, map, mergeMap} from 'rxjs/operators';
import {HttpService} from '@nestjs/common';

export function genericRetryStrategy(maxRetryAttempts: number = 3, scalingDuration: number = 1000, excludedStatusCodes: number[] = []) {
    return (errors: Observable<any>) => errors.pipe(
        mergeMap((error, i) => {
            const retryAttempt = i + 1;
            // if maximum number of retries have been met
            // or response is a status code we don't wish to retry, throw error
            if (retryAttempt > maxRetryAttempts || excludedStatusCodes.find(e => e === error.status)) {
                return throwError(error);
            }
            winston.debug(`Attempt + ${retryAttempt} retrying in ${retryAttempt * scalingDuration} ms`);
            // retry after 1s, 2s, etc...
            return timer(retryAttempt * scalingDuration);
        })
    );
}

// parallel requests
export function parallelRequests<T, R>(
    arrData: T[],
    func: (x: T) => Observable<R>
): Observable<R[]> {
    if (arrData.length === 0) {
        return of([]);
    }
    return forkJoin<R>(...arrData.map(a => func(a)));
}

export function getSortFn(sort: string) {
    let sortFn;
    if (!sort || sort.toLowerCase().startsWith('des')) {
        sort = 'desc';
        sortFn = (a: { timestamp: string }, b: { timestamp: string }) =>
            parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10);
    } else if (sort.toLowerCase().startsWith('asc')) {
        sort = 'asc';
        sortFn = (a: { timestamp: string }, b: { timestamp: string }) =>
            parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10);
    } else {
        throw new Error('invalid sort criteria');
    }
    return [sort, sortFn];
}

export function jsonRPC<T>(httpService: HttpService, url: string, method: string, args: any, headers: any = {'Content-Type': 'application/json'}): Observable<T> {
    const message = JSON.stringify({
        jsonrpc: '2.0',
        id: getRandomId(),
        method,
        params: args
    });
    winston.debug('jsonRPC calling ' + url + ' ' + message);
    return httpService
        .post<{
            jsonrpc: string;
            id: string;
            result: T;
            error?: any;
        }>(url, message, {
            headers
        })
        .pipe(
            map(ax => {
                if (ax.data && ax.data.result !== undefined && ax.data.result !== null) {
                    winston.debug('jsonRPC ret ' + JSON.stringify(ax.data.result));
                    return ax.data.result;
                }
                if ('error' in ax.data && ax.data.error) {
                    if ('message' in ax.data.error && ax.data.error.message) {
                        throw new Error(ax.data.error.message);
                    }
                    throw new Error(ax.data.error);
                }
                throw new Error('Error calling jsonRPC ' + JSON.stringify(ax.data));
            })
        );
}

export function getRandomId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        // tslint:disable-next-line:no-bitwise
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
