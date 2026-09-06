'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useOverflowStore } from '@/lib/store';
import { useToast } from '@/lib/hooks/useToast';
import { getBNBConfig } from '@/lib/bnb/config';
import { getAddress } from 'viem';
import { getSomniaConfig } from '@/lib/somnia/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { getSuiConfig } from '@/lib/sui/config';
import { buildDepositTransaction as buildSuiDepositTransaction, buildNativeSuiDepositTransaction } from '@/lib/sui/client';

import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { useWalletClient, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useInterwovenKit } from '@initia/interwovenkit-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number, txHash: string) => void;
  onError?: (error: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const BYNOMO_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayWalletBalance, setDisplayWalletBalance] = useState<number>(0);

  const { wallets: privyWallets } = useWallets();
  const { authenticated, user } = usePrivy();

  // Solana Hook
  const { sendTransaction: signAndSendSolana, publicKey: solanaPublicKey } = useSolanaWallet();

  // Sui Hooks
  const { mutateAsync: signAndExecuteSui } = useSignAndExecuteTransaction();
  const suiAccount = useCurrentAccount();

  // Aptos Hook
  const { signAndSubmitTransaction: signAndSubmitAptos, connected: isAptosConnected } = useAptosWallet();

  // wagmi wallet client — already authorized, no eth_requestAccounts needed
  const { data: walletClient } = useWalletClient();
  const { connector } = useAccount();

  // Initia / InterwovenKit
  const { requestTxBlock: requestInitiaTx } = useInterwovenKit();

  const { depositFunds, network, walletBalance, refreshWalletBalance, address } = useOverflowStore();
  const toast = useToast();

  const selectedCurrency = useOverflowStore(state => state.selectedCurrency);
  const setSelectedCurrency = useOverflowStore(state => state.setSelectedCurrency);
  const suiToken = network === 'SUI' ? (selectedCurrency === 'USDC' ? 'USDC' : 'SUI') : null;
  const currencySymbol = network === 'SUI' ? (suiToken ?? 'SUI') : network === 'SOL' ? (selectedCurrency || 'SOL') : network === 'APT' ? 'APT' : network === 'XLM' ? 'XLM' : network === 'XTZ' ? 'XTZ' : network === 'NEAR' ? 'NEAR' : network === 'STRK' ? 'STRK' : network === 'PUSH' ? 'PC' : network === 'SOMNIA' ? 'STT' : network === 'OCT' ? 'OCT' : network === 'ZG' ? '0G' : network === 'INIT' ? 'INIT' : 'BNB';
  const networkName = network === 'SUI' ? 'Sui Network' : network === 'SOL' ? 'Solana' : network === 'APT' ? 'Aptos Mainnet' : network === 'XLM' ? 'Stellar' : network === 'XTZ' ? 'Tezos' : network === 'NEAR' ? 'NEAR Protocol' : network === 'STRK' ? 'Starknet Mainnet' : network === 'PUSH' ? 'Push Chain Donut' : network === 'SOMNIA' ? 'Somnia Testnet' : network === 'OCT' ? 'OneChain' : network === 'ZG' ? '0G Mainnet' : network === 'INIT' ? 'Initia Mainnet' : 'BNB Chain';

  // Quick select amounts
  const quickAmounts = network === 'SUI' ? (suiToken === 'USDC' ? [1, 5, 10, 25] : [0.5, 1, 2, 5]) : [0.1, 0.5, 1, 5];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Keep modal wallet balance accurate for currency toggles (especially SOL/BYNOMO).
  useEffect(() => {
    let cancelled = false;
    const syncDisplayedBalance = async () => {
      if (!isOpen || !address || !network) {
        if (!cancelled) setDisplayWalletBalance(0);
        return;
      }

      try {
        if (network === 'SOL') {
          const { getSOLBalance, getTokenBalance } = await import('@/lib/solana/client');
          const bal =
            selectedCurrency === 'BYNOMO'
              ? await getTokenBalance(address, BYNOMO_MINT)
              : await getSOLBalance(address);
          if (!cancelled) setDisplayWalletBalance(bal);
          return;
        }

        // Non-Solana networks continue to use store-fed walletBalance.
        if (!cancelled) setDisplayWalletBalance(walletBalance);
      } catch {
        if (!cancelled) {
          if (network === 'SOL' && selectedCurrency === 'BYNOMO') {
            setDisplayWalletBalance(0);
          } else {
            setDisplayWalletBalance(walletBalance);
          }
        }
      }
    };

    void syncDisplayedBalance();
    return () => {
      cancelled = true;
    };
  }, [isOpen, address, network, selectedCurrency, walletBalance]);

  const validateAmount = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Please enter an amount';
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return 'Please enter a valid number';
    }

    if (numValue <= 0) {
      return 'Amount must be greater than zero';
    }

    if (numValue > displayWalletBalance) {
      return `Insufficient ${currencySymbol} balance`;
    }

    return null;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleQuickSelect = (value: number) => {
    setAmount(value.toString());
    setError(null);
  };

  const handleMaxClick = () => {
    if (displayWalletBalance > 0) {
      // Leave a small amount for gas (native SUI needs buffer; USDC on SUI doesn't)
      const gasBuffer = network === 'SUI' ? (suiToken === 'SUI' ? 0.01 : 0) : network === 'SOL' ? 0.001 : network === 'APT' ? 0.001 : 0.005;
      const maxAmount = Math.max(0, displayWalletBalance - gasBuffer);
      setAmount(maxAmount.toFixed(4));
      setError(null);
    }
  };

  const handleDeposit = async () => {
    const validationError = validateAmount(amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const depositAmount = parseFloat(amount);
      let txHash: string;

      if (network === 'SUI') {
        if (!suiAccount) throw new Error('Sui wallet not connected');
        toast.info('Please confirm the transaction in your Sui wallet...');

        const tx = suiToken === 'SUI'
          ? await buildNativeSuiDepositTransaction(depositAmount, address)
          : await buildSuiDepositTransaction(depositAmount, address);
        const result = await signAndExecuteSui({ transaction: tx as any });
        txHash = result.digest;

      } else if (network === 'SOL') {
        if (!solanaPublicKey) throw new Error('Solana wallet not connected');

        const { buildDepositTransaction, buildTokenDepositTransaction, getSolanaConnection, waitForSolanaSignatureConfirmed } = await import('@/lib/solana/client');
        const connection = getSolanaConnection();
          const selectedCurrency = useOverflowStore.getState().selectedCurrency;

        let transaction;
        if (selectedCurrency === 'BYNOMO') {
            transaction = await buildTokenDepositTransaction(depositAmount, address, BYNOMO_MINT);
        } else {
          transaction = await buildDepositTransaction(depositAmount, address);
        }

        toast.info('Please confirm the transaction in your Solana wallet...');

        txHash = await signAndSendSolana(transaction, connection);
        toast.info('Waiting for on-chain confirmation...');
        await waitForSolanaSignatureConfirmed(connection, txHash);
      } else if (network === 'NEAR') {
        const { depositNEAR } = await import('@/lib/near/wallet');
        toast.info('Please confirm the transaction in your NEAR wallet...');
        txHash = await depositNEAR(amount);
      } else if (network === 'PUSH') {
        if (!walletClient) throw new Error('Wallet not connected. Please reconnect via Connect Wallet.');
        const { getPushConfig } = await import('@/lib/push/config');
        const pushConfig = getPushConfig();
        if (!pushConfig.treasuryAddress) throw new Error('Push Chain treasury address not configured.');
        toast.info('Please confirm the transaction in your wallet...');
        const pushHash = await walletClient.sendTransaction({
          to: pushConfig.treasuryAddress as `0x${string}`,
          value: parseEther(depositAmount.toString()),
        });
        toast.info('Transaction submitted. Waiting for confirmation...');
        const { waitForTransactionReceipt } = await import('@wagmi/core');
        const { config: wagmiCfg } = await import('@/lib/bnb/wagmi');
        await waitForTransactionReceipt(wagmiCfg, { hash: pushHash as `0x${string}`, timeout: 60_000 });
        txHash = pushHash;
      } else if (network === 'STRK') {
        const { depositSTRK } = await import('@/lib/starknet/wallet');
        toast.info('Please confirm the transaction in your Starknet wallet...');
        txHash = await depositSTRK(depositAmount);
      } else if (network === 'XTZ') {
        const { BeaconWallet } = await import('@taquito/beacon-wallet');
        const { NetworkType } = await import('@airgap/beacon-types');
        const { getTezosClient } = await import('@/lib/tezos/client');

        const rpcUrl = process.env.NEXT_PUBLIC_TEZOS_RPC_URL || 'https://rpc.tzkt.io/mainnet';
        const wallet = new BeaconWallet({
          name: "BYNOMO",
          preferredNode: rpcUrl,
          network: {
            type: NetworkType.MAINNET,
            rpcUrl,
          },
        } as any);

        // Clear any cached connection that might use old ecadinfra RPC
        await wallet.clearActiveAccount();
        await wallet.requestPermissions();

        const tezos = await getTezosClient();
        tezos.setWalletProvider(wallet);

        const treasuryAddress = process.env.NEXT_PUBLIC_TEZOS_TREASURY_ADDRESS;
        if (!treasuryAddress) throw new Error('Tezos treasury not configured');

        toast.info('Please confirm the transaction in your Tezos wallet...');
        const op = await tezos.wallet.transfer({ to: treasuryAddress, amount: depositAmount }).send();
        toast.info('Waiting for Tezos inclusion (needed for deposit verification)...');
        await Promise.race([
          op.confirmation(1),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('Tezos confirmation timed out after 2 minutes')), 120_000),
          ),
        ]);
        txHash = op.opHash;
      } else if (network === 'XLM') {
        // Stellar deposit via Stellar Wallets Kit
        const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import('@creit.tech/stellar-wallets-kit');
        const { TransactionBuilder, Networks, Operation, Asset } = await import('@stellar/stellar-sdk');
        const { Horizon } = await import('@stellar/stellar-sdk');

        const treasuryAddress = process.env.NEXT_PUBLIC_STELLAR_TREASURY_ADDRESS;
        if (!treasuryAddress) throw new Error('Stellar treasury not configured');

        const server = new Horizon.Server(process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon.stellar.org');
        const account = await server.loadAccount(address);

        const transaction = new TransactionBuilder(account, {
          fee: '100',
          networkPassphrase: Networks.PUBLIC,
        })
          .addOperation(
            Operation.payment({
              destination: treasuryAddress,
              asset: Asset.native(),
              amount: depositAmount.toFixed(7),
            })
          )
          .setTimeout(30)
          .build();

        const kit = new StellarWalletsKit({
          network: WalletNetwork.PUBLIC,
          modules: allowAllModules(),
        });

        toast.info('Please confirm the transaction in your Stellar wallet...');
        const { signedTxXdr } = await kit.signTransaction(transaction.toXDR());
        const result = await server.submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, Networks.PUBLIC));
        txHash = (result as any).hash || (result as any).id || signedTxXdr.slice(0, 16);
      } else if (network === 'SOMNIA') {
        if (!walletClient) throw new Error('Wallet not connected. Please reconnect via Connect Wallet.');

        const somniaConfig = getSomniaConfig();
        if (!somniaConfig.treasuryAddress) throw new Error('Somnia treasury address not configured');

        toast.info('Please confirm the transaction in your wallet...');
        const somniaHash = await walletClient.sendTransaction({
          to: getAddress(somniaConfig.treasuryAddress as string),
          value: parseEther(depositAmount.toString()),
        });
        toast.info('Transaction submitted. Waiting for on-chain confirmation...');
        const { waitForTransactionReceipt } = await import('@wagmi/core');
        const { config: wagmiCfg } = await import('@/lib/bnb/wagmi');
        await waitForTransactionReceipt(wagmiCfg, { hash: somniaHash as `0x${string}`, timeout: 60_000 });
        txHash = somniaHash;
      } else if (network === 'ZG') {
        const { getZGConfig } = await import('@/lib/zg/config');
        const zgConfig = getZGConfig();
        if (!zgConfig.treasuryAddress) throw new Error('0G treasury address not configured');
        if (!connector) throw new Error('Wallet not connected. Please reconnect.');

        // Get the provider from the current wagmi connector (avoids window.ethereum pointing to wrong wallet)
        const connectorProvider = await connector.getProvider() as any;
        const zgChainIdHex = '0x' + (16661).toString(16);

        // Ensure wallet is on 0G Mainnet — add if needed
        try {
          await connectorProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: zgChainIdHex }] });
        } catch (switchErr: any) {
          if (switchErr.code === 4902 || switchErr.code === -32603) {
            await connectorProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: zgChainIdHex,
                chainName: '0G Mainnet',
                nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
                rpcUrls: ['https://evmrpc.0g.ai'],
                blockExplorerUrls: ['https://chainscan.0g.ai'],
              }],
            });
          } else if (switchErr.code !== 4001) {
            // 4001 = user rejected switch (already on 0G or cancelled) — continue anyway
            throw switchErr;
          }
        }

        toast.info('Please confirm the transaction in your wallet...');
        const { ethers: ethersLib } = await import('ethers');
        const { getZGEip1559Fees } = await import('@/lib/zg/fees');
        const provider = new ethersLib.BrowserProvider(connectorProvider);
        const signer = await provider.getSigner();
        const zgFees = await getZGEip1559Fees();
        const tx = await signer.sendTransaction({
          to: zgConfig.treasuryAddress as string,
          value: ethersLib.parseEther(depositAmount.toString()),
          maxFeePerGas: zgFees.maxFeePerGas,
          maxPriorityFeePerGas: zgFees.maxPriorityFeePerGas,
        });
        toast.info('Transaction submitted. Waiting for on-chain confirmation...');
        const receipt = await tx.wait();
        txHash = receipt!.hash;
      } else if (network === 'OCT') {
        if (!suiAccount) throw new Error('Sui-compatible wallet not connected');
        const { buildOCTDepositTransaction } = await import('@/lib/onechain/client');
        toast.info('Please confirm the transaction in your Sui wallet...');
        const tx = await buildOCTDepositTransaction(depositAmount, address);
        const result = await signAndExecuteSui({ transaction: tx as any });
        txHash = result.digest;
      } else if (network === 'INIT') {
        const { buildInitiaDepositTxRequest } = await import('@/lib/initia/client');
        const txRequest = buildInitiaDepositTxRequest(address, depositAmount);
        toast.info('Please confirm the transaction in your Initia wallet...');
        const result = await requestInitiaTx(txRequest);
        txHash = result.transactionHash;
      } else if (network === 'APT') {
        if (!isAptosConnected) throw new Error('Aptos wallet not connected');
        const { getAptosConfig } = await import('@/lib/aptos/config');
        const aptosConfig = getAptosConfig();
        
        toast.info('Please confirm the transaction in your Aptos wallet...');
        
        // Build transaction payload for APT transfer
        const result = await signAndSubmitAptos({
          data: {
            function: "0x1::aptos_account::transfer",
            typeArguments: [],
            functionArguments: [aptosConfig.treasuryAddress, Math.floor(depositAmount * 100_000_000)], // 8 decimals for APT
          },
        });
        
        txHash = result.hash;
      } else {
        // BNB (EVM) — support both wagmi wallets (MetaMask) and Privy embedded wallets.
        const bnbConfig = getBNBConfig();
        if (!bnbConfig.treasuryAddress) throw new Error('Treasury address not configured');

        if (walletClient) {
          toast.info('Please confirm the transaction in your wallet...');
          const bnbHash = await walletClient.sendTransaction({
            to: getAddress(bnbConfig.treasuryAddress as string),
            value: parseEther(depositAmount.toString()),
          });
          toast.info('Transaction submitted. Waiting for on-chain confirmation...');
          const { waitForTransactionReceipt } = await import('@wagmi/core');
          const { config: wagmiCfg } = await import('@/lib/bnb/wagmi');
          await waitForTransactionReceipt(wagmiCfg, { hash: bnbHash as `0x${string}`, timeout: 60_000 });
          txHash = bnbHash;
        } else {
          if (!authenticated) throw new Error('Not authenticated with Privy');
          const wallet = privyWallets.find(w => w.address.toLowerCase() === address.toLowerCase());
          if (!wallet) throw new Error('Privy wallet not found');

          const ethereumProvider = await wallet.getEthereumProvider();
          const provider = new ethers.BrowserProvider(ethereumProvider);
          const signer = await provider.getSigner();

          toast.info('Please confirm the transaction in your wallet...');
          const txResponse = await signer.sendTransaction({
            to: getAddress(bnbConfig.treasuryAddress),
            value: ethers.parseEther(depositAmount.toString()),
          });
          await txResponse.wait();
          txHash = txResponse.hash;
        }
      }

      toast.info('Transaction submitted. Waiting for confirmation...');

      // Update balance in database
      await depositFunds(address, depositAmount, txHash!);

      // Refresh balances
      refreshWalletBalance();

      toast.success(
        `Successfully deposited ${depositAmount.toFixed(4)} ${currencySymbol}! Balance updated.`
      );

      if (onSuccess) onSuccess(depositAmount, txHash!);
      onClose();
    } catch (err: any) {
      console.error('Deposit error:', err);
      const raw = String(err?.shortMessage || err?.message || 'Failed to deposit funds');
      const errorMessage = /gas tip cap|gas price below minimum/i.test(raw)
        ? '0G network rejected the fee. Retry deposit — we now set the required 2 gwei minimum tip.'
        : raw.length > 180
          ? 'Deposit failed. Please retry, or reconnect your wallet and try again.'
          : raw;
      setError(errorMessage);
      toast.error(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Deposit ${currencySymbol}`}
      showCloseButton={!isLoading}
    >
      <div className="space-y-4">
        {/* SUI token selector */}
        {network === 'SUI' && (
          <div className="flex gap-2">
            {(['SUI', 'USDC'] as const).map(tok => (
              <button
                key={tok}
                onClick={() => { setSelectedCurrency(tok); setAmount(''); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-black uppercase tracking-widest transition-colors ${
                  suiToken === tok
                    ? 'border-[#00f5ff]/60 bg-[#00f5ff]/10 text-[#00f5ff]'
                    : 'border-white/10 bg-white/[0.03] text-white/30 hover:text-white/60'
                }`}
              >
                <img
                  src={tok === 'SUI' ? '/sui-logo.png' : '/logos/usdc-logo.png'}
                  alt={tok}
                  className="w-4 h-4 rounded-full"
                />
                {tok}
              </button>
            ))}
          </div>
        )}

        <div className="bg-gradient-to-br from-[#00f5ff]/10 to-purple-500/10 border border-[#00f5ff]/30 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#00f5ff]/20 text-[#00f5ff] text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg">
            {networkName}
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-mono">
            Wallet Balance
          </p>
          <p className="text-[#00f5ff] text-xl font-bold font-mono flex items-center gap-2">
            {network === 'SUI' && suiToken === 'USDC' && <img src="/logos/usdc-logo.png" alt="USDC" className="w-5 h-5" />}
            {network === 'SUI' && suiToken === 'SUI' && <img src="/sui-logo.png" alt="SUI" className="w-5 h-5 rounded-full" />}
            {network === 'XTZ' && <img src="/logos/tezos-xtz-logo.png" alt="XTZ" className="w-5 h-5" />}
            {network === 'BNB' && <img src="/logos/bnb-bnb-logo.png" alt="BNB" className="w-5 h-5" />}
            {network === 'SOMNIA' && <img src="/logos/somnia.jpg" alt="SOMNIA" className="w-5 h-5" />}
            {network === 'ZG' && <img src="/logos/0g.png" alt="0G" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).src = '/logos/ethereum-eth-logo.png'; }} />}
            {network === 'OCT' && <img src="/logos/onechain.png" alt="OCT" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            {currencySymbol === 'BYNOMO' ? <img src="/overflowlogo.png" alt="BYNOMO" className="w-5 h-5" /> : (network === 'SOL' && <img src="/logos/solana-sol-logo.png" alt="SOL" className="w-5 h-5" />)}
            {network === 'XLM' && <img src="/logos/stellar-xlm-logo.png" alt="XLM" className="w-5 h-5" />}
            {network === 'NEAR' && <img src="/logos/near.png" alt="NEAR" className="w-5 h-5" />}
            {network === 'STRK' && <img src="/logos/starknet-strk-logo.svg" alt="STRK" className="w-5 h-5" />}
            {network === 'PUSH' && <img src="/logos/push-logo.png" alt="PC" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            {network === 'APT' && <img src="/logos/aptos-logo.png" alt="APT" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).src = 'https://cryptologos.cc/logos/aptos-apt-logo.png'; }} />}
            {displayWalletBalance.toFixed(4)} {currencySymbol}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="deposit-amount" className="text-gray-400 text-xs font-mono uppercase">Amount to Deposit</label>
          <div className="relative">
            <input
              id="deposit-amount"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              disabled={isLoading}
              className={`
                w-full px-4 py-3 bg-black/50 border rounded-lg text-lg
                text-white font-mono
                focus:outline-none focus:ring-1 focus:ring-[#00f5ff]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? 'border-red-500' : 'border-[#00f5ff]/30'}
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
              {currencySymbol}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleMaxClick}
              disabled={isLoading}
              className="text-[10px] text-[#00f5ff] hover:text-cyan-400 font-mono disabled:opacity-50 transition-colors uppercase tracking-wider"
            >
              Use Max
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => handleQuickSelect(quickAmount)}
              disabled={isLoading}
              className={`
                px-2 py-2 rounded border font-mono text-xs
                transition-all duration-200
                ${amount === quickAmount.toString()
                  ? 'bg-[#00f5ff]/20 border-[#00f5ff] text-[#00f5ff] shadow-[0_0_10px_rgba(0,245,255,0.3)]'
                  : 'bg-black/30 border-[#00f5ff]/30 text-gray-300 hover:border-[#00f5ff] hover:text-[#00f5ff]'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {quickAmount}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg px-3 py-2">
            <p className="text-red-400 text-xs font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            variant="primary"
            className="flex-1"
            disabled={isLoading || !amount || parseFloat(amount || '0') <= 0}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing</span>
              </span>
            ) : (
              `Deposit ${currencySymbol}`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
