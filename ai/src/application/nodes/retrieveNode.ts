import type { IMarketSearch } from "../../ports/outbound/IMarketSearch.js";
import type { AgentState } from "../agentState.js";
import { enrichPosition } from "../../domain/entities/position.js";

/**
 * Searches Graphiti using the user's focus topics (from their TradingStrategy)
 * plus queries for each open position's market question.
 * Re-enriches open positions with current prices extracted from retrieved facts.
 */
export function makeRetrieveNode(marketSearch: IMarketSearch) {
  return async function retrieveNode(state: AgentState): Promise<Partial<AgentState>> {
    const strategy = state.strategy!;

    // User's focus topics drive the market search
    const queries = [...strategy.graphitiSearchTopics];

    // Also search for context on any currently open positions
    for (const pos of state.openPositions) {
      queries.push(pos.market_question);
    }

    const unique = [...new Set(queries)].slice(0, 6);
    const results = await Promise.all(
      unique.map((q) => marketSearch.search(q, 6).catch(() => [])),
    );
    const marketFacts = results.flat();

    // Re-enrich positions with current prices parsed from Graphiti facts
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

    console.log(`[retrieve] user:${strategy.ensName} | ${marketFacts.length} facts from Graphiti`);
    return { marketFacts, openPositions };
  };
}
