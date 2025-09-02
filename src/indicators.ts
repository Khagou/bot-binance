import { Candle } from './types.js';


export function ema(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const out: number[] = [];
    let prev = values[0];
    out.push(prev);
    for (let i = 1; i < values.length; i++) {
        const v = values[i] * k + prev * (1 - k);
        out.push(v);
        prev = v;
    }
    return out;
}


export function last<T>(arr: T[]): T { return arr[arr.length - 1]; }


export function toCloses(c: Candle[]): number[] { return c.map(x => x.close); }