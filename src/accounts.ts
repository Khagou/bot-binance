// src/accounts.ts
import fs from "fs";
import path from "path";
import { ExchangeAccount } from "./types.js";

const FILE = process.env.EXCHANGES_FILE || "/data/exchanges.json";

let map = new Map<string, ExchangeAccount>();

function load() {
  try {
    const txt = fs.readFileSync(FILE, "utf8").trim();
    if (!txt) return;
    const arr: ExchangeAccount[] = JSON.parse(txt);
    map = new Map(arr.map(a => [a.id, a]));
  } catch {}
}
load();

function save() {
  const arr = Array.from(map.values());
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(arr, null, 2));
}

export function listAccounts(): ExchangeAccount[] {
  return Array.from(map.values());
}
export function getAccount(id: string): ExchangeAccount | undefined {
  return map.get(id);
}
export function upsertAccount(acc: ExchangeAccount) {
  if (!acc.id) throw new Error("account.id required");
  if (!acc.exchangeId) throw new Error("exchangeId required");
  map.set(acc.id, acc); save();
}
export function removeAccount(id: string) {
  map.delete(id); save();
}
