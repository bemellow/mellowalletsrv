import * as winston from 'winston';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BlockChain, BlockChainWithVM } from './interfaces/blockChain.interface';
import { CoinValidator } from '../interfaces/coin_validator.interface';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '../config/config.service';
import { ERC20Token } from './ethereum/erc20_token.service';

interface Coin {
    name: string;
}
interface Token {
    name: string;
    network: string;
    addr: string;
    decimals?: number;
}

@Injectable()
export class BlockChainMapService implements OnModuleInit, CoinValidator {
    readonly chains: Map<string, BlockChain> = new Map();

    constructor(private readonly config: ConfigService, private readonly moduleRef: ModuleRef) {}

    async onModuleInit() {
        const coins = this.config.coins();
        const tokens: { [k: string]: any } = {};
        for (const name in coins) {
            if (!coins.hasOwnProperty(name)) continue;
            const coinData = coins[name];
            if ('network' in coinData) {
                // init tokens after coins
                tokens[name] = coinData;
                continue;
            }
            const d = coinData as Coin;
            winston.debug('GET service ' + name);
            const bc: BlockChain = this.moduleRef.get(name, { strict: false });
            winston.info('Adding coin ' + name + ' : ' + JSON.stringify(d));
            this.chains.set(name, bc);
        }
        for (const name in tokens) {
            if (!tokens.hasOwnProperty(name)) continue;
            const t = tokens[name] as Token;
            const bc = this.getBlockChain(t.network);
            if ('compile' in bc) {
                const token = new ERC20Token(name, bc as BlockChainWithVM, t);
                winston.info('Adding token ' + name + ' ' + token.getInfo());
                this.chains.set(name, token);
            } else {
                throw new Error('Blockchain ' + bc.getInfo() + ' doesn\'t have a VM');
            }
        }
    }

    getBlockChain(coin: string): BlockChain {
        const c = coin;
        if (!this.isValidCoin(c)) {
            throw new Error('Invalid coin ' + coin);
        }
        return this.chains.get(c);
    }

    isValidCoin(coin: string): boolean {
        return this.chains.has(coin);
    }
}
