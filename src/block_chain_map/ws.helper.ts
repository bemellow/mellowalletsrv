import * as winston from 'winston';
import { Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

export abstract class WebSocketHelper<T> {
    private initialized = false;
    protected subject = new ReplaySubject<T>(100);

    protected abstract connect();
    // TODO: Subject can leak stuff, check, check, check.
    // See if we can user multicast/let r = publish()(this.subject); r.connect()
    observe(): Observable<T> {
        if (!this.initialized) {
            this.connect();
            this.initialized = true;
        }
        return this.subject.asObservable();
    }
}
