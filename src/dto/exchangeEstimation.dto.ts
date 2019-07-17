import { IsString, IsInt, IsArray } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger';
import { CoinPairDto } from './coinPair.dto';
import BigNumber from 'bignumber.js';

export class ExchangeEstimationDto {
    @ApiModelProperty()
    @IsString()
    readonly coinPair: CoinPairDto;

    @ApiModelProperty()
    @IsString()
    readonly amount: BigNumber;
}
