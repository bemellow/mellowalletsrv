const path = require('path');
const bip39 = require('bip39');
const fs = require('fs');
const BN = require('bn.js');
const common = require('./common');
const server_api = require('./server_api');


if (require.main === module) {
    if (process.argv.length != 7) {
        console.error('USAGE ', path.basename(process.argv[1]), 'serverUrl network source_phrase balance destination_addr');
        process.exit(1);
    }
    const serverUrl = process.argv[2];
    const networkName = process.argv[3];
    if (!(networkName in common.COINS)) {
        throw new Error("Invalid net " + n);
    }
    const coinData = common.COINS[networkName];
    const network = common.NETWORKS[coinData.network];
    const seed = bip39.mnemonicToSeed(process.argv[4]);
    const balance = new BN(process.argv[5]);
    const destinationAddr = process.argv[6];
    const hpath = 'm/44\'/' + network.network_id + '\'/0\'/0/0';
    const sourceAddr = network.getAddr(seed, hpath);
    console.log('SOURCE ADDR', sourceAddr, 'DESTINATION ADDR', destinationAddr);

    p = (async () => {
            const params = await server_api.getTransactionParams(serverUrl, sourceAddr, coinData.name);
            const tx = network.getTX(seed, hpath, params, sourceAddr, destinationAddr, 1, balance);
            return tx;
        }
    )();
    p.catch(err => console.error("ERROR", err))
        .then(tx => {
            console.log("TO MOVE ", balance.toString(10), network.unit, " FROM ", sourceAddr, " TO ", destinationAddr, " RUN ", tx);
        });

}
