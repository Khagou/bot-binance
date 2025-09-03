export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };


export type PositionLot = {
    id: string;
    entry: number; // entry price
    qtyRem: number; // remaining qty
    tpTakenIdx: number; // -1 none, 0 first TP, 1 second TP
    pooled: boolean; // moved to core bag
    costBasis: number; // cost basis for remaining qty
};


export type CoreBag = {
    qty: number;
    avgEntry: number | null;
    tpDone: Record<string, boolean>; // e.g. {"0.20": true}
};

export type DayStats = {
    buys: number;
    sells: number;
    tps: number;
    pools: number;
    stops: number;
    pnlRealized: number;   // realized profit in USDT (after fees if modeled)
    skimSaved: number;     // amount skimmed to savings
    volumeBought: number;  // USDT used to buy
    volumeSold: number;    // USDT received from sells
};

export type BotState = {
    positions: PositionLot[];
    core: CoreBag;
    lastBuyMs: number | null;
    // budgets
    dailyCapBase: number;
    weeklyCapBase: number;
    dailyRolloverMax: number;
    weeklyRolloverMax: number;
    recycledSoftCap: number;
    exposureCap: number; // 0..1
    skimPct: number; // 0..1


    // live counters
    dailyRemaining: number;
    weeklyRemaining: number;
    carryDailyNext: number;
    carryWeeklyNext: number;
    recycledCash: number;
    recycledTodayBudget: number;


    // accounting
    cashFree: number; // informational (paper)
    equityHint: number; // informational


    // rotation markers
    currentDay: string; // YYYY-MM-DD
    currentWeek: string; // ISO week id
    lastSummaryDay?: string;
    lastSummaryWeek?: string;

    // stats
    statsToday: DayStats;
    statsWeek: DayStats;
    statsTotal: DayStats;
};