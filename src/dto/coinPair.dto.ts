import { IsString } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger';

export class CoinPairDto {
    @ApiModelProperty({
        enum: ['eth', 'btc']
    })
    @IsString()
    readonly mainCoin: string;

    @ApiModelProperty({
        enum: ['eth', 'btc']
    })
    @IsString()
    readonly exchangeCoin: string;
}
