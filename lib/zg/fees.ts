/**
 * 0G Mainnet rejects txs whose EIP-1559 tip is below 2 gwei:
 * "gas tip cap 1500000000, minimum needed 2000000000"
 * MetaMask's default tip is often 1.5 gwei, so we pin fees from RPC with that floor.
 */

import { getRpcUrl } from './config';

/** 0G mempool floor from RPC 0x4115 */
export const ZG_MIN_PRIORITY_FEE_WEI = BigInt(2_000_000_000);
/** Current public RPC typically quotes ~4 gwei */
const ZG_FALLBACK_PRIORITY_FEE_WEI = BigInt(4_000_000_000);

export type ZGEip1559Fees = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

function hexToBigInt(value: unknown): bigint | null {
  if (typeof value !== 'string' || !value.startsWith('0x')) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`0G RPC ${method} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(payload.error.message || method);
  return payload.result;
}

export async function getZGEip1559Fees(): Promise<ZGEip1559Fees> {
  let tip = ZG_FALLBACK_PRIORITY_FEE_WEI;
  let gasPrice = ZG_FALLBACK_PRIORITY_FEE_WEI;
  let baseFee = BigInt(1);

  try {
    const [priorityRaw, gasPriceRaw, block] = await Promise.all([
      rpcCall('eth_maxPriorityFeePerGas').catch(() => null),
      rpcCall('eth_gasPrice').catch(() => null),
      rpcCall('eth_getBlockByNumber', ['latest', false]).catch(() => null),
    ]);
    const rpcTip = hexToBigInt(priorityRaw);
    const rpcGas = hexToBigInt(gasPriceRaw);
    const rpcBase = hexToBigInt((block as { baseFeePerGas?: string } | null)?.baseFeePerGas);
    if (rpcTip && rpcTip > BigInt(0)) tip = rpcTip;
    if (rpcGas && rpcGas > BigInt(0)) gasPrice = rpcGas;
    if (rpcBase && rpcBase > BigInt(0)) baseFee = rpcBase;
  } catch {
    // use fallbacks
  }

  if (tip < ZG_MIN_PRIORITY_FEE_WEI) tip = ZG_MIN_PRIORITY_FEE_WEI;
  const maxFeePerGas = gasPrice > tip + baseFee ? gasPrice : tip + baseFee * BigInt(2);
  return {
    maxPriorityFeePerGas: tip,
    maxFeePerGas: maxFeePerGas < tip ? tip : maxFeePerGas,
  };
}
