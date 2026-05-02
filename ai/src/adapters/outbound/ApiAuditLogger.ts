import type { IAuditLogger, AuditEntry } from "../../ports/outbound/IAuditLogger.js";

/** Sends audit log entries to the api/ module via HTTP POST /ingest/audit. */
export class ApiAuditLogger implements IAuditLogger {
  constructor(
    private readonly apiUrl: string,
    private readonly ensName: string,
    private readonly fallback: IAuditLogger,
  ) {}

  async writeLog(entry: AuditEntry): Promise<void> {
    // Always write to fallback (local file) for resilience
    await this.fallback.writeLog(entry);

    try {
      const res = await fetch(`${this.apiUrl}/ingest/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensName: this.ensName, ...entry }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[ApiAuditLogger] push failed (non-fatal): ${String(err)}`);
    }
  }
}
