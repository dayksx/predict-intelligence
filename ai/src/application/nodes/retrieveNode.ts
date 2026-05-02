import type { IMarketSearch } from "../../ports/outbound/IMarketSearch.js";
import type { AgentState } from "../agentState.js";
import { enrichPosition } from "../../domain/entities/position.js";

/** Searches Graphiti for new market opportunities and per-position context.
 *  Re-enriches open positions with current prices extracted from facts. */
export function makeRetrieveNode(marketSearch: IMarketSearch) {
  return async function retrieveNode(state: AgentState): Promise<Partial<AgentState>> {
    const prefs = state.userPrefs;

    const queries: string[] = [];
    if (prefs?.preferred_domains?.length) {
      queries.push(...prefs.preferred_domains);
    } else {
      queries.push("top prediction markets", "crypto", "US politics", "sports");
    }
    for (const pos of state.openPositions) {
      queries.push(pos.market_question);
    }

    const unique = [...new Set(queries)].slice(0, 5);
    const results = await Promise.all(
      unique.map((q) => marketSearch.search(q, 6).catch(() => [])),
    );
    const marketFacts = results.flat();

    const openPositions = state.openPositions.map((pos) => {
      const words = pos.market_question.toLowerCase().split(" ").slice(0, 4).join(" ");
      const hit = marketFacts.find(
        (f) =>
          f.fact.toLowerCase().includes(pos.market_id.toLowerCase()) ||
          f.fact.toLowerCase().includes(words),
      );
      const probMatch = hit?.fact.match(/YES\s+([\d.]+)%/i);
      const currentPrice = probMatch ? parseFloat(probMatch[1]) / 100 : null;
      return enrichPosition(pos, currentPrice);
    });

    return { marketFacts, openPositions };
  };
}
