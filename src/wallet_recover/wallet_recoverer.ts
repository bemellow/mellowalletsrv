import * as winston from 'winston';
import {IBalanceGetter} from './balance_getter';
import {
    INetwork,
    BtcLivenetNetwork,
    BtcTestnetNetwork,
    EthMainnetNetwork,
    EthRopstenNetwork,
    DaiMainnetNetwork,
    DaiRopstenNetwork, RskTestnetNetwork, RifTestnetNetwork, RskNetwork, RifNetwork
} from './networks';
import {PathKeyPair} from './path_key_pair';

const ADDR_CHUNK_SIZE_TO_SEARCH = 3;
const NUMBER_OF_WALLETS_TO_SEARCH = 3;

export class NetworkPathKey {
    network: string;
    node: PathKeyPair;

    constructor(network: string, node: PathKeyPair) {
        this.network = network;
        this.node = node;
    }
}

export class RecoveredWallet {
    subwallet_index: number;
    used_addresses: number[];

    constructor(subwallet_index: number, used_addresses: number[]) {
        this.subwallet_index = subwallet_index;
        this.used_addresses = used_addresses;
    }
}

export class RecoveredNetwork {
    network: string;
    wallets: RecoveredWallet[];

    constructor(network: string, wallets: RecoveredWallet[]) {
        this.network = network;
        this.wallets = wallets;
    }
}

function recover_all_paths_in_subwallet(
    network: INetwork,
    balance_getter: IBalanceGetter,
    main_wallet_node: PathKeyPair
): Promise<number[]> {
    return new Promise<number[]>(async (resolve, reject) => {
        try {
            const result: number[] = [];
            const empty_wallets = 0;
            const limit = ADDR_CHUNK_SIZE_TO_SEARCH;
            for (let subwallet = 0; ; subwallet += limit) {
                const pairs: PathKeyPair[] = [];
                const addresses: string[] = [];
                for (let i = 0; i < limit; i++) {
                    const address_node = new PathKeyPair(
                        main_wallet_node.path + '/' + (subwallet + i),
                        network.derive_child_from_node(main_wallet_node.public_key, subwallet + i)
                    );
                    pairs.push(address_node);
                    addresses.push(network.get_address(address_node.public_key));
                }
                const balances = await balance_getter.get_balances(network.get_name(), addresses);
                let any = false;
                for (let i = 0; i < balances.length
                    ; i++) {
                    if (balances[i].isZero()) continue;
                    any = true;
                    result.push(subwallet + i);
                }
                if (!any) {
                    resolve(result);
                    return;
                }
            }
        } catch (e) {
            reject(e);
        }
    });
}

function recover_all_paths(
    network: INetwork,
    balance_getter: IBalanceGetter,
    global_root_node: PathKeyPair
): Promise<RecoveredWallet[]> {
    // console.dir(global_root_node);
    return new Promise<RecoveredWallet[]>(async (resolve, reject) => {
        try {
            const result: RecoveredWallet[] = [];
            let empty_wallets = 0;
            for (let subwallet = 0; ; subwallet++) {
                winston.debug('Recovering wallet index ' + subwallet);
                const local_root_node = new PathKeyPair(
                    global_root_node.path + '/' + subwallet,
                    network.derive_child_from_node(global_root_node.public_key, subwallet)
                );
                const used_paths = await recover_all_paths_in_subwallet(
                    network,
                    balance_getter,
                    local_root_node
                );
                if (used_paths.length === 0) {
                    if (++empty_wallets >= NUMBER_OF_WALLETS_TO_SEARCH) {
                        resolve(result);
                        return;
                    }
                    continue;
                }
                empty_wallets = 0;
                result.push(new RecoveredWallet(subwallet, used_paths));
            }
        } catch (e) {
            reject(e);
        }
    });
}

const network_array: INetwork[] = [
    new BtcLivenetNetwork(),
    new BtcTestnetNetwork(),
    new EthMainnetNetwork(),
    new EthRopstenNetwork(),
    new DaiMainnetNetwork(),
    new DaiRopstenNetwork(),
    new RskNetwork(),
    new RskTestnetNetwork(),
    new RifNetwork(),
    new RifTestnetNetwork()
];
let networks: Map<string, INetwork> | null = null;

function get_network(net_string: string): INetwork | null {
    if (networks == null) {
        networks = new Map<string, INetwork>();
        for (const network of network_array)
            networks.set(network.get_name(), network);
    }
    return networks.get(net_string) || null;
}

export function recover_all_wallets(
    balance_getter: IBalanceGetter,
    nodes: NetworkPathKey[]
): Promise<RecoveredNetwork[]> {
    return new Promise<RecoveredNetwork[]>(async (resolve, reject) => {
        const ret: RecoveredNetwork[] = [];
        let error: any = null;
        let errors = 0;
        for (const node of nodes) {
            const net = get_network(node.network);
            if (net == null) continue;

            try {
                const paths = await recover_all_paths(net, balance_getter, node.node);
                if (paths.length === 0) continue;
                ret.push(new RecoveredNetwork(net.get_name(), paths));
            } catch (e) {
                error = e;
                errors++;
            }
        }
        if (errors === nodes.length) reject(error);
        else resolve(ret);
    });
}
