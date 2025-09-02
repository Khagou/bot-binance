import { Candle, PositionLot, BotState } from './types.js';
import { ema, last, toCloses } from './indicators.js';
import { marketBuyUSDT, marketSellQty, fetchTicker } from './exchange.js';
import { notify } from './notifier.js';


const EMA_FAST = 9;
const EMA_SLOW = 21;
const EMA_SUPER = 50;


const PULLBACK = 0.002; // +0.2%
const STOP_BAND = 0.015; // -1.5%
const BASE_ORDER = 10; // USDT
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h
const TP_LEVELS = [0.04, 0.10];
const TP_FRACS = [0.50, 0.50];
const CORE_MODE: 'hodl' | 'wide_tp' = 'hodl';
const CORE_WIDE_LEVELS = [0.20, 0.40, 0.80];
const CORE_WIDE_FRACS = [0.20, 0.20, 0.30];


export function computeEMAs(candles: Candle[]) {
const closes = toCloses(candles);
const e9 = ema(closes, EMA_FAST);
const e21 = ema(closes, EMA_SLOW);
const e50 = ema(closes, EMA_SUPER);
return { e9, e21, e50 };
}


function now() { return Date.now(); }


export async function maybeBuy(state: BotState, candles: Candle[]) {
const { e9, e21 } = computeEMAs(candles);
const price = candles.at(-1)!.close;
const trendUp = last(e9) > last(e21);
const touchesPullback = price <= last(e21) * (1 + PULLBACK);
const cooldownOk = !state.lastBuyMs || now() - state.lastBuyMs >= COOLDOWN_MS;


// financing logic: recycled first, then daily/weekly remaining is handled in index.ts
if (trendUp && touchesPullback && cooldownOk && canFinance(state, BASE_ORDER)) {
const { financed, fromRecycled, fromCaps } = finance(state, BASE_ORDER);
const exec = await marketBuyUSDT(financed);
const lot: PositionLot = {
id: `lot_${Date.now()}`,
entry: exec.price,
qtyRem: exec.filledQty,
tpTakenIdx: -1,
pooled: false,
costBasis: financed
};
state.positions.push(lot);
state.lastBuyMs = now();
await notify(`BUY ${financed.toFixed(2)} USDT @ ~${exec.price.toFixed(2)} | recycled=${fromRecycled.toFixed(2)} caps=${fromCaps.toFixed(2)}`);
}
}


function canFinance(state: BotState, orderAmt: number) {
const enoughRecycled = state.recycledTodayBudget >= orderAmt;
const enoughCaps = state.dailyRemaining >= orderAmt && state.weeklyRemaining >= orderAmt;
return enoughRecycled || enoughCaps;
}

function finance(state: BotState, orderAmt: number) {
let fromRecycled = Math.min(orderAmt, state.recycledTodayBudget);
state.recycledTodayBudget -= fromRecycled;
state.recycledCash -= fromRecycled;


let remaining = orderAmt - fromRecycled;
let fromCaps = 0;
if (remaining > 0) {
fromCaps = remaining;
state.dailyRemaining -= remaining;
state.weeklyRemaining -= remaining;
}
state.cashFree -= orderAmt;
return { financed: orderAmt, fromRecycled, fromCaps };
}

export async function handleLotTPs(state: BotState, price: number) {
for (const lot of state.positions) {
if (lot.qtyRem <= 0 || lot.pooled) continue;
const nextIdx = lot.tpTakenIdx + 1;
if (nextIdx >= TP_LEVELS.length) continue;
const target = lot.entry * (1 + TP_LEVELS[nextIdx]);
if (price >= target) {
const sellQty = lot.qtyRem * TP_FRACS[nextIdx];
const exec = await marketSellQty(sellQty);
const ratio = sellQty / lot.qtyRem;
const costPart = lot.costBasis * ratio;
lot.qtyRem -= sellQty;
lot.costBasis -= costPart;
lot.tpTakenIdx = nextIdx;


const fees = 0; // simplify paper
const net = exec.receivedUSDT - fees;
const profit = Math.max(net - costPart, 0);
const skim = profit * state.skimPct;
const reinvest = net - skim;


state.cashFree += net;
state.recycledCash += reinvest;
state.recycledTodayBudget += Math.min(reinvest, state.recycledSoftCap - state.recycledTodayBudget);


await notify(`TP lot ${lot.id} @ ~${exec.price.toFixed(2)} | sold=${sellQty.toFixed(6)} | net=${net.toFixed(2)} | profit=${profit.toFixed(2)} | skim=${skim.toFixed(2)}`);
}
}
}

export async function poolEligibleLots(state: BotState) {
for (const lot of state.positions) {
if (lot.qtyRem > 0 && !lot.pooled && lot.tpTakenIdx + 1 === 2) {
// merge into core bag
if (state.core.avgEntry == null) state.core.avgEntry = lot.entry;
const n = state.core.qty + lot.qtyRem;
if (n > 0) state.core.avgEntry = ((state.core.avgEntry ?? 0) * state.core.qty + lot.entry * lot.qtyRem) / n;
state.core.qty = n;
lot.qtyRem = 0;
lot.pooled = true;
await notify(`POOL lot ${lot.id} -> core bag | core qty=${state.core.qty.toFixed(6)} avg=${state.core.avgEntry?.toFixed(2)}`);
}
}
}


export async function coreWideTP(state: BotState, price: number) {
if (CORE_MODE !== 'wide_tp') return;
if (state.core.qty <= 0 || state.core.avgEntry == null) return;
for (let i = 0; i < CORE_WIDE_LEVELS.length; i++) {
const lvl = CORE_WIDE_LEVELS[i];
const key = lvl.toFixed(2);
if (state.core.tpDone[key]) continue;
if (price >= state.core.avgEntry * (1 + lvl)) {
const frac = CORE_WIDE_FRACS[i] ?? 0.2;
const sellQty = state.core.qty * frac;
const exec = await marketSellQty(sellQty);
const net = exec.receivedUSDT;
const profit = Math.max(net - (state.core.avgEntry * sellQty), 0);
const skim = profit * state.skimPct;
const reinvest = net - skim;
state.cashFree += net;
state.recycledCash += reinvest;
state.recycledTodayBudget += Math.min(reinvest, state.recycledSoftCap - state.recycledTodayBudget);
state.core.qty -= sellQty;
state.core.tpDone[key] = true;
await notify(`CORE TP ${key} @ ~${exec.price.toFixed(2)} | sold=${sellQty.toFixed(6)} | net=${net.toFixed(2)}`);
}
}
}


export async function softStops(state: BotState, candles: Candle[]) {
const { e9, e21, e50 } = computeEMAs(candles);
const price = candles.at(-1)!.close;


// soft stop for trading lots
const hasTradingLots = state.positions.some(l => l.qtyRem > 0 && !l.pooled);
if (hasTradingLots) {
const cond = price <= last(e21) * (1 - STOP_BAND) && last(e9) < last(e21);
if (cond) {
let qtyClose = 0;
for (const l of state.positions) if (!l.pooled) qtyClose += l.qtyRem;
if (qtyClose > 0) {
const exec = await marketSellQty(qtyClose);
const net = exec.receivedUSDT;
state.cashFree += net;
state.recycledCash += net; // conservative: consider all as reusable in paper
state.recycledTodayBudget += Math.min(net, state.recycledSoftCap - state.recycledTodayBudget);
for (const l of state.positions) if (!l.pooled) { l.qtyRem = 0; l.costBasis = 0; }
await notify(`SOFT STOP (trading) @ ~${exec.price.toFixed(2)} | closed=${qtyClose.toFixed(6)} | net=${net.toFixed(2)}`);
}
}
}


// super stop for core (partial)
// simple: if 3 consecutive closes below ema50*(1-3%) AND e9<e21 -> sell 25%
const belowBand = price <= last(e50) * (1 - 0.03) && last(e9) < last(e21);
// Check last 3 candles below band
let streak = 0;
for (let i = candles.length - 3; i < candles.length; i++) {
if (i < 0) continue;
const p = candles[i].close;
const e50i = ema(candles.map(c => c.close), EMA_SUPER)[i];
if (p <= e50i * (1 - 0.03)) streak++;
}
if (state.core.qty > 0 && belowBand && streak >= 3) {
const sellQty = state.core.qty * 0.25;
const exec = await marketSellQty(sellQty);
const net = exec.receivedUSDT;
state.cashFree += net;
state.recycledCash += net;
state.recycledTodayBudget += Math.min(net, state.recycledSoftCap - state.recycledTodayBudget);
state.core.qty -= sellQty;
await notify(`SUPER STOP (core 25%) @ ~${exec.price.toFixed(2)} | sold=${sellQty.toFixed(6)} | net=${net.toFixed(2)}`);
}
}