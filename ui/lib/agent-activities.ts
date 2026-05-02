/**
 * Agent activity feed types and demo data. Swap `getAgentActivityFeed` for an API
 * when perceive / reason / trigger pipelines persist runs server-side.
 */

export interface MonitoredSource {
  id: string;
  /** Human-readable feed or integration name */
  sourceName: string;
  /** How often the agent polls or receives pushes */
  watchFrequency: string;
  /** ISO 8601 */
  lastFetchAt: string;
  lastFetchUri: string;
}

export interface ReasonRecord {
  id: string;
  /** ISO 8601 */
  decidedAt: string;
  /** Short outcome of the reasoning step */
  summary: string;
  /** Areas of focus referenced for this decision */
  focusAreas: string[];
  /** How this maps to the configured thesis / prompt */
  promptAlignment: string;
}

export type TriggerKind =
  | "swap"
  | "prediction_market"
  | "onchain"
  | "bridge"
  | "other";

export interface TriggeredAction {
  id: string;
  kind: TriggerKind;
  label: string;
  /** ISO 8601 */
  occurredAt: string;
  /** undefined = unknown/pending, true = succeeded, false = failed */
  success?: boolean;
  /** Primary explorer or product URL */
  primaryUrl?: string;
  primaryUrlLabel?: string;
  extraDetail?: string;
}

export interface AgentActivityFeed {
  agentFullName: string;
  perceive: {
    sources: MonitoredSource[];
  };
  reason: {
    runs: ReasonRecord[];
  };
  triggered: {
    actions: TriggeredAction[];
  };
}

/** Demo feed used when no override exists — illustrates the full Perceive → Reason → Act UI. */
export function defaultAgentActivityFeed(label: string): AgentActivityFeed {
  const full = `${label}.agentic.eth`;
  const now = Date.now();
  const iso = (deltaMin: number) =>
    new Date(now - deltaMin * 60_000).toISOString();

  return {
    agentFullName: full,
    perceive: {
      sources: [
        {
          id: "src-gamma",
          sourceName: "Polymarket Gamma API",
          watchFrequency: "Every 15 minutes",
          lastFetchAt: iso(12),
          lastFetchUri:
            "https://gamma-api.polymarket.com/markets?closed=false&limit=80",
        },
        {
          id: "src-rss",
          sourceName: "Fed / macro RSS bundle",
          watchFrequency: "Hourly",
          lastFetchAt: iso(55),
          lastFetchUri: "https://feeds.bloomberg.com/markets/news.rss",
        },
        {
          id: "src-onchain",
          sourceName: "Sepolia wallet / allowance watcher",
          watchFrequency: "Realtime (websocket)",
          lastFetchAt: iso(2),
          lastFetchUri: "wss://sepolia.gateway.tenderly.co",
        },
      ],
    },
    reason: {
      runs: [
        {
          id: "rsn-1",
          decidedAt: iso(18),
          summary:
            "Elevated tail risk in geopolitical bucket vs crypto vol regime — trimmed overlapping YES exposure on correlated markets.",
          focusAreas: ["Geopolitic", "Cross-asset correlation"],
          promptAlignment:
            "Matched thesis clause prioritizing regime-change catalysts over headline noise.",
        },
        {
          id: "rsn-2",
          decidedAt: iso(220),
          summary:
            "Liquidity depth on target outcome improved — staged incremental participation within delegated ETH envelope.",
          focusAreas: ["Crypto", "Execution sizing"],
          promptAlignment:
            "Delegated amount and focus domains capped trade size; slippage guard held.",
        },
      ],
    },
    triggered: {
      actions: [
        {
          id: "trg-1",
          kind: "prediction_market",
          label: "Reduced YES on correlated geopolitical markets",
          occurredAt: iso(19),
          primaryUrl: "https://polymarket.com/",
          primaryUrlLabel: "Polymarket",
          extraDetail: "Batch adjust · USDC allowance unchanged",
        },
        {
          id: "trg-2",
          kind: "swap",
          label: "USDC → WETH on Sepolia (route: Uniswap V3)",
          occurredAt: iso(90),
          primaryUrl:
            "https://sepolia.etherscan.io/tx/0xe6afbcfa58aa12558297105aac062645293470847fc788ea906bc08586780752",
          primaryUrlLabel: "Sepolia Etherscan",
        },
        {
          id: "trg-3",
          kind: "onchain",
          label: "Set text records via Public Resolver multicall",
          occurredAt: iso(400),
          primaryUrl:
            "https://sepolia.etherscan.io/tx/0x9c67ad43cf956186958062649293470847fc788ea906bc085867807522aaaa",
          primaryUrlLabel: "Sepolia Etherscan",
          extraDetail: "Resolver metadata update after reasoning run",
        },
      ],
    },
  };
}

type ActivityOverride = Partial<
  Pick<AgentActivityFeed, "perceive" | "reason" | "triggered">
>;

const OVERRIDES: Record<string, ActivityOverride> = {
  agent0: {
    perceive: {
      sources: [
        {
          id: "a0-poly",
          sourceName: "Polymarket crypto cohort",
          watchFrequency: "Every 10 minutes",
          lastFetchAt: new Date(Date.now() - 8 * 60_000).toISOString(),
          lastFetchUri:
            "https://gamma-api.polymarket.com/events?tag=crypto&active=true",
        },
      ],
    },
  },
};

export function getAgentActivityFeed(label: string): AgentActivityFeed {
  const key = label.toLowerCase();
  const override = OVERRIDES[key];
  if (override) {
    const merged = defaultAgentActivityFeed(key);
    return {
      agentFullName: merged.agentFullName,
      perceive: {
        sources: override.perceive?.sources ?? merged.perceive.sources,
      },
      reason: {
        runs: override.reason?.runs ?? merged.reason.runs,
      },
      triggered: {
        actions: override.triggered?.actions ?? merged.triggered.actions,
      },
    };
  }
  return defaultAgentActivityFeed(key);
}

/** ENS-style label: single segment, no dots */
export function isValidAgentLabel(label: string): boolean {
  if (label.length < 1 || label.length > 63) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

export function agentFullNameFromLabel(label: string): string {
  return `${label}.agentic.eth`;
}

export function triggerKindPresentation(kind: TriggerKind): {
  label: string;
  pillClass: string;
} {
  const map: Record<TriggerKind, { label: string; pillClass: string }> = {
    swap: {
      label: "Swap",
      pillClass:
        "border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
    },
    prediction_market: {
      label: "Prediction market",
      pillClass:
        "border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
    },
    onchain: {
      label: "On-chain",
      pillClass:
        "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    bridge: {
      label: "Bridge",
      pillClass:
        "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    },
    other: {
      label: "Other",
      pillClass:
        "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
    },
  };
  return map[kind];
}

export function formatActivityDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
