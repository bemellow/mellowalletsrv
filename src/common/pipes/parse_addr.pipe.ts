import { BadRequestException } from '@nestjs/common';
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ParseAddr implements PipeTransform<Array<string>, Array<string>> {
    transform(value: Array<string>, metadata: ArgumentMetadata): Array<string> {
        return value;
    }
}
