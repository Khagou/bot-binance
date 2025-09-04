import 'dotenv/config';
import { fetchCandles, fetchTicker } from './exchange.js';
import { loadState, saveState } from './state.js';
import { isoDay, isoWeek } from './utils/time.js';
import { notify } from './notifier.js';
import { handleLotTPs, maybeBuy, poolEligibleLots, coreWideTP, softStops } from './strategy.js';


const TF = process.env.TIMEFRAME || '1h';
const STATE_FILE = process.env.STATE_FILE || '.state.json';
const LOOP_MS = process.env.PAPER === '1' ? 30_000 : 300_000;


const state = loadState(STATE_FILE);

function fmt(n: number, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : String(n); }

async function sendDailySummary(prevDay: string) {
    const used = state.dailyCapBase - Math.max(state.dailyRemaining, 0);
    const usedPct = state.dailyCapBase > 0 ? (100 * used / state.dailyCapBase) : 0;
    const coreLine = state.core.qty > 0 && state.core.avgEntry ? `core: qty=${fmt(state.core.qty, 6)} avg=${fmt(state.core.avgEntry)}` : 'core: empty';
    const s = state.statsToday;
    const lines = [
      `📊 Daily recap ${prevDay}`,
      `buys: ${s.buys} | sells: ${s.sells} | TP: ${s.tps} | stops: ${s.stops} | pools: ${s.pools}`,
      `pnl realized: ${fmt(s.pnlRealized)} | skim saved: ${fmt(s.skimSaved)}`,
      `vol: buy ${fmt(s.volumeBought)} / sell ${fmt(s.volumeSold)}`,
      `caps: used ${fmt(used)} / ${fmt(state.dailyCapBase)} (${fmt(usedPct)}%) | recycled: ${fmt(state.recycledCash)}`,
      coreLine,
    ].join('\n');
    await notifyEvent('INFO', lines);
    state.lastSummaryDay = prevDay;
    // reset day stats after summary
    state.statsToday = { buys:0, sells:0, tps:0, pools:0, stops:0, pnlRealized:0, skimSaved:0, volumeBought:0, volumeSold:0 };
}

async function sendWeeklySummary(prevWeek: string) {
    const used = state.weeklyCapBase - Math.max(state.weeklyRemaining, 0);
    const usedPct = state.weeklyCapBase > 0 ? (100 * used / state.weeklyCapBase) : 0;
    const coreLine = state.core.qty > 0 && state.core.avgEntry ? `core: qty=${fmt(state.core.qty, 6)} avg=${fmt(state.core.avgEntry)}` : 'core: empty';
    const s = state.statsWeek;
    const lines = [
      `📈 Weekly recap ${prevWeek}`,
      `buys: ${s.buys} | sells: ${s.sells} | TP: ${s.tps} | stops: ${s.stops} | pools: ${s.pools}`,
      `pnl realized: ${fmt(s.pnlRealized)} | skim saved: ${fmt(s.skimSaved)}`,
      `vol: buy ${fmt(s.volumeBought)} / sell ${fmt(s.volumeSold)}`,
      `weekly cap used: ${fmt(used)} / ${fmt(state.weeklyCapBase)} (${fmt(usedPct)}%) | recycled carry: ${fmt(state.recycledCash)}`,
      coreLine,
    ].join('\n');
    await notifyEvent('INFO', lines);
    state.lastSummaryWeek = prevWeek;
    // reset week stats after summary
    state.statsWeek = { buys:0, sells:0, tps:0, pools:0, stops:0, pnlRealized:0, skimSaved:0, volumeBought:0, volumeSold:0 };
}

async function rotateBudgetsIfNeeded() {
    const day = isoDay();
    const week = isoWeek();


    // --- Compute rollovers from PREVIOUS periods before resetting ---
    if (state.currentDay && state.currentDay !== day) {
        await sendDailySummary(state.currentDay);
        const unusedDaily = Math.max(state.dailyRemaining, 0);
        state.carryDailyNext = Math.min(unusedDaily, state.dailyRolloverMax);
    }
    if (state.currentWeek && state.currentWeek !== week) {
        await sendWeeklySummary(state.currentWeek);
        const unusedWeekly = Math.max(state.weeklyRemaining, 0);
        state.carryWeeklyNext = Math.min(unusedWeekly, state.weeklyRolloverMax);
    }

    // --- Apply new period budgets ---
    if (state.currentWeek !== week) {
        state.weeklyRemaining = state.weeklyCapBase + state.carryWeeklyNext;
        state.carryWeeklyNext = 0;
        state.currentWeek = week;
    }
    if (state.currentDay !== day) {
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
        await new Promise(r => setTimeout(r, LOOP_MS));
    }
}


main().catch(console.error);