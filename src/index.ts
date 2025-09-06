// src/index.ts (replace main with this shape)
import dotenv from "dotenv";
dotenv.config();

import { BotManager } from "./botManager.js";
import { startDashboard } from "./dashboard.js";
import { BotConfig } from "./types.js";
import path from "path";

const manager = new BotManager();

// Backward compatible: seed one bot from env if SYMBOL present
const envSymbol = process.env.SYMBOL;
if (envSymbol) {
  const id = "env-bot";
  const symbols = envSymbol.split(',').map(s => s.trim()).filter(Boolean).map(symbol => ({ symbol }));
  const cfg: BotConfig = {
    id,
    name: process.env.BOT_NAME || "Env Bot",
    exchange: {
      id: process.env.EXCHANGE || "binance",
      apiKey: process.env.API_KEY,
      apiSecret: process.env.API_SECRET,
      paper: process.env.PAPER === "1",
    },
    symbols,
    strategy: {
      timeframe: process.env.TIMEFRAME || "15m",
      ema: { fast: 9, slow: 21 },
    },
    budget: {
      dailyCapUSDT: Number(process.env.DAILY_CAP_USDT || 100),
      weeklyCapUSDT: Number(process.env.WEEKLY_CAP_USDT || 500),
    },
    notifier: {
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
    },
    stateFile: process.env.STATE_FILE || path.join("/data", "bots", `${id}.json`),
    timezone: process.env.TZ || "Europe/Paris",
  };
  manager.upsert(cfg);
}

// Start dashboard server
const port = Number(process.env.DASHBOARD_PORT || 8080);
const token = process.env.DASHBOARD_TOKEN || "";
startDashboard(manager, { port, token });