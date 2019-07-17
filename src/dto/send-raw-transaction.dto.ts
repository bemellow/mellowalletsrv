import { IsString } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger';

export class SendRawTransactionDto {
    @ApiModelProperty({
        required: true,
        type: String,
        description: 'Hex encoded string containing the  signed transaction'
    })
    @IsString()
    readonly tx: string;
}
