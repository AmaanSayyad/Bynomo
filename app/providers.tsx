'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useOverflowStore } from '@/lib/store';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { WagmiProvider, useAccount, useBalance, useSwitchChain } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config as wagmiConfig, pushChainDonut, somniaTestnet, zgMainnet } from '@/lib/bnb/wagmi';
import { bsc } from 'wagmi/chains';

// Solana Imports
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

// Sui Imports
import { createNetworkConfig, SuiClientProvider, WalletProvider, useCurrentAccount, useSuiClientContext } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import '@mysten/dapp-kit/dist/index.css';

// Initia / InterwovenKit Imports
import { InterwovenKitProvider, MAINNET as INITIA_MAINNET, injectStyles as injectInitiaStyles, useInterwovenKit } from '@initia/interwovenkit-react';
import interwovenKitStyles from '@initia/interwovenkit-react/styles.js';

// Aptos Imports
import { AptosWalletAdapterProvider, useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';

// Custom Components
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { ReferralSync } from './ReferralSync';
import type { AssetType } from '@/lib/utils/priceFeed';
import { useSessionTracker } from '@/hooks/useSessionTracker';

// Wallet Sync component to bridge all wallet states with our Zustand store
function WalletSync() {
  const { user, authenticated, ready: privyReady } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const { connected: solanaConnected, publicKey: solanaPublicKey } = useWallet();
  const suiAccount = useCurrentAccount();
  const { selectNetwork: selectSuiNetwork } = useSuiClientContext();
  const { address: wagmiAddress, isConnected: wagmiConnected, chainId: wagmiChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { address: initiaAddress, isConnected: initiaConnected } = useInterwovenKit();
  const { account: aptosAccount, connected: aptosConnected } = useAptosWallet();

  // Fetch PC balance via wagmi (reliable, uses already-established connection)
  const { data: pushBalanceData } = useBalance({
    address: wagmiAddress,
    chainId: pushChainDonut.id,
    query: { enabled: wagmiConnected && !!wagmiAddress && wagmiChainId === pushChainDonut.id },
  });

  // Fetch STT balance via wagmi (Somnia)
  const { data: somniaBalanceData } = useBalance({
    address: wagmiAddress,
    chainId: somniaTestnet.id,
    query: { enabled: wagmiConnected && !!wagmiAddress && wagmiChainId === somniaTestnet.id },
  });

  // Fetch 0G balance via wagmi (0G Mainnet)
  const { data: zgBalanceData } = useBalance({
    address: wagmiAddress,
    chainId: zgMainnet.id,
    query: { enabled: wagmiConnected && !!wagmiAddress && wagmiChainId === zgMainnet.id },
  });

  const {
    address,
    isConnected: storeIsConnected,
    network: storeNetwork,
    accountType,
    setAddress,
    setIsConnected,
    setNetwork,
    refreshWalletBalance,
    fetchBalance,
    fetchProfile,
    preferredNetwork
  } = useOverflowStore();

  // Track session dwell time for this wallet
  useSessionTracker(address, storeNetwork);

  // Sync Push Chain PC balance directly into the store whenever wagmi reports it
  useEffect(() => {
    if (wagmiChainId === pushChainDonut.id && pushBalanceData && storeNetwork === 'PUSH') {
      const formatted = formatUnits(pushBalanceData.value, pushBalanceData.decimals);
      useOverflowStore.setState({ walletBalance: Number.parseFloat(formatted) });
    }
  }, [pushBalanceData, wagmiChainId, storeNetwork]);

  // Sync Somnia STT balance into the store whenever wagmi reports it
  useEffect(() => {
    if (wagmiChainId === somniaTestnet.id && somniaBalanceData && storeNetwork === 'SOMNIA') {
      const formatted = formatUnits(somniaBalanceData.value, somniaBalanceData.decimals);
      useOverflowStore.setState({ walletBalance: Number.parseFloat(formatted) });
    }
  }, [somniaBalanceData, wagmiChainId, storeNetwork]);

  // Sync 0G balance into the store whenever wagmi reports it
  useEffect(() => {
    if (wagmiChainId === zgMainnet.id && zgBalanceData && storeNetwork === 'ZG') {
      const formatted = formatUnits(zgBalanceData.value, zgBalanceData.decimals);
      useOverflowStore.setState({ walletBalance: Number.parseFloat(formatted) });
    }
  }, [zgBalanceData, wagmiChainId, storeNetwork]);

  // Switch Sui client network based on preferredNetwork
  useEffect(() => {
    if (preferredNetwork === 'OCT') {
      selectSuiNetwork('onechain');
    } else if (preferredNetwork === 'SUI') {
      selectSuiNetwork('mainnet');
    }
  }, [preferredNetwork, selectSuiNetwork]);

  // Restoration Effect for Stellar
  const attemptedRestore = useRef(false);
  useEffect(() => {
    if (preferredNetwork === 'XLM' && !attemptedRestore.current) {
      attemptedRestore.current = true;
      const checkStellar = async () => {
        if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'XLM') return;
        try {
          const { restoreSession } = await import('@/lib/stellar/wallet-kit');
          const restoredAddress = await restoreSession();
          if (restoredAddress) {
            setAddress(restoredAddress);
            setIsConnected(true);
            setNetwork('XLM');
            refreshWalletBalance();
            fetchProfile(restoredAddress);
            queueMicrotask(() => fetchBalance(restoredAddress));
          }
        } catch (e) {
          console.error("Stellar restore failed", e);
        }
      };
      checkStellar();
    }
  }, [preferredNetwork, address, setAddress, setIsConnected, setNetwork, refreshWalletBalance, fetchBalance, fetchProfile]);

  // Main Sync Effect
  useEffect(() => {
    // 0. Demo Mode
    if (accountType === 'demo') {
      if (address !== '0xDEMO_1234567890') {
        setAddress('0xDEMO_1234567890');
        setIsConnected(true);
        // Demo mode is also push-only for now.
        setNetwork('PUSH');
      }
      return;
    }

    // 1. Solana
    if (solanaConnected && solanaPublicKey && preferredNetwork === 'SOL') {
      const addr = solanaPublicKey.toBase58();
      if (address !== addr || !storeIsConnected || storeNetwork !== 'SOL') {
        setAddress(addr);
        setIsConnected(true);
        setNetwork('SOL');
        refreshWalletBalance();
        fetchProfile(addr);
      }
      queueMicrotask(() => fetchBalance(addr));
      return;
    }

    // 2. Sui
    if (suiAccount?.address && preferredNetwork === 'SUI') {
      if (address !== suiAccount.address || !storeIsConnected || storeNetwork !== 'SUI') {
        setAddress(suiAccount.address);
        setIsConnected(true);
        setNetwork('SUI');
        refreshWalletBalance();
        fetchProfile(suiAccount.address);
      }
      queueMicrotask(() => fetchBalance(suiAccount.address));
      return;
    }

    // 2b. OneChain (OCT) — also uses Sui-compatible wallet
    if (suiAccount?.address && preferredNetwork === 'OCT') {
      if (address !== suiAccount.address || !storeIsConnected || storeNetwork !== 'OCT') {
        setAddress(suiAccount.address);
        setIsConnected(true);
        setNetwork('OCT');
        refreshWalletBalance();
        fetchProfile(suiAccount.address);
      }
      queueMicrotask(() => fetchBalance(suiAccount.address));
      return;
    }

    // 2c. Initia (INIT) — InterwovenKit
    if (initiaConnected && initiaAddress && preferredNetwork === 'INIT') {
      if (address !== initiaAddress || !storeIsConnected || storeNetwork !== 'INIT') {
        setAddress(initiaAddress);
        setIsConnected(true);
        setNetwork('INIT');
        refreshWalletBalance();
        fetchProfile(initiaAddress);
      }
      queueMicrotask(() => fetchBalance(initiaAddress));
      return;
    }

    // 2d. Aptos (APT)
    if (aptosConnected && aptosAccount?.address && preferredNetwork === 'APT') {
      const aptosAddr = aptosAccount.address.toString();
      if (address !== aptosAddr || !storeIsConnected || storeNetwork !== 'APT') {
        setAddress(aptosAddr);
        setIsConnected(true);
        setNetwork('APT');
        refreshWalletBalance();
        fetchProfile(aptosAddr);
      }
      queueMicrotask(() => fetchBalance(aptosAddr));
      return;
    }

    // 3. Push Chain (via wagmi/ConnectKit on chainId 42101)
    if (preferredNetwork === 'PUSH') {
      if (wagmiConnected && wagmiAddress && wagmiChainId === pushChainDonut.id) {
        if (address !== wagmiAddress || !storeIsConnected || storeNetwork !== 'PUSH') {
          setAddress(wagmiAddress);
          setIsConnected(true);
          setNetwork('PUSH');
          refreshWalletBalance();
          fetchProfile(wagmiAddress);
        }
        queueMicrotask(() => fetchBalance(wagmiAddress));
        return;
      }
      // Still waiting for user to switch network — keep existing state
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'PUSH') return;
      return;
    }

    // 4. Somnia (via wagmi/ConnectKit)
    if (preferredNetwork === 'SOMNIA') {
      if (wagmiConnected && wagmiAddress && wagmiChainId === somniaTestnet.id) {
        if (address !== wagmiAddress || !storeIsConnected || storeNetwork !== 'SOMNIA') {
          setAddress(wagmiAddress);
          setIsConnected(true);
          setNetwork('SOMNIA');
          refreshWalletBalance();
          fetchProfile(wagmiAddress);
        }
        queueMicrotask(() => fetchBalance(wagmiAddress));
        return;
      }
      // Wallet connected but on wrong chain — auto-switch to Somnia
      if (wagmiConnected && wagmiAddress && wagmiChainId !== somniaTestnet.id) {
        switchChain({ chainId: somniaTestnet.id });
        return;
      }
      // Still waiting for user to switch network — keep existing state
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'SOMNIA') return;
      return;
    }

    // 4b. 0G Mainnet (via wagmi/ConnectKit)
    if (preferredNetwork === 'ZG') {
      if (wagmiConnected && wagmiAddress && wagmiChainId === zgMainnet.id) {
        if (address !== wagmiAddress || !storeIsConnected || storeNetwork !== 'ZG') {
          setAddress(wagmiAddress);
          setIsConnected(true);
          setNetwork('ZG');
          refreshWalletBalance();
          fetchProfile(wagmiAddress);
        } else {
          // Already synced — still refresh on-chain wallet balance (panel was stuck at 0).
          refreshWalletBalance();
        }
        queueMicrotask(() => fetchBalance(wagmiAddress));
        return;
      }
      // Wallet connected but on wrong chain — auto-switch to 0G
      if (wagmiConnected && wagmiAddress && wagmiChainId !== zgMainnet.id) {
        switchChain({ chainId: zgMainnet.id });
        return;
      }
      // Still waiting for user to switch network — keep existing state
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'ZG') return;
      return;
    }

    // 6. BNB (Wagmi or Privy)
    if (preferredNetwork === 'BNB') {
      if (wagmiConnected && wagmiAddress && wagmiChainId === bsc.id) {
        if (address !== wagmiAddress || !storeIsConnected || storeNetwork !== 'BNB') {
          setAddress(wagmiAddress);
          setIsConnected(true);
          setNetwork('BNB');
          refreshWalletBalance();
          fetchProfile(wagmiAddress);
        }
        queueMicrotask(() => fetchBalance(wagmiAddress));
        return;
      }
      // Wallet connected but on wrong chain — auto-switch to BSC
      if (wagmiConnected && wagmiAddress && wagmiChainId !== bsc.id) {
        switchChain({ chainId: bsc.id });
        return;
      }
      if (privyReady && authenticated && privyWallets[0]) {
        const addr = privyWallets[0].address;
        if (address !== addr || !storeIsConnected || storeNetwork !== 'BNB') {
          setAddress(addr);
          setIsConnected(true);
          setNetwork('BNB');
          refreshWalletBalance();
          fetchProfile(addr);
        }
        queueMicrotask(() => fetchBalance(addr));
        return;
      }
    }

    // 5. Stellar
    if (preferredNetwork === 'XLM') {
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'XLM') return;
    }

    // 6. Tezos
    if (preferredNetwork === 'XTZ') {
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'XTZ') return;
    }

    // 7. NEAR
    if (preferredNetwork === 'NEAR') {
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'NEAR') return;
    }

    // 8. Starknet
    if (preferredNetwork === 'STRK') {
      const injectedStarknetAddress = typeof window !== 'undefined'
        ? (window as unknown as { starknet?: { selectedAddress?: string } }).starknet?.selectedAddress
        : null;
      if (injectedStarknetAddress && address !== injectedStarknetAddress) {
        setAddress(injectedStarknetAddress);
        setIsConnected(true);
        setNetwork('STRK');
        refreshWalletBalance();
        fetchProfile(injectedStarknetAddress);
        queueMicrotask(() => fetchBalance(injectedStarknetAddress));
        return;
      }
      if (useOverflowStore.getState().address && useOverflowStore.getState().network === 'STRK') return;
    }

    // 9. Cleanup
    const state = useOverflowStore.getState();
    const isDemoMode = state.accountType === 'demo';
    const hasSolana = solanaConnected && solanaPublicKey;
    const hasSui = !!suiAccount?.address;
    const hasBNB = (wagmiConnected && !!wagmiAddress && wagmiChainId === bsc.id) || (privyReady && authenticated && !!privyWallets[0]);
    const hasStellar = state.network === 'XLM' && !!state.address;
    const hasTezos = state.network === 'XTZ' && !!state.address;
    const hasNEAR = state.network === 'NEAR' && !!state.address;
    const hasSTRK = state.network === 'STRK' && !!state.address;
    const hasPUSH = wagmiConnected && !!wagmiAddress && wagmiChainId === pushChainDonut.id;
    const hasSOMNIA = wagmiConnected && !!wagmiAddress && wagmiChainId === somniaTestnet.id;
    const hasZG = wagmiConnected && !!wagmiAddress && wagmiChainId === zgMainnet.id;
    const hasOCT = preferredNetwork === 'OCT' && !!suiAccount?.address;
    const hasINIT = preferredNetwork === 'INIT' && initiaConnected && !!initiaAddress;
    const hasAPT = preferredNetwork === 'APT' && aptosConnected && !!aptosAccount?.address;

    let shouldClear = false;
    if (isDemoMode) {
      shouldClear = false;
    } else {
      if (preferredNetwork === 'SOL' && !hasSolana) shouldClear = true;
      else if (preferredNetwork === 'SUI' && !hasSui) shouldClear = true;
      else if (preferredNetwork === 'BNB' && !hasBNB) shouldClear = true;
      else if (preferredNetwork === 'XLM' && !hasStellar) shouldClear = true;
      else if (preferredNetwork === 'XTZ' && !hasTezos) shouldClear = true;
      else if (preferredNetwork === 'NEAR' && !hasNEAR) shouldClear = true;
      else if (preferredNetwork === 'STRK' && !hasSTRK) shouldClear = true;
      else if ((preferredNetwork as string) === 'SOMNIA' && !hasSOMNIA) shouldClear = true;
      else if ((preferredNetwork as string) === 'ZG' && !hasZG) shouldClear = true;
      else if (preferredNetwork === 'OCT' && !hasOCT) shouldClear = true;
      else if (preferredNetwork === 'INIT' && !hasINIT) shouldClear = true;
      else if (preferredNetwork === 'APT' && !hasAPT) shouldClear = true;
      else if (!preferredNetwork && !hasBNB && !hasSolana && !hasSui && !hasStellar && !hasTezos && !hasNEAR && !hasSTRK && !hasPUSH && !hasSOMNIA && !hasZG && !hasOCT && !hasINIT && !hasAPT) shouldClear = true;
    }

    if (shouldClear && address !== null) {
      setAddress(null);
      setIsConnected(false);
      setNetwork(null);
    }
  }, [
    user, authenticated, privyWallets, privyReady,
    solanaConnected, solanaPublicKey,
    suiAccount,
    wagmiAddress, wagmiConnected, wagmiChainId,
    initiaAddress, initiaConnected,
    preferredNetwork, address, accountType,
    storeIsConnected, storeNetwork,
    setAddress, setIsConnected, setNetwork, refreshWalletBalance, fetchBalance, fetchProfile,
    switchChain
  ]);

  return null;
}

const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl('mainnet') },
  onechain: { url: process.env.NEXT_PUBLIC_ONECHAIN_RPC || 'https://rpc-testnet.onelabs.cc' },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  const solanaWallets = useMemo(() => [], []);

  const solanaEndpoint = useMemo(() => {
    try {
      const { getSolanaConfig } = require('@/lib/solana/config');
      return getSolanaConfig().rpcEndpoint;
    } catch (e) {
      return "https://solana-rpc.publicnode.com";
    }
  }, []);

  useEffect(() => {
    injectInitiaStyles(interwovenKitStyles);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stopPriceFeed: (() => void) | undefined;

    const initializeApp = async () => {
      try {
        const { updateAllPrices, loadTargetCells, startGlobalPriceFeed } = useOverflowStore.getState();
        const { initWalletKit } = await import('@/lib/stellar/wallet-kit');
        await initWalletKit().catch(console.error);
        await loadTargetCells().catch(console.error);

        if (cancelled) return;

        // Seed a faster default asset for the chart.
        // We try a small set in parallel and pick the first one that returns a valid price.
        // This helps avoid long "Connecting to Pyth Network..." delays when some feeds are slower.
        try {
          const { fetchPrice } = await import('@/lib/utils/priceFeed');
          const store = useOverflowStore.getState();

          const candidates: AssetType[] = ['BTC', 'ETH', 'SOL', 'SUI', 'BNB'];

          const seeded = await Promise.any(
            candidates.map(async (asset) => {
              const p = await fetchPrice(asset);
              if (p?.price && p.price > 0) return { asset, price: p.price };
              throw new Error('No valid price');
            })
          );

          if (cancelled) return;

          store.setSelectedAsset(seeded.asset);
          // Seed at least 2 points so LiveChart can render quickly.
          store.updatePrice(seeded.price, seeded.asset);
          store.updatePrice(seeded.price, seeded.asset);
        } catch (e) {
          // Non-fatal: we'll still start the global feed and show the default BNB chart.
        }

        if (cancelled) return;

        stopPriceFeed = startGlobalPriceFeed(updateAllPrices);
        if (cancelled) {
          stopPriceFeed();
          stopPriceFeed = undefined;
          return;
        }

        const { ensureBalanceSession } = await import('@/lib/balance/balanceClientHeaders');
        await ensureBalanceSession().catch(() => {});

        if (cancelled) return;
        setIsReady(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        if (!cancelled) setIsReady(true);
      }
    };

    void initializeApp();

    return () => {
      cancelled = true;
      stopPriceFeed?.();
    };
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || '';

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider mode="dark">
          <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
              appearance: {
                theme: 'dark',
                accentColor: '#A855F7',
                showWalletLoginFirst: true,
              },
              supportedChains: [bsc, somniaTestnet, pushChainDonut, zgMainnet],
              defaultChain: bsc,
              embeddedWallets: {
                createOnLogin: 'users-without-wallets',
              },
            }}
          >
            <ConnectionProvider endpoint={solanaEndpoint}>
              <SolanaWalletProvider wallets={solanaWallets} autoConnect>
                <WalletModalProvider>
                  <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
                    <WalletProvider autoConnect>
                      <InterwovenKitProvider {...INITIA_MAINNET}>
                        <AptosWalletAdapterProvider autoConnect dappConfig={{ network: Network.MAINNET }}>
                          <WalletSync />
                          <ReferralSync />
                          {children}
                          <WalletConnectModal />

                          <ToastProvider />
                        </AptosWalletAdapterProvider>
                      </InterwovenKitProvider>
                    </WalletProvider>
                  </SuiClientProvider>
                </WalletModalProvider>
              </SolanaWalletProvider>
            </ConnectionProvider>
          </PrivyProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
