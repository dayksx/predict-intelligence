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
): Promise<void> {
  await client.post("/ingest/profiles", { ensName, status, profile });
}
