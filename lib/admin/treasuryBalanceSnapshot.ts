/**
 * Read-only on-chain balances for admin dashboard (treasury EOAs only).
 * Uses only public env addresses and RPC URLs — no private keys.
 */

import { createPublicClient, formatEther, http, type Chain } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { getBNBConfig } from '@/lib/bnb/config';
import { getPushConfig, getPushExplorerAddressUrl } from '@/lib/push/config';
import { getSomniaConfig } from '@/lib/somnia/config';
import { getZGConfig } from '@/lib/zg/config';
import { getOneChainConfig } from '@/lib/onechain/config';
import { getStarknetConfig } from '@/lib/starknet/config';
import { getInitiaConfig } from '@/lib/initia/config';
import {
  shouldQueryBnbTreasury,
  shouldQueryInitiaTreasury,
  shouldQueryOneChainTreasury,
  shouldQueryPushTreasury,
  shouldQuerySolanaTreasury,
  shouldQuerySomniaTreasury,
  shouldQueryStarknetTreasury,
  shouldQueryStellarTreasury,
  shouldQuerySuiTreasury,
  shouldQueryTezosTreasury,
  shouldQueryZgTreasury,
} from '@/lib/admin/treasuryDashboardNetwork';

export type TreasuryBalanceRow = {
  chain: string;
  label: string;
  address: string;
  asset: string;
  balance: number | null;
  formatted: string;
  explorerUrl: string | null;
  error: string | null;
};

const FETCH_MS = 14_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function fmt(n: number | null, maxFrac = 6): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (n >= 1e9) return n.toExponential(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function evmChain(chainId: number, name: string, rpc: string, symbol: string): Chain {
  return {
    id: chainId,
    name,
    nativeCurrency: { name: symbol, symbol, decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  };
}

async function evmNativeBalance(rpcUrl: string, chainId: number, name: string, symbol: string, address: string): Promise<number> {
  const trimmed = address.trim();
  if (!trimmed.startsWith('0x') || trimmed.length < 10) throw new Error('invalid EVM address');
  const chain = evmChain(chainId, name, rpcUrl, symbol);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const wei = await client.getBalance({ address: trimmed as `0x${string}` });
  return Number(formatEther(wei));
}

async function solNativeLamports(rpc: string, address: string): Promise<number> {
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const conn = new Connection(rpc, 'confirmed');
  const lamports = await conn.getBalance(new PublicKey(address.trim()));
  return lamports / 1e9;
}

async function suiUsdcBalance(rpc: string, owner: string, coinType: string): Promise<number> {
  const { SuiClient } = await import('@mysten/sui/client');
  const client = new SuiClient({ url: rpc });
  const bal = await client.getBalance({ owner: owner.trim(), coinType });
  return Number(bal.totalBalance) / 1_000_000;
}

async function onechainOctBalance(rpc: string, owner: string, coinType: string, decimals: number): Promise<number> {
  const { SuiClient } = await import('@mysten/sui/client');
  const client = new SuiClient({ url: rpc });
  const coins = await client.getCoins({ owner: owner.trim(), coinType });
  const raw = coins.data.reduce((s, c) => s + BigInt(c.balance), BigInt(0));
  return Number(raw) / 10 ** decimals;
}

async function stellarNativeXlm(horizonUrl: string, address: string): Promise<number> {
  const { Horizon } = await import('@stellar/stellar-sdk');
  const server = new Horizon.Server(horizonUrl);
  const account = await server.loadAccount(address.trim());
  const native = account.balances.find((b: { asset_type?: string }) => b.asset_type === 'native');
  if (!native || !('balance' in native)) throw new Error('no native balance');
  return parseFloat((native as { balance: string }).balance);
}

async function tezosNativeXtz(rpcUrl: string, address: string): Promise<number> {
  const { TezosToolkit } = await import('@taquito/taquito');
  const tezos = new TezosToolkit(rpcUrl);
  const bal = await tezos.tz.getBalance(address.trim());
  return bal.toNumber() / 1_000_000;
}

async function nearNativeNear(nodeUrl: string, accountId: string): Promise<number> {
  const { JsonRpcProvider } = await import('near-api-js');
  const provider = new JsonRpcProvider({ url: nodeUrl });
  const view = await provider.viewAccount({ accountId: accountId.trim() });
  return Number(view.amount) / 1e24;
}

async function initiaUinit(restUrl: string, address: string, denom: string): Promise<number> {
  const url = `${restUrl.replace(/\/$/, '')}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address.trim())}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`initia rest ${r.status}`);
  const j = (await r.json()) as { balances?: { denom: string; amount: string }[] };
  const row = j.balances?.find((b) => b.denom === denom);
  if (!row) return 0;
  return Number(row.amount) / 1e6;
}

type RowInput = Pick<TreasuryBalanceRow, 'chain' | 'label' | 'address' | 'asset' | 'explorerUrl'> & {
  fetch: () => Promise<number>;
};

async function row(partial: RowInput): Promise<TreasuryBalanceRow> {
  try {
    const balance = await withTimeout(partial.fetch(), FETCH_MS);
    return {
      ...partial,
      balance,
      formatted: fmt(balance),
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    return {
      ...partial,
      balance: null,
      formatted: '—',
      error: msg,
    };
  }
}

function explorerEvm(kind: 'bsc' | 'push' | 'somnia' | 'zg', addr: string): string | null {
  const a = encodeURIComponent(addr);
  switch (kind) {
    case 'bsc':
      return `https://bscscan.com/address/${a}`;
    case 'push':
      return getPushExplorerAddressUrl(addr);
    case 'somnia': {
      const base = process.env.NEXT_PUBLIC_SOMNIA_TESTNET_EXPLORER || 'https://shannon-explorer.somnia.network';
      return `${base}/address/${a}`;
    }
    case 'zg': {
      const base = process.env.NEXT_PUBLIC_ZG_MAINNET_EXPLORER || 'https://chainscan.0g.ai';
      return `${base}/address/${a}`;
    }
    default:
      return null;
  }
}

/**
 * Collect balances for all configured treasury EOAs (best effort per chain).
 */
export async function buildTreasuryBalanceSnapshot(): Promise<{
  generatedAt: string;
  rows: TreasuryBalanceRow[];
}> {
  const tasks: Promise<TreasuryBalanceRow>[] = [];

  // BNB
  try {
    const cfg = getBNBConfig();
    const chain = cfg.network === 'mainnet' ? bsc : bscTestnet;
    if (shouldQueryBnbTreasury(cfg.network) && cfg.treasuryAddress) {
      tasks.push(
        row({
          chain: 'BNB',
          label: 'BNB Smart Chain — treasury',
          address: cfg.treasuryAddress,
          asset: 'BNB',
          explorerUrl: explorerEvm('bsc', cfg.treasuryAddress),
          fetch: () =>
            evmNativeBalance(cfg.rpcEndpoint, chain.id, chain.name, chain.nativeCurrency.symbol, cfg.treasuryAddress),
        }),
      );
    }
  } catch {
    /* skip */
  }

  // Push (skipped on dashboard unless ADMIN_TREASURY_SHOW_TESTNET — integration is testnet)
  try {
    const cfg = getPushConfig();
    if (shouldQueryPushTreasury() && cfg.treasuryAddress) {
      tasks.push(
        row({
          chain: 'PUSH',
          label: 'Push — treasury',
          address: cfg.treasuryAddress,
          asset: 'native',
          explorerUrl: explorerEvm('push', cfg.treasuryAddress),
          fetch: () => evmNativeBalance(cfg.rpcEndpoint, cfg.chainId, 'Push', 'ETH', cfg.treasuryAddress),
        }),
      );
    }
  } catch {
    /* skip */
  }

  // Somnia
  try {
    const cfg = getSomniaConfig();
    const rpc = cfg.rpcUrls[0];
    if (shouldQuerySomniaTreasury(cfg.chainName) && cfg.treasuryAddress) {
      const addr = String(cfg.treasuryAddress);
      tasks.push(
        row({
          chain: 'STT',
          label: 'Somnia — treasury',
          address: addr,
          asset: cfg.nativeCurrency.symbol,
          explorerUrl: explorerEvm('somnia', addr),
          fetch: () =>
            evmNativeBalance(rpc, cfg.chainId, cfg.chainName, cfg.nativeCurrency.symbol, addr),
        }),
      );
    }
  } catch {
    /* skip */
  }

  // 0G
  try {
    const cfg = getZGConfig();
    const rpc = cfg.rpcUrls[0];
    if (shouldQueryZgTreasury(rpc) && cfg.treasuryAddress) {
      const addr = String(cfg.treasuryAddress);
      tasks.push(
        row({
          chain: '0G',
          label: '0G — treasury',
          address: addr,
          asset: cfg.nativeCurrency.symbol,
          explorerUrl: explorerEvm('zg', addr),
          fetch: () =>
            evmNativeBalance(rpc, cfg.chainId, cfg.chainName, cfg.nativeCurrency.symbol, addr),
        }),
      );
    }
  } catch {
    /* skip */
  }

  // Solana
  const solTreasury = process.env.NEXT_PUBLIC_SOL_TREASURY_ADDRESS?.trim();
  const BYNOMO_MAINNET_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';
  const solRpc =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
      ? 'https://api.mainnet-beta.solana.com'
      : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  if (shouldQuerySolanaTreasury() && solTreasury) {
    tasks.push(
      row({
        chain: 'SOL',
        label: 'Solana — treasury',
        address: solTreasury,
        asset: 'SOL',
        explorerUrl: `https://solscan.io/account/${encodeURIComponent(solTreasury)}`,
        fetch: () => solNativeLamports(solRpc, solTreasury),
      }),
    );
  }

  // Solana — SPL BYNOMO balance in the operational treasury wallet.
  // Keep this tied to NEXT_PUBLIC_SOL_TREASURY_ADDRESS (the wallet controlled by SOL_TREASURY_SECRET_KEY).
  if (shouldQuerySolanaTreasury() && solTreasury) {
    tasks.push(
      row({
        chain: 'SOL',
        label: 'Solana — BYNOMO treasury',
        address: solTreasury,
        asset: 'BYNOMO',
        explorerUrl: `https://solscan.io/account/${encodeURIComponent(solTreasury)}`,
        fetch: async () => {
          const { getTokenBalance } = await import('@/lib/solana/client');
          return getTokenBalance(solTreasury, BYNOMO_MAINNET_MINT);
        },
      }),
    );
  }

  // Sui USDC
  const suiRpc = process.env.NEXT_PUBLIC_SUI_RPC_ENDPOINT?.trim();
  const suiTreasury = process.env.NEXT_PUBLIC_SUI_TREASURY_ADDRESS?.trim();
  const suiUsdcType = process.env.NEXT_PUBLIC_USDC_TYPE?.trim();
  if (shouldQuerySuiTreasury() && suiRpc && suiTreasury) {
    // Native SUI
    tasks.push(
      row({
        chain: 'SUI',
        label: 'Sui — treasury (SUI)',
        address: suiTreasury,
        asset: 'SUI',
        explorerUrl: `https://suiscan.xyz/mainnet/account/${encodeURIComponent(suiTreasury)}`,
        fetch: async () => {
          const { SuiClient } = await import('@mysten/sui/client');
          const client = new SuiClient({ url: suiRpc });
          const bal = await client.getBalance({ owner: suiTreasury });
          return Number(bal.totalBalance) / 1_000_000_000;
        },
      }),
    );

    // USDC on Sui
    if (suiUsdcType) {
      tasks.push(
        row({
          chain: 'SUI',
          label: 'Sui — treasury (USDC)',
          address: suiTreasury,
          asset: 'USDC',
          explorerUrl: `https://suiscan.xyz/mainnet/account/${encodeURIComponent(suiTreasury)}`,
          fetch: () => suiUsdcBalance(suiRpc, suiTreasury, suiUsdcType),
        }),
      );
    }
  }

  // OneChain OCT
  try {
    const oc = getOneChainConfig();
    const ocExplorer = process.env.NEXT_PUBLIC_ONECHAIN_EXPLORER || 'https://explorer-testnet.onechain.one';
    if (
      shouldQueryOneChainTreasury(oc.rpcEndpoint, ocExplorer) &&
      oc.treasuryAddress &&
      oc.rpcEndpoint
    ) {
      tasks.push(
        row({
          chain: 'OCT',
          label: 'OneChain — treasury (OCT)',
          address: oc.treasuryAddress,
          asset: 'OCT',
          explorerUrl: `${ocExplorer.replace(/\/$/, '')}/address/${encodeURIComponent(oc.treasuryAddress)}`,
          fetch: () => onechainOctBalance(oc.rpcEndpoint, oc.treasuryAddress, oc.octCoinType, oc.decimals),
        }),
      );
    }
  } catch {
    /* skip */
  }

  // Stellar
  const xlmTreasury = process.env.NEXT_PUBLIC_STELLAR_TREASURY_ADDRESS?.trim();
  const stellarNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK?.trim() || 'public';
  const horizon = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL?.trim() || 'https://horizon.stellar.org';
  if (shouldQueryStellarTreasury(stellarNetwork, horizon) && xlmTreasury) {
    tasks.push(
      row({
        chain: 'XLM',
        label: 'Stellar — treasury',
        address: xlmTreasury,
        asset: 'XLM',
        explorerUrl: `https://stellar.expert/explorer/public/account/${encodeURIComponent(xlmTreasury)}`,
        fetch: () => stellarNativeXlm(horizon, xlmTreasury),
      }),
    );
  }

  // Tezos
  const xtzTreasury = process.env.NEXT_PUBLIC_TEZOS_TREASURY_ADDRESS?.trim();
  const xtzRpc = process.env.NEXT_PUBLIC_TEZOS_RPC_URL?.trim() || 'https://rpc.tzkt.io/mainnet';
  if (shouldQueryTezosTreasury(xtzRpc) && xtzTreasury) {
    tasks.push(
      row({
        chain: 'XTZ',
        label: 'Tezos — treasury',
        address: xtzTreasury,
        asset: 'XTZ',
        explorerUrl: `https://tzkt.io/${encodeURIComponent(xtzTreasury)}`,
        fetch: () => tezosNativeXtz(xtzRpc, xtzTreasury),
      }),
    );
  }

  // NEAR
  const nearTreasury = process.env.NEXT_PUBLIC_NEAR_TREASURY_ADDRESS?.trim();
  const nearNode = 'https://rpc.mainnet.near.org';
  if (nearTreasury) {
    tasks.push(
      row({
        chain: 'NEAR',
        label: 'NEAR — treasury',
        address: nearTreasury,
        asset: 'NEAR',
        explorerUrl: `https://nearblocks.io/address/${encodeURIComponent(nearTreasury)}`,
        fetch: () => nearNativeNear(nearNode, nearTreasury),
      }),
    );
  }

  // Starknet STRK (ERC-20)
  const snCfg = getStarknetConfig();
  if (shouldQueryStarknetTreasury(snCfg.chainId) && snCfg.treasuryAddress) {
    tasks.push(
      row({
        chain: 'STRK',
        label: 'Starknet — treasury (STRK token)',
        address: snCfg.treasuryAddress,
        asset: 'STRK',
        explorerUrl: `https://starkscan.co/contract/${encodeURIComponent(snCfg.treasuryAddress)}`,
        fetch: async () => {
          const { getSTRKBalance } = await import('@/lib/starknet/client');
          return getSTRKBalance(snCfg.treasuryAddress);
        },
      }),
    );
  }

  // Initia
  try {
    const ic = getInitiaConfig();
    if (shouldQueryInitiaTreasury() && ic.treasuryAddress && ic.restUrl) {
      tasks.push(
        row({
          chain: 'INIT',
          label: 'Initia — treasury',
          address: ic.treasuryAddress,
          asset: 'INIT',
          explorerUrl: `https://scan.initia.xyz/${encodeURIComponent(ic.chainId)}/accounts/${encodeURIComponent(ic.treasuryAddress)}`,
          fetch: () => initiaUinit(ic.restUrl, ic.treasuryAddress, ic.denom),
        }),
      );
    }
  } catch {
    /* skip */
  }

  const rows = await Promise.all(tasks);

  const seen = new Set<string>();
  const unique: TreasuryBalanceRow[] = [];
  for (const r of rows) {
    const k = `${r.chain}|${r.address}|${r.asset}|${r.label}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }

  unique.sort((a, b) => a.chain.localeCompare(b.chain) || a.label.localeCompare(b.label));

  return { generatedAt: new Date().toISOString(), rows: unique };
}
