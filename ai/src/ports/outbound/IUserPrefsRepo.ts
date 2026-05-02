import type { UserPrefs } from "../../domain/entities/userPrefs.js";

export interface IUserPrefsRepo {
  loadPrefs(): Promise<UserPrefs>;
}
