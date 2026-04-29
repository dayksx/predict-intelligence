# predict-intelligence-listener

Runs once a day, pulls active markets from Polymarket and news RSS feeds, and ingests them into [Graphiti](https://github.com/getzep/graphiti) — a temporal knowledge graph. AI agents query the graph to reason about market movements, related news, and causal connections.

## Setup

```bash
cp .env.example .env   # fill in LITELLM_API_KEY and LITELLM_BASE_URL
npm install
```

## Start the Graphiti server

Graphiti runs as a local Docker service alongside Neo4j:

```bash
docker compose up
```

This starts:
- **Graphiti** at `http://localhost:8000` — entity extraction, temporal graph, hybrid search
- **Neo4j** at `bolt://localhost:7687` — graph storage (browser at `http://localhost:7474`)

Graphiti uses your LiteLLM proxy (`gpt-4o-mini`) for entity extraction and embeddings.

## Run the listener

```bash
npm run dev                      # development
npm run build && npm start       # production
```

## Structure

```
src/
├── types.ts                 # shared types (MarketEvent, Domain)
├── config.ts                # all env vars in one place
├── main.ts                  # cron loop — runs tick() every INTERVAL_HOURS
├── sources/
│   ├── predictionMarkets.ts # fetches and normalises markets from Polymarket Gamma API
│   └── newsRss.ts           # fetches RSS feeds (stub)
└── graphiti/
    └── client.ts            # POSTs markets as episodes to the Graphiti REST API
```

## How it works

Each daily tick:
1. Fetches active markets from the Polymarket Gamma API (paginated, up to 500)
2. Classifies each market by domain (crypto, finance, geopolitics, energy, sports)
3. POSTs each market as a text episode to `POST /v1/episodes` on the Graphiti server

Graphiti then:
- Uses an LLM to extract entities (e.g. "Federal Reserve", "Bitcoin ETF") and relationships
- Links markets that share entities — so agents can ask *"what markets are related to the Fed?"*
- Tracks fact changes over time with temporal validity windows
- Stores everything in Neo4j with vector embeddings for hybrid search

## Env vars

| Variable | Default | Description |
|---|---|---|
| `INTERVAL_HOURS` | `24` | How often the tick runs |
| `GRAPHITI_URL` | `http://localhost:8000` | Graphiti server base URL |
| `GRAPHITI_GROUP_ID` | `predict` | Namespace for all episodes |
| `POLYMARKET_GAMMA_URL` | `https://gamma-api.polymarket.com` | Polymarket API base URL |
| `MARKET_CATEGORIES` | all | Comma-separated domains to ingest (e.g. `crypto,finance`) |
| `LITELLM_API_KEY` | — | LiteLLM API key (used by Graphiti server via docker-compose) |
| `LITELLM_BASE_URL` | — | LiteLLM proxy URL (e.g. `https://litellm.consensys.info/v1`) |
| `LITELLM_MODEL` | `gpt-4o-mini` | Model name passed to LiteLLM |
