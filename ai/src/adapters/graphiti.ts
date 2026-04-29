/** Infrastructure adapter — all Graphiti HTTP calls live here */

const GRAPHITI_URL = () => process.env.GRAPHITI_URL ?? "http://localhost:8000";
const GROUP_ID = () => process.env.GRAPHITI_GROUP_ID ?? "predict";

export interface GraphitiFact {
  uuid: string;
  name: string;
  fact: string;
  valid_at: string | null;
  invalid_at: string | null;
}

/** Sends a semantic search query to Graphiti and returns matching facts. */
export async function searchGraphiti(
  query: string,
  maxFacts = 10,
): Promise<GraphitiFact[]> {
  let res: Response;
  try {
    res = await fetch(`${GRAPHITI_URL()}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        group_ids: [GROUP_ID()],
        max_facts: maxFacts,
      }),
    });
  } catch (err) {
    throw new Error(`Graphiti unreachable at ${GRAPHITI_URL()} — is Docker running? ${err}`);
  }

  if (!res.ok) {
    throw new Error(
      `Graphiti search failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { facts: GraphitiFact[] };
  return data.facts;
}
