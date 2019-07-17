const axios = require('axios');
const BN = require('bn.js');

async function getBalance(serverUrl, addr, coin) {
    const response = await axios.get(serverUrl + '/getBalance?addresses=' + addr + '&coin=' + coin, {
        transformResponse: (res) => {
            return res;
        }
    });
    return new BN(response.data);
}


async function getTransactionParams(serverUrl, addr, coin) {
    const response = await axios.get(serverUrl + '/getTransactionParams?addresses=' + addr + '&coin=' + coin)
    return response.data;
}


module.exports = {getBalance, getTransactionParams};