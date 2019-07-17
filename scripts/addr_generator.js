const path = require('path');
const bip39 = require('bip39');
const common = require('./common');

function printAddrs(seed) {
    const paths = ['/0/0', '/0/0/0', '/1/0', '/0/1'];
    const printer = x => console.log(x.network.padStart(5), ":", x.path.padEnd(25), x.addr);
    for (const p of paths) {
        console.log('');
        common.getAddrs(seed, p).forEach(printer);
    }
}

function searchAddr(seed, addr) {
    addr = addr.toLowerCase();
    if (addr.startsWith("0x")) {
        addr = addr.substr(2);
    }
    const change = Array.from(Array(20).keys(), x => '/' + x);
    const addr_idx = Array.from(Array(20).keys(), x => '/' + x);
    const extra = ["", ...Array.from(Array(20).keys(), x => '/' + x)];
    for (const i of change) {
        process.stdout.write('.');
        for (const j of addr_idx) {
            for (const k of extra) {
                // m / purpose' / coin_type' / account' / change / address_index
                const found = common.getAddrs(seed, i + j + k).filter(x => {
                    const a = x.addr.toLowerCase();
                    const c = a.startsWith("0x") ? a.substr(2) : a;
                    return c === addr;
                });
                if (found.length > 0) {
                    return found;
                }
            }
        }
    }
    return false;
}

if (require.main === module) {
    if (process.argv.length < 3 || process.argv.length > 4) {
        console.error('USAGE ', path.basename(process.argv[1]), '"recovery_phrase"');
        process.exit(1);
    }

    if (!bip39.validateMnemonic(process.argv[2])) {
        console.error("Invalid mnemonic", process.argv[2]);
        process.exit(2);
    }
    const seed = bip39.mnemonicToSeed(process.argv[2]);
    console.log('SEED', seed.toString('hex'));
    if (process.argv.length == 3) {
        printAddrs(seed);
        process.exit(0);
    }

    const s = searchAddr(seed, process.argv[3])
    if (s) {
        console.log('FOUND');
        s.forEach(x => console.log((x.network.padEnd(5) + ":" + x.path.padEnd(25) + x.addr)));
        process.exit(0);
    } else {
        console.log("NOT FOUND")
        process.exit(1);
    }

}
