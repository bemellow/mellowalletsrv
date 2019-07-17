import {
    Controller,
    Get,
    UseInterceptors,
    Post,
    Body,
    UsePipes,
    ValidationPipe,
    Query
} from '@nestjs/common';
import {
    ApiUseTags,
    ApiOperation,
    ApiResponse,
    ApiOkResponse,
    ApiCreatedResponse,
    ApiImplicitQuery
} from '@nestjs/swagger';
import {LoggingInterceptor} from './common/interceptors/logging.interceptor';
import {BigNumber} from 'bignumber.js';
import {ParseCSVArray} from './common/pipes/parse_csv_array.pipe';
import {SendRawTransactionDto} from './dto/send-raw-transaction.dto';
import {ParseBigNumber} from './common/pipes/parse_bignumber.pipe';
import {AppService} from './app.service';
import {
    ParseCoinPipe,
    ParseExchangeCoinPipe,
    ParsePriceEstimatorCoinPipe
} from './common/pipes/parse_coin.pipe';
import {Observable} from 'rxjs';
import {BalanceDto} from './dto/balance.dto';
import {GlobalHistoryDto} from './dto/global_history.dto';
import {WalletCoins, ExchangeCoins, TokenCoins} from './config/config.module';
import {map} from 'rxjs/operators';
import {ParseOptionalPositiveInt} from './common/pipes/parse_int.pipe';
import {TransactionHistory, Fee} from './block_chain_map/interfaces/blockChain.interface';
import {PriceVariationDto} from './dto/price_variation.dto';
import {NetworkPathKeyArrDto} from './dto/path_key_pair.dto';
import {RecoveredNetworkDto} from './dto/recovered_network.dto';
import {TimeoutInterceptor} from './common/interceptors/timeout.interceptor';
import {Timeout} from './common/decorators/timeout.decorator';
import {RawTransactionDto} from './dto/raw_transaction.dto';

@ApiUseTags()
@Controller()
// @UseInterceptors(TransformInterceptor)
@UseInterceptors(LoggingInterceptor)
@UseInterceptors(TimeoutInterceptor)
// @UseInterceptors(CacheInterceptor)
// @UseInterceptors(ClassSerializerInterceptor)
@UsePipes(new ValidationPipe())
export class AppController {
    constructor(readonly service: AppService) {
    }

    @Get('getBalance')
    // @ApiImplicitBody()
    @ApiOperation({
        title: 'Get Balance',
        description: 'Get the sum of the total balance of all addresses'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true,
        description: 'Coin to use'
    })
    @ApiImplicitQuery({
        name: 'addresses',
        required: true,
        type: 'string',
        isArray: true,
        collectionFormat: 'csv',
        description: 'List of addresses to get balances from'
    })
    @ApiOkResponse({
        description: 'total balance of all addresses for the given coin',
        type: String
    })
    getBalance(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('addresses', ParseCSVArray) addresses: string[]
    ): Observable<string> {
        const balance = this.service.getBalance(coin, addresses);
        return balance.pipe(map(ax => ax.toFixed(0)));
    }

    @Get('getBalances')
    // @ApiImplicitBody()
    @ApiOperation({
        title: 'Get Balances',
        description: 'Get the detail of balances for all addresses'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true,
        description: 'Coin to use'
    })
    @ApiImplicitQuery({
        name: 'addresses',
        required: true,
        type: 'string',
        isArray: true,
        collectionFormat: 'csv',
        description: 'List of addresses to get balances from'
    })
    @ApiOkResponse({
        description: 'balances of all addresses for the given coin',
        type: String
    })
    getBalances(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('addresses', ParseCSVArray) addresses: string[]
    ): Observable<BalanceDto[]> {
        return this.service.getBalances(coin, addresses);
    }

    @Get('getFee')
    @ApiOperation({
        title: 'Get Fee',
        description: 'Get the estimated fee for a transaction'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true,
        description: 'Coin to use'
    })
    @ApiOkResponse({
        description: 'the estimated fee',
        type: String
    })
    getFee(@Query('coin', ParseCoinPipe) coin: string): Observable<Fee> {
        return this.service.getFee(coin);
    }

    @Get('getTransferGas')
    @ApiOperation({
        title: 'Get Estimated Transfer Gas Limit',
        description: 'Get the gas limit for a token call'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: TokenCoins,
        required: true,
        description: 'Coin to use'
    })
    @ApiImplicitQuery({
        name: 'from',
        required: true,
        type: String,
        description: 'From addr'
    })
    @ApiImplicitQuery({
        name: 'to',
        required: true,
        type: String,
        description: 'To addr'
    })
    @ApiImplicitQuery({
        name: 'quantity',
        required: true,
        type: String,
        description: 'transfer value'
    })
    @ApiOkResponse({
        description: 'the estimated gas',
        type: String
    })
    getTransferGas(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('quantity', ParseBigNumber) quantity: BigNumber
    ): Observable<string> {
        return this.service.getTransferGas(coin, from, to, quantity).pipe(map(ax => ax.toFixed(0)));
    }

    @Post('sendRawTransaction')
    @ApiOperation({
        title: 'Send Raw Transaction',
        description: 'Send a raw transaction to a given network'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true,
        description: 'Coin to use'
    })
    @ApiCreatedResponse({
        description: 'Returns the transaction hash.'
    })
    @ApiResponse({status: 403, description: 'Forbidden.'})
    sendRawTransaction(
        @Query('coin', ParseCoinPipe) coin: string,
        @Body() buf: SendRawTransactionDto
    ): Observable<RawTransactionDto> {
        return this.service.sendRawTransaction(coin, buf.tx).pipe(map(ax => ({
            tx: ax
        })));
    }

    @Get('getCurrencyPrice')
    @ApiOperation({
        title: 'Get Currency Price',
        description: 'Given a currency get the exchange rate'
    })
    @ApiImplicitQuery({
        name: 'fromCoin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'toCoin',
        enum: ExchangeCoins,
        required: true
    })
    @ApiOkResponse({
        description:
            'exchange rate expressed in the base unit (satoshi, wei, etc) of the destination coin',
        type: String
    })
    getCurrencyPrice(
        @Query('fromCoin', ParseCoinPipe) fromCoin: string,
        @Query('toCoin', ParsePriceEstimatorCoinPipe) toCoin: string
    ): Observable<string> {
        return this.service.getCurrencyPrice(fromCoin, toCoin).pipe(map(b => b.toFixed(0)));
    }

    @Get('getPriceVariation')
    @ApiOperation({
        title: 'Get Price Variation',
        description: '24hs Price variation  rate for all the coins'
    })
    @ApiOkResponse({
        description: 'price variation rate',
        type: String
    })
    getPriceVariation(): Observable<PriceVariationDto> {
        return this.service.getPriceVariation().pipe(
            map(ax =>
                Object.keys(ax).reduce((acc, val) => {
                    acc[val] = ax[val].multipliedBy(100).toFixed();
                    return acc;
                }, {})
            )
        );
    }

    @Get('exchangeEstimation')
    @ApiOperation({
        title: 'Get Currency Price',
        description: 'Given a currency get the exchange rate including fees'
    })
    @ApiImplicitQuery({
        name: 'fromCoin',
        enum: WalletCoins,
        required: true,
        description:
            'fromCoin quantity expressed in the coin unit (btc, eth, etc) (fix in the future)'
    })
    @ApiImplicitQuery({
        name: 'toCoin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'quantity',
        required: true,
        type: String,
        description: 'toCoin quantity expressed in the base unit (satoshi, wei, etc)'
    })
    exchangeEstimationForm(
        @Query('fromCoin', ParseCoinPipe) fromCoin: string,
        @Query('toCoin', ParseExchangeCoinPipe) toCoin: string,
        @Query('quantity', ParseBigNumber) quantity: BigNumber
    ): Observable<string> {
        return this.service
            .getExchangeAmount(fromCoin, toCoin, quantity)
            .pipe(map(b => b.toFixed()));
    }

    @Get('doExchange')
    @ApiOperation({
        title: 'Do Exchange',
        description:
            'Given a currency and a destination address return the deposit address to do the exchange'
    })
    @ApiImplicitQuery({
        name: 'fromCoin',
        enum: WalletCoins,
        required: true,
        description:
            'fromCoin quantity expressed in the coin unit (btc, eth, etc) (fix in the future)'
    })
    @ApiImplicitQuery({
        name: 'toCoin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'destinationAddr',
        required: true,
        type: String,
        description: 'Destination address'
    })
    @ApiImplicitQuery({
        name: 'quantity',
        required: true,
        type: String,
        description: 'Main Coin quantity'
    })
    @ApiOkResponse({description: 'Return deposit address'})
    doExchange(
        @Query('fromCoin', ParseCoinPipe) fromCoin: string,
        @Query('toCoin', ParseExchangeCoinPipe) toCoin: string,
        @Query('destinationAddr') destinationAddr: string,
        @Query('quantity', ParseBigNumber) quantity: BigNumber
    ): Observable<string> {
        return this.service.createTransaction(fromCoin, toCoin, destinationAddr, quantity);
    }

    @Get('resolveName')
    @ApiOperation({
        title: 'Resolve a Name to an Address',
        description: 'Resolve a Name belonging of a blockchain to an Address'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'name',
        required: true,
        type: 'string',
        isArray: false,
        description: 'Name to resolve'
    })
    @ApiOkResponse({description: 'Return address for given name or 0x00..0 address'})
    resolveName(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('name') name: string
    ): Observable<any> {
        return this.service.resolveName(coin, name);
    }

    @Get('getTransactionParams')
    @ApiOperation({
        title: 'Get Transaction Params',
        description:
            'Given a currency and an address list return necesary info to build a signed transaction'
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'addresses',
        required: true,
        type: 'string',
        isArray: true,
        collectionFormat: 'csv',
        description: 'List of addresses to get parameters for'
    })
    @ApiOkResponse({description: 'Return a json with values specific to each coinType'})
    getTransactionParams(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('addresses', ParseCSVArray) addrs: string[]
    ): Observable<any> {
        return this.service.getTransactionParams(coin, addrs);
    }

    @Get('getTransactionHistory')
    @ApiOperation({
        title: 'Get transaction history',
        description: 'Given a currency and an address list return transaction history '
    })
    @ApiImplicitQuery({
        name: 'coin',
        enum: WalletCoins,
        required: true
    })
    @ApiImplicitQuery({
        name: 'addresses',
        required: true,
        type: 'string',
        isArray: true,
        collectionFormat: 'csv',
        description: 'List of addresses to get parameters for'
    })
    @ApiImplicitQuery({
        name: 'skip',
        required: false,
        type: 'number',
        description: 'number of records to skip'
    })
    @ApiImplicitQuery({
        name: 'take',
        required: false,
        type: 'number',
        description: 'number of records to get'
    })
    @ApiImplicitQuery({
        name: 'sort',
        required: false,
        type: 'string',
        description: 'sort order'
    })
    @ApiOkResponse({description: 'Return transaction history'})
    getTransactionHistory(
        @Query('coin', ParseCoinPipe) coin: string,
        @Query('addresses', ParseCSVArray) addrs: string[],
        @Query('skip', ParseOptionalPositiveInt) skip: number,
        @Query('take', ParseOptionalPositiveInt) take: number,
        @Query('sort') sort: string
    ): Observable<TransactionHistory[]> {
        if (sort && sort !== 'asc' && sort !== 'desc') {
            throw new Error('Invalid sort order');
        }
        return this.service.getTransactionHistory(coin, addrs, skip, take, sort);
    }

    @Post('getGlobalTransactionHistory')
    @ApiOperation({
        title: 'Get global transaction history',
        description:
            'Given a set of currencies and an addresses return a mixed transaction history '
    })
    @ApiOkResponse({description: 'Return a json transaction history'})
    getGlobalTransactionHistory(@Body() data: GlobalHistoryDto): Observable<TransactionHistory[]> {
        return this.service.getGlobalTransactionHistory(data);
    }

    @Post('recoverWallet')
    @ApiOperation({
        title: 'Recover a wallet using the original public key by searching addresses with balance',
        description: 'Given a public key find all the bip32 related addresses with balance'
    })
    @ApiOkResponse({description: 'Return a json transaction history'})
    @Timeout(30 * 60 * 1000)
    recoverWallet(@Body() data: NetworkPathKeyArrDto): Observable<RecoveredNetworkDto[]> {
        return this.service.recoverWallet(data.data);
    }
}
