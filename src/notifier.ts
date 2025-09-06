import fetch from "node-fetch";
import { NotifierConfig } from "./types.js";

// Fallback ENV si pas de config par bot
const ENV_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ENV_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// Flags optionnels via env
function flag(name: string, def: boolean) {
  const v = process.env[name];
  if (v == null) return def;
  const low = v.toLowerCase();
  return !(low === "0" || low === "false" || low === "off" || low === "no");
}
const NOTIFY = {
  BUY:   flag("NOTIFY_BUY",   true),
  TP:    flag("NOTIFY_TP",    true),
  STOP:  flag("NOTIFY_STOP",  true),
  INFO:  flag("NOTIFY_INFO",  true),
  ERROR: flag("NOTIFY_ERRORS",true),
};

export async function notify(n: NotifierConfig | undefined, text: string) {
  try {
    // priorité à la config du bot
    if (n?.telegramBotToken && n?.telegramChatId) {
      const url = `https://api.telegram.org/bot${n.telegramBotToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: n.telegramChatId, text, parse_mode: "Markdown" }),
      });
      return;
    }
    // sinon fallback ENV (plusieurs chats possibles)
    if (ENV_TOKEN && ENV_CHAT_IDS.length) {
      const url = `https://api.telegram.org/bot${ENV_TOKEN}/sendMessage`;
      await Promise.all(ENV_CHAT_IDS.map(cid =>
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: cid, text, parse_mode: "Markdown" }),
        })
      ));
    }
  } catch { /* no-throw */ }
}

// Compat + filtrage par type
export async function notifyEvent(
  n: NotifierConfig | undefined,
  type: keyof typeof NOTIFY,
  text: string
) {
  if (!NOTIFY[type]) return;
  await notify(n, text);
}
