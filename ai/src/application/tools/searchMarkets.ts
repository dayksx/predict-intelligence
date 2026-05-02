import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { IMarketSearch } from "../../ports/outbound/IMarketSearch.js";

/** Returns a LangChain tool backed by the injected IMarketSearch port.
 *  Used for future hybrid (ReAct-style) workflows — the pipeline uses retrieveNode directly. */
export function makeSearchMarketsTool(marketSearch: IMarketSearch) {
  return tool(
    async ({ query }) => {
      let facts;
      try {
        facts = await marketSearch.search(query, 8);
      } catch (err) {
        const msg = `Error fetching market data: ${err}`;
        console.error(`[tool error] ${msg}`);
        return msg;
      }

      if (!facts.length) {
        return `No facts found for query: "${query}". The graph may not have data on this topic yet.`;
      }

      return facts
        .map((f) => {
          const when = f.valid_at ? ` (as of ${f.valid_at.slice(0, 10)})` : "";
          const stale = f.invalid_at ? ` [expired ${f.invalid_at.slice(0, 10)}]` : "";
          return `• ${f.fact}${when}${stale}`;
        })
        .join("\n");
    },
    {
      name: "search_markets",
      description:
        "Search the prediction market knowledge graph for facts, probabilities, and relationships. " +
        "Returns timestamped facts extracted from Polymarket data.",
      schema: z.object({
        query: z.string().describe("Natural language query about markets, entities, or events"),
      }),
    },
  );
}
