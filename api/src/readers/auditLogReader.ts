import { createReadStream, existsSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";
import { resolve } from "path";

const AUDIT_DIR = process.env.AUDIT_DIR ?? resolve("../data/audit");

export interface AuditEntry {
  timestamp: string;
  runId: string;
  event: string;
  data: Record<string, unknown>;
}

/** Reads all JSONL lines from a user's audit log file, most-recent-first. */
export async function readAuditLog(ensName: string): Promise<AuditEntry[]> {
  const filePath = join(AUDIT_DIR, `${ensName}.jsonl`);
  if (!existsSync(filePath)) return [];

  return new Promise((resolve, reject) => {
    const entries: AuditEntry[] = [];
    const rl = createInterface({ input: createReadStream(filePath) });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        entries.push(JSON.parse(trimmed) as AuditEntry);
      } catch {
        // skip malformed lines
      }
    });

    rl.on("close", () => resolve(entries.reverse())); // newest first
    rl.on("error", reject);
  });
}
