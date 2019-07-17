import {ReflectMetadata} from '@nestjs/common';

export const Timeout = (timeout: number) => ReflectMetadata('timeout', timeout);
