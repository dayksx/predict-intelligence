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
│         │               └─▶ UniswapSwapExecutor (Sepolia, live swap)          │
│         │                   PolymarketTradeExecutor (dry-run for Polymarket)   │
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
| `ui/` | Next.js app — ENS subdomain registration, wallet dashboard, per-agent delegation analytics (venue P&L, waterfall diagram), and activity views — see [`ui/README.md`](ui/README.md) |
| `sc/` | Solidity contracts — ENS subdomain registrar on Sepolia |
| `listener/` | Data ingestion — Polymarket markets + ENS user registration watcher |
| `ai/` | Autonomous trading agent — LangGraph pipeline + A2A server |
| `api/` | API gateway (if applicable) |

### UI highlights

The [`ui/`](ui/) app complements on-chain registration with:

- **Home (`/`)** — `AgentRegistrationForm`: claim `*.agentic.eth` on Sepolia and publish ENS text records (focus domain, thesis, agent name, delegated amount, avatar, etc.).
- **Dashboard (`/dashboard`)** — Lists the connected wallet’s agentic subdomains (via client-side resolution), profile-style header from ENS, and links into each agent.
- **Agent detail (`/dashboard/agents/[label]`)** — Reads ENS records for that agent and shows:
  - A **delegation metrics strip**: delegated ETH (from ENS), a **venue P&L chart** (Swap / Perps / Predict gains vs losses), wins/losses split, net trading P&L, and book value.
  - A **narrow-column outcome waterfall** (delegation → gains → losses → book line) beside a **live sidebar** (chat).
  - **Activity sections** (Perceive / Reason / Triggered) fed from local demo data until wired to your indexer.

Yield numbers are driven by [`ui/lib/delegation-yield-snapshot.ts`](ui/lib/delegation-yield-snapshot.ts). Until an indexer supplies realized wins/losses, the UI can show **mock** trading outcomes using `NEXT_PUBLIC_MOCK_AGENT_YIELD` (documented in [`ui/README.md`](ui/README.md)).

## Data Flow Summary

1. **User registers** `alice.agentic.eth` on Sepolia via the UI, setting their focus domain, thesis, agent name, and delegated ETH amount.
2. **Listener** detects the new subdomain within 1 minute via the ENS Sepolia subgraph, fetches the 4 text records with viem, and saves `data/profiles/alice.agentic.eth.json`.
3. **Listener** also ingests Polymarket market data into the Graphiti knowledge graph every 24h, and writes a local `market_registry.json` with exact CLOB token IDs for trade execution.
4. **AI scheduler** runs once per day for every registered user. It loads the user's strategy, searches Graphiti using their focus topics, calls the LLM with their thesis injected into the system prompt, validates decisions, and executes trades from the user's wallet.
5. All positions and audit logs are **isolated per user** under `data/positions/` and `data/audit/`.

## Running Locally

### Prerequisites
- Docker (for Neo4j + Graphiti)
- Node.js 20+
- OpenAI API key (or compatible LiteLLM endpoint)
- Sepolia RPC URL (Alchemy / Infura)

### 1. Start infrastructure (Neo4j + Graphiti)

```bash
cd listener
npm run infra:up
```

This starts two Docker containers:
- **Neo4j** on `bolt://localhost:7687` (browser at http://localhost:7474, login: `neo4j` / `password`)
- **Graphiti** on http://localhost:8000

### 2. Start the listener

```bash
cd listener
cp .env.example .env   # fill in OPENAI_API_KEY, SEPOLIA_RPC_URL
npm run dev
```

Key env vars:
- `OPENAI_API_KEY` — used by Graphiti for LLM extraction and embeddings
- `SEPOLIA_RPC_URL` — Alchemy/Infura Sepolia endpoint for ENS text record reads
- `GRAPHITI_URL=http://localhost:8000` — already set in `.env.example`

The listener polls ENS for new user registrations every 1 min and ingests Polymarket data every 24h. To trigger a manual ingest immediately:
```bash
curl -X POST http://localhost:3001/ingest/now
```

### 3. Start the API

```bash
cd api
cp .env.example .env   # fill in GRAPHITI_URL
npm run dev
```

Runs on http://localhost:3001. Serves agent activity, positions, and user profiles to the UI.

### 4. Start the AI agent

```bash
cd ai
cp .env.example .env   # fill in OPENAI_API_KEY, PRIVATE_KEY, UNISWAP_API_KEY
npm run dev
```

Key env vars:
- `OPENAI_API_KEY` — LLM for trading decisions
- `PRIVATE_KEY` — Sepolia wallet private key (for Uniswap swaps)
- `UNISWAP_API_KEY` — from https://hub.uniswap.org
- `GRAPHITI_URL=http://localhost:8000`
- `API_URL=http://localhost:3001`

The AI agent does **not** run automatically on startup. It is triggered via the A2A endpoint:
```bash
# Trigger a run for a specific user
curl -X POST http://localhost:4337/message:send \
  -H "Content-Type: application/json" \
  -d '{"message":{"role":"user","parts":[{"text":"run for alice.agentic.eth"}]}}'
```

### 5. Start the UI

```bash
cd ui
cp .env.example .env.local   # fill in NEXT_PUBLIC_* vars
npm run dev
```

Runs on http://localhost:3000. Key env vars:
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from https://cloud.walletconnect.com
- `NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS` — optional, defaults to the repo's deployed Sepolia contract

### Quick start order

```
infra:up → listener → api → ai → ui
```
