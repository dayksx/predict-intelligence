import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";
import { postProfile } from "../apiClient.js";

const DATA_DIR = process.env.ENS_DATA_DIR ?? resolve("data");
const PROFILES_DIR = process.env.PROFILES_DIR ?? `${DATA_DIR}/profiles`;
const STATE_FILE = `${DATA_DIR}/ens_last_polled.txt`;
const PENDING_FILE = `${DATA_DIR}/ens_pending.json`;

/** Saves a TradingStrategy to data/profiles/{ensName}.json and api/. */
export async function saveProfile(strategy: object & { ensName: string }): Promise<void> {
  await mkdir(PROFILES_DIR, { recursive: true });
  const filePath = join(PROFILES_DIR, `${strategy.ensName}.json`);
  await writeFile(filePath, JSON.stringify(strategy, null, 2));
  console.log(`[ens] profile saved → ${filePath}`);

  try {
    await postProfile(strategy.ensName, "registered", strategy);
    console.log(`[ens] profile pushed → api`);
  } catch (err) {
    console.warn(`[ens] api profile push failed (non-fatal): ${String(err)}`);
  }
}

/** Returns true if a profile file already exists for this ENS name. */
export function profileExists(ensName: string): boolean {
  return existsSync(join(PROFILES_DIR, `${ensName}.json`));
}

/** Reads the last-polled unix timestamp (seconds) from disk, defaulting to 0. */
export async function readLastPolled(): Promise<number> {
  if (!existsSync(STATE_FILE)) return 0;
  const raw = await readFile(STATE_FILE, "utf-8");
  return parseInt(raw.trim(), 10) || 0;
}

/** Persists the current unix timestamp as the last-polled marker. */
export async function writeLastPolled(timestampSeconds: number): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, String(timestampSeconds));
}

/**
 * Pending retry list — subdomains discovered but with missing/incomplete metadata.
 * Retried on every ENS tick until their text records are published.
 */
export async function readPending(): Promise<string[]> {
  if (!existsSync(PENDING_FILE)) return [];
  const raw = await readFile(PENDING_FILE, "utf-8");
  return JSON.parse(raw) as string[];
}

export async function addPending(ensName: string): Promise<void> {
  const list = await readPending();
  if (!list.includes(ensName)) {
    list.push(ensName);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(PENDING_FILE, JSON.stringify(list, null, 2));
    console.log(`[ens] queued for retry when metadata is published: ${ensName}`);
  }
  // Mark as pending in api/ too
  try {
    await postProfile(ensName, "pending", null);
  } catch {
    // non-fatal
  }
}

export async function removePending(ensName: string): Promise<void> {
  const list = await readPending();
  const updated = list.filter((n) => n !== ensName);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PENDING_FILE, JSON.stringify(updated, null, 2));
}
