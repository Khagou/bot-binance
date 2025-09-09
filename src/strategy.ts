// src/strategy.ts (additions / adaptation)
import { BotConfig, PerSymbolConfig } from "./types.js";
import { loadSpendState, saveSpendState, resetIfNeeded, addSpend, recordBuy, loadBotState, saveBotState } from "./state.js";
import { createExchangeForBot, fetchOHLCV, placeMarketBuy, fetchPrice } from "./exchange.js"; // adapt to your actual names
import { computeEmaSignal } from "./indicators.js"; // adapt to your actual API
import { notify } from "./notifier.js";

export async function runBotOnce(cfg: BotConfig) {
  const tz = cfg.timezone || "Europe/Paris";
  const st = loadBotState(cfg.stateFile);
  resetIfNeeded(st.spend, tz);

  const ex = await createExchangeForBot(cfg);

  for (const s of cfg.symbols) {
    const symbol = s.symbol;

    // caps
    const capDaily = cfg.budget.dailyCapUSDT;
    const capWeekly = cfg.budget.weeklyCapUSDT;
    const symDaily = s.dailyCapUSDT ?? capDaily;
    const symWeekly = s.weeklyCapUSDT ?? capWeekly;

    if (st.spend.totalToday >= capDaily || st.spend.totalThisWeek >= capWeekly) break;
    const symState = st.spend.perSymbol[symbol] || { spentToday: 0, spentThisWeek: 0 };
    if (symState.spentToday >= symDaily || symState.spentThisWeek >= symWeekly) continue;

    const timeframe = cfg.strategy.timeframe;
    const ema = s.ema || cfg.strategy.ema;

    const candles = await fetchOHLCV(ex, symbol, timeframe, 200);
    const signal = computeEmaSignal(candles, ema.fast, ema.slow);
    if (!signal.shouldBuy) continue;

    const remaining = Math.min(
      s.orderSizeUSDT ?? 10,
      Math.max(0, capDaily - st.spend.totalToday),
      Math.max(0, capWeekly - st.spend.totalThisWeek),
      Math.max(0, symDaily - symState.spentToday),
      Math.max(0, symWeekly - symState.spentThisWeek)
    );
    if (remaining <= 0) continue;

    // Prix courant pour baseQty (ok en paper et même en réel si createOrder ne renvoie pas la qty)
    const px = await fetchPrice(ex, symbol);
    const baseQty = px > 0 ? remaining / px : 0;
    
    const paper = !!(cfg.exchange?.paper);  // safe pour TS même si exchange est undefined

    const filled = await placeMarketBuy(ex, symbol, remaining, { paper: cfg.exchange.paper });
    if (filled) {
      // suivi budget + ordre/holdings
      addSpend(st.spend, symbol, filled.costUSDT);
      recordBuy(st, {
        id: String(filled.orderId),
        ts: Date.now(),
        symbol,
        side: "buy",
        baseQty,
        price: px,
        costUSDT: filled.costUSDT,
        paper,
      });
      saveBotState(cfg.stateFile, st);

      // notif
      await notify(cfg.notifier, `✅ [${cfg.id}] ${symbol} • Buy ~${baseQty.toFixed(6)} @ ${px.toFixed(2)}  (≈ ${filled.costUSDT} USDT)`);
    }
  }
}