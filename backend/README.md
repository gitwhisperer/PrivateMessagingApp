# PMA Backend

Lightweight helper API (mostly optional) – front-end can call the Stacks network directly. This service can:

* Provide health & config endpoints
* (Extend) Cache read-only responses / index message events
* (Extend) Provide search / aggregation beyond on-chain primitives

## Run

1. Copy `.env.example` to `.env` and fill `CONTRACT_ADDRESS`.
2. Install deps (optional – doc only; not installed automatically here):
   ```bash
   npm install
   npm run dev
   ```

## Extend Ideas
* Add WebSocket that tails Hiro event stream for `print` events with `event: "message-sent"`.
* Persist message metadata in a DB (SQLite, Postgres) for faster UX.
* Implement off-chain spam heuristics.
