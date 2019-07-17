import {NestFactory} from '@nestjs/core';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';
import {ApplicationModule} from './app.module';
import {join} from 'path';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as rateLimit from 'express-rate-limit';
import * as winston from 'winston';
import {LoggerService, Logger} from '@nestjs/common';
import {WsAdapter} from '@nestjs/websockets';
import {ConsoleTransportInstance} from 'winston/lib/winston/transports';

class MyLogger extends Logger implements LoggerService {
    log(message: any, context?: string): any {
        winston.debug(message);
    }

    error(message: any, trace?: string, context?: string): any {
        winston.error(message);
    }

    warn(message: any, context?: string): any {
        winston.warn(message);
    }
}

async function bootstrap() {
    const isDev = (process.env.NODE_ENV === 'development');

    const app = await NestFactory.create(ApplicationModule, {
        logger: new MyLogger()
    });

    /*const app = await NestFactory.create(ApplicationModule, {
        logger: false,
    });
    app.useLogger(app.get(Logger));*/

    // Add prefix
    // app.setGlobalPrefix(basePath);
    app.use(helmet());
    // Enable CORS
    app.enableCors();
    /*if (!isDev) {
        app.use(
            rateLimit({
                windowMs: 60 * 1000, // 1 minutes
                max: 1000 // limit each IP to 100 requests per windowMs
            })
        );
    }*/
    app.use(morgan('dev'));
    const public_dir = join(__dirname, 'public');
    winston.debug('USING PUBLIC DIR ' + public_dir);
    if (isDev) {
        app.useStaticAssets(public_dir);
    }
    app.useWebSocketAdapter(new WsAdapter(app));

    // better done by module.
    // app.useGlobalFilters(new ErrorFilter());

    if (isDev) {
        const options = new DocumentBuilder()
            .setTitle('Wallet SRV')
            .setDescription('Wallet backend server')
            .setVersion('1.0')
            // .addTag('walletsrv')
            // .addBearerAuth('Authorization', 'header')
            // .setBasePath(basePath)
            .build();
        const document = SwaggerModule.createDocument(app, options);
        SwaggerModule.setup('/walletsrv/v1', app, document);
    }
    const port = parseInt(process.env.EXPRESS_PORT, 10) || 5001;
    let host;
    if (!isDev) {
        host = '127.0.0.1';
    }
    winston.info('Server listening on port ' + port + (host ? ' host ' + host : ''));
    const server = await app.listen(port, host);
    // wait "forever", there is a timeout inside the nestjs app.
    server.setTimeout(24 * 60 * 60 * 1000);
}

function configLogger() {
    const options = {
        level: 'debug',
        format: winston.format.json(),
        transports: []
        // new winston.transports.File({filename: 'error.log', level: 'error'}),
    };

    if (process.env.DISABLE_LOG !== 'true') {
        options.transports.push(
            new winston.transports.Console({
                // format: winston.format.simple(),
                // winston.format.json()
                format: winston.format.combine(
                    winston.format.timestamp({
                        format: 'YYYY-MM-DD hh:mm:ss.ms'
                    }),
                    winston.format.colorize(),
                    winston.format.printf(info => {
                        const {message, level, timestamp, ...rest} = info;
                        return `${timestamp} ${level}: ${message}  ${rest === {} ? JSON.stringify(rest) : ''}`;
                    })
                )
            })
        );
    } else {
        options.transports.push(new winston.transports.File({filename: 'combined.log'}));
    }
    // configure default logger too, it is easyer to use!!!
    winston.configure(options);
}

// MAIN !!!
configLogger();
bootstrap();
