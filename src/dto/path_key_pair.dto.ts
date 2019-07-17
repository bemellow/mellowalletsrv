import { ApiModelProperty } from '@nestjs/swagger';
import { WalletCoins } from '../config/config.module';

export class PathKeyPairDto {
    @ApiModelProperty({
        required: true,
        type: String
    })
    public path: string;
    @ApiModelProperty({
        required: true,
        type: String
    })
    public public_key: string;
}

export class NetworkPathKeyDto {
    @ApiModelProperty({
        required: true,
        type: String,
        enum: WalletCoins
    })
    network: string; // e.g. 'BTC', 'ETH', etc.

    @ApiModelProperty({
        required: true,
        type: String,
        enum: WalletCoins
    })
    @ApiModelProperty({
        required: true,
        type: PathKeyPairDto
    })
    public node: PathKeyPairDto;
}

export class NetworkPathKeyArrDto {
    @ApiModelProperty({
        required: true,
        type: NetworkPathKeyDto,
        isArray: true
    })
    data: NetworkPathKeyDto[];
}
