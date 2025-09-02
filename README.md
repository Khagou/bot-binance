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

## 4) Passer en réel (à tes risques)

- Mets `PAPER=0` dans `.env`
- Renseigne `API_KEY` / `API_SECRET`
- Vérifie que l’API **ne permet pas les retraits**.

## Notes

- **Caps**: `dailyCapBase`, `weeklyCapBase` dans l’état initial (`state.ts`).
- **Rollover**: automatique via `currentDay/currentWeek`.
- **Recycled & skim**: gérés lors des ventes (TP, stops).
- **EMAs**: 9/21/50 en 1h.
