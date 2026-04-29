# Bynomo — Investor Pitch Deck

> **The first binary options trading dapp on-chain.**
> Live at [bynomo.fun](https://bynomo.fun) · Contact: bynomo.fun@gmail.com

---

## Slide 1 — Cover

```
BYNOMO

The first on-chain binary options trading platform.

Fast binary rounds · Pyth oracle pricing · 12 blockchains · Transparent settlement

bynomo.fun  ·  bynomo.fun@gmail.com  ·  @bynomofun
```

---

## Slide 2 — The Origin

In 2021, I saw a Binomo ad promoted by major influencers. I tried the paper mode — made 10× in a week. I put in three months of savings in real mode and lost everything.

Later I found Reddit threads showing that **Binomo ran algorithms that let users win in demo mode and lose in real mode**. This happened to millions of traders worldwide.

That day I decided to build the transparent, oracle-driven alternative.

> In 2021, sub-1-second on-chain price feeds didn't exist. I waited 5 years. In 2026 Pyth Hermes made it possible. **Bynomo is the result.**

---

## Slide 3 — The Problem

| # | Problem | Scale |
|---|---------|-------|
| 1 | **Web2 binary options are rigged** — Binomo, IQ Option, Quotex use proprietary algorithms that let users win in demo and lose in real mode | 590M+ crypto users, millions defrauded |
| 2 | **No credible Web3 binary options product exists** — the category is wide open at production level | $27.56B market growing at 19.8% CAGR |
| 3 | **Sub-1s oracle feeds didn't exist until 2025** — the technical blocker that made this impossible for 5 years has only just been removed | Pyth Hermes reached production maturity in 2025 |
| 4 | **DeFi trading is too complex** — funding rates, liquidation, wallet sigs per trade, complex UX | 400M daily on-chain transactions with no simple fast-trading product |

---

## Slide 4 — The Solution

**Bynomo is the first on-chain binary options platform with sub-5s oracle-settled rounds across 12 blockchains.**

| Principle | How |
|-----------|-----|
| **No manipulation** | All settlement driven by Pyth Hermes — a public, verifiable oracle feed. No proprietary algorithm. |
| **Instant trades** | No wallet signature per bet — bets are instant off-chain balance ops with on-chain deposit/withdrawal |
| **Simple UX** | Deposit → pick a mode → set amount → bet. Three clicks. Beginner-friendly. |
| **Fully transparent** | Every deposit, withdrawal, and payout is logged in an immutable audit trail |
| **12 blockchains** | SOL · BNB · SUI · NEAR · STRK · XLM · XTZ · INIT · OCT · PUSH · 0G · SOMNIA — one unified UI |

---

## Slide 5 — Product: How It Works

### 3-Step User Journey

```
Step 1 — Fund
Connect any wallet → send mainnet tokens to Bynomo treasury
→ balance credited instantly (Supabase, off-chain)

Step 2 — Trade
Pick a mode · set amount · confirm
No wallet signature needed per bet

Step 3 — Settle
Pyth Hermes resolves the outcome at expiry
Win → payout credited · Lose → house keeps stake
P&L off-chain (Supabase) · deposits/withdrawals on-chain
```

### Game Modes

| Mode | Mechanic | Win Condition |
|------|----------|--------------|
| **Box Mode** | Select a pre-drawn multiplier tile on the live chart | Tip of the green price line touches the tile's start within its price band |
| **Draw Mode** | Draw your own rectangle on the live chart — dynamic multiplier calculated instantly | Price line passes end-to-end through the drawn rectangle |
| **Classic Mode** | Pick UP or DOWN + multiplier + expiry time | Price at expiry is above (UP) or below (DOWN) the strike price |
| **Blitz Mode** | Pay a one-time on-chain entry fee | All multipliers boosted 2× for the 1-min active window |

---

## Slide 6 — Traction

> Product is **100% ready and live**. All numbers below are real, pre-public-launch.

### On-Chain (Solana)

| Metric | Value |
|--------|-------|
| Bets settled | **12,567+** |
| Total staked volume | **249.89 SOL ($46,258)** |
| Platform revenue (10% fee) | **~$4,600** |
| Unique wallets | **76** |
| Active price feeds | **28** |
| Avg session time (last 7 days) | **2h 8m** |

### Web & Community (Last 30 Days)

| Metric | Value |
|--------|-------|
| Users | **3,200+** |
| Page views | **6,600+** |
| Traffic growth | **+799%** |
| Engagement growth | **+774%** |

### Community (3 Days Organic — Before Live Link)

| Platform | Members |
|----------|---------|
| X / Twitter | **2,261** |
| Telegram | **900** |
| Discord | **260** |
| **Total** | **3,421+** |

### Other Signals

- Multiple tweets went viral before product launch
- **5+ blockchain ecosystems sent inbound offers** to deploy Bynomo natively on their chain
- Product fully built, audited internally, and deployed on Vercel across 12 chains

---

## Slide 7 — Market Opportunity

| Market | Size | Signal |
|--------|------|--------|
| Binary options / prediction | **$27.56B (2025) → ~$116B by 2034** (19.8% CAGR) | Long-term structural demand for fast binary outcome trading |
| Crypto prediction markets | **$45B+ annual volume** (Polymarket, Kalshi) | Liquidity appetite for oracle-driven prediction already proven |
| Crypto derivatives | **$86T+ annually (2025)** | Massive speculative trader base looking for simpler instruments |
| Global crypto users | **590M+** | Reachable audience with wallets already set up |

**Bynomo's wedge:** The only product that combines fast oracle-settled binary rounds + transparent settlement + beginner-friendly UX + 12 chains. The category has no incumbent.

---

## Slide 8 — Business Model

### Three Revenue Streams

| Stream | Mechanism | Rate |
|--------|-----------|------|
| **Platform fees** | 10% on every deposit + 10% on every withdrawal | Applied to all 12 chains |
| **House edge** | Multipliers set below fair-odds parity (e.g. 1.9× at 52.6% break-even) | Every losing bet is net revenue |
| **Blitz entry fees** | One-time flat fee per Blitz window, paid on-chain directly to fee collector | Per chain: 1 SOL · 0.1 BNB · 50 SUI · 400 XLM · 150 XTZ · 50 NEAR · 1500 STRK |

### Revenue Projections

| Monthly Bet Volume | Expected Monthly Revenue |
|-------------------|-------------------------|
| $5M | $250K – $500K |
| $20M | $400K – $2.0M |

### Unit Economics

#### How Revenue Is Generated Per User

```
User deposits 1 SOL ($185)
  ├── 10% deposit fee  →  $18.50 to Bynomo                ← Rail 1
  └── $166.50 credited to Bynomo balance

User plays (house edge ~3% per bet cycle)
  └── ~$5–15 captured from betting activity              ← Rail 2

User withdraws remaining balance
  └── 10% withdrawal fee  →  ~$15 to Bynomo               ← Rail 3

Optional: Blitz entry  →  1 SOL flat fee = $185           ← Rail 4
────────────────────────────────────────────────────
Total Bynomo revenue (no Blitz):  ~$38  on 1 SOL deposit
Total Bynomo revenue (with Blitz): ~$223 on 1 SOL deposit
Infra cost to serve this user:    < $0.10
```

#### Three User Scenarios

| | Conservative | Base Case | Optimistic |
|-|-------------|-----------|------------|
| **Avg deposit** | $50 | $150 | $400 |
| **Deposit fee (10%)** | $5 | $15 | $40 |
| **Avg withdrawal** | $40 | $120 | $350 |
| **Withdrawal fee (10%)** | $4 | $12 | $35 |
| **House edge captured** | $2 | $5 | $15 |
| **Revenue / user / month** | **~$11** | **~$32** | **~$90** |
| **Infra cost / user** | <$0.10 | <$0.10 | <$0.10 |
| **Gross margin / user** | **~$10.90** | **~$31.90** | **~$89.90** |

#### Acquisition vs Lifetime Value

| | Conservative | Base Case | Optimistic |
|-|-------------|-----------|------------|
| **CAC** (cost to acquire 1 user) | $15 | $8 | $4 |
| **Monthly revenue / user** | $11 | $32 | $90 |
| **Months to recover CAC** | 1.4 mo | 0.25 mo | <2 weeks |
| **LTV (12-month active user)** | $132 | $384 | $1,080 |
| **LTV / CAC** | **~9×** | **~48×** | **~270×** |

> CAC drops toward $0 as the referral flywheel, viral X launch, and per-chain ecosystem blitz generate organic signups. Every organic user is **pure profit from day 1**.

#### Why the Math Gets Better at Scale

| Volume | Monthly Revenue | Key Driver |
|--------|----------------|------------|
| 1,000 active users | $11K – $90K | Early adopters, higher CAC |
| 10,000 active users | $110K – $900K | Referral loops kicking in, CAC falling |
| 100,000 active users | $1.1M – $9M | Organic flywheel, CAC near $0 |
| Infra cost at 100K users | ~$10K | Vercel + Supabase serverless — nearly flat |

---

## Slide 9 — Competitive Landscape

Bynomo is the only production product offering oracle-settled binary rounds at **5s–1m timeframes across 12 blockchains in a single UI**. It sits at the intersection of three large markets but is a direct substitute for none of them — the category is entirely vacant at the Web3 level.

| Segment | Examples | Why They Can't Compete |
|---------|----------|------------------------|
| **Web2 binary options** | Binomo, IQ Option, Quotex | Opaque pricing, algorithmically rigged outcomes, no on-chain settlement; users do not custody funds. Their business model depends on opacity — they cannot go transparent. |
| **Crypto prediction markets** | Polymarket, Kalshi, Azuro | Event/outcome markets ("Will X happen?"), not sub-minute price binary options. Resolution takes hours or days, not 5s–1m. Architecturally incompatible with fast rounds. |
| **Crypto derivatives (CEX)** | Binance Futures, Bybit, OKX | Leveraged perpetuals with funding rates and liquidation risk. No fixed-expiry binary product. Regulatory overhead prevents fast pivots. |
| **On-chain options / DeFi** | Dopex, Lyra, Premia | Standard calls/puts with complex UX, high gas, long settlement. No simple "price up/down in 30s" binary product. |
| **Fast trading dapps** | Euphoria Fi | Mobile-first perps on a single chain — no fixed-expiry timeframes, no binary options loop. Building multi-chain from scratch = 6–12 months minimum. |
| **Web3 binary options** | — | No established on-chain binary options dapp exists at production level. **Bynomo fills this gap entirely.** |

---

## Slide 10 — Go-To-Market

### Target Users

| Segment | Who | Channel |
|---------|-----|---------|
| **DeFi-native traders** | Options/perps/DEX users seeking 5s–1m high-frequency instruments | X/Twitter, DeFi Discord/Telegram, KOLs |
| **Web2 binary options refugees** | Former Binomo/IQ Option users — 590M+ globally | Reddit, SEO, YouTube, paid |
| **Traders, Gamblers & Communities** | KOLs, trading groups, Telegram/Discord seeking gamified trading | Micro-influencers, viral PnL clips, ambassador program |
| **Chain ecosystem communities** | Every supported chain's regional groups, ecosystem projects, and executives | Per-chain foundation outreach, ecosystem hackathons |

### GTM Strategy

#### Phase 1 — Public Launch `Now`

| # | Tactic | Goal |
|---|--------|------|
| 1 | Viral X giveaway launch — Euphoria Fi / MegaETH playbook; word-of-mouth cascade from day 1 | 10K+ impressions day 1 |
| 2 | Per-chain ecosystem blitz — regional community groups + executive retweets + every ecosystem project across all 12 chains | Foundation-level support per chain |
| 3 | 100 micro-influencer campaign (1K–20K followers) in trading, crypto, Web3 niches | 5M+ combined reach |
| 4 | Short-form PnL clips + Blitz streak highlights engineered for X / Telegram virality | 50+ organic reposts per clip |
| 5 | Perpetual referral fee share — deep links into Classic and Box modes | 25% of signups via referral |

#### Phase 2 — Community Depth `Days 30–90`

| # | Tactic | Goal |
|---|--------|------|
| 1 | Bynomo Ambassador Program — regional groups, trading tutorials, local language content | 20 active regional ambassadors |
| 2 | Weekly Podcast / AMA Series on X with top traders | 5K+ live listeners / episode |
| 3 | Blitz tournament events with community prize pools | 1,000 participants / event |
| 4 | Chain foundation grant applications — Solana, Sui, NEAR, Starknet, and others | $100K–$300K in ecosystem grants |

#### Phase 3 — Scale `Days 91–180`

| # | Tactic | Goal |
|---|--------|------|
| 1 | P2P mode — removes treasury directional risk, enables larger payouts | P2P beta live |
| 2 | 200+ new assets via Pyth — forex, stocks, commodities, indices | 50+ new tradeable pairs |
| 3 | Mobile app + PWA redesign | 60% mobile session share |
| 4 | Affiliate / white-label — communities embed Bynomo with revenue share | 5 affiliate partners |
| 5 | Regional expansion — Southeast Asia, MENA, LatAm | 3 regional markets active |

---

## Slide 11 — Roadmap

| Phase | Timeline | Key Deliverables |
|-------|----------|-----------------|
| **Phase 0 — Stability** ✅ | Complete | Core loop · admin dashboard · multi-chain deposit/withdraw · fee system |
| **Phase 1 — Public Launch** | Now | Viral launch · community seeding · referral program · per-chain ecosystem blitz |
| **Phase 2 — Community Depth** | Days 30–90 | Ambassador program · weekly X AMA · tournaments · leaderboards · chain grants |
| **Phase 3 — Scale** | Days 91–180 | P2P mode · 200+ assets · mobile app · CEX/wallet integrations · regional expansion |

### Post-Raise Product Milestones

| Milestone | With $500K | With $1.5M |
|-----------|------------|------------|
| Security audit | ✅ Complete in 60 days | ✅ Full audit + bug bounty |
| P2P mode | ✅ Beta in 90 days | ✅ Full launch |
| Mobile app | Partial PWA | ✅ Native app |
| Chain expansion | +3 chains | +8 chains |
| Team | 3–4 people | 6–8 people |

---

## Slide 12 — The Raise

### Round Overview

| Item | Detail |
|------|--------|
| **Round** | Pre-Seed |
| **Raising** | $500K – $1.5M |
| **Instrument** | SAFE (post-money cap) or token warrant |
| **Investor profile** | Crypto-native VC · ecosystem fund · strategic angel |

### Use of Funds

> Marketing and token distribution drive user acquisition. Tech is already built and live.

#### At $500K Raise

| Category | Allocation | Amount | Line Items |
|----------|-----------|--------|------------|
| **Marketing & Growth** | 45% | $225K | 100 micro-KOL deals · X / Telegram paid amplification · launch giveaway · PnL clip production · per-chain ecosystem blitz (12 chains) · regional community managers |
| **Token & Community** | 25% | $125K | BYNOMO token liquidity seeding · airdrop campaigns · Blitz tournament prize pools · referral reward reserve · ambassador incentives |
| **Product & Infra** | 20% | $100K | Mobile PWA · 50+ new Pyth assets · multi-chain hardening · audit |
| **Operations** | 10% | $50K | Growth lead hire · legal / compliance · 6-month infra runway |

#### At $1.5M Raise

| Category | Allocation | Amount | Line Items |
|----------|-----------|--------|------------|
| **Marketing & Growth** | 45% | $675K | Tier-1 KOL partnerships · 3 regional Blitz championship events ($50K prize pools each) · Southeast Asia / MENA / LatAm expansion · affiliate & white-label partner network · paid social at scale |
| **Token & Community** | 25% | $375K | CEX listing fees + market making · expanded airdrop campaigns · Blitz mega-tournament prize pools ($100K+ pools) · ecosystem grant co-funding · ambassador program at scale |
| **Product & Infra** | 20% | $300K | 200+ Pyth assets (forex, stocks, commodities) · native mobile app · P2P mode · white-label SDK · 3 more chain integrations |
| **Operations** | 10% | $150K | 4 full-time hires (BD · community · growth · ops) · legal entity · compliance advisory · 12-month infra runway |

#### User Growth Targets (tied to capital deployed)

| Capital Deployed | Active Users | MRR | Key Driver |
|-----------------|-------------|-----|------------|
| $80K | 500 | ~$16K | Organic + referral flywheel |
| $250K | 2,500 | ~$80K | KOL + ecosystem blitz |
| $750K | 10,000 | ~$320K | Regional expansion + token incentives |
| $1.5M | 40,000+ | ~$1.3M | CEX listing + tournament virality |

### Why Now

- **$27.56B market** growing at 19.8% CAGR — zero credible Web3 incumbent
- **Technical unlock** — Pyth Hermes sub-1s feeds only production-ready in 2025
- **Working product** — real deposits, real payouts, real on-chain settlement today
- **Organic traction** — 3,421 community members, 12,567 bets, $46K volume before public launch
- **Inbound demand** — 5+ chains offered to deploy Bynomo on their ecosystem
- **Bull market timing** — crypto retail volume surging; demand for fast trading instruments at peak

---

## Slide 13 — Team

> We are builders, traders, and growth operators who have shipped a live multi-chain product before raising a single dollar.

| Person | Role | Background |
|--------|------|------------|
| **Founder / CEO** | Product · Strategy · Vision | Built Bynomo end-to-end — product design, multi-chain architecture, game mechanics, and go-to-market. Previously backed by Bagsapp ($4M funding). Operator mindset: product live before raise. |
| **Co-founder / CTO** | Full-stack · Web3 · Infra | Architected the Next.js 16 + Supabase backend, 12-chain wallet integrations, Pyth oracle pipeline, and treasury settlement engine. Ships fast — entire platform built in months, not years. |
| **Head of Growth** | Marketing · Community · KOLs | Runs the per-chain ecosystem blitz, KOL pipeline, and referral programs. Community grew to 3,421 members organically before public launch. |
| **BD / Partnerships** | Chain Ecosystems · Grants | Manages ecosystem relationships across Solana, Sui, NEAR, Starknet, Initia, and others. 5+ chains inbound-requesting Bynomo deployment. |

### Why This Team Wins

| | Signal |
|---|--------|
| **Shipped first** | Live product with real users, real deposits, real on-chain payouts — before raising |
| **Capital efficient** | $4M Bagsapp backing proves ability to build and grow with limited capital |
| **Operator DNA** | No slides-only founders — every team member has a live, working deliverable |
| **Chain-native** | Deep ecosystem relationships across 12 chains before Series A |

---

## Slide 14 — Future

### 6-Month Roadmap

| Quarter | Milestone | Impact |
|---------|-----------|--------|
| **Q2 2026** | Public launch across all 12 chains · Blitz tournament season 1 | First 2,500 active users · $80K MRR |
| **Q2 2026** | BYNOMO token liquidity seeding · airdrop campaign · CEX listing pipeline | Token holders = built-in user base |
| **Q2 2026** | 200+ Pyth assets live (forex · stocks · commodities · indices) | 5× more tradeable markets |
| **Q3 2026** | Native mobile app + PWA launch | 60%+ mobile session share |
| **Q3 2026** | P2P mode — players trade against each other, not the house | Removes treasury directional risk · enables unlimited payout size |
| **Q3 2026** | Blitz Championship Season 2 — $100K+ prize pools | Viral growth event · regional media coverage |
| **Q4 2026** | White-label SDK — ecosystems + communities embed Bynomo | 5+ affiliate partners · revenue share model |
| **Q4 2026** | Southeast Asia · MENA · LatAm regional expansion | 3 new high-volume retail markets |
| **Q4 2026** | 10,000 active users · $320K MRR | Series A ready |

### Where Bynomo Goes From Here

| Vision | Detail |
|--------|--------|
| **The Robinhood of Web3 trading** | Simple, fast, on-chain — accessible to any retail user on any chain |
| **P2P layer** | Remove house risk entirely — Bynomo becomes a pure platform fee business |
| **Token economy** | BYNOMO stakers get fee rebates, Blitz access, and governance — aligning power users with the protocol |
| **Cross-chain liquidity** | Single account, single balance, trade on any of 12+ chains — the first truly chain-agnostic binary options platform |
| **Institutional desk** | Custom Blitz events, white-label deployments, and OTC prize pool funding for DAOs, trading communities, and hedge funds |

---

## Slide 15 — Contact & Links

| | |
|---|---|
| **Product** | [bynomo.fun](https://bynomo.fun) |
| **Live trade** | [bynomo.fun/trade](https://bynomo.fun/trade) |
| **Demo video** | [youtu.be/_YWvJihlqfE](https://youtu.be/_YWvJihlqfE) |
| **X / Twitter** | [@bynomofun](https://x.com/bynomofun) |
| **Telegram** | [t.me/bynomo](https://t.me/bynomo) |
| **Discord** | [discord.gg/5MAHQpWZ7b](https://discord.gg/5MAHQpWZ7b) |
| **Email** | bynomo.fun@gmail.com |
| **Deck / data room** | [View Pitch Deck](https://docs.google.com/presentation/d/1kDVnUCeJ-LZ3dfpo_YsSqen6qSzlgzHFWFk79Eodj9A/edit?usp=sharing) |

---

*Bynomo — Like Binomo of Web2, but 10× better and fully on-chain.*
