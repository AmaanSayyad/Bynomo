'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import GridScan from '@/components/ui/GridScan';
import HowItWorksSteps from '@/components/landing/HowItWorksSteps';
import DemoVideoSection from '@/components/landing/DemoVideoSection';
import LogosMarqueeSection from '@/components/landing/LogosMarqueeSection';
import { SocialProofCarousel } from '@/components/landing/SocialProofCarousel';
import LiveStatsSection from '@/components/landing/LiveStatsSection';
import FutardEmbedSection, { FUTARD_LAUNCH_URL } from '@/components/landing/FutardEmbedSection';
import './waitlist/waitlist.css';

const testimonials = [
    {
        name: "Astra Vance",
        role: "Venture Strategist",
        content: "The Blitz Rounds are a game-changer. The millisecond precision from Pyth Oracles makes BYNOMO feel like a professional CEX but with decentralized peace of mind.",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Lyra Sterling",
        role: "DeFi Architect",
        content: "The 30-second round intervals are perfect for scalping. Knowing every outcome is verifiable on-chain gives me the confidence to trade larger volumes.",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Kai Zen",
        role: "Algo Developer",
        content: "Migrating to the BYNOMO protocol was the best move. Instant house balance settlement solves the on-chain latency issue perfectly for high-frequency binary options.",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Julian Vane",
        role: "Quant Trader",
        content: "BYNOMO's tiered system provides a clear roadmap for traders. The VIP perks and advanced indicators give us a significant edge in these fast-moving rounds.",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Sarah M.",
        role: "Early Adopter",
        content: "Switching between Bitcoin and Gold predictions within seconds is what makes BYNOMO stand out. The multi-asset support is truly elite.",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop"
    }
];

const faqs = [
    {
        question: "How does the House Balance work?",
        answer: "To ensure millisecond execution, BYNOMO uses a hybrid house balance system. You deposit to the treasury for your selected chain, and it is then reflected in your game balance for instant off-chain betting."
    },
    {
        question: "What assets can I trade?",
        answer: "BYNOMO supports a wide range of assets including major cryptos (BTC, ETH, SOL), precious metals (Gold, Silver), and top-tier stocks (AAPL, NVDA, TSLA) through Pyth price feeds."
    },
    {
        question: "What are Blitz Rounds?",
        answer: "Blitz Rounds are premium high-frequency trading sessions. They offer significantly higher multipliers (up to 10x) and ultra-fast 30-second round intervals for advanced traders."
    },
    {
        question: "How do I upgrade to VIP tier?",
        answer: "Tiers (Standard, Gold, VIP) are determined by your trading volume and early participation. VIPs enjoy exclusive technical indicators, reduced withdrawal fees, and priority treasury access."
    },
    {
        question: "Are my funds safe?",
        answer: "Yes. All deposits are held in a secure treasury wallet verified on-chain. Withdrawals are processed through the BYNOMO protocol, ensuring you maintain ultimate control over your assets."
    }
];

export default function WaitlistPage() {
    const [scrolled, setScrolled] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (containerRef.current) {
                setScrolled(containerRef.current.scrollTop > 20);
            }
        };
        const currentContainer = containerRef.current;
        if (currentContainer) {
            currentContainer.addEventListener('scroll', handleScroll);
        }

        const interval = setInterval(() => {
            setActiveIdx(prev => (prev + 1) % testimonials.length);
        }, 5000);

        return () => {
            if (currentContainer) {
                currentContainer.removeEventListener('scroll', handleScroll);
            }
            clearInterval(interval);
        };
    }, []);

    const scrollToTop = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div ref={containerRef} className="landing-layout h-full overflow-y-auto overflow-x-hidden scroll-smooth selection:bg-purple-500/30">

            {/* ── Announcement Banner ─────────────────────────────────────── */}
            <div
                className="marquee-banner relative z-50 w-full overflow-hidden h-14 flex items-center"
                style={{ background: 'linear-gradient(90deg, #021a0e 0%, #000d06 40%, #000d06 60%, #021a0e 100%)', borderBottom: '1px solid rgba(52,211,153,0.15)' }}
            >

                {/* Subtle top shimmer line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none" />

                {/* Gradient edge fades */}
                <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#021a0e] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#021a0e] to-transparent z-10 pointer-events-none" />

                {/* Track ignores pointer events; segments and pills opt in — hover/focus only on real controls, no parent leakage */}
                <div className="announcement-track flex items-center whitespace-nowrap pointer-events-none">
                    {[0, 1, 2, 3].map(i => (
                        <React.Fragment key={i}>
                            {/* Text is non-interactive; only the pill navigates (avoids huge accidental hit targets). */}
                            <div
                                className="pointer-events-auto inline-flex items-center gap-2 sm:gap-4 px-8 sm:px-14"
                                aria-hidden={i > 0}
                            >
                                <span className="text-base sm:text-xl shrink-0" aria-hidden>
                                    🎉
                                </span>
                                <span className="text-[10px] sm:text-sm font-semibold text-white/80">
                                    Bynomo is accepted for{' '}
                                    <span className="font-black text-emerald-400 text-xs sm:text-base" style={{ textShadow: '0 0 20px rgba(52,211,153,0.4)' }}>
                                        $4M Bagsapp Funding
                                    </span>
                                </span>
                                <a
                                    href="https://bags.fm/apps/067c4ea3-94c8-47b7-b0c2-d80029f7fed8"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    tabIndex={i > 0 ? -1 : undefined}
                                    className="pointer-events-auto group inline-flex items-center gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold text-black transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}
                                    aria-label="View Bynomo on Bags.fm (opens in new tab)"
                                >
                                    View on Bags.fm
                                    <span className="group-hover:translate-x-0.5 transition-transform inline-block" aria-hidden>
                                        ↗
                                    </span>
                                </a>
                                <span className="text-emerald-900 text-base sm:text-lg mx-3 sm:mx-6 shrink-0" aria-hidden>
                                    ◆
                                </span>
                            </div>

                            <div className="pointer-events-auto inline-flex items-center gap-2 sm:gap-4 px-8 sm:px-14" aria-hidden={i > 0}>
                                <span className="text-base sm:text-xl shrink-0" aria-hidden>
                                    📘
                                </span>
                                <span className="text-[10px] sm:text-sm font-semibold text-white/80">
                                    Bynomo Litepaper is now{' '}
                                    <span className="font-black text-emerald-300 text-xs sm:text-base" style={{ textShadow: '0 0 20px rgba(52,211,153,0.35)' }}>
                                        LIVE
                                    </span>
                                </span>
                                <Link
                                    href="/litepaper"
                                    tabIndex={i > 0 ? -1 : undefined}
                                    className="pointer-events-auto group inline-flex items-center gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold text-black transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #6ee7b7, #34d399)' }}
                                    aria-label="Open Bynomo litepaper"
                                >
                                    Open Litepaper
                                    <span className="group-hover:translate-x-0.5 transition-transform inline-block" aria-hidden>
                                        ↗
                                    </span>
                                </Link>
                                <span className="text-emerald-900 text-base sm:text-lg mx-3 sm:mx-6 shrink-0" aria-hidden>
                                    ◆
                                </span>
                            </div>

                            <div className="pointer-events-auto inline-flex items-center gap-2 sm:gap-4 px-8 sm:px-14" aria-hidden={i > 0}>
                                <span className="text-base sm:text-xl shrink-0" aria-hidden>
                                    🚀
                                </span>
                                <span className="text-[10px] sm:text-sm font-semibold text-white/80">
                                    Bynomo is fundraising on{' '}
                                    <span className="font-black text-emerald-300 text-xs sm:text-base" style={{ textShadow: '0 0 20px rgba(52,211,153,0.35)' }}>
                                        Futard.io
                                    </span>
                                </span>
                                <a
                                    href={FUTARD_LAUNCH_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    tabIndex={i > 0 ? -1 : undefined}
                                    className="pointer-events-auto group inline-flex items-center gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold text-black transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #5eead4, #2dd4bf)' }}
                                    aria-label="View Bynomo fundraising launch on Futard (opens in new tab)"
                                >
                                    View launch
                                    <span className="group-hover:translate-x-0.5 transition-transform inline-block" aria-hidden>
                                        ↗
                                    </span>
                                </a>
                                <span className="text-emerald-900 text-base sm:text-lg mx-3 sm:mx-6 shrink-0" aria-hidden>
                                    ◆
                                </span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .announcement-track {
                    animation: announcement-scroll 35s linear infinite;
                }
                /* Pause when cursor is anywhere on the bar (not delegated from track :hover → children) */
                .marquee-banner:hover .announcement-track {
                    animation-play-state: paused;
                }
                @keyframes announcement-scroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>

            {/* Background stays fixed */}
            <div className="fixed inset-0 pointer-events-none">
                <GridScan
                    sensitivity={0.01}
                    lineThickness={1}
                    linesColor="#14141a"
                    gridScale={0.1}
                    scanColor="#FF9FFC"
                    scanOpacity={0.03}
                    scanDuration={16.0}
                    enablePost
                    bloomIntensity={0.05}
                    chromaticAberration={0.0001}
                    noiseIntensity={0.01}
                />
            </div>



            {/* HERO SECTION */}
            <section id="hero-top" className="min-h-screen flex flex-col justify-center relative overflow-hidden px-4 sm:px-6 lg:px-20">
                <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-10 sm:gap-12 lg:gap-24 relative isolate">
                    {/* LEFT SIDE: Big brand (decorative) — keep below headline/body in the stack */}
                    <div className="relative z-0 flex flex-col justify-center select-none mix-blend-difference">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: {
                                    opacity: 1,
                                    transition: {
                                        staggerChildren: 0.15,
                                        delayChildren: 0.2
                                    }
                                }
                            }}
                            className="flex flex-wrap lg:flex-nowrap justify-center lg:justify-start"
                        >
                            {Array.from("BYNOMO").map((letter, index) => (
                                <motion.h1
                                    key={index}
                                    variants={{
                                        hidden: { opacity: 0, x: -50, filter: "blur(20px)" },
                                        visible: {
                                            opacity: 1,
                                            x: 0,
                                            filter: "blur(0px)",
                                            transition: {
                                                type: "spring",
                                                damping: 20,
                                                stiffness: 100
                                            }
                                        }
                                    }}
                                    className="text-[18vw] sm:text-[14vw] lg:text-[10rem] font-black leading-[0.8] tracking-tighter text-white"
                                    style={{ fontFamily: 'var(--font-orbitron)' }}
                                >
                                    {letter}
                                </motion.h1>
                            ))}
                        </motion.div>
                    </div>

                    {/* RIGHT SIDE: Tagline & live CTA (waitlist removed) */}
                    <motion.div
                        initial={{ x: 100, opacity: 0, filter: "blur(10px)" }}
                        animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
                        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-20 flex flex-col justify-center items-center lg:items-start lg:pl-4 -mt-8 lg:mt-0 gap-6 lg:gap-8 text-center lg:text-left"
                    >
                        <Link
                            href="/litepaper"
                            className="group inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-emerald-100 shadow-[0_0_35px_-12px_rgba(52,211,153,0.75)] hover:bg-emerald-400/25 transition-colors"
                            aria-label="Open Bynomo litepaper"
                        >
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                            Bynomo Litepaper is now LIVE
                            <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                        </Link>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                            className="text-2xl lg:text-5xl font-bold text-white tracking-tight"
                        >
                            Predict the next tick.
                        </motion.h2>
                        <p className="text-sm lg:text-base text-white/45 font-medium max-w-md leading-relaxed mx-auto lg:mx-0">
                            BYNOMO is live — connect your wallet, fund your house balance, and trade multi-asset charts with oracle-backed prices.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-gray-200 transition-colors shadow-[0_20px_50px_-15px_rgba(255,255,255,0.25)]"
                            aria-label="Scroll to product demo video"
                        >
                            Check demo
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>

                    </motion.div>

                </div>

                {/* Decorative Red Abstract Blur - keeping consistent with the requested style */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-50 block lg:hidden" />
            </section>

            <section id="how-it-works" className="relative py-16 sm:py-24 lg:py-32 bg-[#02040a] overflow-visible">
                <div className="section-content relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6">
                    <div className="text-center mb-10 sm:mb-14 lg:mb-16 px-1">
                        <div className="text-white/25 font-mono text-[9px] sm:text-[10px] mb-3 sm:mb-4 uppercase tracking-[0.2em] sm:tracking-[0.35em] flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_10px_purple] shrink-0" />
                            How It Works
                        </div>
                        <h2 className="text-[1.65rem] leading-[1.05] min-[400px]:text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white mb-4 sm:mb-6 uppercase px-1" style={{ fontFamily: 'var(--font-orbitron)' }}>
                            How <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/20">Bynomo works</span>
                        </h2>
                        <p className="text-white/35 max-w-2xl mx-auto text-[11px] sm:text-sm font-bold uppercase tracking-wide sm:tracking-widest leading-relaxed px-2">
                            Connect, deposit, predict, and settle in a fast hybrid flow powered by oracle pricing and secure treasury rails.
                        </p>
                    </div>

                    <div className="relative z-10">
                        <HowItWorksSteps />
                    </div>

                    {/* Background glows */}
                    <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
                </div>
            </section>

            {/* PRODUCT DEMO — after how-it-works, before ecosystem */}
            <DemoVideoSection />

            {/* CHAINS + DEX LOGOS SECTION */}
            <LogosMarqueeSection />

            {/* LIVE PLATFORM STATS */}
            <LiveStatsSection />

            {/* FUTARD FUNDRAISING EMBED */}
            <FutardEmbedSection />

            {/* ADVISORS + PARTNERSHIPS — marquee rows */}
            <section className="relative overflow-hidden border-t border-white/[0.06] bg-[#02040a]">
                <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-purple-600/[0.05] blur-[130px]" />

                {/* Section heading */}
                <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="mb-12 text-center sm:mb-14 lg:mb-16"
                    >
                        <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] sm:tracking-[0.35em] text-white/25">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                            Network &amp; credibility
                        </div>
                        <h2
                            className="mb-3 sm:mb-4 text-2xl min-[400px]:text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white px-1"
                            style={{ fontFamily: 'var(--font-orbitron)' }}
                        >
                            Advisory Board & Partnerships{' '}

                        </h2>
                        
                    </motion.div>
                </div>

                {/* Rolling carousel — Advisor + Partnership */}
                <div className="relative z-10 pb-16 sm:pb-20 lg:pb-24">
                    <SocialProofCarousel />
                </div>
            </section>

            {/* TESTIMONIALS SECTION */}
            <section>
                <div className="section-content">
                    <div className="text-center mb-24">
                        <h2 className="text-5xl font-black tracking-tighter mb-6">Trusted by Traders</h2>
                        <p className="text-white/40 text-lg font-medium">Join the next generation of binary options enthusiasts.</p>
                    </div>
                </div>

                <div className="testimonials-slider-container">
                    <div
                        className="testimonial-track"
                        style={{
                            transform: `translateX(calc(${(testimonials.length - 1) / 2} * var(--testimonial-step) - ${activeIdx} * var(--testimonial-step)))`
                        }}
                    >
                        {testimonials.map((t, i) => (
                            <div key={i} className={`testimonial-card-premium ${i === activeIdx ? 'active' : ''}`}>
                                <div className="text-purple-500 text-6xl font-serif mb-8 opacity-20">"</div>
                                <p className="text-xl italic text-white/60 mb-10 font-medium leading-relaxed">
                                    {t.content}
                                </p>
                                <div className="flex items-center gap-5">
                                    <img
                                        src={t.avatar}
                                        alt={t.name}
                                        className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-lg shadow-purple-500/20"
                                    />
                                    <div>
                                        <div className="font-black text-sm tracking-[0.2em] uppercase">{t.name}</div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-purple-500/60 mt-1">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="bg-black/20">
                <div className="section-content">
                    <div className="faq-grid">
                        <div className="faq-title-area">
                            <div className="text-purple-500 font-black uppercase tracking-[0.4em] text-xs mb-8">FAQ</div>
                            <h2 className="text-6xl font-black tracking-tighter mb-8 leading-[0.9]">Frequently<br />asked<br />questions</h2>
                            <p className="text-white/30 text-lg font-medium max-w-sm">
                                Can't find what you're looking for? Reach out to our community on Discord.
                            </p>
                        </div>

                        <div className="faq-accordion-list">
                            {faqs.map((faq, i) => (
                                <div
                                    key={i}
                                    className={`faq-item ${activeFaq === i ? 'active' : ''}`}
                                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                >
                                    <div className="faq-question-wrap">
                                        <h4 className="faq-question">{faq.question}</h4>
                                        <div className="faq-icon">+</div>
                                    </div>
                                    <div className="faq-answer">
                                        <p className="faq-answer-text">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="cta-section">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="cta-card"
                >
                    <div className="cta-glow" />
                    <h2 className="cta-title">Ready to trade the future with decentralized precision?</h2>
                    <Link href="/trade" className="cta-button" aria-label="Start trading">
                        Start now
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateY(1px)' }}>
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </Link>
                </motion.div>
            </section>

            {/* FOOTER SECTION */}
            <footer className="py-24 px-10 border-t border-white/5 bg-black relative z-10 w-full overflow-hidden">
                <div className="huge-footer-logo">BYNOMO</div>


                <div className="footer-meta">
                    <div className="footer-meta-item">2026 © All rights reserved</div>

                    <div className="footer-link-group">
                        <a href="https://x.com/bynomofun" target="_blank" rel="noopener noreferrer" className="footer-meta-item">X / Twitter</a>
                        <a href="https://linktr.ee/bynomo.fun" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Linktree</a>
                        <a href="https://github.com/AmaanSayyad/Bynomo" target="_blank" rel="noopener noreferrer" className="footer-meta-item">GitHub</a>
                        <a href="https://t.me/bynomo" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Telegram</a>
                        <a href="https://discord.gg/5MAHQpWZ7b" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Discord</a>
                        <Link href="/bags" className="footer-meta-item">Bags</Link>
                        <a
                            href="https://www.futard.io/launch/2aJ7mzSagAVYr1hYFgJAYHCoDLbvkjTtRRe44knWidRc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-meta-item"
                            style={{ color: 'rgba(45,212,191,0.7)' }}
                        >
                            Futard Fundraise ↗
                        </a>
                    </div>

                    <div className="footer-link-group">
                        <a href="#" className="footer-meta-item">Terms</a>
                        <a href="#" className="footer-meta-item">Privacy</a>
                        <a href="#" className="footer-meta-item">Cookies</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
