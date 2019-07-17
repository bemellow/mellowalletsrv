import { ApiModelProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { CoinAddrListDto } from './coin-addrlist.dto';

export class GlobalHistoryDto {
    @ApiModelProperty({
        required: false,
        type: Number
    })
    readonly skip: number;

    @ApiModelProperty({
        required: false,
        type: Number
    })
    readonly take: number;

    @ApiModelProperty({
        required: true,
        type: CoinAddrListDto,
        isArray: true,
        minLength: 1
    })
    @IsArray()
    readonly data: CoinAddrListDto[];
}
