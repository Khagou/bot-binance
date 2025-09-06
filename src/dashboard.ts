import http from "http";
import { BotManager } from "./botManager.js";
import { BotConfig } from "./types.js";
import { loadBotState, portfolioSummary } from "./state.js";
import { createExchange, fetchPrice } from "./exchange.js";

interface Options { port: number; token?: string }

export function startDashboard(manager: BotManager, opts: Options) {
  const server = http.createServer(async (req, res) => {
    if (!req.url) { res.writeHead(404); res.end(); return; }

    const isApi = req.url.startsWith("/api/");
    if (opts.token && isApi) {
      if (req.headers["authorization"] !== `Bearer ${opts.token}`) {
        res.writeHead(401); res.end("Unauthorized"); return;
      }
    }

    // UI
    if (req.method === "GET" && req.url === "/") return serveIndex(res);

    // API: list
    if (req.method === "GET" && req.url === "/api/bots") {
      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify(manager.summaries()));
      return;
    }

    // API: upsert bot
    if (req.method === "POST" && req.url === "/api/bots") {
      const body = await readJson(req);
      const cfg = validateBotConfig(body as BotConfig);
      manager.upsert(cfg);
      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // API: details (portfolio + orders)
    const md = req.url.match(/^\/api\/bots\/([^\/]+)\/details$/);
    if (req.method === "GET" && md) {
      const id = decodeURIComponent(md[1]);
      const cfg = manager.get(id);
      if (!cfg) { res.writeHead(404); res.end("Unknown bot"); return; }

      const st = loadBotState(cfg.stateFile);
      const ex = await createExchange(cfg.exchange);

      const priceMap: Record<string, number> = {};
      for (const s of cfg.symbols) {
        try { priceMap[s.symbol] = await fetchPrice(ex, s.symbol); }
        catch { priceMap[s.symbol] = 0; }
      }

      const summary = portfolioSummary(st, priceMap);
      const orders = [...st.portfolio.orders].sort((a,b) => b.ts - a.ts).slice(0, 50);

      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({ summary, orders }));
      return;
    }

    // API: start/stop/delete
    const m = req.url.match(/^\/api\/bots\/([^\/]+)\/(start|stop|delete)$/);
    if (req.method === "POST" && m) {
      const id = decodeURIComponent(m[1]);
      const action = m[2];
      try {
        if (action === "start") manager.start(id);
        else if (action === "stop") manager.stop(id);
        else if (action === "delete") manager.remove(id);
        res.setHeader("Content-Type","application/json");
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    res.writeHead(404); res.end("Not found");
  });

  server.listen(opts.port, () => console.log(`[dashboard] listening on ${opts.port}`));
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const txt = Buffer.concat(chunks).toString("utf8");
        resolve(txt ? JSON.parse(txt) : {});
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function validateBotConfig(input: any): BotConfig {
  if (!input?.id) throw new Error("id required");
  if (!Array.isArray(input.symbols) || input.symbols.length === 0) throw new Error("symbols[] required");
  if (!input.exchange?.id) throw new Error("exchange.id required");
  if (!input.strategy?.timeframe) throw new Error("strategy.timeframe required");
  if (!input.strategy?.ema) throw new Error("strategy.ema required");
  if (!input.budget) throw new Error("budget required");
  if (!input.stateFile) throw new Error("stateFile required");
  return input as BotConfig;
}

function serveIndex(res: http.ServerResponse) {
  const html = `<!doctype html><meta charset="utf-8"/>
  <title>Crypto Bot Manager</title>
  <style>
    body{font:14px system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 16px}
    h1{margin:0 0 12px}
    section{margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px}
    label{display:block;margin:6px 0}
    input,button{font:inherit;padding:6px 10px;border:1px solid #d1d5db;border-radius:8px}
    button{cursor:pointer}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border-bottom:1px solid #eee;padding:8px;text-align:left;vertical-align:top}
    .row{display:flex;gap:10px;align-items:center}
    .muted{color:#6b7280}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #e5e7eb}
  </style>
  <h1>Crypto Bot Manager</h1>

  <section class="row">
    <div>
      <strong>API token</strong>
      <div class="row">
        <input id="tok" placeholder="DASHBOARD_TOKEN (si requis)" style="min-width:260px">
        <button id="saveTok">Enregistrer</button>
        <span class="muted">Les appels /api utiliseront ce Bearer</span>
      </div>
    </div>
  </section>

  <section>
    <h2>Nouveau bot / Mise à jour</h2>
    <form id="f">
      <details open><summary>Base</summary>
        <label>ID <input name="id" required></label>
        <label>Nom <input name="name"></label>
        <label>Timezone <input name="timezone" value="Europe/Paris"></label>
        <label>Fichier d’état <input name="stateFile" value="/data/bots/demo.json"></label>
      </details>
      <details open><summary>Exchange</summary>
        <label>Exchange ID <input name="exId" value="binance"></label>
        <label>API key <input name="apiKey"></label>
        <label>API secret <input name="apiSecret"></label>
        <label>Paper <input type="checkbox" name="paper" checked></label>
      </details>
      <details open><summary>Stratégie</summary>
        <label>Timeframe <input name="timeframe" value="15m"></label>
        <label>EMA fast <input type="number" name="emaFast" value="9"></label>
        <label>EMA slow <input type="number" name="emaSlow" value="21"></label>
      </details>
      <details open><summary>Budget</summary>
        <label>Daily cap (USDT) <input type="number" name="daily" value="100"></label>
        <label>Weekly cap (USDT) <input type="number" name="weekly" value="500"></label>
      </details>
      <details open><summary>Symbols</summary>
        <label>Liste (comma-sep) <input name="symbols" placeholder="BTC/USDC,ETH/USDC"></label>
        <label>Order size (USDT, optionnel, valeur unique) <input type="number" name="order"></label>
      </details>
      <details><summary>Telegram (optionnel)</summary>
        <label>Bot token <input name="tgToken"></label>
        <label>Chat ID <input name="tgChat"></label>
      </details>
      <p><button>Enregistrer</button></p>
    </form>
  </section>

  <section>
    <h2>Bots</h2>
    <div id="list"></div>
  </section>

  <script>
    (function(){
      const tok = document.getElementById('tok');
      tok.value = localStorage.getItem('dashToken') || '';
      document.getElementById('saveTok').onclick = () => {
        localStorage.setItem('dashToken', tok.value.trim());
        load();
      };

      function authHeaders() {
        const t = localStorage.getItem('dashToken');
        return t ? { 'Authorization': 'Bearer ' + t } : {};
      }

      async function api(path, opts={}) {
        const headers = Object.assign({'Content-Type':'application/json'}, authHeaders(), opts.headers||{});
        const res = await fetch(path, Object.assign({}, opts, { headers }));
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      async function load() {
        try {
          const bots = await api('/api/bots');
          renderList(bots);
        } catch (e) {
          document.getElementById('list').innerHTML = '<p class="muted">' + e + '</p>';
        }
      }

      function renderList(bots) {
        if (!bots.length) { document.getElementById('list').innerHTML = '<p class="muted">Aucun bot</p>'; return; }
        let rows = '';
        for (const b of bots) {
          rows += '<tr id="row-'+b.id+'">' +
            '<td><code>'+b.id+'</code><div class="muted">'+(b.name||'')+'</div></td>' +
            '<td>'+b.symbols.join(', ')+'</td>' +
            '<td>'+b.timeframe+'</td>' +
            '<td><span class="badge">daily '+b.budget.dailyCapUSDT+'</span> <span class="badge">weekly '+b.budget.weeklyCapUSDT+'</span></td>' +
            '<td>'+(b.running ? '🟢 running' : '⚪ stopped')+'<div class="muted">'+(b.lastRunAt||'')+'</div><div class="muted">'+(b.lastError||'')+'</div></td>' +
            '<td>'+(b.running ? '<button data-act="stop" data-id="'+b.id+'">Stop</button>' : '<button data-act="start" data-id="'+b.id+'">Start</button>') +
              '<button data-act="details" data-id="'+b.id+'" style="margin-left:6px">Details</button>' +
              '<button data-act="delete" data-id="'+b.id+'" style="margin-left:6px">Delete</button>' +
            '</td></tr>';
        }
        document.getElementById('list').innerHTML =
          '<table><thead><tr><th>ID</th><th>Symbols</th><th>TF</th><th>Budget</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows+'</tbody></table>';

        document.querySelectorAll('#list button').forEach(btn => btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const act = btn.getAttribute('data-act');
          if (act === 'details') {
            const data = await api('/api/bots/' + encodeURIComponent(id) + '/details');
            showDetails(id, data);
            return;
          }
          await api('/api/bots/' + encodeURIComponent(id) + '/' + act, { method: 'POST' });
          load();
        });
      }

      function showDetails(id, data) {
        const host = document.querySelector('#row-' + CSS.escape(id));
        const old = document.getElementById('details-' + id);
        if (old) old.remove();

        const s = data.summary;
        let rows = '';
        for (const r of (s.rows||[])) {
          rows += '<tr>' +
            '<td>'+r.symbol+'</td>' +
            '<td>'+r.baseQty.toFixed(6)+'</td>' +
            '<td>'+r.avgPrice.toFixed(2)+'</td>' +
            '<td>'+r.price.toFixed(2)+'</td>' +
            '<td>'+r.valueUSDT.toFixed(2)+'</td>' +
            '<td>'+r.pnlUSDT.toFixed(2)+' ('+r.pnlPct.toFixed(2)+'%)</td>' +
            '</tr>';
        }
        let orders = '';
        for (const o of (data.orders||[])) {
          orders += '<tr>' +
            '<td>'+new Date(o.ts).toLocaleString()+'</td>' +
            '<td>'+o.symbol+'</td>' +
            '<td>'+o.side+'</td>' +
            '<td>'+o.baseQty.toFixed(6)+'</td>' +
            '<td>'+o.price.toFixed(2)+'</td>' +
            '<td>'+o.costUSDT.toFixed(2)+'</td>' +
            '<td>'+(o.paper?'paper':'live')+'</td>' +
            '</tr>';
        }
        const box = document.createElement('tr');
        box.id = 'details-' + id;
        box.innerHTML =
          '<td colspan="6"><div style="border:1px solid #eee;border-radius:10px;padding:12px">' +
            '<h3>Summary</h3>' +
            '<p><strong>Total value:</strong> ' + s.totals.valueUSDT.toFixed(2) + ' — ' +
               '<strong>Invested:</strong> ' + s.totals.investedUSDT.toFixed(2) + ' — ' +
               '<strong>PNL:</strong> ' + s.totals.pnlUSDT.toFixed(2) + ' (' + s.totals.pnlPct.toFixed(2) + '%) — ' +
               '<strong>Cash:</strong> ' + s.totals.cashUSDT.toFixed(2) + ' USDT</p>' +
            '<table style="width:100%;border-collapse:collapse">' +
              '<thead><tr><th>Symbol</th><th>Qty</th><th>PRU</th><th>Price</th><th>Value</th><th>PNL</th></tr></thead>' +
              '<tbody>' + (rows || '<tr><td colspan="6" style="color:#777">No holdings</td></tr>') + '</tbody>' +
            '</table>' +
            '<h3 style="margin-top:14px">Orders (last 50)</h3>' +
            '<table style="width:100%;border-collapse:collapse">' +
              '<thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Cost</th><th>Mode</th></tr></thead>' +
              '<tbody>' + (orders || '<tr><td colspan="7" style="color:#777">No orders</td></tr>') + '</tbody>' +
            '</table>' +
          '</div></td>';
        host.parentNode.insertBefore(box, host.nextSibling);
      }

      const f = document.getElementById('f');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const symbols = (fd.get('symbols')||'').toString().split(',').map(s=>s.trim()).filter(Boolean).map(s=>({symbol:s, orderSizeUSDT: Number(fd.get('order'))||undefined}));
        const body = {
          id: fd.get('id'),
          name: fd.get('name')||undefined,
          timezone: fd.get('timezone')||undefined,
          stateFile: fd.get('stateFile')||('/data/bots/'+fd.get('id')+'.json'),
          exchange: { id: fd.get('exId')||'binance', apiKey: fd.get('apiKey')||undefined, apiSecret: fd.get('apiSecret')||undefined, paper: !!fd.get('paper') },
          strategy: { timeframe: fd.get('timeframe')||'15m', ema: { fast: Number(fd.get('emaFast')||9), slow: Number(fd.get('emaSlow')||21) } },
          budget: { dailyCapUSDT: Number(fd.get('daily')||100), weeklyCapUSDT: Number(fd.get('weekly')||500) },
          notifier: { telegramBotToken: fd.get('tgToken')||undefined, telegramChatId: fd.get('tgChat')||undefined },
          symbols
        };
        await api('/api/bots', { method:'POST', body: JSON.stringify(body) });
        f.reset(); load(); alert('Bot enregistré');
      };

      load(); setInterval(load, 5000);
    })();
  </script>`;
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end(html);
}
