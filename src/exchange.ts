import ccxt from "ccxt";
import { ExchangeConfig } from "./types.js";

export async function createExchange(cfg: ExchangeConfig) {
  const Klass = (ccxt as any)[cfg.id];
  if (!Klass) throw new Error(`Unknown exchange ${cfg.id}`);
  const ex = new Klass({
    apiKey: cfg.apiKey,
    secret: cfg.apiSecret,
    enableRateLimit: true,
  });
  // Optionnel : si tu veux placer de vrais ordres sur TESTNET (avec clés testnet)
  if (typeof ex.setSandboxMode === "function" && cfg.paper) {
    ex.setSandboxMode(true); // ex: binance -> https://testnet.binance.vision
  }
  return ex;
}

export async function fetchOHLCV(ex: any, symbol: string, timeframe: string, limit = 200) {
  return ex.fetchOHLCV(symbol, timeframe, undefined, limit);
}

export async function fetchPrice(ex: any, symbol: string): Promise<number> {
  const t = await ex.fetchTicker(symbol);
  return Number(t.last || t.close || t.bid || t.ask || 0);
}

// NEW: simule en paper (aucun appel privé). Sinon, en réel utilise quoteOrderQty pour binance
export async function placeMarketBuy(
  ex: any,
  symbol: string,
  costUSDT: number,
  opts: { paper?: boolean } = {}
) {
  if (opts.paper) {
    return { orderId: `paper-${Date.now()}`, costUSDT };
  }
  await ex.loadMarkets();
  const params: any = {};
  if ((ex.id || "").toLowerCase().startsWith("binance")) {
    params.quoteOrderQty = costUSDT; // binance
  } else {
    params.cost = costUSDT;          // autres exchanges supportant 'cost'
  }
  const order = await ex.createOrder(symbol, "market", "buy", undefined, undefined, params);
  return { orderId: order.id, costUSDT };
}
