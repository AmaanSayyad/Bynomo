'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { LiveChart } from './';
import { BalanceDisplay } from '@/components/balance';
import { startPriceFeed } from '@/lib/store/gameSlice';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { getBNBConfig } from '@/lib/bnb/config';
import { getAddress } from 'viem';
import { ethers } from 'ethers';
import { useToast } from '@/lib/hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, ShieldCheck, Loader2, Wallet } from 'lucide-react';
import { useSignAndExecuteTransaction, useCurrentAccount, useDisconnectWallet as useSuiDisconnect } from '@mysten/dapp-kit';
import { useWalletClient, useDisconnect as useWagmiDisconnect } from 'wagmi';
import { useInterwovenKit } from '@initia/interwovenkit-react';
import { parseEther } from 'viem';
import posthog from 'posthog-js';
import { useSomniaReactivity } from '@/lib/hooks/useSomniaReactivity';


export const GameBoard: React.FC = () => {
  const BYNOMO_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';
  const {
    address,
    isConnected,
    network,
    walletBalance,
    houseBalance,
    bets,
    gameMode,
    setGameMode,
    setTimeframeSeconds,
    selectedAsset,
    updatePrice,
    placeBetFromHouseBalance,
    isPlacingBet,
    isBlitzActive,
    blitzEndTime,
    nextBlitzTime,
    hasBlitzAccess,
    updateBlitzTimer,
    enableBlitzAccess,
    error,
    clearError,
    isLoading: isLoadingBalance,
    activeTab,
    setActiveTab,
    userTier,
    refreshWalletBalance,
    accessCode,
    fetchProfile,
    selectedCurrency,
    setSelectedCurrency
  } = useStore();

  // Real-time house balance updates for Somnia via Somnia Reactivity
  useSomniaReactivity();

  const { wallets } = useWallets();
  const { } = usePrivy();
  const { sendTransaction: sendSolanaTransaction } = useSolanaWallet();
  const { data: walletClient } = useWalletClient();
  const { disconnect: wagmiDisconnect } = useWagmiDisconnect();
  const { mutate: disconnectSui } = useSuiDisconnect();
  const { disconnect: disconnectInitia, requestTxBlock: requestInitiaTx } = useInterwovenKit();
  const { signAndSubmitTransaction: signAndSubmitAptos, disconnect: disconnectAptos } = useAptosWallet();

  const [betAmount, setBetAmount] = useState<string>('0.1');
  // Default box-mode settings (when user lands on /trade):
  // - Quick Amount: 0.1
  // - Expiration Time: 5s
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const [blitzCountdown, setBlitzCountdown] = useState<string>('');
  const [blitzTimeRemaining, setBlitzTimeRemaining] = useState<string>('');
  const [isActivatingBlitz, setIsActivatingBlitz] = useState(false);
  const { mutateAsync: signAndExecuteSui } = useSignAndExecuteTransaction();
  const suiAccount = useCurrentAccount();

  const toast = useToast();
  const [accessInput, setAccessInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [walletPanelBalance, setWalletPanelBalance] = useState<number | null>(null);

  // Keep wallet-balance value in sync with the SOL/BYNOMO toggle.
  // Without this, the numeric value can remain from the previous symbol
  // (e.g. SOL amount shown with BYNOMO label) until another action triggers refresh.
  useEffect(() => {
    if (!isConnected || !address || !network) return;
    if (network !== 'SOL' && network !== 'SUI') return;
    void refreshWalletBalance();
  }, [selectedCurrency, isConnected, address, network, refreshWalletBalance]);

  // Read wallet-panel balance directly for toggle-sensitive currencies.
  // This prevents stale SOL values being shown when BYNOMO is selected.
  useEffect(() => {
    let cancelled = false;
    const loadWalletPanelBalance = async () => {
      if (!isConnected || !address || !network) {
        if (!cancelled) setWalletPanelBalance(null);
        return;
      }
      try {
        if (network === 'SOL') {
          const { getSOLBalance, getTokenBalance } = await import('@/lib/solana/client');
          const symbol = selectedCurrency || 'SOL';
          const bal = symbol === 'BYNOMO'
            ? await getTokenBalance(address, BYNOMO_MINT)
            : await getSOLBalance(address);
          if (!cancelled) setWalletPanelBalance(bal);
          return;
        }

        if (network === 'ZG') {
          const { getZGBalance } = await import('@/lib/zg/client');
          const bal = await getZGBalance(address);
          if (!cancelled) setWalletPanelBalance(bal);
          return;
        }

        // For other networks use the unified store value (keep in sync when it updates).
        if (!cancelled) setWalletPanelBalance(walletBalance);
      } catch (e) {
        // Never fall back to global walletBalance for Solana+BYNOMO — store may still hold SOL.
        if (!cancelled) {
          const sym = selectedCurrency || 'SOL';
          if (network === 'SOL' && sym === 'BYNOMO') {
            setWalletPanelBalance(0);
          } else if (network === 'ZG') {
            setWalletPanelBalance(null);
          } else {
            setWalletPanelBalance(walletBalance);
          }
        }
      }
    };

    void loadWalletPanelBalance();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, network, selectedCurrency, walletBalance]);

  // Unified balance and currency
  const currencySymbol = network === 'SOL' ? (selectedCurrency || 'SOL') : network === 'SUI' ? (selectedCurrency === 'USDC' ? 'USDC' : 'SUI') : network === 'XLM' ? 'XLM' : network === 'XTZ' ? 'XTZ' : network === 'NEAR' ? 'NEAR' : network === 'STRK' ? 'STRK' : network === 'PUSH' ? 'PC' : network === 'SOMNIA' ? 'STT' : network === 'OCT' ? 'OCT' : network === 'ZG' ? '0G' : network === 'INIT' ? 'INIT' : network === 'APT' ? 'APT' : 'BNB';
  // Per-chain blitz entry fees (paid to the platform fee collector wallet, not treasury).
  const BLITZ_FEES: Record<string, number> = {
    BNB:    0.1,
    SOL:    1,
    SUI:    50,
    XLM:    400,
    XTZ:    150,
    NEAR:   50,
    STRK:   1500,
    // Testnet / minor chains keep a nominal fee
    PUSH:   0.01,
    SOMNIA: 0.01,
    ZG:     0.01,
    OCT:    0.01,
    INIT:   0.01,
    APT:    0.1,
  };
  const isSolBynomoBlitz = network === 'SOL' && (selectedCurrency || 'SOL') === 'BYNOMO';
  const SOL_BYNOMO_BLITZ_FEE = 8_000_000;
  const blitzEntryFee = isSolBynomoBlitz
    ? SOL_BYNOMO_BLITZ_FEE
    : ((network ? BLITZ_FEES[network] : undefined) ?? 0.01);

  // Blitz entry is always paid in the chain native token (Sui path uses native SUI, not USDC house ledger).
  const blitzEntryCurrencySymbol =
    network === 'SOL' ? (isSolBynomoBlitz ? 'BYNOMO' : 'SOL')
      : network === 'SUI' ? 'SUI'
        : network === 'XLM' ? 'XLM'
          : network === 'XTZ' ? 'XTZ'
            : network === 'NEAR' ? 'NEAR'
              : network === 'STRK' ? 'STRK'
                : network === 'PUSH' ? 'PC'
                  : network === 'SOMNIA' ? 'STT'
                    : network === 'OCT' ? 'OCT'
                      : network === 'ZG' ? '0G'
                        : network === 'INIT' ? 'INIT'
                          : network === 'APT' ? 'APT'
                            : 'BNB';

  // Connection status
  const isWalletConnected = !!address;
  const isUnauthorized = false; // Access codes disabled

  const handleEnterBlitz = async () => {
    if (!isWalletConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!isBlitzActive) {
      toast.error("Blitz Round is not currently active");
      return;
    }

    try {
      setIsActivatingBlitz(true);
      
      // Track Blitz entry attempt (no wallet address sent to third-party analytics)
      posthog.capture('blitz_entry_started', {
        network,
        entryFee: blitzEntryFee
        // address intentionally omitted to protect user privacy
      })

      if (network === 'SOL') {
        const {
          getSolanaConnection,
          buildSolTransferTransaction,
          buildTokenTransferTransaction,
        } = await import('@/lib/solana/client');
        const connection = getSolanaConnection();
        const payingWithBynomo = (selectedCurrency || 'SOL') === 'BYNOMO';
        const feeWallet = payingWithBynomo
          ? (process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_BYNOMO || process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_SOL)
          : process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_SOL;
        if (!feeWallet) {
          throw new Error(`${payingWithBynomo ? 'BYNOMO' : 'SOL'} fee collector wallet not configured`);
        }
        const transaction = payingWithBynomo
          ? await buildTokenTransferTransaction(blitzEntryFee, address, feeWallet, BYNOMO_MINT)
          : await buildSolTransferTransaction(blitzEntryFee, address, feeWallet);
        toast.info(`Confirming ${blitzEntryFee} ${payingWithBynomo ? 'BYNOMO' : 'SOL'} Blitz Entry...`);
        const signature = await sendSolanaTransaction(transaction, connection);
        if (process.env.NODE_ENV === 'development') {
          console.log("Solana Blitz confirmed");
        }
      } else if (network === 'BNB') {
        const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        if (!wallet) {
          throw new Error("Active wallet not found in session. Please reconnect.");
        }

        const ethereumProvider = await wallet.getEthereumProvider();
        const provider = new ethers.BrowserProvider(ethereumProvider);
        const signer = await provider.getSigner();

        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM;
        if (!feeWallet) throw new Error('EVM fee collector wallet not configured');

        toast.info(`Confirming ${blitzEntryFee} BNB Blitz Entry...`);
        const txResponse = await signer.sendTransaction({
          to: getAddress(feeWallet),
          value: ethers.parseEther(blitzEntryFee.toString()),
        });
        if (process.env.NODE_ENV === 'development') {
          console.log("BNB Blitz confirmed");
        }
      } else if (network === 'SUI') {
        if (!suiAccount) throw new Error('Sui wallet not connected');
        const { buildSuiNativeTransferTransaction } = await import('@/lib/sui/client');
        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_SUI;
        if (!feeWallet) throw new Error('SUI fee collector wallet not configured');
        const tx = await buildSuiNativeTransferTransaction(blitzEntryFee, address, feeWallet);
        toast.info(`Confirming ${blitzEntryFee} SUI Blitz Entry...`);
        const result = await signAndExecuteSui({ transaction: tx as any });
        if (process.env.NODE_ENV === 'development') {
          console.log("Sui Blitz confirmed");
        }
      } else if (network === 'XTZ') {
        const { BeaconWallet } = await import('@taquito/beacon-wallet');
        const { NetworkType } = await import('@airgap/beacon-types');
        const { getTezosClient } = await import('@/lib/tezos/client');

        const rpcUrl = process.env.NEXT_PUBLIC_TEZOS_RPC_URL || 'https://rpc.tzkt.io/mainnet';
        const wallet = new BeaconWallet({
          name: "BYNOMO",
          preferredNode: rpcUrl,
          network: { type: NetworkType.MAINNET, rpcUrl }
        } as any);

        await wallet.requestPermissions();
        const tezos = await getTezosClient();
        tezos.setWalletProvider(wallet);

        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_XTZ;
        if (!feeWallet) throw new Error('XTZ fee collector wallet not configured');

        toast.info(`Confirming ${blitzEntryFee} XTZ Blitz Entry...`);
        const op = await tezos.wallet.transfer({ to: feeWallet, amount: blitzEntryFee }).send();
        if (process.env.NODE_ENV === 'development') {
          console.log("Tezos Blitz confirmed");
        }
      } else if (network === 'XLM') {
        const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import('@creit.tech/stellar-wallets-kit');
        const { TransactionBuilder, Networks, Operation, Asset, Horizon } = await import('@stellar/stellar-sdk');

        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_XLM;
        if (!feeWallet) throw new Error('XLM fee collector wallet not configured');

        const server = new Horizon.Server(process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon.stellar.org');
        const account = await server.loadAccount(address);

        const transaction = new TransactionBuilder(account, {
          fee: '100',
          networkPassphrase: Networks.PUBLIC,
        })
          .addOperation(Operation.payment({
            destination: feeWallet,
            asset: Asset.native(),
            amount: blitzEntryFee.toFixed(7),
          }))
          .setTimeout(30)
          .build();

        const kit = new StellarWalletsKit({
          network: WalletNetwork.PUBLIC,
          modules: allowAllModules(),
        });

        toast.info(`Confirming ${blitzEntryFee} XLM Blitz Entry...`);
        const { signedTxXdr } = await kit.signTransaction(transaction.toXDR());
        const result = await server.submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, Networks.PUBLIC));
        if (process.env.NODE_ENV === 'development') {
          console.log("Stellar Blitz confirmed");
        }
      } else if (network === 'NEAR') {
        const { transferNEARToAddress } = await import('@/lib/near/wallet');
        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_NEAR;
        if (!feeWallet) throw new Error('NEAR fee collector wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} NEAR Blitz Entry...`);
        const txHash = await transferNEARToAddress(blitzEntryFee.toString(), feeWallet);
        if (process.env.NODE_ENV === 'development') {
          console.log("NEAR Blitz confirmed");
        }
      } else if (network === 'STRK') {
        const { transferSTRKToAddress } = await import('@/lib/starknet/wallet');
        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_STRK;
        if (!feeWallet) throw new Error('STRK fee collector wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} STRK Blitz Entry...`);
        const txHash = await transferSTRKToAddress(blitzEntryFee, feeWallet);
        if (process.env.NODE_ENV === 'development') {
          console.log("Starknet Blitz confirmed");
        }
      } else if (network === 'PUSH') {
        if (!walletClient) throw new Error('Wallet not connected. Please reconnect via Connect Wallet.');
        // PC fees go to the dedicated PC treasury wallet; fall back to the generic EVM fee wallet.
        const pcFeeWallet =
          process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_PC ||
          process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM;
        if (!pcFeeWallet) throw new Error('PC fee treasury wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} PC Blitz Entry...`);
        const hash = await walletClient.sendTransaction({
          to: getAddress(pcFeeWallet) as `0x${string}`,
          value: parseEther(blitzEntryFee.toString()),
        });
        if (process.env.NODE_ENV === 'development') {
          console.log("Push Chain Blitz confirmed");
        }
      } else if (network === 'SOMNIA') {
        if (!walletClient) throw new Error('Wallet not connected. Please reconnect via Connect Wallet.');
        const evmFeeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM;
        if (!evmFeeWallet) throw new Error('EVM fee collector wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} STT Blitz Entry...`);
        const hash = await walletClient.sendTransaction({
          to: getAddress(evmFeeWallet as string),
          value: parseEther(blitzEntryFee.toString()),
        });
        toast.info('Waiting for on-chain confirmation...');
        const { waitForTransactionReceipt } = await import('@wagmi/core');
        const { config: wagmiCfg } = await import('@/lib/bnb/wagmi');
        await waitForTransactionReceipt(wagmiCfg, { hash: hash as `0x${string}`, timeout: 60_000 });
        if (process.env.NODE_ENV === 'development') {
          console.log("Somnia Blitz confirmed");
        }
      } else if (network === 'ZG') {
        if (!walletClient) throw new Error('Wallet not connected. Please reconnect via Connect Wallet.');
        const evmFeeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM;
        if (!evmFeeWallet) throw new Error('EVM fee collector wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} 0G Blitz Entry...`);
        const { getZGEip1559Fees } = await import('@/lib/zg/fees');
        const zgFees = await getZGEip1559Fees();
        const hash = await walletClient.sendTransaction({
          to: getAddress(evmFeeWallet as string),
          value: parseEther(blitzEntryFee.toString()),
          maxFeePerGas: zgFees.maxFeePerGas,
          maxPriorityFeePerGas: zgFees.maxPriorityFeePerGas,
        });
        toast.info('Waiting for on-chain confirmation...');
        const { waitForTransactionReceipt } = await import('@wagmi/core');
        const { config: wagmiCfg } = await import('@/lib/bnb/wagmi');
        await waitForTransactionReceipt(wagmiCfg, { hash: hash as `0x${string}`, timeout: 60_000 });
        if (process.env.NODE_ENV === 'development') {
          console.log("0G Blitz confirmed");
        }
      } else if (network === 'OCT') {
        if (!suiAccount) throw new Error('Sui-compatible wallet not connected');
        const { buildOCTTransferTransaction } = await import('@/lib/onechain/client');
        const octFeeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_OCT;
        if (!octFeeWallet) throw new Error('OCT fee collector wallet not configured');
        toast.info(`Confirming ${blitzEntryFee} OCT Blitz Entry...`);
        const tx = await buildOCTTransferTransaction(blitzEntryFee, address!, octFeeWallet);
        const result = await signAndExecuteSui({ transaction: tx as any });
        if (process.env.NODE_ENV === 'development') {
          console.log("OneChain Blitz confirmed");
        }
      } else if (network === 'INIT') {
        const { buildInitiaTransferTxRequest } = await import('@/lib/initia/client');
        const initFeeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_INIT;
        if (!initFeeWallet) throw new Error('INIT fee collector wallet not configured');
        const txRequest = buildInitiaTransferTxRequest(address!, initFeeWallet, blitzEntryFee);
        toast.info(`Confirming ${blitzEntryFee} INIT Blitz Entry...`);
        const result = await requestInitiaTx(txRequest);
        if (process.env.NODE_ENV === 'development') {
          console.log("Initia Blitz confirmed");
        }
      } else if (network === 'APT') {
        const { getAptosClient } = await import('@/lib/aptos/client');
        const client = getAptosClient();
        const feeWallet = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET_APT;
        if (!feeWallet) throw new Error('APT fee collector wallet not configured');
        
        toast.info(`Confirming ${blitzEntryFee} APT Blitz Entry...`);
        
        const response = await signAndSubmitAptos({
          data: {
            function: "0x1::aptos_account::transfer",
            typeArguments: [],
            functionArguments: [feeWallet, (BigInt(Math.floor(blitzEntryFee * 1e8))).toString()],
          }
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log("Aptos Blitz confirmed");
        }
        await client.getSDK().waitForTransaction({ transactionHash: response.hash });
      } else {
        throw new Error(`Blitz not supported for network: ${network}`);
      }

      toast.success("Payment successful! Blitz Mode enabled.");
      enableBlitzAccess();
      refreshWalletBalance();
      
      // Track successful Blitz entry (sanitized - no wallet address)
      posthog.capture('blitz_entry_success', {
        network,
        entryFee: blitzEntryFee
        // address removed to protect user privacy
      })
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Blitz entry failed:", err.message || err);
      }
      const errorMessage = err.message || "";
      
      // Track Blitz entry failure (sanitized - no wallet address)
      posthog.capture('blitz_entry_failed', {
        network,
        error: errorMessage
        // address removed to protect user privacy
      })
      
      if (errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('User rejected')) {
        toast.error("User rejected");
      } else {
        toast.error(errorMessage || "Failed to enter Blitz Round");
      }
    } finally {
      setIsActivatingBlitz(false);
    }
  };

  const handleValidateAccess = async () => {
    if (!accessInput || isValidating || !address) return;
    setIsValidating(true);
    setAccessError(null);

    try {
      const { balanceMutationHeaders } = await import('@/lib/balance/balanceClientHeaders');
      const res = await fetch('/api/validate-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
        body: JSON.stringify({
          code: accessInput.trim().toUpperCase(),
          walletAddress: address
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await fetchProfile(address);
        toast.success("Access authorized!");
      } else {
        setAccessError(data.error || 'Invalid code');
      }
    } catch (err) {
      setAccessError('Neural connection failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Update Blitz Timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      updateBlitzTimer();
      const now = Date.now();
      if (isBlitzActive && blitzEndTime) {
        const remaining = Math.max(0, blitzEndTime - now);
        setBlitzTimeRemaining(`${Math.floor(remaining / 1000)}s`);
        setBlitzCountdown('');
      } else {
        const timeToNext = Math.max(0, nextBlitzTime - now);
        const mins = Math.floor(timeToNext / 60000);
        const secs = Math.floor((timeToNext % 60000) / 1000);
        setBlitzCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
        setBlitzTimeRemaining('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isBlitzActive, blitzEndTime, nextBlitzTime, updateBlitzTimer]);

  // Identify user when wallet connects — use a one-way hash of the address
  // so PostHog receives a stable anonymous ID without the raw wallet address.
  // This keeps session stitching while protecting user privacy.
  useEffect(() => {
    if (address) {
      // Simple deterministic hash: last 12 chars is NOT sufficient, use a digest approach
      // We XOR-fold a basic hash to create a stable non-reversible identifier
      const simpleHash = address
        .split('')
        .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
      const anonymousId = `u_${Math.abs(simpleHash).toString(36)}_${address.slice(-6)}`;
      posthog.identify(anonymousId, {
        // Never send raw wallet address to third-party analytics
        network,
        hasBlitzAccess,
        userTier,
        hasAccessCode: !!accessCode
      });
    }
  }, [address, network, hasBlitzAccess, userTier, accessCode])


  // Sync selectedDuration with store's timeframeSeconds
  useEffect(() => {
    // Classic: duration picker affects both betting window & grid
    if (gameMode === 'binomo') {
      setTimeframeSeconds(selectedDuration);
      return;
    }

    // Box/Draw: keep draw sizing/parity stable with the reference behavior
    if (gameMode === 'draw') {
      setTimeframeSeconds(5);
      return;
    }

    // Box keeps the existing behavior
    setTimeframeSeconds(selectedDuration);
  }, [selectedDuration, setTimeframeSeconds, gameMode]);

  // Multiplier mapping based on duration
  const getMultiplier = (duration: number) => {
    switch (duration) {
      case 5: return 1.75;
      case 10: return 1.80;
      case 15: return 1.85;
      case 30: return 1.90;
      case 60: return 1.95;
      default: return 1.90;
    }
  };

  const handleBynomoBet = async (direction: 'UP' | 'DOWN') => {
    if (!address || !isWalletConnected || gameMode !== 'binomo' || isUnauthorized) return;

    try {
      const multiplier = getMultiplier(selectedDuration);
      // Track bet placement (sanitized - no wallet address or specific amounts)
      posthog.capture('bet_placed', {
        direction,
        // amount removed to protect financial privacy
        multiplier,
        duration: selectedDuration,
        asset: selectedAsset,
        network,
        currency: currencySymbol
        // wallet address never sent to analytics
      })

      // House balance only — /api/balance/bet deducts Supabase balance; no on-chain stake per bet.
      await placeBetFromHouseBalance(
        betAmount,
        `${direction}-${multiplier}-${selectedDuration}`,
        address,
        undefined,
      );
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to place bet:", err instanceof Error ? err.message : err);
      }
      
      // Track bet failure (sanitized - no wallet address or specific amounts)
      posthog.capture('bet_failed', {
        direction,
        // amount removed to protect financial privacy
        error: err instanceof Error ? err.message : 'Unknown error',
        network
        // wallet address never sent to analytics
      })
    }
  };

  const activeWalletBalance = walletPanelBalance ?? walletBalance;

  const formatAddress = (addr: string) => {
    if (!addr || addr.length <= 10) return addr || '---';
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: number) => {
    return isNaN(bal) ? '0.0000' : bal.toFixed(4);
  };

  return (
    <div className="relative w-full h-full flex overflow-hidden">
      {/* Main Interactive Chart */}
      <div className="absolute inset-0">
        <LiveChart
          betAmount={betAmount}
          setBetAmount={setBetAmount}
        />
      </div>

      {/* Blitz Round Indicator - Top Right */}
      <div className="absolute top-4 sm:top-6 right-3 sm:right-6 z-30 pointer-events-auto">
        <div className={`rounded-xl backdrop-blur-xl border shadow-lg overflow-hidden transition-all duration-500 ${isBlitzActive ? 'bg-gradient-to-br from-orange-500/20 via-red-500/20 to-yellow-500/20 border-orange-500/50 shadow-orange-500/30 animate-pulse' : 'bg-black/80 border-gray-700/50'}`}>
          <div className="px-3 py-2">
            {isBlitzActive ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                  <p className="text-orange-400 text-[9px] font-bold uppercase tracking-wider">BLITZ ACTIVE</p>
                  <p className="text-white text-sm font-bold font-mono">{blitzTimeRemaining} left</p>
                </div>
                {hasBlitzAccess && (
                  <div className="ml-2 px-1.5 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-[8px] text-green-400 font-bold">2x</div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg opacity-50">⏰</span>
                <div>
                  <p className="text-gray-500 text-[9px] font-medium uppercase tracking-wider">Next Blitz</p>
                  <p className="text-gray-300 text-sm font-mono">{blitzCountdown}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Toggle Button - Fixed to bottom (Mobile only) */}
      {!isPanelOpen && (
        <div className="sm:hidden fixed bottom-24 left-4 z-40 animate-in slide-in-from-left duration-300">
          <div className="flex flex-col items-start gap-1">
            {/* Small win indicator if available */}
            {bets.length > 0 && bets[0].won && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-8 text-[11px] font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] flex items-center gap-1"
              >
                <span>+{parseFloat(bets[0].payout).toFixed(2)} {currencySymbol}</span>
              </motion.div>
            )}
            <button
              onClick={() => setIsPanelOpen(true)}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 px-4 flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all active:scale-95 border-emerald-500/20"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-none mb-1">House Balance</span>
                <span className="text-base font-black text-white leading-none font-mono">
                  {houseBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}


      {/* Modern Quick Bet Panel — height-capped + internal scroll so wallet/blitz never overflows under the viewport */}
      <div className="absolute top-2 bottom-6 left-4 right-4 sm:top-4 sm:bottom-12 sm:left-8 sm:right-auto z-[110] pointer-events-none flex min-h-0 flex-col justify-end">
        <div className={`max-h-full min-h-0 bg-gradient-to-br from-black/95 via-purple-950/30 to-black/95 backdrop-blur-xl border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden w-full sm:w-[300px] transition-all duration-300 ease-out pointer-events-auto flex flex-col ${isPanelOpen
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-full opacity-0 scale-95 !pointer-events-none sm:translate-y-0 sm:opacity-100 sm:scale-100 sm:!pointer-events-auto'
          }`}>

          {/* Close button for mobile */}
          <button
            onClick={() => setIsPanelOpen(false)}
            className="sm:hidden absolute top-2 right-2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-xs z-20"
          >
            ✕
          </button>

          {/* Game Mode Selector */}
          <div className="flex shrink-0 gap-1 p-1 bg-black/60 border-b border-white/5" data-tour="game-mode-toggle">
            <button
              data-tour="classic-mode"
              onClick={() => setGameMode('binomo')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-200 ${gameMode === 'binomo'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Classic
            </button>
            <button
              data-tour="box-mode"
              onClick={() => setGameMode('box')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-200 ${gameMode === 'box'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Box
            </button>
            <button
              data-tour="draw-mode"
              onClick={() => setGameMode('draw')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all duration-200 ${gameMode === 'draw'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Draw
            </button>
          </div>

          {/* Tab Navigation - Pill Style */}
          <div className="flex shrink-0 gap-1 p-2 bg-black/40">
            <button
              onClick={() => setActiveTab('bet')}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'bet'
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              Bet
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'wallet'
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('blitz')}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeTab === 'blitz'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-orange-400/70 hover:text-orange-400 hover:bg-orange-400/5'
                }`}
            >
              Blitz
            </button>
          </div>

          {/* Tab body — scrolls inside the card when content (e.g. wallet) is tall */}
          <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto p-4">
            {/* Overlay if not authorized */}
            {isUnauthorized && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <div className="w-full space-y-4 text-center animate-in fade-in zoom-in duration-300">
                  <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                    <Key className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px]">Access Restricted</h4>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={accessInput}
                      onChange={(e) => setAccessInput(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      disabled={isValidating}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-3 text-center text-white font-mono text-base tracking-[0.2em] placeholder:tracking-normal placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                    <button
                      onClick={handleValidateAccess}
                      disabled={!accessInput || isValidating}
                      className="w-full bg-white text-black font-black uppercase tracking-widest text-[10px] py-3 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      {isValidating ? 'Validating...' : 'Unlock Node'}
                    </button>
                    {accessError && (
                      <p className="text-red-500 text-[8px] font-black uppercase tracking-widest">{accessError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={`flex min-h-0 flex-col transition-all duration-700 ${isUnauthorized ? 'blur-xl grayscale opacity-20 pointer-events-none select-none' : ''}`}>
              {activeTab === 'bet' ? (
                <div className="space-y-4">
                  {/* Amount Presets */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                      Quick Amount
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0.1, 0.5, 1, 5, 10].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setBetAmount(amt.toString())}
                          className={`
                            py-2.5 rounded-lg font-bold text-sm transition-all duration-200
                            ${betAmount === amt.toString()
                              ? 'bg-gradient-to-b from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 scale-105'
                              : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:scale-102'
                            }
                          `}
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration Selector */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                      Expiration Time
                    </label>
                    {gameMode === 'draw' && (
                      <p className="text-purple-300 text-[10px] font-bold uppercase tracking-widest mb-2">
                        Draw duration fixed at 5s
                      </p>
                    )}
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {[5, 10, 15, 30, 60].map(duration => (
                        <button
                          key={duration}
                          onClick={() => gameMode !== 'draw' && setSelectedDuration(duration)}
                          disabled={gameMode === 'draw'}
                          className={`
                            py-3 sm:py-2.5 rounded-xl font-black text-[10px] sm:text-xs transition-all duration-300 border
                            ${selectedDuration === duration
                              ? 'bg-purple-600/20 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-105 z-10'
                              : 'bg-black/40 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="tracking-tighter">{duration < 60 ? `${duration}s` : '1m'}</span>
                            {gameMode === 'binomo' && (
                              <span className="text-[7px] sm:text-[8px] opacity-70 font-mono tracking-tighter">x{getMultiplier(duration)}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Input */}
                  <div>
                    <label className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-2 block">
                      Investment Amount
                    </label>
                    <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5">
                      <input
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2 text-white font-mono text-base focus:outline-none min-w-0"
                        placeholder="0.00"
                      />
                      <span className="px-2 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-[10px] font-bold shrink-0">
                        {currencySymbol}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons / Instructions */}
                  {gameMode === 'binomo' ? (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleBynomoBet('UP')}
                        disabled={!isWalletConnected || isPlacingBet || isUnauthorized}
                        className="group relative flex flex-col items-center justify-center gap-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                      >
                        <div className="text-emerald-500 text-2xl font-bold group-hover:scale-110 transition-transform">▲</div>
                        <span className="text-emerald-400 text-xs font-black tracking-tighter uppercase">Higher</span>
                      </button>

                      <button
                        onClick={() => handleBynomoBet('DOWN')}
                        disabled={!isWalletConnected || isPlacingBet || isUnauthorized}
                        className="group relative flex flex-col items-center justify-center gap-1 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                      >
                        <div className="text-rose-500 text-2xl font-bold group-hover:scale-110 transition-transform">▼</div>
                        <span className="text-rose-400 text-xs font-black tracking-tighter uppercase">Lower</span>
                      </button>
                    </div>
                  ) : gameMode === 'box' ? (
                    <div className="pt-2">
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                        <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">Box Mode Active</p>
                        <p className="text-gray-400 text-[10px] leading-relaxed">
                          Click any cell on the grid chart to place your bet. Each cell has a different multiplier based on its distance from the current price.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                        <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">Draw Mode Active</p>
                        <p className="text-gray-400 text-[10px] leading-relaxed">
                          Draw a box on chart → then confirm to place your bet.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ERROR MESSAGE DISPLAY */}
                  {error && (
                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl relative group">
                      <button
                        onClick={clearError}
                        className="absolute top-2 right-2 text-red-500/50 hover:text-red-500 p-1"
                      >
                        ✕
                      </button>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <div className="flex-1">
                          <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Error</p>
                          <p className="text-red-300 text-[11px] leading-tight mt-0.5">
                            {error.includes('User not found') ||
                            error.includes('No house balance') ||
                            error.includes('Insufficient house') ||
                            error.includes('balance')
                              ? `No house credits yet or not enough balance. Deposit ${currencySymbol} from the Wallet tab, then place your bet.`
                              : error}
                          </p>
                          {(error.includes('User not found') ||
                            error.includes('No house balance') ||
                            error.includes('Insufficient house') ||
                            error.includes('balance')) && (
                            <button
                              onClick={() => {
                                setActiveTab('wallet');
                                clearError();
                              }}
                              className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-[10px] font-bold transition-all"
                            >
                              Go to Deposit
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isWalletConnected && null}
                </div>

              ) : activeTab === 'wallet' ? (
                <div className="space-y-4" data-tour="deposit-section">
                  {isWalletConnected && address ? (
                    <>
                      {/* House Balance Display */}
                      <BalanceDisplay />

                      {/* Address Card */}
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Wallet Address</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white font-mono text-sm truncate">{formatAddress(address)}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(address);
                              toast.success('Address copied!');
                            }}
                            className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            title="Copy full address"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Wallet Balance Display */}
                      <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl p-4 border border-purple-500/20">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-gray-400 text-[10px] uppercase tracking-widest">Wallet Balance</p>
                          {network === 'SOL' && (
                            <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                              {['SOL', 'BYNOMO'].map(c => (
                                <button
                                  key={c}
                                  onClick={() => setSelectedCurrency(c)}
                                  className={`px-2 py-0.5 rounded-md text-[8px] font-black transition-all ${(selectedCurrency || 'SOL') === c
                                    ? 'bg-purple-500 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-white">
                            {isLoadingBalance ? 'Loading...' : formatBalance(activeWalletBalance)}
                          </span>
                          <span className="text-purple-400 text-sm font-medium">{currencySymbol}</span>
                        </div>
                      </div>

                      {/* Disconnect Button */}
                      <button
                        onClick={() => {
                          const s = useStore.getState();
                          if (s.network === 'PUSH' || s.network === 'BNB' || s.network === 'SOMNIA' || s.network === 'ZG') wagmiDisconnect();
                          else if (s.network === 'SUI' || s.network === 'OCT') disconnectSui();
                          else if (s.network === 'INIT') disconnectInitia();
                          else if (s.network === 'APT') disconnectAptos();
                          s.setPreferredNetwork(null);
                          s.disconnect();
                        }}
                        className="w-full py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all duration-200"
                      >
                        Disconnect Wallet
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm">No wallet connected</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Blitz Round Section */}
                  <div className={`rounded-xl p-4 relative overflow-hidden border-2 transition-all duration-500 ${isBlitzActive ? 'bg-gradient-to-br from-orange-500/20 via-red-500/10 to-yellow-500/10 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'bg-black/40 border-gray-800/50'}`}>
                    <div className="absolute top-0 right-0 px-3 py-1 bg-orange-500/20 border-b border-l border-orange-500/30 text-orange-400 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                      Live System
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner transition-transform duration-500 ${isBlitzActive ? 'bg-orange-500/20 border-orange-500/50 animate-pulse scale-110' : 'bg-gray-900 border-gray-800'}`}>
                        {isBlitzActive ? '🔥' : '⏰'}
                      </div>
                      <div>
                        <p className={`text-[10px] uppercase font-black tracking-[0.2em] mb-1 ${isBlitzActive ? 'text-orange-400' : 'text-gray-500'}`}>
                          {isBlitzActive ? 'Blitz Round Active' : 'Next Blitz Sequence'}
                        </p>
                        <p className={`text-2xl font-black font-mono tracking-tighter ${isBlitzActive ? 'text-white' : 'text-gray-400'}`}>
                          {isBlitzActive ? blitzTimeRemaining : blitzCountdown}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {network === 'SOL' && (
                        <div className="flex items-center justify-between gap-2 p-2 bg-black/40 border border-white/5 rounded-xl">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pay in</span>
                          <div className="flex gap-1 bg-black/50 p-0.5 rounded-lg border border-white/5">
                            {['SOL', 'BYNOMO'].map((c) => (
                              <button
                                key={c}
                                onClick={() => setSelectedCurrency(c)}
                                className={`px-2 py-1 rounded-md text-[9px] font-black transition-all ${(selectedCurrency || 'SOL') === c
                                  ? 'bg-orange-500 text-white'
                                  : 'text-gray-500 hover:text-gray-300'
                                  }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                          <span>Current Multiplier Boost</span>
                          <span className={isBlitzActive ? 'text-orange-400' : 'text-gray-400'}>{isBlitzActive ? '2.0x' : '1.0x'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${isBlitzActive ? 'bg-gradient-to-r from-orange-500 to-red-500 w-full' : 'bg-gray-700 w-0'}`}
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleEnterBlitz}
                        disabled={!isWalletConnected || hasBlitzAccess || isActivatingBlitz || isUnauthorized}
                        className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${hasBlitzAccess
                          ? 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)] cursor-default'
                          : !isWalletConnected
                            ? 'bg-gray-800 text-gray-500 border border-gray-700'
                            : 'bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 bg-[length:200%_auto] hover:bg-right text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 border-t border-white/20'
                          }`}
                      >
                        {isActivatingBlitz ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                          </span>
                        ) : hasBlitzAccess ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="text-base">✓</span> System Enabled
                          </span>
                        ) : !isWalletConnected ? (
                          'Connect Wallet'
                        ) : (
                          `Enter Blitz Round (${blitzEntryFee} ${blitzEntryCurrencySymbol})`
                        )}
                      </button>

                      <p className={`text-[9px] text-center font-medium leading-relaxed ${isBlitzActive ? 'text-orange-500/60' : 'text-gray-600'}`}>
                        {isBlitzActive
                          ? 'Activate now to receive 2x multipliers on all boosted grid cells.'
                          : 'Blitz rounds occur every 3 minutes. Prepare your balance.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-white/5 bg-black/20 p-4">
            {!isWalletConnected ? (
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest text-center">
                Connect wallet to start trading
              </p>
            ) : isUnauthorized ? (
              <p className="text-purple-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                Initialization Required
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#00ff88] rounded-full shadow-[0_0_8px_#00ff88]" />
                  <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Connected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/20 font-mono">{formatAddress(address)}</span>
                  <button
                    onClick={() => {
                      if (!address) return;
                      navigator.clipboard.writeText(address);
                      setAddressCopied(true);
                      setTimeout(() => setAddressCopied(false), 2000);
                    }}
                    className="text-white/20 hover:text-white/60 transition-colors"
                    title="Copy address"
                  >
                    {addressCopied ? (
                      <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
