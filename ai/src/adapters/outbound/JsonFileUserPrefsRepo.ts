import { readFile } from "fs/promises";
import { existsSync } from "fs";
import type { IUserPrefsRepo } from "../../ports/outbound/IUserPrefsRepo.js";
import { UserPrefsZ, type UserPrefs } from "../../domain/entities/userPrefs.js";

const DEFAULT_PREFS: UserPrefs = UserPrefsZ.parse({});

export class JsonFileUserPrefsRepo implements IUserPrefsRepo {
  constructor(private readonly filePath: string) {}

  async loadPrefs(): Promise<UserPrefs> {
    if (!existsSync(this.filePath)) {
      console.warn(`[prefs] ${this.filePath} not found — using defaults`);
      return DEFAULT_PREFS;
    }
    const raw = await readFile(this.filePath, "utf-8");
    return UserPrefsZ.parse(JSON.parse(raw));
  }
}
