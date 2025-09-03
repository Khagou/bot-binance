import { Candle } from './types.js';
import ccxt from 'ccxt'

const PAPER = process.env.PAPER === '1';
const SYMBOL = process.env.SYMBOL || 'BTC/USDT';


let ex: ccxt.Exchange;


export function getExchange() {
    if (!ex) {
        const id = (process.env.EXCHANGE || 'binance') as ccxt.ExchangeId;
        const cls = (ccxt as any)[id];
        const params: any = {
            enableRateLimit: true,
            options: {
              defaultType: 'spot',
              adjustForTimeDifference: true, // auto sync clock drift for private calls
              recvWindow: 10000,             // tolerate up to 10s drift
            },
          };
      
          // In PAPER mode we do NOT attach API keys to avoid private endpoints
          if (!PAPER && process.env.API_KEY && process.env.API_SECRET) {
            params.apiKey = process.env.API_KEY;
            params.secret = process.env.API_SECRET;
          }
      
          ex = new cls(params);
    }
    return ex;
}

async function ensureTimeSync(e: ccxt.Exchange) {
    try {
      // Only meaningful in real mode (private endpoints)
      if (!PAPER) {
        // @ts-ignore
        if (typeof (e as any).loadTimeDifference === 'function') {
          // @ts-ignore
          await (e as any).loadTimeDifference();
        }
      }
    } catch {}
}

export async function fetchCandles(timeframe: string, limit = 200): Promise<Candle[]> {
    const e = getExchange();
    const raw = await e.fetchOHLCV(SYMBOL, timeframe, undefined, limit);
    return raw.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
}


export async function fetchTicker(): Promise<number> {
    const e = getExchange();
    await ensureTimeSync(e);
    const t = await e.fetchTicker(SYMBOL);
    return t.last as number;
}


export async function marketBuyUSDT(amountUSDT: number): Promise<{ filledQty: number; price: number; cost: number }> {
    const e = getExchange();
    const price = await fetchTicker();
    const qty = amountUSDT / price;
    if (PAPER) return { filledQty: qty, price, cost: amountUSDT };
    await ensureTimeSync(e);
    const o = await e.createOrder(SYMBOL, 'market', 'buy', qty);
    return { filledQty: o.filled as number, price, cost: (o.cost as number) };
}


export async function marketSellQty(qty: number): Promise<{ receivedUSDT: number; price: number }> {
    const e = getExchange();
    const price = await fetchTicker();
    if (PAPER) return { receivedUSDT: qty * price, price };
    await ensureTimeSync(e);
    const o = await e.createOrder(SYMBOL, 'market', 'sell', qty);
    return { receivedUSDT: (o.filled as number) * price, price };
}