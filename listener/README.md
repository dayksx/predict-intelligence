# predict-intelligence-listener

Runs once a day, pulls active markets from Polymarket and news RSS feeds, and ingests them into [Graphiti](https://github.com/getzep/graphiti) — a temporal knowledge graph. AI agents query the graph to reason about market movements, related news, and causal connections.

## Setup

```bash
cp .env.example .env   # fill in LITELLM_API_KEY and LITELLM_BASE_URL
npm install
```

## Start the Graphiti server

Graphiti and Neo4j run as local Docker services. Use the npm scripts:

```bash
npm run infra:up       # start Graphiti + Neo4j in the background
npm run infra:logs     # tail Graphiti logs (watch processing progress)
npm run infra:down     # stop and remove containers
```

This starts:
- **Graphiti** at `http://localhost:8000` — entity extraction, temporal graph, hybrid search
- **Neo4j** at `bolt://localhost:7687` — graph storage (browser UI at `http://localhost:7474`)

Graphiti uses your LiteLLM proxy (`gpt-4o-mini`) for entity extraction and `titan-embed-text-v2` for embeddings.

> **Note:** `graphiti_patch/` contains two files that are volume-mounted into the Graphiti container at startup. They fix two upstream bugs: the embedder model not being applied correctly, and the background worker crashing silently on errors. Do not delete this folder.

## Run the listener

```bash
npm run dev                      # development (uses .env)
npm run build && npm start       # production
```

The listener fetches markets, queues them as episodes on the Graphiti server, and exits. Graphiti processes the queue asynchronously in the background — check progress with `npm run infra:logs`.

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
graphiti_patch/
├── zep_graphiti.py          # patches embedder constructor to use correct model
└── ingest.py                # patches worker to survive errors and use fresh clients
```

## How it works

Each daily tick:
1. Fetches active markets from the Polymarket Gamma API (paginated, up to `POLYMARKET_FETCH_LIMIT`)
2. Classifies each market by domain (crypto, finance, geopolitics, energy, sports)
3. POSTs each market as a text episode to the Graphiti server

Graphiti then (asynchronously, one episode at a time):
- Uses an LLM to extract entities (e.g. "Federal Reserve", "Bitcoin ETF") and relationships
- Deduplicates entities across episodes — multiple markets about Bitcoin share one node
- Tracks fact changes over time with temporal validity windows (`valid_at` / `invalid_at`)
- Links markets that share entities — agents can ask *"what markets are related to the Fed?"*
- Stores everything in Neo4j with vector embeddings for hybrid search

## Env vars

| Variable | Default | Description |
|---|---|---|
| `INTERVAL_HOURS` | `24` | How often the tick runs |
| `POLYMARKET_FETCH_LIMIT` | `50` | Max markets to ingest per tick (raise to 500 for production) |
| `MARKET_CATEGORIES` | all | Comma-separated domains to filter (e.g. `crypto,finance`) |
| `GRAPHITI_URL` | `http://localhost:8000` | Graphiti server base URL |
| `GRAPHITI_GROUP_ID` | `predict` | Namespace for all episodes in Neo4j |
| `POLYMARKET_GAMMA_URL` | `https://gamma-api.polymarket.com` | Polymarket API base URL |
| `LITELLM_API_KEY` | — | API key for your LiteLLM proxy |
| `LITELLM_BASE_URL` | — | LiteLLM proxy URL (e.g. `https://litellm.consensys.info/v1`) |
| `LITELLM_MODEL` | `gpt-4o-mini` | LLM used by Graphiti for entity extraction |
| `LITELLM_EMBEDDING_MODEL` | `titan-embed-text-v2` | Embedding model used by Graphiti |
