import * as winston from 'winston';
import { Injectable, NestMiddleware, MiddlewareFunction } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    resolve(context: string): MiddlewareFunction {
        return (req, res, next) => {
            winston.debug(`[${context}] Request...`);
            next();
        };
    }
}
