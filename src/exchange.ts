import ccxt from "ccxt";
import { ExchangeConfig, ExchangeAccount, BotConfig } from "./types.js";
import { getAccount } from "./accounts.js";

// instancie ccxt depuis un "exchange config inline" (legacy)
export async function createExchange(cfg: { id: string; apiKey?: string; apiSecret?: string; paper?: boolean; sandbox?: boolean; }) {
  const Klass = (ccxt as any)[cfg.id];
  if (!Klass) throw new Error(`Unknown exchange ${cfg.id}`);
  const ex = new Klass({ apiKey: cfg.apiKey, secret: cfg.apiSecret, enableRateLimit: true });
  if (typeof (ex as any).setSandboxMode === "function" && (cfg.sandbox || cfg.paper)) {
    (ex as any).setSandboxMode(true);
  }
  return ex;
}

// depuis un ExchangeAccount enregistré
export async function createExchangeFromAccount(acc: ExchangeAccount) {
  return createExchange({ id: acc.exchangeId, apiKey: acc.apiKey, apiSecret: acc.apiSecret, paper: acc.paper, sandbox: acc.sandbox });
}

// ➜ résolution pour un BotConfig (réf compte OU inline)
export async function createExchangeForBot(cfg: BotConfig) {
  if (cfg.exchangeAccountId) {
    const acc = getAccount(cfg.exchangeAccountId);
    if (!acc) throw new Error(`Exchange account not found: ${cfg.exchangeAccountId}`);
    return createExchangeFromAccount(acc);
  }
  if (cfg.exchange?.id) return createExchange({ ...cfg.exchange });
  throw new Error("No exchange provided (exchangeAccountId or exchange.id required)");
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
