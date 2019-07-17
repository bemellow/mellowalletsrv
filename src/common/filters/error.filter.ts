import * as winston from 'winston';
import {Catch, HttpException, ArgumentsHost, HttpStatus} from '@nestjs/common';
import {AxiosError} from 'axios';
import {WsException} from '@nestjs/websockets';

@Catch()
export class AllExceptionsFilter {
    catch(exception: any, host: ArgumentsHost) {
        const isDev = (process.env.NODE_ENV !== 'production');
        let msg: any = {
            error: true,
            timestamp: new Date().toISOString()
        };
        if (exception instanceof Error) {
            winston.error('ERROR ' + exception.name + ' ' + JSON.stringify(exception.message));
            msg = Object.assign(msg, this.getMessageForError(isDev, exception));
            winston.debug('ERROR ' + JSON.stringify(msg));
            winston.debug('ERROR ' + exception.stack);
        } else if (typeof exception === 'string') {
            if (isDev) {
                msg.detail = exception;
            }
            winston.error('ERROR ' + exception + ' is string, probably need a better one');
            winston.debug('ERROR ' + new Error().stack);
        } else {
            throw new Error(
                'Add the right error handling to AllExceptionsFilter for ' + typeof exception
            );
        }
        // Detect the type of connection (a little bit uggly)
        const args: any[] = host.getArgs();
        if (args.length > 0 && typeof args[0] === 'object') {
            if ('url' in args[0]) {
                msg.path = args[0].url;
            }

            if ('send' in args[0]) {
                const ws: { send: (s: string) => void } = args[0];
                ws.send(JSON.stringify(msg));
                return;
            }
            if (args.length > 1 && typeof args[1] === 'object') {
                if ('status' in args[1]) {
                    const response: { status: (n: number) => any } = args[1];
                    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(msg);
                    return;
                }
            }
        }
        throw new Error('Unsupported host type');
    }

    private getMessageForError(isDev: boolean, exception: Error) {
        const msg: any = {};
        if (isDev) {
            msg.name = exception.name;
            msg.message = exception.message;
        }
        if (exception instanceof WsException) {
        } else if (exception instanceof HttpException) {
            msg.status = exception.getStatus();
            if (isDev) {
                msg.detail = exception.getResponse();
            }
        } else {
            const axErr = exception as AxiosError;
            if (axErr.response && axErr.response.data) {
                const ax: AxiosError = exception as AxiosError;
                winston.debug('AXIOS ERROR ' + ax.code + ' ' + JSON.stringify(ax.response.data));
                msg.status = HttpStatus.INTERNAL_SERVER_ERROR;
                if (isDev) {
                    if (ax.config && ax.config.url) {
                        msg.client_url = ax.config.url;
                    }
                    if (ax.response && ax.response.data) {
                        msg.detail = ax.response.data;
                    }
                }
            }
        }
        return msg;
    }
}
