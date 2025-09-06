// src/risk.ts
import { BotState } from "./types.js";

export function exposureAfter(state: BotState, addUSDT: number): number {
  const mv = marketValueHint(state);
  const equity = Math.max(state.cashFree + mv, 1e-6);
  return (mv + addUSDT) / equity;
}

export function marketValueHint(state: BotState): number {
  // Si index.ts met à jour une hint live, on l'utilise, sinon 0
  return Number(state.equityHint ?? 0);
}
