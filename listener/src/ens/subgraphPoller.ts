import axios from "axios";
import type { SubgraphDomain } from "./types.js";

/** ENS subgraph endpoint for Sepolia — indexes all ENS domain registrations on the testnet. */
const SUBGRAPH_URL =
  process.env.ENS_SUBGRAPH_URL ??
  "https://api.studio.thegraph.com/query/49574/enssepolia/version/latest";

const PARENT_NAME = "agentic.eth";

const QUERY = `
  query NewSubdomains($since: String!) {
    domains(
      where: { parent_: { name: "${PARENT_NAME}" }, createdAt_gt: $since }
      orderBy: createdAt
      orderDirection: asc
      first: 100
    ) {
      id
      name
      labelName
      owner { id }
      createdAt
    }
  }
`;

/**
 * Polls the ENS Sepolia subgraph for new agentic.eth subdomains registered
 * after the given unix timestamp (in seconds).
 */
export async function fetchNewSubdomains(sinceTimestamp: number): Promise<SubgraphDomain[]> {
  const response = await axios.post<{
    data?: { domains?: SubgraphDomain[] };
    errors?: Array<{ message: string }>;
  }>(SUBGRAPH_URL, {
    query: QUERY,
    variables: { since: String(sinceTimestamp) },
  });

  if (response.data.errors?.length) {
    throw new Error(`ENS subgraph error: ${response.data.errors[0].message}`);
  }

  return response.data.data?.domains ?? [];
}
