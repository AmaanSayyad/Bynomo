/**
 * Game state slice for Zustand store
 * Manages game state, active rounds, price data, and betting actions
 * 
 * Note: After BNB migration, game logic remains off-chain.
 * Only deposit/withdrawal operations interact with the blockchain.
 */

import { StateCreator } from "zustand";
import { TargetCell, PricePoint, ActiveRound } from "@/types/game";
import { AssetType } from "@/lib/utils/priceFeed";
import { playWinSound, playLoseSound } from "@/lib/utils/sounds";
import { balanceMutationHeaders } from "@/lib/balance/balanceClientHeaders";
import { resolveHouseLedgerCurrency } from "@/lib/balance/houseLedgerCurrency";

// Game Modes
export type GameMode = 'binomo' | 'box' | 'draw';

// Active bet (Supports both modes)
export interface ActiveBet {
  id: string;
  mode: GameMode;
  asset: AssetType; // Added for multi-asset tracking
  amount: number;
  multiplier: number;
  direction: 'UP' | 'DOWN';
  timestamp: number;
  status: 'active' | 'settled';
  network?: string; // Track which network (currency) this bet uses
  /** Wallet address captured at placement time — used for settlement even if
   *  the user disconnects their wallet before the round resolves. */
  userAddress?: string;
  settlementToken?: string;
  // Classic mode specific
  strikePrice?: number;
  endTime?: number;
  // Box mode specific
  cellId?: string;
  priceTop?: number;
  priceBottom?: number;
  // Draw mode specific
  startTime?: number;
}

export interface GameState {
  // Core State
  gameMode: GameMode;
  selectedAsset: AssetType;
  currentPrice: number;
  priceHistory: PricePoint[];
  assetPrices: Record<string, number>; // Global price tracking
  assetHistories: Record<string, PricePoint[]>; // History for each asset
  rawAssetPrices: Record<string, number>; // Store original prices for delta amplification
  activeRound: ActiveRound | null;
  activeBets: ActiveBet[];
  settledBets: ActiveBet[];
  targetCells: TargetCell[];
  isPlacingBet: boolean;
  isSettling: boolean;
  lastResult: {
    won: boolean;
    amount: number;
    payout: number;
    timestamp: number;
    asset: AssetType; // Track which asset this result belongs to
    cellId?: string; // For box mode visual feedback
    currency?: string; // The currency usage (e.g. XLM, NEAR, BNB)
  } | null;
  error: string | null;
  timeframeSeconds: number;

  // Blitz Round State (Premium Feature)
  isBlitzActive: boolean;
  blitzEndTime: number | null;
  nextBlitzTime: number;
  hasBlitzAccess: boolean;
  blitzMultiplier: number;
  activeTab: 'bet' | 'wallet' | 'blitz';
  activeIndicators: Record<string, boolean>;
  isIndicatorsOpen: boolean;
  isTourOpen: boolean;

  // Actions
  setActiveTab: (tab: 'bet' | 'wallet' | 'blitz') => void;
  setGameMode: (mode: GameMode) => void;
  setSelectedAsset: (asset: AssetType) => void;
  setTimeframeSeconds: (seconds: number) => void;
  placeBet: (amount: string, targetId: string) => Promise<void>;
  placeBetFromHouseBalance: (amount: string, targetId: string, userAddress: string, cellId?: string, metadata?: { priceTop?: number; priceBottom?: number; startTime?: number; endTime?: number; txHash?: string }) => Promise<{ betId: string; remainingBalance: number; bet: ActiveBet } | void>;
  updatePrice: (price: number, asset?: AssetType) => void;
  updateAllPrices: (prices: Record<string, number>) => void;
  startGlobalPriceFeed: (updateAllPrices: (prices: Record<string, number>) => void) => (() => void);


  addActiveBet: (bet: ActiveBet) => void;
  resolveBet: (betId: string, won: boolean, payout: number) => void;
  clearLastResult: () => void;
  settleRound: (betId: string) => Promise<void>;
  setActiveRound: (round: ActiveRound | null) => void;
  loadTargetCells: () => Promise<void>;
  clearError: () => void;


  // Blitz Round Actions
  enableBlitzAccess: () => void;
  revokeBlitzAccess: () => void;
  updateBlitzTimer: () => void;
  // Indicators Actions
  toggleIndicator: (indicatorId: string) => void;
  setIsIndicatorsOpen: (isOpen: boolean) => void;
  setIsTourOpen: (isOpen: boolean) => void;
}



// Maximum price history points (reduced for performance)
const MAX_PRICE_HISTORY = 200;


// Default target cells configuration
const DEFAULT_TARGET_CELLS: TargetCell[] = [
  { id: '1', label: '+$5 in 30s', multiplier: 1.5, priceChange: 5, direction: 'UP' },
  { id: '2', label: '+$10 in 30s', multiplier: 2.0, priceChange: 10, direction: 'UP' },
  { id: '3', label: '+$20 in 30s', multiplier: 3.0, priceChange: 20, direction: 'UP' },
  { id: '4', label: '+$50 in 30s', multiplier: 5.0, priceChange: 50, direction: 'UP' },
  { id: '5', label: '+$100 in 30s', multiplier: 10.0, priceChange: 100, direction: 'UP' },
  { id: '6', label: '-$5 in 30s', multiplier: 1.5, priceChange: -5, direction: 'DOWN' },
  { id: '7', label: '-$10 in 30s', multiplier: 2.0, priceChange: -10, direction: 'DOWN' },
  { id: '8', label: '-$20 in 30s', multiplier: 3.0, priceChange: -20, direction: 'DOWN' },
];

/**
 * Create game slice for Zustand store
 * Handles betting, round management, and price updates
 */
export const createGameSlice: StateCreator<any> = (set, get) => ({
  // Initial state
  gameMode: 'binomo', // Default to classic mode
  selectedAsset: 'BNB',
  currentPrice: 0,
  priceHistory: [],
  assetPrices: {},
  assetHistories: {},
  rawAssetPrices: {},

  activeRound: null,
  activeBets: [],
  settledBets: [],
  targetCells: DEFAULT_TARGET_CELLS,
  isPlacingBet: false,
  isSettling: false,
  lastResult: null,
  error: null,
  // Default pacing. Classic (binomo) mode uses a countdown timer set by the user; 5s is a sensible default.
  timeframeSeconds: 5,
  activeTab: 'bet',
  activeIndicators: {},
  isIndicatorsOpen: false,
  isTourOpen: false,

  // Blitz Initial State
  isBlitzActive: false,
  blitzEndTime: null,
  nextBlitzTime: (() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('binomo_blitz_next');
      if (stored) {
        const t = parseInt(stored, 10);
        if (t > Date.now()) return t;
      }
      const next = Date.now() + 2 * 60 * 1000;
      localStorage.setItem('binomo_blitz_next', next.toString());
      return next;
    }
    return Date.now() + 2 * 60 * 1000;
  })(),
  hasBlitzAccess: false,
  blitzMultiplier: 2.0,

  /**
   * Set game mode (binomo or box)
   */
  setGameMode: (mode: GameMode) => {
    set({
      gameMode: mode,
      lastResult: null,
    });

  },

  /**
   * Set UI active tab
   */
  setActiveTab: (tab: 'bet' | 'wallet' | 'blitz') => {
    set({ activeTab: tab });
  },

  /**
   * Toggle a technical indicator
   */
  toggleIndicator: (indicatorId: string) => {
    set((state: GameState) => ({
      activeIndicators: {
        ...state.activeIndicators,
        [indicatorId]: !state.activeIndicators[indicatorId]
      }
    }));
  },

  /**
   * Set indicators menu open state
   */
  setIsIndicatorsOpen: (isOpen: boolean) => {
    set({ isIndicatorsOpen: isOpen });
  },

  setIsTourOpen: (isOpen: boolean) => {
    set({ isTourOpen: isOpen });
  },


  /**
   * Set timeframe for grid cells (box mode)
   */
  setTimeframeSeconds: (seconds: number) => {
    const { gameMode, activeBets } = get();

    /**
     * In 'box' mode, the grid (columns/boundaries) is directly tied to timeframeSeconds.
     * If there are active box bets, we MUST NOT allow changing the duration,
     * as it would rebuild the grid and make existing bets visually/logically lost.
     */
    if (
      (gameMode === 'box' || gameMode === 'draw') &&
      activeBets.some((bet: ActiveBet) => bet.mode === 'box' || bet.mode === 'draw')
    ) {
      return;
    }

    set((state: GameState) => ({
      timeframeSeconds: seconds,
      /**
       * In 'binomo' (classic) mode or when there are no box bets, we update timeframeSeconds.
       * Classic bets are independent of the current selector (they have strikePrice/endTime),
       * so we keep them active.
       */
      activeBets: state.activeBets,
    }));
  },




  /**
   * Set selected asset for price tracking
   */
  setSelectedAsset: (asset: AssetType) => {
    const { selectedAsset: currentAsset, assetHistories, assetPrices } = get();

    if (currentAsset !== asset) {
      set({
        selectedAsset: asset,
        priceHistory: assetHistories[asset] || [],
        currentPrice: assetPrices[asset] || 0,
        activeRound: null
      });
    }
  },


  /**
   * Place a bet on a target cell
   * Note: After Sui migration, this method is deprecated.
   * Use placeBetFromHouseBalance instead for off-chain betting.
   * @param amount - Bet amount in USDC tokens (e.g., "1.0")
   * @param targetId - ID of the target cell (1-8) OR dynamic grid target (e.g., "UP-2.50")
   */
  placeBet: async (amount: string, targetId: string) => {
    throw new Error("placeBet is deprecated after BNB migration. Use placeBetFromHouseBalance instead.");
  },

  /**
   * Place a bet using house balance (no wallet signature required)
   * Instant-resolution system: bet is placed on a specific cell, resolves when chart hits it
   * @param amount - Bet amount in BNB tokens
   * @param targetId - Dynamic grid target (e.g., "UP-2.50") containing direction and multiplier
   * @param userAddress - User's wallet address
   * @param cellId - Optional: The specific cell ID this bet is placed on
   * @param metadata - Optional: Extra resolution info (price bounds, end time)
   */
  placeBetFromHouseBalance: async (
    amount: string,
    targetId: string,
    userAddress: string,
    cellId?: string,
    metadata?: { priceTop?: number; priceBottom?: number; startTime?: number; endTime?: number; txHash?: string }
  ) => {
    const { targetCells, currentPrice, addActiveBet, gameMode, timeframeSeconds, selectedAsset } = get();

    try {
      // Parse amount for validation
      const betAmount = parseFloat(amount);
      if (isNaN(betAmount) || betAmount <= 0) {
        throw new Error("Invalid bet amount");
      }


      let target: TargetCell;
      let direction: 'UP' | 'DOWN' = 'UP';
      let multiplier = 1.9;
      let durationSeconds = timeframeSeconds || 30;

      // Check if this is a dynamic grid target (e.g., "UP-1.9-30" or "DOWN-1.2-5")
      if (targetId.startsWith('UP-') || targetId.startsWith('DOWN-')) {
        const parts = targetId.split('-');
        direction = parts[0] as 'UP' | 'DOWN';
        multiplier = parseFloat(parts[1]) || 1.9;
        durationSeconds = parseInt(parts[2]) || durationSeconds;

        // Create dynamic target
        target = {
          id: targetId,
          label: `${direction} x${multiplier} (${durationSeconds}s)`,
          multiplier: multiplier,
          priceChange: direction === 'UP' ? 10 : -10,
          direction: direction
        };
      } else {
        // Find predefined target cell
        const foundTarget = targetCells.find((cell: TargetCell) => cell.id === targetId);
        if (!foundTarget) {
          throw new Error("Invalid target cell");
        }
        target = foundTarget;
        direction = target.direction;
        multiplier = target.multiplier;
      }

      // DEMO MODE: Skip API call for demo mode
      const { accountType, demoBalance, updateBalance: storeUpdateBalance } = get();
      const isDemoMode = accountType === 'demo';

      if (isDemoMode) {
        if (demoBalance < betAmount) {
          throw new Error("Insufficient demo balance");
        }

        set({ isPlacingBet: true, error: null });

        // Simulate bet placement without API
        const fakeBetId = `demo-${Date.now()}`;

        const network = (get() as any).network || 'BNB';
        const selectedCurrency = (get() as any).selectedCurrency;
        const currency = resolveHouseLedgerCurrency({
          network,
          selectedCurrency,
          userAddress,
        });

        // Create active bet for tracking
        const activeBet: ActiveBet = {
          id: fakeBetId,
          mode: gameMode,
          asset: selectedAsset, // Set current asset
          amount: betAmount,
          multiplier: multiplier,
          direction: direction,
          timestamp: Date.now(),
          status: 'active',
          network: currency,
          userAddress,
          ...(gameMode === 'binomo' ? {
            strikePrice: currentPrice,
            endTime: Date.now() + (durationSeconds * 1000)
          } : {
            cellId: cellId || targetId,
            priceTop: metadata?.priceTop,
            priceBottom: metadata?.priceBottom,
            startTime: metadata?.startTime,
            endTime: metadata?.endTime
          })
        };


        // Update local demo balance immediately
        storeUpdateBalance(betAmount, 'subtract');

        // Add to active bets
        addActiveBet(activeBet);

        set({ isPlacingBet: false, error: null });

        return {
          betId: fakeBetId,
          remainingBalance: demoBalance - betAmount,
          bet: activeBet
        };
      }

      set({ isPlacingBet: true, error: null });

      const network = (get() as any).network || 'BNB';
      const selectedCurrency = (get() as any).selectedCurrency;
      const currency = resolveHouseLedgerCurrency({
        network,
        selectedCurrency,
        userAddress,
      });

      // Call API endpoint to place bet from house balance
      const response = await fetch('/api/balance/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...balanceMutationHeaders(),
        },
        body: JSON.stringify({
          userAddress: userAddress,
          betAmount,
          currency: currency,
          txHash: metadata?.txHash, // Pass transaction hash if provided (SOL/BNB)
          roundId: Date.now(),
          targetPrice: currentPrice,
          isOver: direction === 'UP',
          multiplier: multiplier,
          asset: selectedAsset,
          targetCell: {
            id: 9,
            priceChange: target.priceChange,
            direction: direction,
            timeframe: durationSeconds,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place bet');
      }

      const data = await response.json();

      if (data.duplicate) {
        await (get() as any).fetchBalance?.(userAddress);
        set({ isPlacingBet: false, error: null });
        throw new Error(data.message || 'Bet already processed');
      }

      if (data.betId == null || data.settlementToken == null) {
        await (get() as any).fetchBalance?.(userAddress);
        set({ isPlacingBet: false, error: null });
        throw new Error('Invalid bet response from server');
      }

      const remRaw = data.remainingBalance;
      const rem = typeof remRaw === 'number' ? remRaw : Number(remRaw);
      if (Number.isFinite(rem)) {
        (get() as any).setBalance?.(rem);
      }

      // Create ActiveBet object
      const activeBet: ActiveBet = {
        id: data.betId,
        mode: gameMode,
        asset: selectedAsset, // Set current asset
        amount: betAmount,
        multiplier: multiplier,
        direction: direction,
        timestamp: Date.now(),
        status: 'active',
        network: currency, // Save the currency identifier used (e.g. XLM, NEAR, PC)
        userAddress: userAddress, // Capture address at placement time for settlement
        settlementToken: data.settlementToken,
        ...(gameMode === 'binomo' ? {
          strikePrice: currentPrice,
          endTime: Date.now() + (durationSeconds * 1000)
        } : {
          cellId: cellId || targetId,
          priceTop: metadata?.priceTop,
          priceBottom: metadata?.priceBottom,
          startTime: metadata?.startTime,
          endTime: metadata?.endTime
        })
      };


      // Add to active bets (multiple bets can be active simultaneously)
      addActiveBet(activeBet);

      set({
        isPlacingBet: false,
        error: null
      });

      // Return bet info for UI
      return {
        betId: data.betId,
        remainingBalance: data.remainingBalance,
        bet: activeBet
      };
    } catch (error) {
      console.error("Error placing bet from house balance:", error);
      set({
        isPlacingBet: false,
        error: error instanceof Error ? error.message : "Failed to place bet"
      });
      throw error;
    }
  },

  /**
   * Settle an active round
   * Note: After Sui migration, settlement is handled automatically by the instant-resolution system.
   * This method is kept for backward compatibility but does nothing.
   * @param betId - The unique bet ID to settle
   */
  settleRound: async (betId: string) => {
    console.log('settleRound called but is deprecated after BNB migration');
    set({ isSettling: false });
  },

  /**
   * Update all prices at once (Atomic)
   */
  updateAllPrices: (prices: Record<string, number>) => {
    const { 
      selectedAsset, activeBets, resolveBet, assetPrices, 
      assetHistories, rawAssetPrices, address, accountType, 
      fetchBalance, updateBalance 
    } = get();
    const now = Date.now();
    
    // Create clones of existing collections to modify
    const updatedAssetPrices = { ...assetPrices };
    const updatedAssetHistories = { ...assetHistories };
    const updatedRawPrices = { ...rawAssetPrices };
    
    let currentAssetUpdated = false;
    let nextCurrentPrice = 0;
    let nextCurrentHistory: PricePoint[] = [];

    Object.entries(prices).forEach(([asset, price]) => {
      const assetKey = asset as AssetType;
      
      // Get volatility multiplier based on asset type
      const getVolatilityMultiplier = (a: AssetType) => {
        // High volatility for Forex and Stocks/Indices to make them tradable on short timeframes
        if (['EUR', 'GBP', 'JPY', 'AUD', 'CAD'].includes(a)) return 15.0;
        
        // Stocks and Indices
        const stockSymbols = ['AAPL', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'TSLA', 'META', 'NFLX', 'AMD', 'BABA', 'DIS', 'JPM', 'V', 'MA', 'PYPL', 'COIN', 'MSTR', 'UBER', 'PLTR', 'CRM', 'INTC', 'TSM', 'SPX', 'NDX', 'DJI'];
        if (stockSymbols.includes(a)) return 18.0;
        
        // Commodities/Metals
        const commoditySymbols = ['GOLD', 'SILVER', 'WTI', 'BRENT'];
        if (commoditySymbols.includes(a)) return 10.0;
        
        // Default for Crypto (already volatile)
        return 2.5;
      };


      const multiplier = getVolatilityMultiplier(assetKey);
      const lastRawPrice = updatedRawPrices[assetKey] || price;
      const rawDelta = price - lastRawPrice;
      
      const jitterSign = Math.random() > 0.5 ? 1 : -1;
      const jitterAmount = price * (0.00004 + Math.random() * 0.00008) * jitterSign;
      
      const amplifiedDelta = (rawDelta * multiplier) + jitterAmount;
      const previousVirtualPrice = updatedAssetPrices[assetKey] || price;
      const finalPrice = previousVirtualPrice + amplifiedDelta;

      updatedAssetPrices[assetKey] = finalPrice;
      updatedRawPrices[assetKey] = price;

      const history = [...(updatedAssetHistories[assetKey] || [])];
      history.push({ timestamp: now, price: finalPrice });
      updatedAssetHistories[assetKey] = history.slice(-MAX_PRICE_HISTORY);

      if (assetKey === selectedAsset) {
        currentAssetUpdated = true;
        nextCurrentPrice = finalPrice;
        nextCurrentHistory = updatedAssetHistories[assetKey];
      }

      // RESOLUTION LOGIC: Check bets for this asset
      if (activeBets && activeBets.length > 0) {
        activeBets.forEach((bet: ActiveBet) => {
          if ((bet.asset || 'BNB') !== assetKey || bet.status !== 'active') return;

          if (bet.mode === 'binomo' && bet.endTime && bet.strikePrice !== undefined && now >= bet.endTime) {
            const won = bet.direction === 'UP' ? finalPrice > bet.strikePrice : finalPrice < bet.strikePrice;
            resolveBet(bet.id, won, won ? bet.amount * bet.multiplier : 0);
          } else if (bet.mode === 'box' && bet.endTime && bet.priceTop !== undefined && bet.priceBottom !== undefined && now >= bet.endTime) {
            const won = finalPrice <= bet.priceTop && finalPrice >= bet.priceBottom;
            resolveBet(bet.id, won, won ? bet.amount * bet.multiplier : 0);
          }
        });
      }
    });

    // Atomic set call for all updates
    const updateObj: any = {
      assetPrices: updatedAssetPrices,
      assetHistories: updatedAssetHistories,
      rawAssetPrices: updatedRawPrices,
      error: null
    };

    if (currentAssetUpdated) {
      updateObj.currentPrice = nextCurrentPrice;
      updateObj.priceHistory = nextCurrentHistory;
    }

    set(updateObj);
  },


  /**
   * Set active round (used by event listeners)
   * @param round - Active round data or null to clear
   */
  setActiveRound: (round: ActiveRound | null) => {
    set({ activeRound: round });
  },

  /**
   * Load target cells from configuration
   * Note: After Sui migration, target cells are configured off-chain.
   * No blockchain query needed.
   */
  loadTargetCells: async () => {
    // Use default configuration (off-chain)
    set({ targetCells: DEFAULT_TARGET_CELLS });
  },

  /**
   * Add a new active bet (for instant-resolution system)
   * @param bet - The bet to add
   */
  addActiveBet: (bet: ActiveBet) => {
    const { activeBets } = get();
    set({ activeBets: [...activeBets, bet] });
  },

  /**
   * Resolve a bet (win or lose) and update house balance
   * @param betId - The bet ID to resolve
   * @param won - Whether the bet was won
   * @param payout - The payout amount if won
   */
  resolveBet: (betId: string, won: boolean, payout: number) => {
    const { activeBets, settledBets, currentPrice, address, network, accountType, updateBalance, fetchBalance } = get();
    const resolvedBet = activeBets.find((b: ActiveBet) => b.id === betId);

    if (resolvedBet) {
      const settledBet = { ...resolvedBet, status: 'settled' as const };
      const now = Date.now();

      // Play sound effects
      if (won) playWinSound();
      else playLoseSound();

      // ── Remove bet from active state FIRST ───────────────────────────────
      // This must happen synchronously before any async API calls to prevent
      // the price-tick loop from resolving the same bet a second time.
      set({
        activeBets: activeBets.filter((b: ActiveBet) => b.id !== betId),
        settledBets: [settledBet, ...settledBets].slice(0, 50),
        lastResult: {
          won,
          amount: resolvedBet.amount,
          payout,
          timestamp: now,
          asset: resolvedBet.asset,
          cellId: resolvedBet.cellId,
          currency: resolvedBet.network || (network || 'BNB')
        }
      });

      // ── Use the address that was captured at bet-placement time ───────────
      // Falls back to current store address in case of older bets without it.
      const settlementAddress = resolvedBet.userAddress || address;
      const settlementCurrency = resolvedBet.network || (network || 'BNB');

      // Handle Balance Update
      if (won) {
        if (accountType === 'real' && settlementAddress) {
          fetch('/api/balance/win', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
            body: JSON.stringify({
              userAddress: settlementAddress,
              winAmount: payout,
              currency: settlementCurrency,
              betId: resolvedBet.id,
              settlementToken: resolvedBet.settlementToken,
            })
          }).then(() => {
            if (fetchBalance && settlementAddress) fetchBalance(settlementAddress);
          }).catch(console.error);
        } else if (accountType === 'demo') {
          updateBalance(payout, 'add');
        }
      }

      // Also add to persistent local history store
      const anyGet = get() as any;
      if (anyGet.addBet) {
        anyGet.addBet({
          id: resolvedBet.id,
          timestamp: now,
          amount: resolvedBet.amount.toString(),
          won: won,
          payout: payout.toString(),
          startPrice: resolvedBet.strikePrice || 0,
          endPrice: currentPrice,
          actualChange: currentPrice - (resolvedBet.strikePrice || 0),
          target: {
            id:
              resolvedBet.mode === 'binomo'
                ? 'classic'
                : resolvedBet.mode === 'draw'
                  ? 'draw'
                  : 'box',
            label:
              resolvedBet.mode === 'binomo'
                ? `${resolvedBet.direction} ${resolvedBet.multiplier}x`
                : resolvedBet.mode === 'draw'
                  ? `Draw ${resolvedBet.multiplier}x`
                  : `Box ${resolvedBet.multiplier}x`,
            multiplier: resolvedBet.multiplier,
            priceChange: 0,
            direction: resolvedBet.direction
          }
        });
      }

      // ── Save to Supabase bet_history ──────────────────────────────────────
      // Real mode: persist all non-demo ids. Demo mode: persist demo-* ids only (admin splits real vs demo).
      const isDemoBet = String(resolvedBet.id).toLowerCase().startsWith('demo-');
      if (settlementAddress) {
        if (accountType === 'real' && !isDemoBet) {
          fetch('/api/bets/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
            body: JSON.stringify({
              id: resolvedBet.id,
              walletAddress: settlementAddress,
              asset: resolvedBet.asset || 'BNB',
              direction: resolvedBet.direction,
              amount: resolvedBet.amount,
              multiplier: resolvedBet.multiplier,
              strikePrice: resolvedBet.strikePrice || 0,
              endPrice: currentPrice,
              payout: payout,
              won: won,
              mode: resolvedBet.mode,
              network: settlementCurrency,
            }),
          }).catch(err => console.error('Failed to save bet to Supabase:', err));
        } else if (accountType === 'demo' && isDemoBet) {
          fetch('/api/bets/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
            body: JSON.stringify({
              id: resolvedBet.id,
              walletAddress: settlementAddress,
              asset: resolvedBet.asset || 'BNB',
              direction: resolvedBet.direction,
              amount: resolvedBet.amount,
              multiplier: resolvedBet.multiplier,
              strikePrice: resolvedBet.strikePrice || 0,
              endPrice: currentPrice,
              payout: payout,
              won: won,
              mode: resolvedBet.mode,
              network: settlementCurrency,
            }),
          }).catch(err => console.error('Failed to save demo bet to Supabase:', err));
        }
      }
    }

    // Log resolution for debugging
    console.log(`Bet ${betId} resolved: ${won ? 'WON' : 'LOST'}, payout: ${payout}`);
  },

  /**
   * Clear the last result notification
   */
  clearLastResult: () => {
    set({ lastResult: null });
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },

  // Blitz Actions
  enableBlitzAccess: () => {
    set({ hasBlitzAccess: true });
  },

  revokeBlitzAccess: () => {
    set({ hasBlitzAccess: false });
  },

  updateBlitzTimer: () => {
    const { isBlitzActive, blitzEndTime, nextBlitzTime } = get();
    const now = Date.now();
    const BLITZ_DURATION = 60 * 1000; // 1 minute
    const BLITZ_INTERVAL = 2 * 60 * 1000; // 2 minutes between blitzes

    if (isBlitzActive) {
      if (blitzEndTime && now >= blitzEndTime) {
        const newNextTime = now + BLITZ_INTERVAL;
        if (typeof window !== 'undefined') {
          localStorage.setItem('binomo_blitz_next', newNextTime.toString());
        }
        set({
          isBlitzActive: false,
          blitzEndTime: null,
          nextBlitzTime: newNextTime,
          hasBlitzAccess: false,
        });
      }
    } else {
      if (now >= nextBlitzTime) {
        const newNextTime = now + BLITZ_INTERVAL + BLITZ_DURATION;
        if (typeof window !== 'undefined') {
          localStorage.setItem('binomo_blitz_next', newNextTime.toString());
        }
        set({
          isBlitzActive: true,
          blitzEndTime: now + BLITZ_DURATION,
          nextBlitzTime: newNextTime,
        });
      }
    }
  },

  /**
   * Start global multi-asset price feed tracking
   */
  startGlobalPriceFeed: (updateAllPrices: (prices: Record<string, number>) => void) => {
    return startGlobalPriceFeed(updateAllPrices);
  }
});



/**
 * Start global multi-asset price feed tracking
 */
export const startGlobalPriceFeed = (
  updateAllPrices: (prices: Record<string, number>) => void
): (() => void) => {
  let stopFeedFn: (() => void) | null = null;
  let isActive = true;

  // Use a more immediate load
  import('@/lib/utils/priceFeed').then(({ startMultiPythPriceFeed }) => {
    if (!isActive) return;
    
    stopFeedFn = startMultiPythPriceFeed((prices) => {
      if (isActive && Object.keys(prices).length > 0) {
        // Wrap in a try-catch to prevent one bad update from freezing the feed
        try {
          updateAllPrices(prices);
        } catch (e) {
          console.error("Price update error:", e);
        }
      }
    });
  }).catch(err => {
    console.error('Failed to start multi-asset price feed:', err);
  });

  return () => {
    isActive = false;
    if (stopFeedFn) {
      stopFeedFn();
    }
  };
};

/**
 * Start price feed polling (Legacy/Single Asset)
 * @param updatePrice - Function to update price in store
 * @param asset - Asset to track
 * @returns Function to stop polling
 */
export const startPriceFeed = (
  updatePrice: (price: number, asset?: AssetType) => void,
  asset: AssetType = 'BTC'
): (() => void) => {
  // Clean up any existing single-asset feed first
  if ((window as any).__currentPriceFeed) {
    (window as any).__currentPriceFeed.stop();
  }

  let stopFeedFn: (() => void) | null = null;
  let isActive = true;

  (window as any).__currentPriceFeed = {
    asset,
    stop: () => {
      isActive = false;
      if (stopFeedFn) stopFeedFn();
    }
  };

  import('@/lib/utils/priceFeed').then(({ startPythPriceFeed }) => {
    if (!isActive) return;
    stopFeedFn = startPythPriceFeed((price) => {
      if (isActive) updatePrice(price, asset);
    }, asset);
  });

  return () => {
    isActive = false;
    if (stopFeedFn) stopFeedFn();
  };
};

