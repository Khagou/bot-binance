import fs from 'node:fs';
import path from 'node:path';
import { BotState, DayStats } from './types.js';


const emptyStats = (): DayStats => ({
    buys: 0,
    sells: 0,
    tps: 0,
    pools: 0,
    stops: 0,
    pnlRealized: 0,
    skimSaved: 0,
    volumeBought: 0,
    volumeSold: 0,
  });

const DEFAULT_STATE: BotState = {
    positions: [],
    core: { qty: 0, avgEntry: null, tpDone: {} },
    lastBuyMs: null,
    dailyCapBase: 30,
    weeklyCapBase: 100,
    dailyRolloverMax: 30,
    weeklyRolloverMax: 100,
    recycledSoftCap: 30,
    exposureCap: 0.7,
    skimPct: 0.3,
    dailyRemaining: 30,
    weeklyRemaining: 100,
    carryDailyNext: 0,
    carryWeeklyNext: 0,
    recycledCash: 0,
    recycledTodayBudget: 0,
    cashFree: 1000,
    equityHint: 1000,
    currentDay: '',
    currentWeek: '',
    lastSummaryDay: undefined,
    lastSummaryWeek: undefined,
    statsToday: emptyStats(),
    statsWeek: emptyStats(),
    statsTotal: emptyStats(),
};


export function loadState(file: string): BotState {
    try {
        if (fs.existsSync(file)) {
            const raw = fs.readFileSync(file, 'utf-8');
            return { ...DEFAULT_STATE, ...JSON.parse(raw) } as BotState;
        }
    } catch (e) {
        console.error('Failed to load state', e);
    }
    return { ...DEFAULT_STATE };
}


export function saveState(file: string, state: BotState) {
    try {
        fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('Failed to save state', e);
    }
}