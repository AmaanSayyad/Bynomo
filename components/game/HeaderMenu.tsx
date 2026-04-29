'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import Link from 'next/link';

export function HeaderMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const {
        setIsTourOpen,
        userTier,
        username
    } = useStore();

    const [isTradePage, setIsTradePage] = useState(false);

    useEffect(() => {
        setIsTradePage(window.location.pathname === '/trade');

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const menuItems = [
        ...(isTradePage ? [{
            label: 'Quick Tour',
            sublabel: 'Interactive onboarding',
            onClick: () => {
                setIsTourOpen(true);
                setIsOpen(false);
            },
            accent: 'bg-purple-500'
        }] : []),
        {
            label: 'Profile',
            sublabel: username || 'My Neural Identity',
            href: '/profile',
            accent: 'bg-blue-500'
        },
        {
            label: 'Rewards',
            sublabel: 'Referral System & Ranking',
            href: '/referrals',
            accent: 'bg-emerald-500'
        },
        {
            label: 'Leaderboard',
            sublabel: 'Global Hall of Fame',
            href: '/leaderboard',
            accent: 'bg-yellow-500'
        },
        {
            label: 'Staking',
            sublabel: 'Lock BYNOMO for rewards',
            href: '/staking',
            accent: 'bg-fuchsia-500'
        }
    ];

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-4 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-full transition-all active:scale-95 group"
            >
                <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 group-hover:text-white transition-colors leading-none mb-1">
                        Explorer
                    </span>
                    <span className="text-[8px] font-bold text-white/30 tracking-[0.1em] transition-colors leading-none">
                        MENU
                    </span>
                </div>
                <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    <div className="w-3 h-[1px] bg-white" />
                    <div className="w-2 h-[1px] bg-white" />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute top-full right-0 z-[110] mt-3 w-64 overflow-hidden rounded-3xl border border-white/5 bg-black/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
                    >
                        <div className="p-3 space-y-1">
                            {menuItems.map((item, idx) => {
                                const content = (
                                    <div className="flex items-center gap-4 px-4 py-4 rounded-[1.25rem] hover:bg-white/5 transition-all group cursor-pointer relative overflow-hidden">
                                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 ${item.accent} opacity-0 group-hover:opacity-100 transition-all`} />

                                        <div className="flex-1">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-white/90 group-hover:translate-x-1 transition-transform">
                                                {item.label}
                                            </p>
                                            <p className="text-[9px] text-white/30 font-medium group-hover:translate-x-1 transition-transform delay-75">
                                                {item.sublabel}
                                            </p>
                                        </div>

                                        <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                            <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                );

                                if (item.href) {
                                    return (
                                        <Link key={idx} href={item.href} onClick={() => setIsOpen(false)}>
                                            {content}
                                        </Link>
                                    );
                                }

                                return (
                                    <div key={idx} onClick={item.onClick}>
                                        {content}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-6 py-4 bg-white/2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[7px] text-white/20 font-black uppercase tracking-[0.3em]">
                                BYNOMO v2.4
                            </span>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-white/10 rounded-full" />
                                <div className="w-1 h-1 bg-white/10 rounded-full" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
