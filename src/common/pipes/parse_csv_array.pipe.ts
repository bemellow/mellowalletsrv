import { BadRequestException } from '@nestjs/common';
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ParseCSVArray implements PipeTransform<string, Array<string>> {
    transform(value: string, metadata: ArgumentMetadata): Array<string> {
        const { metatype } = metadata;
        if (!metatype || !(metatype === Array)) {
            throw new BadRequestException('Validation failed');
        }
        const val = value.split(',');
        if (!val) {
            throw new BadRequestException('Validation failed');
        }
        return val;
    }
}
