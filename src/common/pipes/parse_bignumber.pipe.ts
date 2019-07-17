import { BadRequestException } from '@nestjs/common';
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import BigNumber from 'bignumber.js';

@Injectable()
export class ParseBigNumber implements PipeTransform<string, BigNumber> {
    transform(value: string, metadata: ArgumentMetadata): BigNumber {
        // TODO: TEST!!!
        const val = new BigNumber(value, 10);
        if (val.isNaN()) {
            throw new BadRequestException('Validation failed');
        }
        return val;
    }
}
