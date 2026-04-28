import axios from "axios";

const GAMMA_BASE = process.env.POLYMARKET_GAMMA_URL ?? "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  question: string;
  description?: string;
  slug?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  negRisk?: boolean;
  volume?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  conditionId?: string;
  events?: { id: string; title: string; slug?: string; description?: string }[];
}

export interface MarketEvent {
  market_id: string;
  domain: string;
  title: string;
  description: string;
  yes_prob: number;
  no_prob: number;
  volume_usdc: number;
  resolution_date: string | null;
  source: "polymarket";
  url: string;
  clob_yes_token_id: string | null;
  clob_no_token_id: string | null;
  neg_risk: boolean;
  fetched_at: string;
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  crypto: [
    "bitcoin", "btc", "ethereum", "eth", "crypto", "defi", "solana",
    "nft", "web3", "token", "stablecoin", "layer 2", "l2",
  ],
  geopolitics: [
    "war", "ceasefire", "nato", "russia", "ukraine", "china", "taiwan",
    "election", "president", "congress", "trump", "sanction", "nuclear",
    "conflict", "diplomacy", "military",
  ],
  energy: [
    "oil", "gas", "energy", "opec", "barrel", "crude", "brent",
    "renewable", "solar", "carbon", "emissions", "climate",
  ],
  sports: [
    "nfl", "nba", "mlb", "nhl", "world cup", "champions league",
    "soccer", "football", "basketball", "tennis", "olympics", "super bowl",
  ],
  finance: [
    "fed", "federal reserve", "interest rate", "inflation", "gdp", "recession",
    "s&p", "nasdaq", "stock", "earnings", "ipo", "bond", "yield", "treasury",
  ],
};

function inferDomain(m: GammaMarket): string {
  const corpus = [
    m.question,
    m.description ?? "",
    m.slug ?? "",
    ...(m.events ?? []).map((e) => `${e.title} ${e.slug ?? ""} ${e.description ?? ""}`),
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

export async function fetchPredictionMarkets(limit = 200): Promise<MarketEvent[]> {
  let raw: GammaMarket[] = [];
  let offset = 0;

  while (raw.length < limit) {
    const { data } = await axios.get<GammaMarket[]>(`${GAMMA_BASE}/markets`, {
      params: { active: true, closed: false, limit: Math.min(100, limit - raw.length), offset },
      timeout: 15_000,
    });
    if (!data.length) break;
    raw = [...raw, ...data];
    offset += data.length;
    if (data.length < 100) break;
  }

  const fetched_at = new Date().toISOString();

  return raw.map((m) => {
    let yes_prob = 0.5;
    let no_prob = 0.5;
    try {
      const prices = JSON.parse(m.outcomePrices ?? "[0.5,0.5]") as string[];
      yes_prob = parseFloat(prices[0] ?? "0.5");
      no_prob = parseFloat(prices[1] ?? "0.5");
    } catch { /* use defaults */ }

    let clob_yes_token_id: string | null = null;
    let clob_no_token_id: string | null = null;
    try {
      if (m.clobTokenIds) {
        const ids = JSON.parse(m.clobTokenIds) as string[];
        clob_yes_token_id = ids[0] ?? null;
        clob_no_token_id = ids[1] ?? null;
      }
    } catch { /* token IDs unavailable */ }

    return {
      market_id: m.id,
      domain: inferDomain(m),
      title: m.question,
      description: m.description ?? "",
      yes_prob,
      no_prob,
      volume_usdc: parseFloat(m.volume ?? "0"),
      resolution_date: m.endDate ?? null,
      source: "polymarket" as const,
      url: `https://polymarket.com/event/${m.conditionId ?? m.id}`,
      clob_yes_token_id,
      clob_no_token_id,
      neg_risk: m.negRisk ?? false,
      fetched_at,
    };
  });
}
