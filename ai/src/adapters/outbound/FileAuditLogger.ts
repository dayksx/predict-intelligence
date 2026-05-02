import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import type { IAuditLogger, AuditEntry } from "../../ports/outbound/IAuditLogger.js";

export class FileAuditLogger implements IAuditLogger {
  constructor(private readonly filePath: string) {}

  async writeLog(entry: AuditEntry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, JSON.stringify(entry) + "\n");
  }
}
