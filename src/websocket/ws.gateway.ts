import * as winston from 'winston';
import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsResponse,
    OnGatewayConnection,
    OnGatewayDisconnect
} from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { UseFilters } from '@nestjs/common';
import { WSService } from './ws.service';
import { AllExceptionsFilter } from '../common/filters/error.filter';
import { ConfigService } from '../config/config.service';

interface MyWebSocket {
    id: number;
    url: string;
    _socket: { remoteAddress: any; remotePort: any };
}

@WebSocketGateway()
@UseFilters(AllExceptionsFilter)
export class WSGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private cnt = 1;
    @WebSocketServer() server;

    constructor(private readonly config: ConfigService, private readonly wsService: WSService) {
        winston.debug('WSGateway started !!!');
    }

    handleConnection(socket: MyWebSocket, ...args: any[]) {
        socket.id = this.cnt++;
        winston.debug(
            'New Websocket connection from ' + this.getRemoteAddress(socket) + ' id: ' + socket.id
        );
        // args[0] == http.IncomingMessage
        // socket ==  WebSocket
        // this.server == WebSocketServer
        /*socket.send(
            JSON.stringify({
                event: 'events',
                data: 'test'
            })
        );
        */
    }

    public handleDisconnect(socket: MyWebSocket, ...args: any[]): any {
        winston.debug(
            'Websocket disconnect from ' + this.getRemoteAddress(socket) + ' id: ' + socket.id
        );
    }

    @SubscribeMessage('subscribe')
    onSubscribe(
        socket: MyWebSocket,
        data: { coin: string; addrs: string[] }
    ): Observable<WsResponse<any>> {
        winston.debug(
            'Websocket ' +
                this.getRemoteAddress(socket) +
                ' id: ' +
                socket.id +
                ' subscribe ' +
                JSON.stringify(data)
        );
        const ret = this.wsService.subscribe(data.coin, data.addrs);
        if (!this.config.isProduction()) {
            ret.pipe(
                tap(ax =>
                    winston.debug('WS: ' + JSON.stringify(data) + ' GOT ' + JSON.stringify(ax))
                )
            );
        }
        return ret.pipe(
            map(ax => ({
                event: 'tx',
                data: ax
            }))
        );
    }

    private getRemoteAddress(ws: MyWebSocket): string {
        if (ws.url) {
            return ws.url;
        }
        if (!ws._socket || !ws._socket.remoteAddress) {
            return 'Unknown';
        }
        return ws._socket.remoteAddress + ':' + ws._socket.remotePort;
    }
}
