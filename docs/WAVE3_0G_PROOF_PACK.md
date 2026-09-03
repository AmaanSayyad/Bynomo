# Wave 3 — 0G Integration Proof Pack (Bynomo)

This file is meant to be used directly in your Wave 3 submission to AKINDO / 0G judges.
It provides a copy/paste checklist and the exact 0G configuration values currently used by this repo.

## 1) 0G Mainnet configuration (from `.env`)

Chain
- `NEXT_PUBLIC_ZG_MAINNET_CHAIN_ID=16661`
- `NEXT_PUBLIC_ZG_MAINNET_NAME=0G Mainnet`
- Native symbol: `NEXT_PUBLIC_ZG_MAINNET_CURRENCY_SYMBOL=0G`

RPC / Explorer
- `NEXT_PUBLIC_ZG_MAINNET_RPC=https://evmrpc.0g.ai`
- `NEXT_PUBLIC_ZG_MAINNET_EXPLORER=https://chainscan.0g.ai`

Treasury integration target (deposit + withdrawal/fee rail)
- `NEXT_PUBLIC_ZG_TREASURY_ADDRESS=0xCBae80461Bb820e4075035F765f8a46fA65a6ded`

## 2) Explorer links to include in your submission

0G treasury address page
- `https://chainscan.0g.ai/address/0xCBae80461Bb820e4075035F765f8a46fA65a6ded`

Example tx link templates (replace with real Wave 3 tx hashes)
- Deposit tx: `https://chainscan.0g.ai/tx/<DEPOSIT_TX_HASH>`
- Withdrawal tx: `https://chainscan.0g.ai/tx/<WITHDRAW_TX_HASH>`
- (Optional) Fee transfer tx (if applicable to your demo): `https://chainscan.0g.ai/tx/<FEE_TX_HASH>`

## 3) What judges should verify (Wave 3 proof checklist)

1. **0G wallet flow works**: frontend prompts to switch/add `0G Mainnet` (EVM chain switching).
2. **Deposit is real and verifiable**:
   - user sends native `0G` to `NEXT_PUBLIC_ZG_TREASURY_ADDRESS`
   - backend verifies the tx receipt via the 0G RPC
   - Supabase balance is credited and logged in `balance_audit_log` with operation type `deposit`
3. **Withdrawal is real and verifiable**:
   - backend executes treasury transfer calling `withdrawTo(to, amount)` on the configured treasury integration target
   - Supabase balance is updated and logged in `balance_audit_log` with operation type `withdrawal`

## 4) Mapping from proof to code (so reviewers can audit quickly)

0G chain definition / runtime config
- `lib/zg/config.ts` (rpcUrls, blockExplorerUrls, treasury address)
- `lib/bnb/wagmi.ts` (wagmi chain config for `zgMainnet`)

0G deposit verification
- `lib/balance/verifyEvmDepositTx.ts`
  - checks `tx.from == userAddress`
  - checks `tx.to == ZG treasuryAddress`
  - checks `receipt.status == 1`

0G withdrawals / fee transfers
- `lib/zg/backend-client.ts`
  - uses treasury ABI with `withdrawTo(address,uint256)` and executes it from backend signer
- `app/api/balance/withdraw/route.ts`
  - routes withdrawals for currency `0G` into `transferZGFromTreasury()`

Fee transfers
- `lib/fees/platformFee.ts`
  - routes `0G` fees through `transferZGFromTreasury()` as well

## 5) Demo video script (2–3 minutes)

1. Connect wallet and switch to `0G Mainnet`
2. Deposit a small amount:
   - show deposit tx hash on the 0G Explorer
   - show the UI balance credit
3. Place a bet and show the outcome in the UI
4. Withdraw:
   - show the withdrawal tx hash on the 0G Explorer

## 6) Common setup/replication note (important)

This repo expects:
- `ZG_TREASURY_PRIVATE_KEY` (not `ZG_TREASURY_SECRET_KEY`)

If you change anything locally, keep the env var name aligned with `lib/zg/backend-client.ts`.

