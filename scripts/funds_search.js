const path = require('path');
const bip39 = require('bip39');
const fs = require('fs');
const common = require('./common');
const server_api = require('./server_api');


async function searchBalances(serverUrl, mnemonic) {
    const seed = bip39.mnemonicToSeed(mnemonic);
    //console.log('SEED ', seed.toString('hex'));
    const ret = [];
    const paths = ['/0/0', '/0/1', '/0/2', '/0/3', '/0/0/0', '/0/1/0', '/0/0/1', '/1/0', '/1/1', '/1/2', '/2/0'];
    for (const p of paths) {
        for (const c of Object.keys(common.COINS)) {
            // Get address for every network.
            const coin = common.COINS[c];
            console.log("Searching funds for ", seed.toString('hex'), coin.name, p);
            const addr = common.getAddr(seed, coin.network, p);
            try {
                const balance = await server_api.getBalance(serverUrl, addr.addr, coin.name);
                if (balance.gtn(0)) {
                    ret.push({seed, ...addr, coin: c, coin_name: coin.name, balance: balance.toString(10)});
                    console.log("FOUND", seed.toString('hex'), addr.network, addr.path, addr.addr, balance.toString(10));
                }
            } catch (err) {
                console.error("SKIP ERROR", addr, err.message, err.response ? err.response.data : err);
            }
        }
    }
    return ret;
}


if (require.main === module) {
    if (process.argv.length < 5) {
        console.error('USAGE ', path.basename(process.argv[1]), 'server_url out_file "recovery_phrase" ...');
        process.exit(1);
    }
    for (const m of process.argv.slice(4)) {
        if (!bip39.validateMnemonic(m)) {
            console.error("Invalid mnemonic", m);
        }
    }

    const serverUrl = process.argv[2];
    const outFile = process.argv[3];
    const parallel = true;
    let p;
    if (parallel) {
        p = Promise.all(process.argv.slice(3).map(m => searchBalances(serverUrl, m)));
    } else {
        p = (async () => {
                const ret = [];
                for (const m of process.argv.slice(3)) {
                    ret.push(await searchBalances(serverUrl, m));
                }
                return ret;
            }
        )();
    }
    p.catch(err => console.error("ERROR", err))
        .then(ret => {
            console.log("RET", ret);
            fs.writeFileSync(outFile, JSON.stringify(ret.filter(x => x.length > 0)));
        });
}
