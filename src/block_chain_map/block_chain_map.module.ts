import { Module } from '@nestjs/common';
import { BlockChainMapService } from './block_chain_map.service';
import { BitcoinModule } from './bitcoin/bitcoin.module';
import { EthereumModule } from './ethereum/ethereum.module';

@Module({
    imports: [
        EthereumModule.create('ETH', 'ETH-Ropsten'),
        EthereumModule.create('RSK', 'RSK-Testnet'),
        BitcoinModule.create('BTC', 'BTC-Testnet')
    ],
    providers: [BlockChainMapService],
    exports: [BlockChainMapService]
})
export class BlockChainMapModule {}
