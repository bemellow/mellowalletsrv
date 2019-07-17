export class RecoveredWalletDto {
    subwallet_index: number;
    used_addresses: number[];
    constructor(subwallet_index: number, used_addresses: number[]) {
        this.subwallet_index = subwallet_index;
        this.used_addresses = used_addresses;
    }
}

export class RecoveredNetworkDto {
    network: string;
    wallets: RecoveredWalletDto[];
    constructor(network: string, wallets: RecoveredWalletDto[]) {
        this.network = network;
        this.wallets = wallets;
    }
}
