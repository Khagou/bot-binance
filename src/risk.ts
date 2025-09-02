import { BotState } from './types.js';


export function exposureAfter(state: BotState, addUSDT: number): number {
    const mv = marketValueHint(state);
    const equity = Math.max(state.cashFree + mv, 1e-6);
    return (mv + addUSDT) / equity;
}


export function marketValueHint(state: BotState): number {
    // Paper simplifié: approx via core avg & last entries; remplacé en réel par valorisation live
    let mv = 0;
    // We keep it 0 here; index.ts updates equityHint from live price if needed
    return mv;
}