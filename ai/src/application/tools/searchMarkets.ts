import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphitiAdapter } from "../../adapters/outbound/GraphitiAdapter.js";

const graphiti = new GraphitiAdapter();

/** LangChain tool that bridges the agent core to the Graphiti outbound adapter. */
export const searchMarketsTool = tool(
  async ({ query }) => {
    let facts;
    try {
      facts = await graphiti.search(query, 8);
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
        const expired = f.invalid_at ? ` [expired ${f.invalid_at.slice(0, 10)}]` : "";
        return `• ${f.fact}${when}${expired}`;
      })
      .join("\n");
  },
  {
    name: "search_markets",
    description:
      "Search the prediction market knowledge graph for facts, probabilities, and relationships. " +
      "Use this whenever the user asks about specific markets, assets, events, or trading opportunities. " +
      "Returns timestamped facts extracted from Polymarket data.",
    schema: z.object({
      query: z.string().describe("Natural language query about markets, entities, or events"),
    }),
  }
);
