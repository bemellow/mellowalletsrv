/* tslint:disable:no-console */
import frisby = require('frisby');
import ethutil = require('ethereumjs-util');
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import HDKey = require('hdkey');
import BN = require('bn.js');
import objectContaining = jasmine.objectContaining;
import {ECPair, networks, payments, TransactionBuilder} from 'bitcoinjs-lib';
import {Transaction as EthTX} from 'ethereumjs-tx';
import {AbiCoder} from 'web3-eth-abi';
import {StateMutabilityType, AbiType} from 'web3-utils';
import * as rskutil from 'rskjs-util';

const SERVER_URL = 'http://localhost:5001'; // 'http://46.101.117.238';
const FROM_SEED = bip39.mnemonicToSeed('elevator grace gauge torch pair popular bread yard come grab pyramid nose');
const TO_SEED = bip39.mnemonicToSeed('rabbit major initial then apart vault apple candy treat use response raven');

jest.setTimeout(1000 * 60 * 60);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getEthAddr(seed: Buffer, networkId: number) {
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const pubKey = HDKey.fromMasterSeed(seed).derive(path).publicKey;
    return ethutil.toChecksumAddress(ethutil.pubToAddress(pubKey, true).toString('hex'));
}

function getRskAddr(seed: Buffer, networkId: number, chainId: number) {
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const pubKey = HDKey.fromMasterSeed(seed).derive(path).publicKey;
    return rskutil.toChecksumAddress(ethutil.pubToAddress(pubKey, true).toString('hex'), chainId).toLowerCase();
}

function getBtcAddr(seed: Buffer, networkId: number, network) {
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const options = {
        pubkey: bip32.fromSeed(seed, network).derivePath(path).neutered().publicKey,
        network
    };
    return payments.p2pkh(options).address;
}

function buildBTCTx(network, networkId, seed: Buffer, params, fromAddr, toAddr, feePercent: number, balance: BN) {
    const fee = new BN(params.highFee); // statoshi / KB, going to assume 1kb transaction
    const realFee = fee.muln(feePercent);
    const availableUtxos = params.utxos;
    let cant = new BN(0);
    const utxos = [];
    const tx = new TransactionBuilder(network);
    for (const [i, u] of availableUtxos.entries()) {
        utxos.push([i, u]);
        tx.addInput(u.txid, u.vout, i);
        cant = cant.add(new BN(u.satoshis));
        if (cant.gte(balance)) {
            break;
        }
    }
    if (cant.lt(balance)) {
        throw new Error('Inssuficient balance');
    }
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const priv = HDKey.fromMasterSeed(seed).derive(path).privateKey;
    const key = ECPair.fromPrivateKey(priv, {network});
    // transafer
    tx.addOutput(toAddr, balance.sub(realFee).toNumber());
    // change
    if (cant.gt(balance)) {
        tx.addOutput(fromAddr, cant.sub(balance).toNumber());
    }
    for (const [i, u] of utxos) {
        tx.sign(i, key);
    }
    // const f = tx.byteLength();
    // calculate real cost...
    const ret = tx.build().toHex();
    console.log('BITCOIN TX', ret);
    return '0x' + ret;
}

function buildETHTx(networkId, seed: Buffer, params, fromAddr: string, toAddr: string, feePercent: number, balance: BN, chainId) {
    const nonce = params.nonces.find(x => (x.addr === fromAddr)).nonce;
    const gasPrice = (new BN(params.gasPrice).muln(feePercent));

    const gasLimit = 21000;
    const usedGasPrice = gasPrice.muln(gasLimit);
    const quantity = balance.sub(usedGasPrice);
    if (quantity.isNeg()) {
        throw new Error('Inssuficient balance');
    }
    const rawTx = {
        nonce: '0x' + (new BN(nonce)).toString(16),
        gasPrice: '0x' + (gasPrice).toString(16),
        gasLimit: '0x' + new BN((gasLimit)).toString(16),
        to: toAddr,
        value: '0x' + (new BN(quantity)).toString(16),
        data: ''
    };
    const tx = new EthTX(rawTx, {chain: chainId});
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const privateKey = HDKey.fromMasterSeed(seed).derive(path).privateKey;
    tx.sign(privateKey);
    return '0x' + tx.serialize().toString('hex');
}

async function getTransactionParamsForToken(addrFrom, addrTo, quantity, coin) {
    const res = await frisby.get(SERVER_URL + '/getTransactionParams?addresses=' + addrFrom + '&coin=' + coin).expect('status', 200);
    const params = JSON.parse(res.body);
    const res1 = await frisby.get(SERVER_URL + '/getTransferGas?quantity='
        + quantity.toString(10)
        + '&to=' + addrTo
        + '&from=' + addrFrom
        + '&coin=' + coin).expect('status', 200);
    params.tokenNeededGas = new BN(res1.body);
    return params;
}

async function getTransactionParams(addrFrom, addrTo, quantity, coin) {
    const res = await frisby.get(SERVER_URL + '/getTransactionParams?addresses=' + addrFrom + '&coin=' + coin).expect('status', 200);
    return JSON.parse(res.body);
}

function buildETHTokenTx(contractAddr: string, networkId, seed: Buffer, params, fromAddr: string, toAddr: string, feePercent: number, balance: BN, chainId) {
    const nonce = params.nonces.find(x => (x.addr === fromAddr)).nonce;
    const gasPrice = (new BN(params.gasPrice).muln(feePercent));

    const transferABI = {
        constant: false,
        inputs: [
            {
                name: '_to',
                type: 'address'
            },
            {
                name: '_value',
                type: 'uint256'
            }
        ],
        name: 'transfer',
        outputs: [
            {
                name: '',
                type: 'bool'
            }
        ],
        payable: false,
        stateMutability: 'nonpayable' as StateMutabilityType,
        type: 'function' as AbiType
    };
    const encoded = new AbiCoder().encodeFunctionCall(transferABI,
        [toAddr.toLowerCase(), '0x' + balance.toString(16)]);
    console.log('TOKEN TX DATA', encoded);

    const rawTx = {
        nonce: '0x' + (new BN(nonce)).toString(16),
        gasPrice: '0x' + gasPrice.toString(16),
        gasLimit: '0x' + params.tokenNeededGas.toString(16),
        to: contractAddr,
        value: '0x' + (new BN(0)).toString(16),
        data: new Buffer(encoded.substr(2), 'hex')
    };
    const tx = new EthTX(rawTx, {chain: chainId});
    const path = 'm/44\'/' + networkId + '\'/0\'/0/0';
    const privateKey = HDKey.fromMasterSeed(seed).derive(path).privateKey;
    tx.sign(privateKey);
    return '0x' + tx.serialize().toString('hex');
}

xdescribe('price', () => {
    it('getPrice variation', async (done) => {
        const priceVariation = await frisby.get(SERVER_URL + '/getPriceVariation').expect('status', 200);
        const floatRegExp = /^[-+]?[0-9]*\.?[0-9]+$/;
        expect(JSON.parse(priceVariation.body)).toEqual(objectContaining({
            'BTC': expect.stringMatching(floatRegExp),
            'RSK': expect.stringMatching(floatRegExp),
            'BTC-Testnet': expect.stringMatching(floatRegExp),
            'RSK-Testnet': expect.stringMatching(floatRegExp),
            'ETH': expect.stringMatching(floatRegExp),
            'ETH-Ropsten': expect.stringMatching(floatRegExp),
            'DAI': expect.stringMatching(floatRegExp),
            'DAI-Ropsten': expect.stringMatching(floatRegExp),
            'RIF': expect.stringMatching(floatRegExp),
            'RIF-Testnet': expect.stringMatching(floatRegExp),
        }));
        done();
    });
});

xdescribe('exchange', () => {
    xit('exchange TODO make it better', async (done) => {
        const exchangeEstimation = await frisby.get(SERVER_URL + '/exchangeEstimation?quantity=123&toCoin=BTC&fromCoin=ETH')
            .expect('status', 200);
        expect(JSON.parse(exchangeEstimation.body)).toEqual(expect.any(Number));
        // TODO: DoExchange.
        done();
    });
});

xdescribe('name resolution', () => {
    xit('TODO: resolve Name', async (done) => {
        const exchangeEstimation = await frisby.get(SERVER_URL + '/resolveName?name=asd.eth&coin=ETH-Ropsten')
            .expect('status', 200);
        expect(JSON.parse(exchangeEstimation.body)).toEqual(expect.any(String));
        done();
    });
});

xit('transaction history', async (done) => {
    const global = await frisby.post(SERVER_URL + '/getGlobalTransactionHistory',
        {
            skip: 0,
            take: 0,
            data: [
                {
                    coin: 'ETH-Ropsten',
                    addrs: ['none']
                }]
        }
    ).expect('status', 201);
    expect(JSON.parse(global.body)).toEqual([]);
    // TODO: Some example.
    const history = await frisby.post(SERVER_URL + '/getTransactionHistory?addresses=none&coin=ETH')
        .expect('status', 500);
    // expect(JSON.parse(history.body)).toEqual([]);
    done();
});

xit('recover wallet', async (done) => {
    // TODO: A good example.
    const exchangeEstimation = await frisby.post(SERVER_URL + '/recoverWallet', {
        data: [
            {
                network: 'ETH',
                node: 'ETH'
            }
        ]
    }).expect('status', 200);
    expect(JSON.parse(exchangeEstimation.body)).toEqual(expect.any(String));
    done();
});

const ETH_COIN = {
    unit: 'wei',
    quantity: new BN(10 * 21000 * 1000 * 1000 * 1000),
    feePercent: 1.5,
    getTransactionParams,
    getAddr: (seed) => getEthAddr(seed, 1),
    checkFee: (feeData) => expect((new BN(feeData.gasPrice)).cmp(new BN(20000000)),
        'fee ' + feeData.gasPrice).toBeGreaterThanOrEqual(0),
    checkTransactionParams: (params, addr) => expect(params).toEqual(objectContaining({
        gasPrice: expect.any(String),
        nonces: [
            {
                addr,
                nonce: expect.any(Number)
            }
        ]
    })),
};
const BTC_COIN = {
    getTransactionParams,
    checkFee: (feeData) => expect(feeData).toEqual(objectContaining({
        lowFee: expect.any(String),
        mediumFee: expect.any(String),
        highFee: expect.any(String),
    })),
    checkTransactionParams: (params, addr) => expect(params).toEqual(objectContaining({
        lowFee: expect.any(String),
        mediumFee: expect.any(String),
        highFee: expect.any(String),
        utxos: expect.arrayContaining([{
            address: addr,
            satoshis: expect.any(String),
            txid: expect.any(String),
            vout: expect.any(Number),
        }])
    })),
};
const COINS = {
    'ETH-Ropsten': Object.assign({}, ETH_COIN, {
        it,
        getAddr: (seed) => getEthAddr(seed, 1),
        buildTx: (fromSeed, txParams, fromAddr, toAddr, feePercent, balance: BN) =>
            buildETHTx(1, fromSeed, txParams, fromAddr, toAddr, feePercent, balance, 3),
    }),
    'DAI-Ropsten': Object.assign({}, ETH_COIN, {
        it,
        unit: 'dai',
        network: 'ETH-Ropsten',
        getTransactionParams: getTransactionParamsForToken,
        buildTx: (fromSeed, txParams, fromAddr, toAddr, feePercent, balance: BN) =>
            buildETHTokenTx(
                '0xb6444ec2b1689a36B58f5D9a824fFDC2D1b7F72d',
                1,
                fromSeed,
                txParams,
                fromAddr,
                toAddr,
                feePercent,
                balance,
                3
            ),
        quantity: new BN(1234),
    }),
    'BTC-Testnet': Object.assign({}, BTC_COIN, {
        it,
        unit: 'sathoshi',
        getAddr: (seed) => getBtcAddr(seed, 1, networks.testnet),
        buildTx: (fromSeed, txParams, fromAddr, toAddr, feePercent, balance: BN) =>
            buildBTCTx(networks.testnet, 1, fromSeed, txParams, fromAddr, toAddr, feePercent, balance),
        quantity: new BN(100 * 1000),
        feePercent: 1.5
    }),
    'RSK-Testnet': Object.assign({}, ETH_COIN, {
        it,
        getAddr: (seed) => getRskAddr(seed, 37310, 31),
        buildTx: (fromSeed, txParams, fromAddr, toAddr, feePercent, balance: BN) =>
            buildETHTx(37310, fromSeed, txParams, fromAddr, toAddr, feePercent, balance, 1),
    }),
    'RIF-Testnet': Object.assign({}, ETH_COIN, {
        it,
        network: 'RSK-Testnet',
        getAddr: (seed) => getRskAddr(seed, 37310, 31),
        getTransactionParams: getTransactionParamsForToken,
        buildTx: (fromSeed, txParams, fromAddr, toAddr, feePercent, balance: BN) =>
            buildETHTokenTx(
                '0xd8c5adcac8d465c5a2d0772b86788e014ddec516',
                1,
                fromSeed,
                txParams,
                fromAddr,
                toAddr,
                feePercent,
                balance,
                3
            ),
        quantity: new BN(1234),
    }),
    'ETH': Object.assign({}, ETH_COIN, {
        it: xit,
        getAddr: (seed) => getEthAddr(seed, 60),
    }),
    'BTC': Object.assign({}, BTC_COIN, {
        it: xit,
        getAddr: (seed) => getBtcAddr(seed, 0, networks.bitcoin),
    }),
    'DAI': Object.assign({}, ETH_COIN, {
        it: xit,
        network: 'ETH',
        getAddr: (seed) => getEthAddr(seed, 60),
    }),
    'RSK': Object.assign({}, ETH_COIN, {
        it: xit,
        chain_id: 30,
        getAddr: (seed) => getEthAddr(seed, 137),
    }),
    'RIF': Object.assign({}, ETH_COIN, {
        it: xit,
        chain_id: 30,
        network: 'RSK',
        getAddr: (seed) => getEthAddr(seed, 137),
    }),
};

async function checkAll(coin, networkData) {
    const addrFrom = networkData.getAddr(FROM_SEED);
    const addrTo = networkData.getAddr(TO_SEED);
    const res = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrFrom + '&coin=' + coin)
        .expect('status', 200);
    const addrFromBalance = new BN(res.body);
    const res2 = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrTo + '&coin=' + coin)
        .expect('status', 200);
    const addrToBalance = new BN(res2.body);
    const res3 = await frisby.get(SERVER_URL + '/getBalances?addresses=' + addrFrom + ',' + addrTo + '&coin=' + coin)
        .expect('status', 200);
    const addrBalances: any[] = JSON.parse(res3.body);
    expect(addrBalances.find(x => (x.addr === addrFrom)).quantity).toEqual(addrFromBalance.toString(10));
    expect(addrBalances.find(x => (x.addr === addrTo)).quantity).toEqual(addrToBalance.toString(10));

    const res4 = await frisby.get(SERVER_URL + '/getFee?coin=' + coin)
        .expect('status', 200);
    const fee = JSON.parse(res4.body);
    networkData.checkFee(fee);

    if (networkData.network) {
        const res5 = await frisby.get(SERVER_URL + '/getTransferGas?quantity=123&to=' + addrTo + '&from=' + addrFrom + '&coin=' + coin)
            .expect('status', 200);
        // const tokenTransfeGas = JSON.parse(res5.body);
    }
    const res6 = await frisby.get(SERVER_URL + '/getCurrencyPrice?toCoin=USD&fromCoin=' + coin)
        .expect('status', 200);
    expect(new BN(res6.body).cmpn(1)).toEqual(1);

    const res7 = await frisby.get(SERVER_URL + '/getTransactionParams?addresses=' + addrFrom + '&coin=' + coin)
        .expect('status', 200);
    const txParams = JSON.parse(res7.body);
    networkData.checkTransactionParams(txParams, addrFrom);
}

xdescribe('checkall coins', () => {
    for (const coin of Object.keys(COINS)) {
        COINS[coin].it(coin + ' checkall', async (done) => {
            await checkAll(coin, COINS[coin]);
            done();

        });
    }
});

async function sendTx(seed, coin, coinData, addrFrom, addrTo, quantity: BN, stopCondiftion) {
    const feePercent = coinData.feePercent;
    console.log('QUANTITY', quantity.toString(10), 'FeePercent', feePercent.toString(10));

    const res = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrFrom + '&coin=' + coin).expect('status', 200);
    const addrFromBalance = new BN(res.body);
    expect(addrFromBalance.cmp(quantity), coin + ' addr ' + addrFrom + ' need at least ' + quantity + ' ' + coinData.unit + ' to run this test').toBeGreaterThanOrEqual(0);
    const res2 = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrTo + '&coin=' + coin).expect('status', 200);
    const addrToBalance = new BN(res2.body);
    if (stopCondiftion(addrFromBalance, addrToBalance, undefined, undefined)) {
        console.log('SKIP sendTx');
        return;
    }

    const params = await coinData.getTransactionParams(addrFrom, addrTo, quantity, coin);
    console.log('PARAMS', params);
    console.log('FROM ADDR', addrFrom);
    console.log('TO ADDR', addrTo);
    console.log('PRIVATE KEY', seed);
    const tx = coinData.buildTx(seed, params, addrFrom, addrTo, feePercent, quantity);
    console.log('TOKEN TX', tx);
    const res8 = await frisby.post(SERVER_URL + '/sendRawTransaction?coin=' + coin, {tx}).expect('status', 201);
    console.log('SENDTX HASH', res8.body);
    // TODO: Better alternative than pooling?
    while (true) {
        const res9 = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrFrom + '&coin=' + coin).expect('status', 200);
        const newFromBalance = new BN(res9.body);
        const res10 = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrTo + '&coin=' + coin).expect('status', 200);
        const newToBalance = new BN(res10.body);
        if (stopCondiftion(addrFromBalance, addrToBalance, newFromBalance, newToBalance)) {
            break;
        }
        await sleep(2000);
    }
}

async function balanceMovement(coin, coinData) {
    const addrFrom = coinData.getAddr(FROM_SEED);
    const addrTo = coinData.getAddr(TO_SEED);
    console.log('addrTo', addrTo);
    console.log('addrFrom', addrFrom);
    console.log('coinData', coinData);
    // Send TX
    if (true) {
        if (coinData.network) {
            // Move balance so we can do the token calls.
            const networkData = COINS[coinData.network];
            // multiply x2 to take fees into account
            await sendTx(FROM_SEED, coinData.network, networkData, addrFrom, addrTo, networkData.quantity.muln(2),
                (addrFromBalance, addrToBalance, newFromBalance, newToBalance) =>
                    (addrToBalance.gte(networkData.quantity) || (newToBalance && newToBalance.gte(networkData.quantity))));
        }
        // Move the funds
        await sendTx(FROM_SEED, coin, coinData, addrFrom, addrTo, coinData.quantity,
            (addrFromBalance, addrToBalance, newFromBalance, newToBalance) =>
                (newFromBalance && newFromBalance.lt(addrFromBalance) && newToBalance && newToBalance.gt(addrToBalance)));
    }
    // Return Tx
    if (true) {
        const toTknBalance = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrTo + '&coin=' + coin).expect('status', 200);
        await sendTx(TO_SEED, coin, coinData, addrTo, addrFrom, new BN(toTknBalance.body),
            (addrFromBalance, addrToBalance, newFromBalance, newToBalance) => (newFromBalance && newFromBalance.eqn(0)));
        // Return the token network assets.
        if (coinData.network) {
            const toBalance = await frisby.get(SERVER_URL + '/getBalance?addresses=' + addrTo + '&coin=' + coinData.network).expect('status', 200);
            // Move balance so we can do the token calls.
            const networkData = COINS[coinData.network];
            await sendTx(TO_SEED, coinData.network, networkData, addrTo, addrFrom, new BN(toBalance.body),
                (addrFromBalance, addrToBalance, newFromBalance, newToBalance) => (newFromBalance && newFromBalance.eqn(0)));
        }
    }
}

describe('balance movement coins', () => {
    xit('ETH-Testnet balance movement', async (done) => {
        await balanceMovement('ETH-Ropsten', COINS['ETH-Ropsten']);
        done();
    });
    xit('BTC-Testnet balance movement', async (done) => {
        await balanceMovement('BTC-Testnet', COINS['BTC-Testnet']);
        done();
    });
    it('DAI-Ropsten balance movement', async (done) => {
        await balanceMovement('DAI-Ropsten', COINS['DAI-Ropsten']);
        done();
    });

    xit('RSK-Testnet balance movement', async (done) => {
        await balanceMovement('RSK-Testnet', COINS['RSK-Testnet']);
        done();
    });

    /*
    for (const coin of Object.keys(COINS)) {
        COINS[coin].it(coin + ' balance movement', async (done) => {
            await balanceMovement(coin, COINS[coin]);
            done();
        });
    }
    */
});
