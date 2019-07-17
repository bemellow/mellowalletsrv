import { IsString, IsArray } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger';
import { WalletCoins } from '../config/config.module';

export class CoinAddrListDto {
    @ApiModelProperty({
        enum: WalletCoins,
        required: true,
        description: 'Coin to use'
    })
    @IsString()
    readonly coin: string;

    @ApiModelProperty({
        required: true,
        type: 'string',
        isArray: true,
        description: 'List of addresses'
    })
    @IsArray()
    readonly addrs: string[];
}
