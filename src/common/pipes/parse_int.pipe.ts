import { BadRequestException, ParseIntPipe } from '@nestjs/common';
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ParseOptionalInt extends ParseIntPipe implements PipeTransform<string> {
    async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
        if (!value) {
            return undefined;
        }
        return super.transform(value, metadata);
    }
}

@Injectable()
export class ParseOptionalPositiveInt extends ParseIntPipe implements PipeTransform<string> {
    async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
        if (!value) {
            return undefined;
        }
        const ret: number = await super.transform(value, metadata);
        if (ret < 0) {
            throw new Error('Validation error, value must be positive');
        }
        return ret;
    }
}
