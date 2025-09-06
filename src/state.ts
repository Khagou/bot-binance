// src/state.ts (additions)
import { BotSpendState, SymbolSpendState, SymbolPair, PersistentState, PortfolioState, OrderRecord } from "./types.js";
import fs from "fs";
import path from "path";

export function loadSpendState(file: string): BotSpendState {
    try {
      const raw = fs.readFileSync(file, "utf8").trim();
      if (!raw) throw new Error("empty");
      const parsed = JSON.parse(raw);
      const base: BotSpendState = { totalToday: 0, totalThisWeek: 0, perSymbol: {} };
      const merged: BotSpendState = { ...base, ...(parsed || {}) };
      if (!merged.perSymbol || typeof merged.perSymbol !== "object") merged.perSymbol = {};
      merged.totalToday = Number(merged.totalToday) || 0;
      merged.totalThisWeek = Number(merged.totalThisWeek) || 0;
      return merged;
    } catch {
      return { totalToday: 0, totalThisWeek: 0, perSymbol: {} };
    }
  }
  
export function saveSpendState(file: string, state: BotSpendState) {
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(state, null, 2));
}
// Chargement robuste (merge défauts)
export function loadBotState(file: string): PersistentState {
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    const parsed = raw ? JSON.parse(raw) : {};
    const spend: BotSpendState = {
      totalToday: Number(parsed?.spend?.totalToday) || 0,
      totalThisWeek: Number(parsed?.spend?.totalThisWeek) || 0,
      perSymbol: parsed?.spend?.perSymbol || {},
      lastResetDailyISO: parsed?.spend?.lastResetDailyISO,
      lastResetWeeklyISO: parsed?.spend?.lastResetWeeklyISO,
    };
    const portfolio: PortfolioState = {
      cashUSDT: typeof parsed?.portfolio?.cashUSDT === "number" ? parsed.portfolio.cashUSDT : 0,
      holdings: parsed?.portfolio?.holdings || {},
      orders: Array.isArray(parsed?.portfolio?.orders) ? parsed.portfolio.orders : [],
      realizedPnlUSDT: Number(parsed?.portfolio?.realizedPnlUSDT) || 0,
    };
    return { spend, portfolio };
  } catch {
    return { spend: { totalToday: 0, totalThisWeek: 0, perSymbol: {} }, portfolio: { cashUSDT: 0, holdings: {}, orders: [], realizedPnlUSDT: 0 } };
  }
}

export function saveBotState(file: string, state: PersistentState) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// === resets jour/semaine (reprend ta logique existante) ===
export function resetIfNeeded(state: BotSpendState, tz: string) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const week = getISOWeekKey(now, tz);
  if (state.lastResetDailyISO !== today) {
    state.totalToday = 0;
    for (const k of Object.keys(state.perSymbol || {})) state.perSymbol[k].spentToday = 0;
    state.lastResetDailyISO = today;
  }
  if (state.lastResetWeeklyISO !== week) {
    state.totalThisWeek = 0;
    for (const k of Object.keys(state.perSymbol || {})) state.perSymbol[k].spentThisWeek = 0;
    state.lastResetWeeklyISO = week;
  }
}

function getISOWeekKey(date: Date, tz: string): string {
  // Simple ISO week key yyyy-Www using local time in tz
  const d = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7; // Monday=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function addSpend(state: BotSpendState, symbol: SymbolPair, amount: number) {
  state.perSymbol[symbol] ||= { spentToday: 0, spentThisWeek: 0 } as SymbolSpendState;
  state.perSymbol[symbol].spentToday += amount;
  state.perSymbol[symbol].spentThisWeek += amount;
  state.totalToday += amount;
  state.totalThisWeek += amount;
}

// === enregistre un ordre & met à jour le PRU/holdings ===
export function recordBuy(ps: PersistentState, ord: OrderRecord) {
  ps.portfolio.orders.push(ord);
  const h = ps.portfolio.holdings[ord.symbol] || { baseQty: 0, avgPrice: 0 };
  // PRU pondéré
  const newQty = h.baseQty + ord.baseQty;
  const newCost = h.baseQty * h.avgPrice + ord.costUSDT;
  ps.portfolio.holdings[ord.symbol] = {
    baseQty: newQty,
    avgPrice: newQty > 0 ? newCost / newQty : 0,
  };
  if (typeof ps.portfolio.cashUSDT === "number") {
    ps.portfolio.cashUSDT -= ord.costUSDT;
  }
}

// === calcul rapide récap (besoin d’un priceMap symbol->price) ===
export function portfolioSummary(ps: PersistentState, priceMap: Record<SymbolPair, number>) {
  const rows = Object.entries(ps.portfolio.holdings).map(([symbol, h]) => {
    const price = Number(priceMap[symbol] ?? 0);
    const value = h.baseQty * price;
    const pnl = (price - h.avgPrice) * h.baseQty;
    const pnlPct = h.avgPrice ? (price / h.avgPrice - 1) * 100 : 0;
    return { symbol, baseQty: h.baseQty, avgPrice: h.avgPrice, price, valueUSDT: value, pnlUSDT: pnl, pnlPct };
  });
  const totalValue = rows.reduce((a, r) => a + r.valueUSDT, 0);
  const totalInvested = ps.portfolio.orders.filter(o => o.side === "buy").reduce((a, o) => a + o.costUSDT, 0);
  const totalPnl = rows.reduce((a, r) => a + r.pnlUSDT, 0);
  return {
    rows,
    totals: {
      investedUSDT: totalInvested,
      valueUSDT: totalValue,
      pnlUSDT: totalPnl,
      pnlPct: totalInvested ? (totalValue / totalInvested - 1) * 100 : 0,
      cashUSDT: ps.portfolio.cashUSDT ?? 0,
    }
  };
}