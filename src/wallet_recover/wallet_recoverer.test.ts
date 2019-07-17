import { BigNumber } from 'bignumber.js';
import { IBalanceGetter } from './balance_getter';
import { NetworkPathKey, recover_all_wallets } from './wallet_recoverer';
import {
    BtcTestnetNetwork,
    BtcLivenetNetwork,
    EthMainnetNetwork,
    EthRopstenNetwork
} from './networks';
import fetch from 'node-fetch';

function get_url(url: string): Promise<string> {
    return fetch(url, { method: 'GET' }).then(x => x.text());
}

interface AddressBalance {
    addr: string;
    quantity: string;
}

class BG extends IBalanceGetter {
    get_balances(network: string, addresses: string[]): Promise<BigNumber[]> {
        const query = 'get_addresses_balances(' + JSON.stringify(addresses) + ')';
        if (addresses.length == 0)
            return new Promise<BigNumber[]>((resolve, reject) => resolve([]));
        const url =
            // 'http://46.101.117.238/getBalances?addresses=' +
            'http://localhost:5001/getBalances?addresses=' +
            addresses.join(',') +
            '&coin=' +
            network;
        return get_url(url).then(response => {
            const map = new Map<string, string>();
            const array = JSON.parse(response) as AddressBalance[];
            for (let i = 0; i < array.length; i++) map.set(array[i].addr, array[i].quantity);
            const ret: BigNumber[] = [];
            for (let i = 0; i < addresses.length; i++) {
                const val = map.get(addresses[i]);
                ret.push(val == undefined ? new BigNumber(0) : new BigNumber(val));
            }
            return ret;
        });
    }
}

it(
    'Main TEST',
    async () => {
        try {
            const bg = new BG();
            const nodes: NetworkPathKey[] = [];
            const phrase =
                'resist try nominee battle love surface card rare panel guess elevator check';
            {
                const testnet = new BtcTestnetNetwork();
                const master = testnet.generate_master_from_recovery_phrase(phrase);
                const testnet_node = testnet.generate_root_node_from_master(master);
                nodes.push(new NetworkPathKey(testnet.get_name(), testnet_node));
            }
            {
                const livenet = new BtcLivenetNetwork();
                const master = livenet.generate_master_from_recovery_phrase(phrase);
                const testnet_node = livenet.generate_root_node_from_master(master);
                nodes.push(new NetworkPathKey(livenet.get_name(), testnet_node));
            }
            {
                const livenet = new EthMainnetNetwork();
                const master = livenet.generate_master_from_recovery_phrase(phrase);
                const testnet_node = livenet.generate_root_node_from_master(master);
                nodes.push(new NetworkPathKey(livenet.get_name(), testnet_node));
            }
            {
                const testnet = new EthRopstenNetwork();
                const master = testnet.generate_master_from_recovery_phrase(phrase);
                const testnet_node = testnet.generate_root_node_from_master(master);
                nodes.push(new NetworkPathKey(testnet.get_name(), testnet_node));
            }
            console.log(JSON.stringify(nodes));
            const recovered = await recover_all_wallets(bg, nodes);
            console.log(JSON.stringify(recovered));
        } catch (err) {
            console.error(err);
        }
    },
    60 * 1000
);
