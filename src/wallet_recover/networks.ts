import { fromSeed, fromBase58 } from 'bip32';
import { pubToAddress, toChecksumAddress } from 'ethereumjs-util';
import { networks, payments, Network } from 'bitcoinjs-lib';
import { mnemonicToSeed } from 'bip39';
import { createHmac } from 'crypto';
import HDNode = require('hdkey');
import { PathKeyPair } from './path_key_pair';

export abstract class INetwork {
    protected abstract get_network_id(): number;
    public abstract generate_master_from_recovery_phrase(phrase: string): string;
    public abstract generate_root_node_from_master(master: string): PathKeyPair;
    public abstract derive_child_from_node(node: string, index: number): string;
    public abstract derive_path_from_node(node: string, path: string): string;
    public abstract get_name(): string;
    public abstract get_address(node: string): string;
}

interface MasterType {
    prk: string;
    cc: string;
    puk: string;
}

abstract class BtcNetwork extends INetwork {
    protected abstract get_network_id(): number;
    protected abstract get_network(): Network;
    generate_master_from_recovery_phrase(phrase: string): string {
        return fromSeed(mnemonicToSeed(phrase), this.get_network()).toBase58();
    }
    generate_root_node_from_master(master: string): PathKeyPair {
        const path = 'm/44\'/' + this.get_network_id() + '\'/0\'';
        const pk = fromBase58(master, this.get_network())
            .derivePath(path)
            .neutered()
            .toBase58();
        return new PathKeyPair(path, pk);
    }
    derive_child_from_node(node: string, index: number): string {
        const t = fromBase58(node, this.get_network()).derive(index);
        return t.toBase58();
    }
    derive_path_from_node(node: string, path: string): string {
        return fromBase58(node, this.get_network())
            .derivePath(path)
            .toBase58();
    }
    get_address(node: string): string {
        const options = {
            pubkey: fromBase58(node, this.get_network()).publicKey,
            network: this.get_network()
        };
        return payments.p2pkh(options).address;
    }
}

export class BtcLivenetNetwork extends BtcNetwork {
    protected get_network_id(): number {
        return 0;
    }
    protected get_network(): Network {
        return networks.bitcoin;
    }
    get_name(): string {
        return 'BTC';
    }
}

export class BtcTestnetNetwork extends BtcNetwork {
    protected get_network_id(): number {
        return 1;
    }
    protected get_network(): Network {
        return networks.testnet;
    }
    get_name(): string {
        return 'BTC-Testnet';
    }
}

const MASTER_SECRET = Buffer.from('Bitcoin seed', 'utf8');

function fromMasterSeed(seed_buffer: Buffer) {
    // let t = HmacSHA512(lib.WordArray.create(seed_buffer), 'Bitcoin seed').toString();
    // let I = new Buffer(t, 'hex');
    const I = createHmac('sha512', MASTER_SECRET)
        .update(seed_buffer)
        .digest();
    const IL = I.slice(0, 32);
    const IR = I.slice(32);

    const ret = new HDNode();
    ret.chainCode = IR;
    ret.privateKey = IL;

    return ret;
}

function serializePrivate(node: HDNode): string {
    const ret: any = {
        prk: node.privateKey.toString('hex'),
        cc: node.chainCode.toString('hex')
    };
    return JSON.stringify(ret);
}

function deserializePrivate(s: string): HDNode {
    const master: MasterType = JSON.parse(s);
    const ret = new HDNode();
    ret.chainCode = new Buffer(master.cc, 'hex');
    ret.privateKey = new Buffer(master.prk, 'hex');
    return ret;
}

function serializePublic(node: HDNode): string {
    const ret: any = {
        puk: node.publicKey.toString('hex'),
        cc: node.chainCode.toString('hex')
    };
    return JSON.stringify(ret);
}

function deserializePublic(s: string): HDNode | null {
    const master: MasterType = JSON.parse(s);
    if (master.prk) return null;
    const ret = new HDNode();
    ret.chainCode = new Buffer(master.cc, 'hex');
    ret.publicKey = new Buffer(master.puk, 'hex');
    return ret;
}

abstract class EthNetwork extends INetwork {
    generate_master_from_recovery_phrase(phrase: string): string {
        const master = fromMasterSeed(mnemonicToSeed(phrase));
        return serializePrivate(master);
    }
    generate_root_node_from_master(s: string): PathKeyPair {
        let node = deserializePrivate(s);
        const path = 'm/44\'/' + this.get_network_id() + '\'/0\'';
        node = node.derive(path);
        return new PathKeyPair(path, serializePublic(node));
    }
    derive_child_from_node(s: string, index: number): string {
        const deserialized = deserializePublic(s) || deserializePrivate(s);
        return serializePublic(deserialized.deriveChild(index));
    }
    derive_path_from_node(s: string, path: string): string {
        let deserialized = deserializePublic(s);
        let pub = true;
        if (!deserialized) {
            pub = false;
            deserialized = deserializePrivate(s);
        }
        const derived = deserialized.derive(path);
        let serialized = '';
        if (pub) serialized = serializePublic(derived);
        else serialized = serializePrivate(derived);
        return serialized;
    }
    get_address(s: string): string {
        const master: MasterType = JSON.parse(s);
        const public_key: string = master.puk;
        const address_bin = pubToAddress(new Buffer(public_key, 'hex'), true);
        const address = Buffer.from(address_bin as Buffer).toString('hex');
        return toChecksumAddress(address);
    }
}

export class EthMainnetNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 60;
    }
    get_name(): string {
        return 'ETH';
    }
}

export class EthRopstenNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 1;
    }
    get_name(): string {
        return 'ETH-Ropsten';
    }
}

export class DaiMainnetNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 60;
    }
    get_name(): string {
        return 'DAI';
    }
}

export class DaiRopstenNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 1;
    }
    get_name(): string {
        return 'DAI-Ropsten';
    }
}

export class RskNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 137;
    }
    get_name(): string {
        return 'RSK';
    }
}

export class RskTestnetNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 37310;
    }
    get_name(): string {
        return 'RSK-Testnet';
    }
}

export class RifNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 137;
    }
    get_name(): string {
        return 'RIF';
    }
}

export class RifTestnetNetwork extends EthNetwork {
    protected get_network_id(): number {
        return 37310;
    }
    get_name(): string {
        return 'RIF-Testnet';
    }
}
