import * as winston from 'winston';
import { Module } from '@nestjs/common';
import { WalletRecoverService } from './wallet_recover.service';
import { BlockChainMapService } from '../block_chain_map/block_chain_map.service';
import { BlockChainMapModule } from '../block_chain_map/block_chain_map.module';

@Module({
    imports: [BlockChainMapModule],
    controllers: [],
    providers: [WalletRecoverService],
    exports: [WalletRecoverService]
})
export class WalletRecoverModule {}
