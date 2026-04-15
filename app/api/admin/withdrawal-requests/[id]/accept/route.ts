import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { calculateFeeAmount, collectPlatformFeeFromTreasury } from '@/lib/fees/platformFee';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { canonicalHouseUserAddress } from '@/lib/wallet/canonicalAddress';
import { ethers } from 'ethers';

async function executeTreasuryWithdrawal(
  userAddress: string,
  currency: string,
  amount: number,
  feeAmountOverride?: number,
) {
  const normalizedCurrency = currency.toUpperCase();
  const feeAmount =
    typeof feeAmountOverride === 'number' && Number.isFinite(feeAmountOverride)
      ? feeAmountOverride
      : calculateFeeAmount(amount);
  const netWithdrawAmount = amount - feeAmount;

  if (netWithdrawAmount <= 0) {
    throw new Error('Withdrawal net amount after fees must be > 0');
  }

  const feeTxHash = await collectPlatformFeeFromTreasury(normalizedCurrency, feeAmount);

  let withdrawTxHash: string;
  if (normalizedCurrency === 'BNB') {
    const { transferBNBFromTreasury } = await import('@/lib/bnb/backend-client');
    withdrawTxHash = await transferBNBFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'SOL' || normalizedCurrency === 'BYNOMO') {
    if (normalizedCurrency === 'BYNOMO') {
      const { transferTokenFromTreasury } = await import('@/lib/solana/backend-client');
      const BYNOMO_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';
      withdrawTxHash = await transferTokenFromTreasury(userAddress, netWithdrawAmount, BYNOMO_MINT);
    } else {
      const { transferSOLFromTreasury } = await import('@/lib/solana/backend-client');
      withdrawTxHash = await transferSOLFromTreasury(userAddress, netWithdrawAmount);
    }
  } else if (normalizedCurrency === 'SUI') {
    const { transferSUIFromTreasury } = await import('@/lib/sui/backend-client');
    withdrawTxHash = await transferSUIFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'XLM') {
    const { transferXLMFromTreasury } = await import('@/lib/stellar/backend-client');
    withdrawTxHash = await transferXLMFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'XTZ') {
    const { transferXTZFromTreasury } = await import('@/lib/tezos/backend-client');
    withdrawTxHash = await transferXTZFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'NEAR') {
    const { transferNEARFromTreasury } = await import('@/lib/near/backend-client');
    withdrawTxHash = await transferNEARFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'STRK') {
    const { transferSTRKFromTreasury } = await import('@/lib/starknet/backend-client');
    withdrawTxHash = await transferSTRKFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'PUSH' || normalizedCurrency === 'PC') {
    const { transferPUSHFromTreasury } = await import('@/lib/push/backend-client');
    withdrawTxHash = await transferPUSHFromTreasury(userAddress, netWithdrawAmount);
  } else if (normalizedCurrency === 'SOMNIA' || normalizedCurrency === 'STT') {
    const { transferSOMNIAFromTreasury } = await import('@/lib/somnia/backend-client');
    withdrawTxHash = await transferSOMNIAFromTreasury(userAddress, netWithdrawAmount);
  } else {
    throw new Error(`Unsupported currency for withdrawal: ${currency}`);
  }

  const combinedTxHash = feeTxHash ? `${feeTxHash}|netTx:${withdrawTxHash}` : withdrawTxHash;
  return { combinedTxHash, withdrawTxHash, feeTxHash, feeAmount, netWithdrawAmount };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminAuth(request);
  if (deny) return deny;
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    // Explicit column selection to avoid exposing sensitive future columns
    const { data: req, error: reqError } = await supabase
      .from('withdrawal_requests')
      .select('id, user_address, currency, amount, net_amount, fee_amount, requested_at, status, decided_by, tx_hash, notes, account_type, signature, signed_at, created_at')
      .eq('id', id)
      .single();

    if (reqError) throw reqError;
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') {
      return NextResponse.json({ error: `Cannot accept request in status: ${req.status}` }, { status: 400 });
    }

    const userAddress = String(req.user_address);
    const currency = String(req.currency);
    const amount = Number(req.amount);
    const normalizedCurrency = currency.toUpperCase();

    // Re-verify signed intent for EVM-like chains.
    const requiresIntentSignature =
      normalizedCurrency === 'BNB' ||
      normalizedCurrency === 'PUSH' ||
      normalizedCurrency === 'PC' ||
      normalizedCurrency === 'SOMNIA' ||
      normalizedCurrency === 'STT' ||
      normalizedCurrency === '0G';

    if (requiresIntentSignature) {
      if (!req.signature || !req.signed_at) {
        return NextResponse.json({ error: 'Missing signed withdrawal authorization' }, { status: 401 });
      }
      const signedAt = Number(req.signed_at);
      const displayCurrency =
        normalizedCurrency === 'PC' ? 'PC' :
        normalizedCurrency === 'STT' ? 'STT' :
        normalizedCurrency;
      const expectedMessage = `BYNOMO withdrawal authorization\naddress:${userAddress}\namount:${amount.toFixed(8)}\ncurrency:${displayCurrency}\nsignedAt:${signedAt}`;
      const recovered = ethers.verifyMessage(expectedMessage, String(req.signature));
      if (canonicalHouseUserAddress(recovered) !== canonicalHouseUserAddress(userAddress)) {
        return NextResponse.json({ error: 'Invalid withdrawal signature' }, { status: 401 });
      }
    }

    const addrVariants = walletAddressSearchVariants(userAddress);

    const { data: balRows, error: userError } = await supabase
      .from('user_balances')
      .select('balance, status, user_address')
      .in('user_address', addrVariants)
      .eq('currency', currency);

    if (userError || !balRows?.length) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 });
    }
    for (const row of balRows) {
      if (row.status === 'frozen') {
        return NextResponse.json({ error: 'Account is frozen. Withdrawals are disabled.' }, { status: 403 });
      }
      if (row.status === 'banned') {
        return NextResponse.json({ error: 'Account is banned.' }, { status: 403 });
      }
    }
    const sortedByBal = [...balRows].sort((a, b) => Number(b.balance) - Number(a.balance));
    const userRow = sortedByBal.find(r => Number(r.balance) >= amount);
    if (!userRow) {
      return NextResponse.json({ error: 'Insufficient house balance for acceptance' }, { status: 400 });
    }
    const dbAddress = userRow.user_address;

    // Execute chain transfers.
    const feeAmountFromRequest = Number(req.fee_amount);
    const { combinedTxHash, feeTxHash } = await executeTreasuryWithdrawal(
      userAddress.trim(),
      currency,
      amount,
      Number.isFinite(feeAmountFromRequest) ? feeAmountFromRequest : undefined,
    );

    // Update Supabase balance (deducts user's balance and logs withdrawal audit).
    const { data: updData, error: updError } = await supabase.rpc('update_balance_for_withdrawal', {
      p_user_address: dbAddress,
      p_withdrawal_amount: amount,
      p_currency: currency,
      p_transaction_hash: combinedTxHash,
    });

    if (updError) {
      return NextResponse.json({ error: updError.message || 'Balance update failed' }, { status: 500 });
    }

    const { error: updateReqError } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'accepted',
        decided_at: new Date().toISOString(),
        decided_by: 'admin',
        tx_hash: combinedTxHash,
        fee_tx_hash: feeTxHash,
      })
      .eq('id', id);

    if (updateReqError) throw updateReqError;

    return NextResponse.json({ success: true, newBalance: updData?.new_balance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to accept withdrawal request' }, { status: 500 });
  }
}

