const path = require('path');
const ethutil = require('ethereumjs-util');
const bitcoinjs = require('bitcoinjs-lib');
const bip39 = require('bip39');
const bip32 = require('bip32');
const HDKey = require('hdkey');
const BN = require('bn.js');
const rskjs = require('rskjs-util');
const EthTX = require('ethereumjs-tx');


function moveAllBTCTx(network, seed, path, params, feePercent, toAddr) {
    const utxos = params.utxos;
    const priv = HDKey.fromMasterSeed(seed).derive(path).privateKey;
    const key = bitcoinjs.ECPair.fromPrivateKey(priv, {network});
    const tx = new bitcoinjs.TransactionBuilder(network);
    var quantity = new BN(0);
    for (const [i, u] of utxos.entries()) {
        tx.addInput(u.txid, u.vout, i);
        quantity = quantity.add(new BN(u.satoshis));
    }
    // pay a fee of feePercent
    tx.addOutput(toAddr, quantity.muln(1 - feePercent / 100).toNumber());
    for (const [i, u] of utxos.entries()) {
        tx.sign(i, key);
    }
    // const f = tx.byteLength();

    return "0x" + tx.build().toHex();
}

function moveAllETHTx(seed, path, params, fromAddr, toAddr, feePercent, balance, chainId) {
    const gasLimit = 21000;
    const gasPrice = new BN(params.gasPrice).muln(feePercent);
    const needed = gasPrice.muln(gasLimit);
    const quantity = balance.sub(needed);
    if (quantity.ltn(0)) {
        throw new Error("Balance less than needed quantity " + needed.toString(10))
    }
    const nonce = params.nonces.find(x => (x.addr.toLowerCase() === fromAddr.toLowerCase())).nonce;

    const rawTx = {
        nonce: '0x' + (new BN(nonce)).toString(16),
        gasPrice: '0x' + (gasPrice).toString(16),
        gasLimit: '0x' + new BN((gasLimit)).toString(16),
        to: ethutil.toChecksumAddress(toAddr),
        value: '0x' + (new BN(quantity)).toString(16),
        data: ''
    };
    console.log("RAWTX", rawTx);
    const tx = new EthTX.Transaction(rawTx, {chain: chainId});
    const privateKey = HDKey.fromMasterSeed(seed).derive(path).privateKey;
    tx.sign(privateKey);
    return '0x' + tx.serialize().toString('hex');
};

function getEthAddr(seed, path) {
    const mk = HDKey.fromMasterSeed(seed);
    return ethutil.pubToAddress(mk.derive(path).publicKey, true).toString('hex');
}

function getBtcAddr(seed, network, path) {
    const options = {
        pubkey: bip32.fromSeed(seed, network).derivePath(path).neutered().publicKey,
        network
    };
    return bitcoinjs.payments.p2pkh(options).address;
}

const NETWORKS = {
    ETH: {
        network_id: 60,
        unit: 'wei',
        getAddr: (seed, path) => ethutil.toChecksumAddress(getEthAddr(seed, path)),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllETHTx(seed, path, params, fromAddr, toAddr, feePercent, quantity, 'mainnet'),
    },
    TETH: {
        network_id: 1,
        unit: 'wei',
        getAddr: (seed, path) => ethutil.toChecksumAddress(getEthAddr(seed, path)),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllETHTx(seed, path, params, fromAddr, toAddr, feePercent, quantity, 'ropsten'),
    },
    BTC: {
        network_id: 0,
        unit: 'satoshi',
        getAddr: (seed, path) => getBtcAddr(seed, bitcoinjs.networks.bitcoin, path),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllBTCTx(bitcoinjs.networks.bitcoin, seed, path, params, feePercent, toAddr),
    },
    TBTC: {
        network_id: 1,
        unit: 'satoshi',
        getAddr: (seed, path) => getBtcAddr(seed, bitcoinjs.networks.testnet, path),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllBTCTx(bitcoinjs.networks.testnet, seed, path, params, feePercent, toAddr),
    },
    RSK: {
        network_id: 137,
        chain_id: 31,
        unit: 'rbtc',
        getAddr: (seed, path) => rskjs.toChecksumAddress(getEthAddr(seed, path), 31),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllETHTx(seed, path, params, fromAddr, toAddr, feePercent, quantity, 1),
    },
    TRSK: {
        network_id: 37310,
        chain_id: 30,
        unit: 'rbtc',
        getAddr: (seed, path) => rskjs.toChecksumAddress(getEthAddr(seed, path), 30),
        getTX: (seed, path, params, fromAddr, toAddr, feePercent, quantity) => moveAllETHTx(seed, path, params, fromAddr, toAddr, feePercent, quantity, 1),
    }
};
const COINS = {
    ETH: {
        name: 'ETH',
        network: 'ETH'
    },
    TETH: {
        name: 'ETH-Ropsten',
        network: 'TETH'
    },
    BTC: {
        name: 'BTC',
        network: 'BTC'
    },
    TBTC: {
        name: 'BTC-Testnet',
        network: 'TBTC'
    },
    RSK: {
        name: 'RSK',
        network: 'RSK'
    },
    TRSK: {
        name: 'RSK-Testnet',
        network: 'TRSK'
    },
    DAI: {
        name: 'DAI',
        network: 'ETH'
    },
    TDAI: {
        name: 'DAI-Ropsten',
        network: 'TETH'
    },
    RIF: {
        name: 'RIF',
        network: 'RSK'
    },
    TRIF: {
        name: 'RIF-Testnet',
        network: 'TRSK'
    },
};

function getTX(n, seed, path, params, fromAddr, toAddr, feePercent, quantity) {
    if (!(n in NETWORKS)) {
        throw new Error("Invalid net " + n);
    }
    const net = NETWORKS[n];
    return net.getTX(seed, path, params, fromAddr, toAddr, feePercent, quantity);
}

function getAddr(seed, n, p) {
    if (!(n in NETWORKS)) {
        throw new Error("Invalid net " + n);
    }
    const net = NETWORKS[n];
    // m / purpose' / coin_type' / account' / change / address_index
    const path = 'm/44\'/' + net.network_id + '\'/0\'' + p;
    return {network: n, path, addr: net.getAddr(seed, path)};
}

function getAddrs(seed, p) {
    1
    return Object.keys(NETWORKS).map(n => getAddr(seed, n, p));
}

module.exports = {COINS, NETWORKS, getAddr, getAddrs, getTX};
