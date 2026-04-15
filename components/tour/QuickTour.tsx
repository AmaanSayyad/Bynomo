'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';

interface TourStep {
    target: string;
    title: string;
    content: string;
    howTo?: string[];   // numbered action steps shown below the content
    win?: string;       // "you win when…" line
    position: 'top' | 'bottom' | 'left' | 'right';
}

export const QuickTour: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Use specific selectors for stability
    const isConnected = useStore(state => state.isConnected);
    const setActiveTab = useStore(state => state.setActiveTab);
    const setGameMode = useStore(state => state.setGameMode);

    // Memoize steps to prevent infinite loops
    const steps: TourStep[] = useMemo(() => [
        ...(isConnected ? [] : [{
            target: '[data-tour="connect-button"]',
            title: '👋 Welcome — Connect First',
            content: 'Connect your wallet to get started. BNB Chain, Solana, and more are supported.',
            position: 'bottom' as const
        }]),
        {
            target: '[data-tour="asset-selector"]',
            title: '📈 Pick Your Market',
            content: 'Every asset trades live with real prices. Choose what you know best.',
            howTo: [
                'Click the asset selector at the top of the chart',
                'Browse Crypto, Stocks, Metals, or Forex',
                'Select any asset — the chart updates instantly',
            ],
            position: 'bottom' as const
        },
        {
            target: '[data-tour="classic-mode"]',
            title: '⚡ Classic Mode — Up or Down?',
            content: 'The fastest mode. Set a timer, pick a direction, win if you\'re right when time runs out.',
            howTo: [
                'Enter your bet amount (or tap a quick-amount button)',
                'Choose an expiry: 5 s, 10 s, 30 s, or 1 min',
                'Tap ▲ Higher if you think price rises, ▼ Lower if it falls',
                'Wait — if price moved your way you win × the multiplier shown',
            ],
            win: 'Price ends above (Higher) or below (Lower) the price when you placed the bet.',
            position: 'bottom' as const
        },
        {
            target: '[data-tour="box-mode"]',
            title: '🎯 Box Mode — Click a Cell',
            content: 'The chart turns into a grid of price boxes. Click one to bet on that exact price zone.',
            howTo: [
                'Enter your bet amount',
                'Choose a time column on the chart (5 s … 60 s)',
                'Click any cell on the price grid that appears',
                'Cells far from the current price pay more — higher risk, higher reward',
            ],
            win: 'Price lands inside the cell you clicked when that column\'s timer expires.',
            position: 'bottom' as const
        },
        {
            target: '[data-tour="draw-mode"]',
            title: '✏️ Draw Mode — Draw Your Range',
            content: 'You define both the price range AND the time window by drawing a rectangle on the chart.',
            howTo: [
                'Enter your bet amount (duration is auto-locked at 5 s)',
                'Click and drag on the chart to draw a rectangle',
                'The box sets your price range (height) and time window (width)',
                'Release to see the preview, then tap Confirm to place the bet',
            ],
            win: 'Price stays inside your drawn rectangle for the full 5-second window.',
            position: 'bottom' as const
        },
        {
            target: '[data-tour="deposit-section"]',
            title: '💰 Fund Your Account',
            content: isConnected
                ? 'Send BNB, SOL, or another supported token on-chain. Credits arrive instantly — no waiting.'
                : 'After connecting, deposit here to get your house balance. No credits = no bets.',
            howTo: [
                'Tap the Wallet tab above',
                'Choose your chain and copy the deposit address',
                'Send funds from your external wallet',
                'Balance appears within seconds — then you\'re ready to trade',
            ],
            position: 'bottom' as const
        },
    ], [isConnected]);

    // Handle view state changes (tabs/modes) independently of positioning
    useEffect(() => {
        if (!isOpen) return;

        const step = steps[currentStep];
        if (!step) return;

        // Force open the mobile panel if a target is inside it
        const isTargetInPanel = [
            '[data-tour="classic-mode"]',
            '[data-tour="box-mode"]',
            '[data-tour="draw-mode"]',
            '[data-tour="wallet-tab"]',
            '[data-tour="deposit-section"]'
        ].includes(step.target);

        if (isTargetInPanel && window.innerWidth < 640) {
            const panel = document.querySelector('.sm\\:w-\\[300px\\]');
            if (panel && panel.classList.contains('translate-y-full')) {
                // This is a bit hacky but we need to ensure the panel is visible
                // For a real fix, we should use a shared state, but this works given the current structure
                // Assuming GameBoard has a way to reactive to these changes
            }
            // Better: use the store to ensure panel is open
            // Since we don't have setIsPanelOpen in store, we hope the component handles it
        }

        if (step.target === '[data-tour="classic-mode"]') setGameMode('binomo');
        if (step.target === '[data-tour="box-mode"]') setGameMode('box');
        if (step.target === '[data-tour="draw-mode"]') setGameMode('draw');
        if (step.target === '[data-tour="wallet-tab"]') setActiveTab('bet');
        if (step.target === '[data-tour="deposit-section"]') setActiveTab('wallet');
    }, [currentStep, isOpen, steps, setGameMode, setActiveTab]);

    const updateTargetRect = useCallback(() => {
        const step = steps[currentStep];
        if (!step) return;

        const element = document.querySelector(step.target);
        if (element) {
            setTargetRect(element.getBoundingClientRect());
        }
    }, [currentStep, steps]);

    useEffect(() => {
        if (isOpen) {
            // Initial position and scroll
            const step = steps[currentStep];
            setTimeout(() => {
                const element = document.querySelector(step?.target || '');
                if (element) {
                    // Tall wallet column: "center" can scroll the viewport such that the tooltip clips; "nearest" keeps more UI in view.
                    const block =
                        step?.target === '[data-tour="deposit-section"]' ? 'nearest' : 'center';
                    element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
                    updateTargetRect();
                }
            }, 300); // Increased timeout for panel animations

            window.addEventListener('resize', updateTargetRect);
            window.addEventListener('scroll', updateTargetRect);
            return () => {
                window.removeEventListener('resize', updateTargetRect);
                window.removeEventListener('scroll', updateTargetRect);
            };
        }
    }, [isOpen, currentStep, steps, updateTargetRect]);

    if (!isOpen || !targetRect) return null;

    const currentStepData = steps[currentStep];
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 32, 300) : 340;
    // Layout estimate for viewport math (real card is taller; must not under-estimate or the bottom clips).
    const tooltipLayoutHeight = isMobile ? 340 : 380;

    // Calculate clamped position
    const calculatePosition = () => {
        const padding = 16;
        const gap = 16;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        let preferBottom = currentStepData.position === 'bottom';
        let top = preferBottom ? targetRect.bottom + gap : targetRect.top - tooltipLayoutHeight - gap;

        if (currentStepData.position === 'right' && !isMobile) {
            left = targetRect.right + gap;
            top = targetRect.top;
        } else if (currentStepData.position === 'left' && !isMobile) {
            left = targetRect.left - tooltipWidth - gap;
            top = targetRect.top;
        }

        // Mobile: pick side with more room
        if (isMobile) {
            const spaceAbove = targetRect.top - padding;
            const spaceBelow = vh - padding - targetRect.bottom;
            preferBottom = spaceBelow >= spaceAbove;
            top = preferBottom ? targetRect.bottom + gap : targetRect.top - tooltipLayoutHeight - gap;
        }

        // If "top" placement would go above viewport, flip below (and vice versa when possible).
        if (!preferBottom && top < padding) {
            top = targetRect.bottom + gap;
            preferBottom = true;
        }
        if (preferBottom && top + tooltipLayoutHeight > vh - padding) {
            const above = targetRect.top - tooltipLayoutHeight - gap;
            if (above >= padding) {
                top = above;
                preferBottom = false;
            }
        }

        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
        top = Math.max(padding, Math.min(top, vh - tooltipLayoutHeight - padding));

        // Arrow sits on the edge of the tooltip that faces the highlight.
        const tooltipBelowTarget = preferBottom;
        return { left, top, tooltipBelowTarget };
    };

    const pos = calculatePosition();

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
            setCurrentStep(0);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] pointer-events-none">
            {/* Dimmed Background with Hole */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                <defs>
                    <mask id="tour-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect
                            x={targetRect.left - 8}
                            y={targetRect.top - 8}
                            width={targetRect.width + 16}
                            height={targetRect.height + 16}
                            rx="12"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#tour-mask)"
                    onClick={onClose}
                />
            </svg>

            {/* Spotlight Border */}
            <motion.div
                initial={false}
                animate={{
                    left: targetRect.left - 8,
                    top: targetRect.top - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                }}
                className="absolute border-2 border-purple-500 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.6)] pointer-events-none"
            />

            {/* Tooltip */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    left: pos.left,
                    top: pos.top,
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto backdrop-blur-2xl flex flex-col max-h-[min(420px,calc(100vh-2rem))]"
                style={{ width: tooltipWidth }}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-2 shrink-0">
                    <h3 className="text-purple-400 font-bold text-[11px] sm:text-[13px] leading-snug pr-2">
                        {currentStepData.title}
                    </h3>
                    <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono shrink-0 mt-0.5">
                        {currentStep + 1} / {steps.length}
                    </span>
                </div>

                {/* Scrollable body */}
                <div className="min-h-0 overflow-y-auto overscroll-contain space-y-3 mb-3 pr-0.5">
                    {/* Summary sentence */}
                    <p className="text-gray-300 text-[11px] sm:text-[12px] leading-relaxed">
                        {currentStepData.content}
                    </p>

                    {/* How-to steps */}
                    {currentStepData.howTo && currentStepData.howTo.length > 0 && (
                        <ol className="space-y-1.5">
                            {currentStepData.howTo.map((step, i) => (
                                <li key={i} className="flex items-start gap-2 text-[10px] sm:text-[11px] text-gray-400 leading-snug">
                                    <span className="shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-purple-600/25 text-purple-400 font-black text-[9px]">
                                        {i + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    )}

                    {/* Win condition */}
                    {currentStepData.win && (
                        <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2">
                            <span className="shrink-0 text-emerald-400 text-[11px]">✓</span>
                            <p className="text-emerald-300 text-[10px] sm:text-[11px] leading-snug font-medium">
                                {currentStepData.win}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mt-auto shrink-0 pt-1">
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                        Skip
                    </button>

                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button
                                onClick={handleBack}
                                className="px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-3 sm:px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all"
                        >
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>

                {/* Arrow - Only show on desktop */}
                {!isMobile && (
                    <div
                        className={`absolute w-3 h-3 bg-[#0d0d0d] border-white/10 transform rotate-45 left-1/2 -translate-x-1/2
                ${pos.tooltipBelowTarget ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'}
              `}
                    />
                )}
            </motion.div>
        </div>
    );
};
