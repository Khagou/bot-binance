import 'dotenv/config';

async function main() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');

  const uri  = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: '✅ Ping depuis le bot (Node).',
    disable_web_page_preview: true,
    // parse_mode: 'Markdown'   // active si tu veux du Markdown (attention aux échappements)
  };

  const res = await fetch(uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(json);
  if (!json.ok) throw new Error(JSON.stringify(json));
}

main().catch(err => {
  console.error('Ping failed:', err);
  process.exit(1);
});
