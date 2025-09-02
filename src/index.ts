import 'dotenv/config';
import { fetchCandles, fetchTicker } from './exchange.js';
import { loadState, saveState } from './state.js';
import { isoDay, isoWeek } from './utils/time.js';
import { notify } from './notifier.js';
import { handleLotTPs, maybeBuy, poolEligibleLots, coreWideTP, softStops } from './strategy.js';


const TF = process.env.TIMEFRAME || '1h';
const STATE_FILE = process.env.STATE_FILE || '.state.json';


const state = loadState(STATE_FILE);

async function rotateBudgetsIfNeeded() {
const day = isoDay();
const week = isoWeek();


if (state.currentWeek !== week) {
// week start
state.weeklyRemaining = state.weeklyCapBase + state.carryWeeklyNext;
state.carryWeeklyNext = 0;
state.currentWeek = week;
}
if (state.currentDay !== day) {
// day start
state.dailyRemaining = state.dailyCapBase + state.carryDailyNext;
state.carryDailyNext = 0;
// recycled daily usage budget resets (soft cap)
state.recycledTodayBudget = Math.min(state.recycledCash, state.recycledSoftCap);
state.currentDay = day;
}
}


async function endOfPeriodsRollovers() {
// call this when you detect end-of-day/week (simple schedule); here we run every loop and roll over if clock changed
// Day rollover is handled at next day start; here we snapshot remaining from previous markers
}

async function loopOnce() {
await rotateBudgetsIfNeeded();
const candles = await fetchCandles(TF, 200);
const price = candles.at(-1)!.close;


// update equity hint (paper simplifié)
state.equityHint = state.cashFree; // could add unrealized PnL estimation


await maybeBuy(state, candles);
await handleLotTPs(state, price);
await poolEligibleLots(state);
await coreWideTP(state, price);
await softStops(state, candles);


saveState(STATE_FILE, state);
}

async function main() {
    await notify(`Bot started | TF=${TF} | PAPER=${process.env.PAPER === '1'}`);
    while (true) {
        try {
            await loopOnce();
        } catch (e: any) {
            console.error(e);
            await notify(`Error: ${e?.message || e}`);
        }
        // 5 minutes interval
        await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    }
}


main().catch(console.error);