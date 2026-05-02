import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";

const PROFILES_DIR = process.env.PROFILES_DIR ?? resolve("data/profiles");
const STATE_FILE = resolve("data/ens_last_polled.txt");
const PENDING_FILE = resolve("data/ens_pending.json");

/** Saves a TradingStrategy to data/profiles/{ensName}.json. */
export async function saveProfile(strategy: object & { ensName: string }): Promise<void> {
  await mkdir(PROFILES_DIR, { recursive: true });
  const filePath = join(PROFILES_DIR, `${strategy.ensName}.json`);
  await writeFile(filePath, JSON.stringify(strategy, null, 2));
  console.log(`[ens] profile saved → ${filePath}`);
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
  await mkdir(resolve("data"), { recursive: true });
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
    await writeFile(PENDING_FILE, JSON.stringify(list, null, 2));
    console.log(`[ens] queued for retry when metadata is published: ${ensName}`);
  }
}

export async function removePending(ensName: string): Promise<void> {
  const list = await readPending();
  const updated = list.filter((n) => n !== ensName);
  await writeFile(PENDING_FILE, JSON.stringify(updated, null, 2));
}
