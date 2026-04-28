# predict-intelligence-listener

Runs once a day, pulls data from prediction markets and news RSS feeds, and ingests it into Graphiti so AI agents can query it.

## Setup

```bash
cp .env.example .env
npm install
```

## Run

```bash
npm run dev        # development (no build needed)
npm run build && npm start  # production
```

## Structure

```
src/
├── main.ts                  # cron loop — runs tick() every INTERVAL_HOURS
├── sources/
│   ├── predictionMarkets.ts # fetches from Polymarket, Manifold, etc.
│   └── newsRss.ts           # fetches and parses RSS feeds
└── graphiti/
    └── client.ts            # posts episodes to the Graphiti service
```

## Env vars

| Variable | Default | Description |
|---|---|---|
| `INTERVAL_HOURS` | `24` | How often the tick runs |
| `GRAPHITI_URL` | `http://localhost:8000` | Graphiti service base URL |
