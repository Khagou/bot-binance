# Crypto Bot MVP (Paper Trading)

> **But**: DCA+TP intelligent avec pooling dans un core bag, caps journaliers/hebdo avec rollover, budget recyclé, skim profits.

## 1) Prérequis
- Node 20+

## 2) Installation
```bash
npm i
cp .env.example .env
# édite .env (PAPER=1 pour paper trading)
```

## 3) Lancer en dev
```bash
npm run dev
```

## 4) Docker (déploiement simple)
### Build & run avec Compose
```bash
docker compose up -d --build
```
> Le conteneur expose un mini **dashboard** sur `http://localhost:8080` (modifiable via `DASHBOARD_PORT`).
> Le fichier d'état est persistant dans `./data/state.json` grâce au volume.

### Variables utiles (voir `.env.example`)
- `STATE_FILE=/data/state.json` (défini par défaut dans le conteneur via `docker-compose.yml`)
- `DASHBOARD_PORT=8080`, `DASHBOARD_TOKEN=changeme`, `TZ=Europe/Paris`

## 5) Passer en réel (à tes risques)
- Mets `PAPER=0` dans `.env`
- Renseigne `API_KEY` / `API_SECRET` (trade-only, retraits **off**)
- Option: restreindre par IP.

## Notes
- **Caps**: `dailyCapBase`, `weeklyCapBase` dans l’état initial (`state.ts`).
- **Rollover**: automatique via `currentDay/currentWeek`.
- **Recycled & skim**: gérés lors des ventes (TP, stops).
- **EMAs**: 9/21/50.
- **Toggles de notifications**: `.env` → `NOTIFY_BUY/TP/STOP/POOL/CORE_TP/INFO/ERROR` (1=on, 0=off).
- **Récaps**: quotidien (minuit local) et hebdo (ISO week).
```
bash
npm i
cp .env.example .env
# édite .env (PAPER=1 pour paper trading)
```

## 3) Lancer en dev
```bash
npm run dev
```

## 4) Passer en réel (à tes risques)
- Mets `PAPER=0` dans `.env`
- Renseigne `API_KEY` / `API_SECRET`
- Vérifie que l’API **ne permet pas les retraits**.

## Notes
- **Caps**: `dailyCapBase`, `weeklyCapBase` dans l’état initial (`state.ts`).
- **Rollover**: automatique via `currentDay/currentWeek`.
- **Recycled & skim**: gérés lors des ventes (TP, stops).
- **EMAs**: 9/21/50 en 1h.
- **Toggles de notifications**: `.env` → `NOTIFY_BUY/TP/STOP/POOL/CORE_TP/INFO/ERROR` (1=on, 0=off).
- **Récap quotidien**: envoyé automatiquement **à minuit (heure locale)** juste avant le reset du cap journalier.
```bash
npm i
cp .env.example .env
# édite .env (PAPER=1 pour paper trading)

## 3) Lancer en dev
```bash
npm run dev
```

## 4) Passer en réel (à tes risques)
- Mets `PAPER=0` dans `.env`
- Renseigne `API_KEY` / `API_SECRET`
- Vérifie que l’API **ne permet pas les retraits**.

## Notes
- **Caps**: `dailyCapBase`, `weeklyCapBase` dans l’état initial (`state.ts`).
- **Rollover**: automatique via `currentDay/currentWeek`.
- **Recycled & skim**: gérés lors des ventes (TP, stops).
- **EMAs**: 9/21/50 en 1h.
- **Toggles de notifications**: `.env` → `NOTIFY_BUY/TP/STOP/POOL/CORE_TP/INFO/ERROR` (1=on, 0=off).
```bash
npm i
cp .env.example .env
# édite .env (PAPER=1 pour paper trading)
```

## 3) Lancer en dev
```bash
npm run dev
```

## 4) Passer en réel (à tes risques)
- Mets `PAPER=0` dans `.env`
- Renseigne `API_KEY` / `API_SECRET`
- Vérifie que l’API **ne permet pas les retraits**.

## Notes
- **Caps**: `dailyCapBase`, `weeklyCapBase` dans l’état initial (`state.ts`).
- **Rollover**: automatique via `currentDay/currentWeek`.
- **Recycled & skim**: gérés lors des ventes (TP, stops).
- **EMAs**: 9/21/50 en 1h.

---