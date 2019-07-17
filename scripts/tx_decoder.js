const path = require('path');
const txDecoder = require('ethereum-tx-decoder');
var bitcoinjs = require('bitcoinjs-lib');

const DECODERS = {
    'ETH': (tx) => {
        try {
            const decodedTx = txDecoder.decodeTx(tx);
            console.log(JSON.stringify(decodedTx, null, 4));
            console.log("Gas price", decodedTx.gasPrice.toString(10));
            console.log("Gas limit", decodedTx.gasLimit.toString(10));
            console.log("Value", decodedTx.value.toString(10), "WEI");
        } catch (err) {
            console.error("ERROR", err.message);
        }
        /*
        const abiDecoder = require('abi-decoder');

        let erc20Abi = [ { "constant": true, "inputs": [], "name": "name", "outputs": [ { "name": "", "type": "string" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "_spender",
        abiDecoder.addABI(erc20Abi);
        const decodedData = abiDecoder.decodeMethod(decodedTx["data"]);
        console.log(d
        */
    },
    'BTC': (tx) => {
        var decodedTx = bitcoinjs.Transaction.fromHex(tx.startsWith("0x") ? tx.substring(2) : tx);
        var txid = decodedTx.getId();
        console.log(decodedTx);
    }
};

if (process.argv.length != 4) {
    console.error("Usage", path.basename(process.argv[1]), "{ BTC | ETH } tx_in_hex");
    process.exit(1);
}
const type = process.argv[2];
if (!(type in DECODERS)) {
    console.error("Usage", path.basename(process.argv[1]), "{ BTC | ETH } tx_in_hex");
    process.exit(1);
}
DECODERS[type](process.argv[3]);
