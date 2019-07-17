import { Module } from '@nestjs/common';
import { WSGateway } from './ws.gateway';
import { WSService } from './ws.service';
import { BlockChainMapModule } from '../block_chain_map/block_chain_map.module';

@Module({
    imports: [BlockChainMapModule],
    providers: [WSGateway, WSService]
})
export class WSModule {}
