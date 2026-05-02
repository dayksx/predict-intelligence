/** Lists wrapped subnames under `agentic.eth` whose `wrappedOwner` is the given wallet (Sepolia ENS subgraph). */

export const AGENTIC_PARENT_DOMAIN = "agentic.eth" as const;

export const ENS_SEPOLIA_SUBGRAPH_URL =
  typeof process.env.NEXT_PUBLIC_ENS_SEPOLIA_SUBGRAPH_URL === "string" &&
  process.env.NEXT_PUBLIC_ENS_SEPOLIA_SUBGRAPH_URL.length > 0
    ? process.env.NEXT_PUBLIC_ENS_SEPOLIA_SUBGRAPH_URL
    : "https://api.studio.thegraph.com/query/49574/enssepolia/version/latest";

export type UserAgenticSubdomain = {
  name: string;
  labelName: string | null;
  /** Unix seconds as string from subgraph */
  createdAt: string;
  /** Unix seconds as string, or null if unknown */
  expiryDate: string | null;
};

const QUERY = `
  query UserAgenticSubnames($parent: String!, $owner: String!) {
    domains(where: { name: $parent }, first: 1) {
      subdomains(
        first: 500
        orderBy: createdAt
        orderDirection: desc
        where: { wrappedOwner: $owner }
      ) {
        name
        labelName
        createdAt
        expiryDate
      }
    }
  }
` as const;

type SubgraphResponse = {
  data?: {
    domains?: {
      subdomains?: UserAgenticSubdomain[];
    }[];
  };
  errors?: { message: string }[];
};

function normalizeOwner(owner: `0x${string}`): string {
  return owner.toLowerCase();
}

export async function fetchUserAgenticSubdomains(
  owner: `0x${string}`,
  options?: { signal?: AbortSignal },
): Promise<UserAgenticSubdomain[]> {
  const res = await fetch(ENS_SEPOLIA_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        parent: AGENTIC_PARENT_DOMAIN,
        owner: normalizeOwner(owner),
      },
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    throw new Error(`ENS subgraph HTTP ${res.status}`);
  }

  const json = (await res.json()) as SubgraphResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const list = json.data?.domains?.[0]?.subdomains;
  return Array.isArray(list) ? list : [];
}
