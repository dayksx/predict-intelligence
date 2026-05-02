export interface AuditEntry {
  timestamp: string;
  runId: string;
  event: string;
  data: unknown;
}

export interface IAuditLogger {
  writeLog(entry: AuditEntry): Promise<void>;
}
