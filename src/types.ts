// src/types.ts (additions)
export type SymbolPair = string; // e.g. "BTC/USDC"

export interface EmaParams {
  fast: number; // e.g. 9
  slow: number; // e.g. 21
}

export interface PerSymbolConfig {
  symbol: SymbolPair;
  orderSizeUSDT?: number; // order size for this symbol
  ema?: EmaParams;        // override per symbol
  dailyCapUSDT?: number;  // optional per-symbol daily cap
  weeklyCapUSDT?: number; // optional per-symbol weekly cap
}

export interface BudgetCaps {
  dailyCapUSDT: number;   // total daily budget for the bot
  weeklyCapUSDT: number;  // total weekly budget for the bot
}

export interface StrategyConfig {
  timeframe: string;      // e.g. "15m"
  ema: EmaParams;         // default EMA if not overridden per symbol
}

export interface NotifierConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface ExchangeConfig {
  id: string;             // e.g. "binance"
  apiKey?: string;
  apiSecret?: string;
  paper?: boolean;        // if true, ignore keys
}

export interface BotConfig {
  id: string;                 // unique id for the bot (slug)
  name?: string;              // display name
  exchange: ExchangeConfig;
  symbols: PerSymbolConfig[]; // one or more symbols
  strategy: StrategyConfig;
  budget: BudgetCaps;
  notifier?: NotifierConfig;
  stateFile: string;          // path under /data/bots/<id>.json
  timezone?: string;          // e.g. "Europe/Paris"
}

export interface SymbolSpendState {
  spentToday: number;
  spentThisWeek: number;
}

export interface BotSpendState {
  totalToday: number;
  totalThisWeek: number;
  perSymbol: Record<SymbolPair, SymbolSpendState>;
  lastResetDailyISO?: string;  // YYYY-MM-DD
  lastResetWeeklyISO?: string; // ISO week anchor date
}

// src/types.ts
export interface BotState {
    cashFree: number;        // liquidités en USDT
    equityHint?: number;     // valorisation mark-to-market (optionnel)
  }

  // === ORDRES / PORTEFEUILLE ===
export type Side = "buy" | "sell";

export interface OrderRecord {
  id: string;
  ts: number;                 // Date.now()
  symbol: SymbolPair;
  side: Side;                 // pour l’instant: "buy"
  baseQty: number;            // quantité achetée (BTC, ETH, etc.)
  price: number;              // prix (USDT par unité)
  costUSDT: number;           // quote dépensée
  paper: boolean;
}

export interface Holding {
  baseQty: number;            // quantité détenue
  avgPrice: number;           // prix de revient moyen (USDT)
}

export interface PortfolioState {
  // utilisé surtout en PAPER; en réel tu peux le laisser à 0/undefined
  cashUSDT?: number;
  holdings: Record<SymbolPair, Holding>;
  orders: OrderRecord[];
  realizedPnlUSDT: number;    // utile quand tu feras des ventes
}

export interface PersistentState {
  spend: BotSpendState;       // déjà existant (caps jour/semaine)
  portfolio: PortfolioState;  // nouveau bloc
}

  