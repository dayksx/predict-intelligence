# AI Module — Hexagonal Architecture

## System Overview

This module is **read-only with respect to the knowledge graph**. It never ingests data.
All market knowledge flows in via the `listener` module, which runs daily and writes to Graphiti.

```
┌──────────────────────────────────────────────────────────┐
│  listener/                                               │
│  Polymarket → GraphitiAdapter (write) → Graphiti server  │
└────────────────────────────┬─────────────────────────────┘
                             │  Neo4j (persisted graph)
┌────────────────────────────▼─────────────────────────────┐
│  ai/                                                     │
│  A2A request → WorkflowRunner → LangGraph nodes          │
│                               → GraphitiAdapter (read)   │
└──────────────────────────────────────────────────────────┘
```

### Why Graphiti instead of raw Neo4j

| Concern | Raw Neo4j | Graphiti |
|---|---|---|
| Entity extraction | Custom Cypher + embeddings | Built-in LLM-powered extraction |
| Temporal tracking | Manual `valid_from`/`valid_to` | Automatic `valid_at`/`invalid_at` on every fact |
| Relationship inference | Manual | Automatic (MENTIONS, RELATES_TO edges) |
| Semantic search | Vector index query | `POST /search` |
| AI module writes to graph | Yes | **No — listener owns all writes** |

The AI module never creates nodes or edges. The `IMarketSearch` port is purely a search interface.
Facts returned already carry `valid_at`/`invalid_at`, giving the LLM temporal context for free
(e.g., "Bitcoin YES probability was 65% on 2025-04-01, now 72% as of 2025-04-28").

---

## Target Directory Structure

> Items marked `[done]` exist today. Everything else is planned.

```
src/
├── domain/                         # Innermost ring — zero external dependencies
│   ├── entities/
│   │   ├── market.ts               # MarketFact (from Graphiti), MarketEvent
│   │   ├── decision.ts             # Decision, ToolResult
│   │   ├── userPrefs.ts            # UserPrefs
│   │   ├── position.ts             # Position, EnrichedPosition, enrichPosition()
│   │   └── agentState.ts           # AgentState (LangGraph state shape)
│   └── services/                   # Pure functions — no I/O, no framework
│       ├── contextBuilderService.ts    # buildSystemPrompt from prefs + facts
│       ├── decisionValidatorService.ts # validateDecisions, confidence gate
│       └── portfolioGuardService.ts    # applyPortfolioGuards (caps, reserves)
│
├── ports/
│   ├── inbound/
│   │   └── IWorkflowRunner.ts      [done] How A2A server starts the agent cycle
│   └── outbound/
│       ├── IMarketSearch.ts        [done] search(query, maxFacts) → MarketFact[]
│       ├── IUserPrefsRepo.ts       loadPrefs() → UserPrefs
│       ├── IPositionStore.ts       loadOpen, savePosition, closePosition
│       ├── ITradeExecutor.ts       executeTrade (Polymarket CLOB)
│       ├── ISwapExecutor.ts        executeSwap (Uniswap v3)
│       ├── IWalletService.ts       getBalances, approve, getAllowance
│       └── IAuditLogger.ts         writeLog
│
├── application/                    # LangGraph nodes + workflow
│   ├── nodes/
│   │   ├── ingestNode.ts           Load prefs + snapshot + enrich open positions
│   │   ├── retrieveNode.ts         IMarketSearch.search() for new mkts + open positions
│   │   ├── reasonNode.ts           Single LLM call → Decision[] (review + new opps)
│   │   ├── validateNode.ts         Confidence gate; close_position always passes
│   │   ├── preflightNode.ts        Wallet balances + ERC-20 approvals
│   │   ├── actNode.ts              Deterministic dispatch: trade/swap/close/vote
│   │   └── recordNode.ts           Audit log + position lifecycle (save/close)
│   ├── tools/
│   │   ├── searchMarkets.ts        [done] search_markets — wraps IMarketSearch
│   │   ├── tradeTool.ts            polymarket_trade — wraps ITradeExecutor
│   │   └── swapTool.ts             uniswap_swap — wraps ISwapExecutor
│   └── graph.ts                    [done] StateGraph factory (currently: search + reason)
│
├── adapters/
│   ├── inbound/
│   │   ├── a2a.ts                  [done] A2A HTTP server (Express)
│   │   └── WorkflowRunner.ts       [done] Implements IWorkflowRunner via LangGraph
│   └── outbound/
│       ├── GraphitiAdapter.ts      [done] IMarketSearch → Graphiti REST (POST /search)
│       ├── JsonFileUserPrefsRepo.ts    IUserPrefsRepo → config/user_preferences.json
│       ├── JsonFilePositionStore.ts    IPositionStore → data/positions.json
│       ├── PolymarketTradeExecutor.ts  ITradeExecutor → Polymarket CLOB v2
│       ├── UniswapSwapExecutor.ts      ISwapExecutor → Uniswap v3 on Base
│       ├── ViemWalletService.ts        IWalletService → viem
│       └── FileAuditLogger.ts          IAuditLogger → local JSON file
│
└── infrastructure/
    └── container.ts                DI wiring — only file that reads env vars
                                    and constructs + connects concrete adapters
```

---

## Layer Rules

| Layer | Can import from | Cannot import from |
|---|---|---|
| `domain/` | nothing (only `zod`) | ports, application, adapters, infrastructure |
| `ports/` | `domain/` | application, adapters, infrastructure |
| `application/` | `domain/`, `ports/` | adapters, infrastructure |
| `adapters/` | `domain/`, `ports/` | infrastructure (except `container.ts`) |
| `infrastructure/` | everything | — |

The dependency arrow always points **inward**. The domain never knows about Graphiti, Polymarket, Uniswap, or any framework.

---

## Data Flow

```
a2a.ts  (inbound adapter)
    │
    ▼
WorkflowRunner.ts  (inbound adapter — implements IWorkflowRunner)
    │
    ▼
graph.ts  (application — LangGraph StateGraph)
    │
    ├── ingestNode    → IUserPrefsRepo + IPositionStore
    ├── retrieveNode  → IMarketSearch  ──────────────────► GraphitiAdapter → Graphiti REST
    ├── reasonNode    → LLM + domain/contextBuilderService
    ├── validateNode  → domain/decisionValidatorService  (pure, no I/O)
    ├── preflightNode → IWalletService + domain/portfolioGuardService
    ├── actNode       → ITradeExecutor | ISwapExecutor
    └── recordNode    → IAuditLogger + IPositionStore
```

### What the retrieveNode gets from Graphiti

Each `MarketFact` already carries temporal metadata — no extra logic needed:

```typescript
interface MarketFact {
  uuid: string;
  name: string;
  fact: string;          // "BTC YES probability is 72%, vol $4.2M"
  valid_at: string;      // "2025-04-28T00:00:00Z"
  invalid_at: string | null;  // null = still current
}
```

The LLM sees both current and historical facts in a single search result, enabling reasoning like:
*"Bitcoin YES went from 65% → 72% over the past week; volume is rising — bullish signal."*

---

## LangGraph State Machine

```
START
  └─► ingestNode       Load user prefs; enrich open positions (PnL, days held)
  └─► retrieveNode     search() for new markets AND open position context
  └─► reasonNode       LLM batch call → Decision[]
                         SECTION A: review open positions (close / hold)
                         SECTION B: identify best new entries (trade / swap / hold)
  └─► validateNode     Drop low-confidence; close_position always passes
  └─► preflightNode    ← autonomous safety gate (see below)
  └─► actNode          tool.invoke() → trade | swap | close | vote
  └─► recordNode       IPositionStore (save new / close existing) + IAuditLogger
END
```

### Current state (hackathon MVP)

The graph today runs: `START → agent (LLM + search_markets tool) → END`

The full node pipeline above is the target. Each node is a pure factory function that receives
port interfaces — it can be unit-tested with in-memory mocks, no Docker required.

---

## Autonomous Safety Gate (preflightNode)

```
preflightNode
  │
  ├── 1. Fetch live balances    IWalletService.getBalances()
  │        USDC, WETH, native ETH (gas token)
  │
  ├── 2. Portfolio guards       portfolioGuardService (pure domain fn)
  │        • gas_reserve_eth         — block ALL if ETH < reserve
  │        • max_position_usdc       — cap per-decision spend on new entries
  │        • max_total_exposure_pct  — never commit > X% of wallet at once
  │        • close_position          — always allowed (returns capital)
  │        → blocked decisions are logged and removed from state
  │
  └── 3. Token approvals        IWalletService.approve()
           • trade action             → USDC approved for Polymarket CTF Exchange
           • swap action              → USDC approved for Uniswap SwapRouter
           • close_position action    → USDC approved for Polymarket CTF Exchange
```

---

## User Preferences

Stored in `config/user_preferences.json` (loaded via `JsonFileUserPrefsRepo`).

| Field | Default | Meaning |
|---|---|---|
| `dry_run` | `true` | Log intent without broadcasting transactions |
| `require_human_approval` | `true` | Gate between reason and execution |
| `max_position_usdc` | `10` | Hard cap per individual new entry |
| `max_total_exposure_pct` | `0.7` | Never use more than 70% of wallet |
| `gas_reserve_eth` | `0.005` | Always keep this ETH for gas |
| `confidence_threshold` | `0.65` | Skip new-entry decisions below this score |
| `take_profit_pct` | `0.30` | Close when position is up ≥ 30% |
| `stop_loss_pct` | `0.20` | Close when position is down ≥ 20% |
| `max_days_open` | `30` | Close positions held ≥ 30 days |
| `preferred_domains` | `[]` | Filter: only trade in these market categories |

---

## Position Lifecycle

Positions are tracked in `data/positions.json` (gitignored; created on first trade).

```
actNode: trade/swap succeeds
    │
    ▼
recordNode: savePosition() → { id, market_id, direction, entry_price, status: "open" }
    │
    │  (next daily run)
    │
    ▼
ingestNode: loadOpen() + enrichPosition()
               adds: current_price (from Graphiti fact), pnl_usdc, days_held
    │
    ▼
retrieveNode: search() with position's market context
               Graphiti returns current + historical facts — LLM sees trend automatically
    │
    ▼
reasonNode: LLM sees position PnL + market trend → close_position or hold_open
    │
    ▼
actNode: close_position → opposing-direction trade on Polymarket
    │
    ▼
recordNode: closePosition() → { status: "closed", exit_price, pnl_usdc }
```

---

## Swap Adapters Independently

| Now (hackathon) | Later (production) |
|---|---|
| `JsonFileUserPrefsRepo` | `PostgresUserPrefsRepo` |
| `JsonFilePositionStore` | `PostgresPositionStore` |
| `FileAuditLogger` | `S3AuditLogger` |
| `GraphitiAdapter` (REST) | `GraphitiAdapter` (gRPC / SDK) |
| Single LLM (LiteLLM proxy) | `ILLMProvider` with OpenAI / Anthropic / DeepSeek adapters |

Zero changes to domain or application code for any of these swaps.

---

## Why Not LangGraph ToolNode for Trading

LangGraph's `ToolNode` lets the LLM emit `tool_calls` and executes them automatically — the LLM
directly controls when trades fire. For a financial agent that is unsafe: the confidence gate,
position cap, and wallet checks would have no place to live.

Instead we use a **hybrid**:
- Tools are defined with typed Zod schemas via LangChain's `tool()` helper
- `actNode` dispatches them **deterministically** based on the validated `Decision.action`
- If you ever want LLM-driven tool calling, pass the tools to `ChatOpenAI.bindTools()` — no
  changes to tool definitions

```
reasonNode → Decision[] → validateNode → preflightNode → actNode → tool.invoke()
                               ↑               ↑
                   confidence, position cap   wallet balance, gas, approvals
```

> **Current MVP** uses the LangGraph ReAct pattern (LLM → tool call → LLM) which is fine for
> read-only Q&A. The deterministic node pipeline above is the target for autonomous trading.
