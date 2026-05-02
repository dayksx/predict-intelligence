import type { IMarketSearch } from "../../ports/outbound/IMarketSearch.js";
import type { MarketFact } from "../../domain/entities/market.js";

const GRAPHITI_URL = () => process.env.GRAPHITI_URL ?? "http://localhost:8000";
const GROUP_ID = () => process.env.GRAPHITI_GROUP_ID ?? "predict";

/** Outbound adapter — translates IMarketSearch calls into Graphiti REST API requests. */
export class GraphitiAdapter implements IMarketSearch {
  async search(query: string, maxFacts = 10): Promise<MarketFact[]> {
    let res: Response;
    try {
      res = await fetch(`${GRAPHITI_URL()}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, group_ids: [GROUP_ID()], max_facts: maxFacts }),
      });
    } catch (err) {
      throw new Error(`Graphiti unreachable at ${GRAPHITI_URL()} — is Docker running? ${err}`);
    }

    if (!res.ok) {
      throw new Error(`Graphiti search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { facts: MarketFact[] };
    return data.facts;
  }
}
