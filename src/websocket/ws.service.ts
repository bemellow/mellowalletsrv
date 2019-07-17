import { Injectable } from '@nestjs/common';
import { BlockChainMapService } from '../block_chain_map/block_chain_map.service';
import { Observable } from 'rxjs';
import { TxDto } from '../dto/tx.dto';
import { map } from 'rxjs/operators';

@Injectable()
export class WSService {
    constructor(readonly bcMap: BlockChainMapService) {}

    subscribe(coin: string, addrs: string[]): Observable<TxDto> {
        const bc = this.bcMap.getBlockChain(coin);
        return bc.subscribe(addrs).pipe(
            map(ax => ({
                coin,
                ...ax
            }))
        );
    }
}
