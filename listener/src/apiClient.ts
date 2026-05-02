import axios from "axios";

/** Base URL of the api/ module — all listener data is POSTed here. */
const API_URL = (process.env.API_URL ?? "http://localhost:4338").replace(/\/$/, "");

const client = axios.create({ baseURL: API_URL, timeout: 10_000 });

/** Upserts a batch of markets into the api/ SQLite store. */
export async function postMarkets(markets: unknown[]): Promise<void> {
  await client.post("/ingest/markets", { markets });
}

/** Upserts a user profile (status = "registered" or "pending"). */
export async function postProfile(
  ensName: string,
  status: "registered" | "pending",
  profile: unknown,
  agentId?: string | null,
): Promise<void> {
  await client.post("/ingest/profiles", { ensName, status, profile, agentId });
}

/**
 * Fetches the agentId stored by the UI when the user registered.
 * Returns null if the API is unreachable, the profile doesn't exist, or no agentId was stored.
 */
export async function fetchAgentId(ensName: string): Promise<string | null> {
  try {
    const label = ensName.replace(/\.agentic\.eth$/, "");
    const { data } = await client.get<{ agentId?: string | null }>(`/profile/${label}`);
    return data.agentId ?? null;
  } catch {
    return null;
  }
}
