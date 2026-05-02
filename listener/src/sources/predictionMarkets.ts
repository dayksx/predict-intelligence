import axios from "axios";
import { config } from "../config.js";
import type { MarketEvent } from "../types.js";

/** A parent event grouping one or more related markets on the Gamma API. */
interface GammaEvent {
  id: string;
  title: string;
  slug?: string;
  description?: string;
}

/** Raw market shape returned by the Polymarket Gamma API — internal to this module. */
interface GammaMarket {
  id: string;
  question: string;
  description?: string;
  slug?: string;
  outcomePrices?: string;   // JSON string — "[\"0.62\",\"0.38\"]"
  clobTokenIds?: string;    // JSON string — "[\"0xabc...\",\"0xdef...\"]"
  negRisk?: boolean;
  volume?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  conditionId?: string;
  events?: GammaEvent[];
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  crypto: [
    "bitcoin", "btc", "ethereum", "eth", "crypto", "defi", "blockchain",
    "solana", "sol", "altcoin", "nft", "web3", "token", "coin", "usdc",
    "stablecoin", "layer 2", "l2", "base chain", "polygon",
  ],
  geopolitics: [
    "war", "ceasefire", "nato", "russia", "ukraine", "china", "taiwan",
    "election", "president", "congress", "senate", "trump", "biden",
    "geopolit", "sanction", "nuclear", "conflict", "diplomacy", "treaty",
    "referendum", "coup", "military", "troops", "missile",
  ],
  energy: [
    "oil", "gas", "energy", "opec", "barrel", "crude", "brent", "wti",
    "natural gas", "lng", "renewable", "solar", "wind power", "carbon",
    "emissions", "climate",
  ],
  sports: [
    "nfl", "nba", "nba finals", "mlb", "nhl", "world cup", "champions league", "premier league",
    "soccer", "football", "basketball", "baseball", "tennis", "wimbledon",
    "olympics", "superbowl", "super bowl", "celtics", "lakers", "warriors",
    "magic", "knicks", "bulls", "heat", "mavs", "nuggets", "playoffs",
    "championship", "mvp", "athlete", "team wins",
  ],
  finance: [
    "fed", "federal reserve", "interest rate", "inflation", "gdp", "recession",
    "s&p", "nasdaq", "dow jones", "stock", "earnings", "ipo", "hedge fund",
    "bond", "yield", "treasury", "ecb", "imf",
  ],
};

/** Scores market text against domain keywords and returns the best-matching domain. */
function inferDomain(market: GammaMarket): string {
  const corpus = [
    market.question,
    market.description ?? "",
    market.slug ?? "",
    ...(market.events ?? []).map(
      (e) => `${e.title ?? ""} ${e.slug ?? ""} ${e.description ?? ""}`,
    ),
  ]
    .join(" ")
    .toLowerCase();

  let bestDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter((kw) => corpus.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

/** Fetches a single page of active markets from the Gamma API at the given offset. */
async function fetchPage(offset: number, pageSize: number): Promise<GammaMarket[]> {
  const { data } = await axios.get<GammaMarket[]>(
    `${config.polymarket.gammaUrl}/markets`,
    {
      params: { active: true, closed: false, limit: pageSize, offset },
      timeout: 15_000,
    },
  );
  return data;
}

/** Maps a raw GammaMarket to a clean MarketEvent, parsing JSON strings and inferring domain. */
function toMarketEvent(m: GammaMarket, fetched_at: string): MarketEvent {
  let yes_prob = 0.5;
  let no_prob = 0.5;
  try {
    const prices = JSON.parse(m.outcomePrices ?? "[0.5, 0.5]") as string[];
    yes_prob = parseFloat(prices[0] ?? "0.5");
    no_prob  = parseFloat(prices[1] ?? "0.5");
  } catch { /* use defaults */ }

  let clob_yes_token_id: string | null = null;
  let clob_no_token_id:  string | null = null;
  try {
    if (m.clobTokenIds) {
      const ids = JSON.parse(m.clobTokenIds) as string[];
      clob_yes_token_id = ids[0] ?? null;
      clob_no_token_id  = ids[1] ?? null;
    }
  } catch { /* token IDs unavailable */ }

  return {
    market_id:         m.id,
    domain:            inferDomain(m),
    title:             m.question,
    description:       m.description ?? "",
    yes_prob,
    no_prob,
    volume_usdc:       parseFloat(m.volume ?? "0"),
    resolution_date:   m.endDate ?? null,
    source:            "polymarket",
    url:               `https://polymarket.com/event/${m.conditionId ?? m.id}`,
    clob_yes_token_id,
    clob_no_token_id,
    neg_risk:          m.negRisk ?? false,
    related_articles:  [],
    fetched_at,
  };
}

/** Paginates through the Gamma API, normalises results, and filters by configured categories. */
export async function fetchPolymarketMarkets(): Promise<MarketEvent[]> {
  const { fetchLimit, categories } = config.polymarket;
  let allMarkets: GammaMarket[] = [];
  let offset = 0;

  while (allMarkets.length < fetchLimit) {
    const page = await fetchPage(offset, Math.min(100, fetchLimit - allMarkets.length));
    if (!page.length) break;
    allMarkets = [...allMarkets, ...page];
    offset += page.length;
    if (page.length < 100) break;
  }

  console.log(`[Polymarket] ${allMarkets.length} raw markets fetched`);

  const fetched_at = new Date().toISOString();
  const events = allMarkets
    .map((m) => toMarketEvent(m, fetched_at))
    .filter((e) => categories.includes(e.domain as never));

  console.log(`[Polymarket] ${events.length} markets after category filter (${categories.join(", ")})`);
  return events;
}
