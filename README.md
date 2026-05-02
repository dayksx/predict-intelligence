# Predict Intelligence

Autonomous prediction market trading agents powered by ENS identity, Graphiti knowledge graph, and LangGraph.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER (Sepolia)                                                          │
│                                                                          │
│  Registers  alice.agentic.eth  via predict-intelligence-ui               │
│  Sets ENS text records:                                                  │
│    agentic.focusDomain    = "crypto"                                     │
│    agentic.thesisPrompt   = "BTC breaks ATH before Q3..."                │
│    agentic.agentName      = "Crypto"                                     │
│    agentic.delegatedAmount = "0.01"                                      │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ on-chain ENS registration
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LISTENER  (Node.js — runs continuously)                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │  Market Tick  (every 24h)                           │                 │
│  │                                                     │                 │
│  │  Polymarket Gamma API                               │                 │
│  │    └─ fetch top 200 open markets                    │                 │
│  │         │                                           │                 │
│  │         ├─▶ market_registry.json  (exact CLOB IDs) │                 │
│  │         └─▶ Graphiti REST API     (episode → graph) │                 │
│  │              └─ Neo4j stores temporal knowledge     │                 │
│  └─────────────────────────────────────────────────────┘                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │  ENS Tick  (every 1 min)                            │                 │
│  │                                                     │                 │
│  │  ENS Sepolia Subgraph  (The Graph)                  │                 │
│  │    └─ poll for new agentic.eth subdomains           │                 │
│  │         │                                           │                 │
│  │         └─▶ viem  (Sepolia RPC)                     │                 │
│  │              └─ fetch 4 text records                │                 │
│  │                   │                                 │                 │
│  │                   └─▶ profileBuilder                │                 │
│  │                        └─ data/profiles/            │                 │
│  │                             alice.agentic.eth.json  │                 │
│  └─────────────────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────┘
                             │ data/profiles/*.json + data/market_registry.json
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  AI MODULE  (Node.js — A2A server + daily scheduler)                     │
│                                                                          │
│  Daily Scheduler  (every 24h, one run per registered user)               │
│                                                                          │
│  for each user in data/profiles/:                                        │
│                                                                          │
│    ┌───────────┐    ┌──────────┐    ┌────────┐    ┌──────────┐          │
│    │  ingest   │───▶│ retrieve │───▶│ reason │───▶│ validate │          │
│    │           │    │          │    │        │    │          │          │
│    │ load open │    │ Graphiti │    │ LLM    │    │ filter   │          │
│    │ positions │    │ search   │    │ GPT-4o │    │ by conf. │          │
│    │ + strategy│    │ by user  │    │ + user │    │ threshold│          │
│    │           │    │ topics   │    │ thesis │    │          │          │
│    └───────────┘    └──────────┘    └────────┘    └──────────┘          │
│                                                          │               │
│    ┌──────────┐    ┌─────────┐    ┌────────────────────▼──┐             │
│    │  record  │◀───│   act   │◀───│       preflight        │            │
│    │          │    │         │    │                        │            │
│    │ persist  │    │ trade / │    │ wallet balance check   │            │
│    │ positions│    │ swap /  │    │ portfolio guard        │            │
│    │ audit log│    │ close   │    │ (skip in dry_run)      │            │
│    └──────────┘    └─────────┘    └────────────────────────┘            │
│         │               │                                                │
│         │               └─▶ StubTradeExecutor / StubSwapExecutor        │
│         │                   (live executor wired here when ready)        │
│         ▼                                                                │
│    data/positions/alice.agentic.eth.json                                 │
│    data/audit/alice.agentic.eth.jsonl                                    │
│                                                                          │
│  A2A Server  (port 4337)                                                 │
│    POST /message:send  — trigger a run for a specific user               │
│    GET  /tasks/:id     — poll async task result                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Modules

| Module | Description |
|---|---|
| `ui/` | Next.js registration UI — ENS subdomain claim + metadata publish |
| `sc/` | Solidity contracts — ENS subdomain registrar on Sepolia |
| `listener/` | Data ingestion — Polymarket markets + ENS user registration watcher |
| `ai/` | Autonomous trading agent — LangGraph pipeline + A2A server |
| `api/` | API gateway (if applicable) |

## Data Flow Summary

1. **User registers** `alice.agentic.eth` on Sepolia via the UI, setting their focus domain, thesis, agent name, and delegated ETH amount.
2. **Listener** detects the new subdomain within 1 minute via the ENS Sepolia subgraph, fetches the 4 text records with viem, and saves `data/profiles/alice.agentic.eth.json`.
3. **Listener** also ingests Polymarket market data into the Graphiti knowledge graph every 24h, and writes a local `market_registry.json` with exact CLOB token IDs for trade execution.
4. **AI scheduler** runs once per day for every registered user. It loads the user's strategy, searches Graphiti using their focus topics, calls the LLM with their thesis injected into the system prompt, validates decisions, and executes trades from the user's wallet.
5. All positions and audit logs are **isolated per user** under `data/positions/` and `data/audit/`.

## Running Locally

### Prerequisites
- Docker (for Graphiti + Neo4j)
- Node.js 20+
- A Sepolia RPC URL (Alchemy / Infura)

### Start infrastructure

```bash
cd listener
npm run infra:up
```

### Start listener

```bash
cd listener
cp .env.example .env   # fill in LITELLM_API_KEY, SEPOLIA_RPC_URL, etc.
npm run dev
```

### Start AI agent

```bash
cd ai
cp .env.example .env   # fill in LITELLM_API_KEY
npm run dev
```

The AI agent runs the daily cycle immediately on startup and then every 24h, processing every user profile found in `data/profiles/`.
