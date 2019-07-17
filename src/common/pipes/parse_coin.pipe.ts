import { BadRequestException, Inject } from '@nestjs/common';
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { CoinValidator } from '../../interfaces/coin_validator.interface';
import { BlockChainMapService } from '../../block_chain_map/block_chain_map.service';
import { PriceEstimator } from '../../interfaces/price_estimator.interface';
import { Exchange } from '../../interfaces/exchange.interface';

export class ParseCoinBasePipe implements PipeTransform<string, string> {
    constructor(readonly coinValidator: CoinValidator) {}

    transform(value: string, metadata: ArgumentMetadata): string {
        const { metatype } = metadata;
        if (!metatype || !(metatype === String)) {
            throw new BadRequestException('Validation failed invalid value type');
        }
        if (!this.coinValidator.isValidCoin(value)) {
            throw new BadRequestException('Validation failed invalid coin ' + value);
        }
        return value;
    }
}

@Injectable()
export class ParseCoinPipe extends ParseCoinBasePipe {
    constructor(readonly validator: BlockChainMapService) {
        super(validator);
    }
}

@Injectable()
export class ParseExchangeCoinPipe extends ParseCoinBasePipe {
    constructor(@Inject('Exchange') readonly validator: Exchange) {
        super(validator);
    }
}

@Injectable()
export class ParsePriceEstimatorCoinPipe extends ParseCoinBasePipe {
    constructor(@Inject('PriceEstimator') readonly validator: PriceEstimator) {
        super(validator);
    }
}
