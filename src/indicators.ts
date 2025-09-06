// src/indicators.ts (additions)
export function computeEmaSignal(candles: any[], fast: number, slow: number) {
    // candles: array of [timestamp, open, high, low, close, volume]
    const closes = candles.map(c => c[4]);
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const n = closes.length - 1;
    const crossUp = emaFast[n] > emaSlow[n] && emaFast[n-1] <= emaSlow[n-1];
    return { shouldBuy: crossUp, fast, slow };
  }
  
  function ema(values: number[], period: number) {
    const k = 2 / (period + 1);
    const out = new Array(values.length).fill(0);
    let prev = values[0];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      prev = i === 0 ? v : v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }