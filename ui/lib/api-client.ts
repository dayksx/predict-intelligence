import type {
  MonitoredSource,
  ReasonRecord,
  TriggeredAction,
} from "@/lib/agent-activities";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? ""
).replace(/\/$/, "");

export function isApiConfigured(): boolean {
  return API_URL.length > 0;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`api ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Perceive ─────────────────────────────────────────────────────────────────

interface PerceiveResponse {
  sources: MonitoredSource[];
}

export async function fetchPercieve(): Promise<MonitoredSource[]> {
  const data = await apiFetch<PerceiveResponse>("/perceive");
  return data.sources;
}

// ── Reason ───────────────────────────────────────────────────────────────────

interface ReasonResponse {
  runs: ReasonRecord[];
}

export async function fetchReason(label: string): Promise<ReasonRecord[]> {
  const data = await apiFetch<ReasonResponse>(`/reason/${encodeURIComponent(label)}`);
  return data.runs;
}

// ── Act ───────────────────────────────────────────────────────────────────────

interface ActResponse {
  actions: TriggeredAction[];
}

export async function fetchAct(label: string): Promise<TriggeredAction[]> {
  const data = await apiFetch<ActResponse>(`/act/${encodeURIComponent(label)}`);
  return data.actions;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileResponse {
  status: "registered" | "pending" | "not_found";
  ensName: string;
  profile?: Record<string, unknown>;
  message?: string;
}

export async function fetchProfile(label: string): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>(`/profile/${encodeURIComponent(label)}`);
}
