const path = require('path');
const fs = require('fs');
const BN = require('bn.js');
const common = require('./common');
const server_api = require('./server_api');

async function sendTX(serverUrl, destinationAddr, data) {
    const sourceAddr = data.addr;
    const network = data.network;
    const seed = Buffer.from(data.seed);
    const path = data.path;
    const balance = new BN(data.balance);
    const params = await server_api.getTransactionParams(serverUrl, sourceAddr, data.coin_name);
    const tx = common.getTX(network, seed, path, params, sourceAddr, destinationAddr, 10, balance);
    console.log("TO MOVE ", balance.toString(10), " FROM ", sourceAddr, " TO ", destinationAddr, " (ALL THE BALANCE ) RUN ", tx);
    return tx;
}

if (require.main === module) {
    if (process.argv.length < 3 || process.argv.length > 6 || process.argv.length == 5) {
        console.error('USAGE ', path.basename(process.argv[1]), 'recover_file [ network [ serverUrl destination_addr ] ]');
        process.exit(1);
    }
    const recoverFile = process.argv[2];
    const rawData = JSON.parse(fs.readFileSync(recoverFile));
    const data = [].concat.apply([], rawData.filter(x => x.length > 0))
    if (process.argv.length == 3) {
        console.log([...new Set(data.map(x => x.coin_name))].sort());
        process.exit(0);
    }

    const coin_name = process.argv[3];
    const found = data.filter(x => x.coin_name === coin_name).map(x => ({...x, balance: new BN(x.balance)}));
    console.log(found);
    if (process.argv.length == 6) {
        const parallel = false;
        const serverUrl = process.argv[4];
        const destinationAddr = process.argv[5];
        let send = async (f) => sendTX(serverUrl, destinationAddr, f);
        let p;
        if (parallel) {
            p = Promise.all(found.map(f => send(f)));
        } else {
            p = (async () => {
                    const ret = [];
                    for (const f of found) {
                        ret.push(await send(f));
                    }
                    return ret;
                }
            )();
        }
        p.catch(err => console.error("ERROR", err))
            .then(ret => {
                console.log("RET", ret);
            });
    }

}
