'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeaderMenu } from './game/HeaderMenu';
import { WalletConnect } from './wallet';
import { useStore } from '@/lib/store';
import { motion } from 'framer-motion';

export function Header() {
    const [demoActivated, setDemoActivated] = useState(false);
    const pathname = usePathname();

    const {
        setAddress,
        setBalance,
        setIsConnected,
        toggleAccountType,
        accountType,
        accessCode,
    } = useStore();

    const activateDemoMode = () => {
        if (accountType === 'demo') {
            // Exit demo mode
            toggleAccountType();
            setAddress(null);
            setIsConnected(false);
            return;
        }

        setAddress('0xDEMO_1234567890');
        setBalance(5000); // Increased demo balance for better testing
        setIsConnected(true);
        if (accountType === 'real') toggleAccountType();
        setDemoActivated(true);
        setTimeout(() => setDemoActivated(false), 2000);
    };


    return (
        <header className="z-[100] px-4 sm:px-8 py-3 flex justify-between items-center bg-black/40 backdrop-blur-3xl border-b border-white/5">
            <div className="flex items-center gap-4">
                <Link href="/" className="group flex items-center gap-2">
                    <motion.span
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-xl sm:text-2xl font-black tracking-tighter sm:tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-400 to-white cursor-pointer select-none"
                        style={{ fontFamily: 'var(--font-orbitron)' }}
                    >
                        BYNOMO
                    </motion.span>
                </Link>
                {demoActivated && (
                    <span className="text-[8px] font-mono text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded bg-emerald-400/5 animate-pulse uppercase tracking-widest">
                        Demo Activated
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                {pathname === '/' && (
                    <div className="hidden xl:flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/55">
                        <Link href="/litepaper" className="hover:text-white transition-colors">Litepaper</Link>
                        <a
                            href="https://www.futard.io/launch/2aJ7mzSagAVYr1hYFgJAYHCoDLbvkjTtRRe44knWidRc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-teal-400/80 hover:text-teal-300 transition-colors"
                        >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                            Fundraise
                        </a>
                        <Link href="/bags" className="hover:text-white transition-colors">Bags</Link>
                        <a href="https://linktr.ee/bynomo.fun" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Linktree</a>
                        <a href="https://x.com/bynomofun" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X</a>
                        <a href="https://t.me/bynomo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram</a>
                        <a href="https://discord.gg/5MAHQpWZ7b" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
                    </div>
                )}

                {pathname !== '/' && accessCode !== null && (
                    <button
                        onClick={activateDemoMode}
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-full transition-all group"
                    >
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80 group-hover:text-emerald-400">
                            Demo Mode
                        </span>
                    </button>
                )}

                {pathname === '/' ? (
                    <Link
                        href="/trade"
                        className="px-6 py-2.5 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        Launch DApp
                    </Link>
                ) : (
                    <>
                        <HeaderMenu />
                        <WalletConnect />
                    </>
                )}
            </div>
        </header>
    );
}
