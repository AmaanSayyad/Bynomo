import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { useOverflowStore } from '@/lib/store';

export const WalletInfo: React.FC = () => {
  const { network, address, isConnected, walletBalance, refreshWalletBalance, selectedCurrency } = useOverflowStore();

  // Polling for balance updates
  useEffect(() => {
    if (isConnected && address) {
      void refreshWalletBalance();
      const interval = setInterval(() => {
        void refreshWalletBalance();
      }, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [isConnected, address, network, selectedCurrency, refreshWalletBalance]);

  if (!isConnected || !address) {
    return null;
  }

  // Format address
  const formatAddress = (addr: string) => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const suiWalletSymbol = selectedCurrency === 'USDC' ? 'USDC' : 'SUI';

  const currencySymbol =
    network === 'SUI' ? suiWalletSymbol :
      network === 'SOL' ? (selectedCurrency || 'SOL') :
        network === 'XLM' ? 'XLM' :
          network === 'XTZ' ? 'XTZ' :
            network === 'NEAR' ? 'NEAR' :
              network === 'STRK' ? 'STRK' :
                network === 'PUSH' ? 'PC' :
                  network === 'SOMNIA' ? 'STT' :
                    network === 'OCT' ? 'OCT' :
                      network === 'ZG' ? '0G' :
                        network === 'INIT' ? 'INIT' :
                          network === 'APT' ? 'APT' :
                            'BNB';

  const networkName =
    network === 'SUI' ? 'Sui Network' :
      network === 'SOL' ? 'Solana' :
        network === 'XLM' ? 'Stellar' :
          network === 'XTZ' ? 'Tezos' :
            network === 'NEAR' ? 'NEAR Protocol' :
              network === 'STRK' ? 'Starknet Mainnet' :
                network === 'PUSH' ? 'Push Chain' :
                  network === 'SOMNIA' ? 'Somnia Testnet' :
                    network === 'OCT' ? 'OneChain' :
                      network === 'ZG' ? '0G Mainnet' :
                        network === 'INIT' ? 'Initia Mainnet' :
                          network === 'APT' ? 'Aptos Mainnet' :
                            'BNB Chain';

  const networkLogo =
    network === 'SOMNIA' ? '/logos/somnia.jpg' :
      network === 'SUI' ? (suiWalletSymbol === 'USDC' ? '/logos/usdc-logo.png' : '/logos/sui-logo.png') :
        (network === 'SOL' && selectedCurrency === 'BYNOMO') ? '/overflowlogo.png' :
          network === 'SOL' ? '/logos/solana-sol-logo.png' :
            network === 'XLM' ? '/logos/stellar-xlm-logo.png' :
              network === 'XTZ' ? '/logos/tezos-xtz-logo.png' :
                network === 'NEAR' ? '/logos/near.png' :
                  network === 'STRK' ? '/logos/starknet-strk-logo.svg' :
                    network === 'PUSH' ? '/logos/push-logo.png' :
                      network === 'OCT' ? '/logos/onechain.png' :
                        network === 'ZG' ? '/logos/0g.png' :
                          network === 'INIT' ? '/logos/initia.png' :
                            network === 'APT' ? '/logos/aptos-logo.png' :
                              '/logos/bnb-bnb-logo.png';

  const balance = walletBalance.toFixed(4);
  const isLoading = false; // Store doesn't have isLoading for wallet balance yet, but fetch is fast

  return (
    <Card className="min-w-[200px] border border-white/10 !bg-black/40 backdrop-blur-md">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center p-1 border border-white/10 shrink-0">
            <img
              src={networkLogo}
              alt={networkName}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider font-mono">{networkName} Address</p>
            <div className="flex items-center gap-1.5">
              <p className="text-white font-mono text-[11px] leading-tight truncate">{formatAddress(address)}</p>
              <button
                onClick={handleCopyAddress}
                className="shrink-0 text-gray-500 hover:text-white transition-colors"
                title="Copy address"
              >
                {copied ? (
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
        </div>

        <div className="pt-2 border-t border-white/5">
          <p className="text-gray-400 text-[10px] uppercase tracking-wider font-mono">{currencySymbol} Balance</p>
          <div className="flex items-center gap-2">
            <p className="text-[#00f5ff] font-bold text-lg font-mono drop-shadow-[0_0_8px_rgba(0,245,255,0.5)]">
              {isLoading ? 'Loading...' : `${balance}`}
            </p>
            <span className="text-[10px] text-gray-500 font-bold uppercase mt-1">{currencySymbol}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
