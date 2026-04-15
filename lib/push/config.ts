/**
 * Push Chain Network Configuration
 * Push Chain Donut Testnet (Chain ID: 42101)
 */

export interface PushConfig {
    rpcEndpoint: string;
    chainId: number;
    treasuryAddress: string;
}

export function getPushConfig(): PushConfig {
    const rpcEndpoint = process.env.NEXT_PUBLIC_PUSH_RPC_ENDPOINT || 'https://evm.rpc-testnet-donut-node1.push.org/';
    const chainId = 42101; // Push Chain Donut Testnet
    const treasuryAddress =
        process.env.NEXT_PUBLIC_PUSH_TREASURY_ADDRESS ||
        process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
        '';

    if (!treasuryAddress) {
        console.warn('Missing NEXT_PUBLIC_PUSH_TREASURY_ADDRESS. Please set it in your .env file.');
    }

    return {
        rpcEndpoint,
        chainId,
        treasuryAddress,
    };
}

/** EVM-style block explorer for Push Donut (tx / address links after deposit & withdraw). */
export function getPushExplorerBaseUrl(): string {
    const raw =
        process.env.NEXT_PUBLIC_PUSH_EXPLORER_URL?.trim() ||
        'https://donut.push.network';
    return raw.replace(/\/$/, '');
}

export function getPushExplorerTxUrl(txHash: string): string {
    const h = (txHash || '').trim();
    return `${getPushExplorerBaseUrl()}/tx/${encodeURIComponent(h)}`;
}

export function getPushExplorerAddressUrl(address: string): string {
    const a = (address || '').trim();
    return `${getPushExplorerBaseUrl()}/address/${encodeURIComponent(a)}`;
}
