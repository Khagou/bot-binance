import { BotConfig, BudgetCaps } from "./types.js";
import { runBotOnce } from "./strategy.js";
import { notify } from "./notifier.js";

export interface BotSummary {
  id: string;
  name?: string;
  symbols: string[];
  timeframe: string;
  budget: BudgetCaps;
  running: boolean;
  lastRunAt?: string;
  lastError?: string;
}

interface RunningBot {
  cfg: BotConfig;
  timer?: NodeJS.Timeout;
  running: boolean;
  lastRunAt?: string;
  lastError?: string;
}

export class BotManager {
  private bots = new Map<string, RunningBot>();

  summaries(): BotSummary[] {
    return Array.from(this.bots.values()).map((b) => ({
      id: b.cfg.id,
      name: b.cfg.name,
      symbols: b.cfg.symbols.map((s) => s.symbol),
      timeframe: b.cfg.strategy.timeframe,
      budget: b.cfg.budget,
      running: b.running,
      lastRunAt: b.lastRunAt,
      lastError: b.lastError,
    }));
  }

  list(): BotConfig[] { return Array.from(this.bots.values()).map((b) => b.cfg); }
  get(id: string) { return this.bots.get(id)?.cfg; }

  upsert(cfg: BotConfig) {
    const existing = this.bots.get(cfg.id);
    if (existing) existing.cfg = cfg;
    else this.bots.set(cfg.id, { cfg, running: false });
  }

  remove(id: string) { this.stop(id); this.bots.delete(id); }

  start(id: string) {
    const b = this.bots.get(id);
    if (!b) throw new Error("Bot not found");
    if (b.running) return;
  
    // ping Telegram au lancement (non bloquant)
    import("./notifier.js").then(({ notify }) =>
      notify(b.cfg.notifier, `▶️ Bot *${b.cfg.id}* lancé (${b.cfg.symbols.map(s=>s.symbol).join(", ")}) — TF ${b.cfg.strategy.timeframe}`)
        .catch(() => {})
    ).catch(() => {});
  
    b.running = true;
  
    const loop = async () => {
      if (!b.running) return;
      try {
        await runBotOnce(b.cfg);
        b.lastRunAt = new Date().toISOString();
        b.lastError = undefined;
      } catch (e: any) {
        b.lastError = String(e?.message ?? e);
      }
      if (!b.running) return;
      b.timer = setTimeout(loop, timeframeToMs(b.cfg.strategy.timeframe));
    };
    loop();
  }
  

  stop(id: string) {
    const b = this.bots.get(id);
    if (!b) return;
    b.running = false;
    if (b.timer) clearTimeout(b.timer);
    b.timer = undefined;
  }
}

function timeframeToMs(tf: string): number {
  const m = tf.match(/^(\d+)([mhd])$/);
  if (!m) return 60_000;
  const n = Number(m[1]);
  const u = m[2];
  if (u === "m") return n * 60_000;
  if (u === "h") return n * 3_600_000;
  if (u === "d") return n * 86_400_000;
  return 60_000;
}
