"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AGENTIC_ENS_TEXT_KEYS } from "@/lib/ens-registration-metadata";
import {
  agentFullNameFromLabel,
  defaultAgentActivityFeed,
  formatActivityDateTime,
  isValidAgentLabel,
  triggerKindPresentation,
} from "@/lib/agent-activities";
import { isApiConfigured } from "@/lib/api-client";
import { usePercieve, useReason, useAct, useProfile } from "@/hooks/useAgentFeed";
import {
  AgentDelegationMetricsStrip,
  AgentDelegationOutcomeDiagramPanel,
} from "@/components/agent/AgentDelegationYieldHero";
import { AgentLiveSidebar } from "@/components/agent/AgentLiveSidebar";
import { useEnsAvatar, useEnsText } from "wagmi";
import { sepolia } from "wagmi/chains";

function labelFromParams(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <li className="rounded-xl border border-zinc-100 p-4 dark:border-zinc-800">
      <div className="h-2.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </li>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
      {message}
    </p>
  );
}

export default function AgentActivitiesPage() {
  const params = useParams();
  const label = labelFromParams(params.label);
  const valid = isValidAgentLabel(label);
  const fullName = valid ? agentFullNameFromLabel(label) : "";
  const chainId = sepolia.id;
  const enabled = valid && Boolean(fullName);
  const apiConfigured = isApiConfigured();

  // Live API data
  const perceiveQ  = usePercieve();
  const reasonQ    = useReason(label);
  const actQ       = useAct(label);
  const profileQ   = useProfile(label);

  // Fall back to mock when API is not configured
  const mockFeed = valid ? defaultAgentActivityFeed(label) : null;

  const percieveSources = perceiveQ.data ?? (apiConfigured ? [] : mockFeed?.perceive.sources ?? []);
  const reasonRuns      = reasonQ.data   ?? (apiConfigured ? [] : mockFeed?.reason.runs ?? []);
  const actActions      = actQ.data      ?? (apiConfigured ? [] : mockFeed?.triggered.actions ?? []);
  const { data: avatar } = useEnsAvatar({
    name: fullName,
    chainId,
    query: { enabled },
  });
  const { data: agentNameRecord } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.agentName,
    chainId,
    query: { enabled },
  });
  const { data: focusDomain } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.focusDomain,
    chainId,
    query: { enabled },
  });
  const { data: thesisPrompt } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.thesisPrompt,
    chainId,
    query: { enabled },
  });
  const { data: delegatedAmountEns } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.delegatedAmount,
    chainId,
    query: { enabled },
  });

  const { data: avatar } = useEnsAvatar({ name: fullName, chainId, query: { enabled } });
  const { data: agentNameRecord } = useEnsText({ name: fullName, key: AGENTIC_ENS_TEXT_KEYS.agentName, chainId, query: { enabled } });
  const { data: focusDomain }     = useEnsText({ name: fullName, key: AGENTIC_ENS_TEXT_KEYS.focusDomain, chainId, query: { enabled } });
  const { data: thesisPrompt }    = useEnsText({ name: fullName, key: AGENTIC_ENS_TEXT_KEYS.thesisPrompt, chainId, query: { enabled } });

  const displayName = agentNameRecord?.trim() || (valid ? label : "Unknown agent");

  if (!valid) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
          <Link href="/dashboard" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            ← Dashboard
          </Link>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            Invalid agent label in URL. Use the label only (e.g.{" "}
            <span className="font-mono">myagent</span>), not the full ENS name.
          </p>
        </main>
      </div>
    );
  }

  // Profile status banner
  const profileStatus = profileQ.data?.status;
  const profileBanner =
    !apiConfigured ? (
      <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Perceive / Reason / Act sections show illustrative sample data. Set{" "}
        <span className="font-mono">NEXT_PUBLIC_API_URL</span> to connect to live data.
        Set <span className="font-mono">AGENT_A2A_URL</span> and{" "}
        <span className="font-mono">GRAPHITI_URL</span> for live chat and alpha ingestion.
      </p>
    ) : profileStatus === "pending" ? (
      <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Registration detected — waiting for metadata transaction to confirm on Sepolia.
      </p>
    ) : profileStatus === "not_found" ? (
      <p className="mt-4 rounded-lg border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-xs leading-relaxed text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        No profile found for <span className="font-mono">{fullName}</span>. Register via the home page first.
      </p>
    ) : profileStatus === "registered" ? (
      <p className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-xs leading-relaxed text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        Profile active — showing live data from the agent pipeline.
      </p>
    ) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-5">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            ← Dashboard
          </Link>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-sky-200 bg-zinc-100 ring-2 ring-sky-500/15 dark:border-sky-800 dark:bg-zinc-800 dark:ring-sky-400/10">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-zinc-500 dark:text-zinc-400">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Your agent
              </h1>
              <p className="mt-1 font-mono text-sm text-sky-700 dark:text-sky-300">
                {fullName}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                  Perceive
                </span>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                  Reason
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Act
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Summary metrics and venue chart share the top band; the outcome
                diagram sits in a narrow column beside chat, then activity feeds.
              </p>
            </div>
          </div>

          {profileBanner}

        </div>

        <AgentDelegationMetricsStrip ensDelegatedAmount={delegatedAmountEns} />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
    
          <div className="min-w-0 flex-1">
            <AgentLiveSidebar key={label} label={label} />
          </div>
        </div>

        <div className="space-y-6">
          {/* Perceive */}
          <section
            aria-labelledby="perceive-heading"
            className="rounded-2xl border border-emerald-200/90 bg-white p-5 shadow-sm dark:border-emerald-900/45 dark:bg-emerald-950/15 sm:p-6"
          >
            <h2
              id="perceive-heading"
              className="flex items-center gap-2 text-lg font-semibold text-emerald-950 dark:text-emerald-100"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] dark:bg-emerald-400"
                aria-hidden
              />
              Perceive
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Sources this agent watches: cadence, last successful fetch, and the resource URI.
            </p>

            <div className="mt-5 overflow-x-auto rounded-xl border border-emerald-100 dark:border-emerald-900/35">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50/90 dark:border-emerald-900/40 dark:bg-emerald-950/50">
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Source</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Watch frequency</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Last fetch</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Last fetch URI</th>
                  </tr>
                </thead>
                <tbody>
                  {perceiveQ.isLoading ? (
                    <>
                      <SkeletonRow cols={4} />
                      <SkeletonRow cols={4} />
                    </>
                  ) : percieveSources.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState message="No sources recorded yet — run the listener to populate." />
                      </td>
                    </tr>
                  ) : (
                    percieveSources.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{s.sourceName}</td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{s.watchFrequency}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {formatActivityDateTime(s.lastFetchAt)}
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          <a
                            href={s.lastFetchUri}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-xs text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                          >
                            {s.lastFetchUri}
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reason */}
          <section
            aria-labelledby="reason-heading"
            className="rounded-2xl border border-violet-200/90 bg-white p-5 shadow-sm dark:border-violet-900/45 dark:bg-violet-950/15 sm:p-6"
          >
            <h2
              id="reason-heading"
              className="flex items-center gap-2 text-lg font-semibold text-violet-950 dark:text-violet-100"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.28)] dark:bg-violet-400"
                aria-hidden
              />
              Reason
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Policy from your ENS records (area of focus and thesis prompt), plus recent decision summaries.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/35">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Area of focus (ENS)
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {focusDomain?.trim() || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/35">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Thesis prompt (ENS)
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {thesisPrompt?.trim() || "—"}
                </p>
              </div>
            </div>

            <h3 className="mt-8 text-sm font-semibold text-violet-900 dark:text-violet-200">
              Decision log
            </h3>
            {reasonQ.isLoading ? (
              <ul className="mt-3 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </ul>
            ) : reasonRuns.length === 0 ? (
              <EmptyState message="No reasoning runs yet — the daily cycle will populate this." />
            ) : (
              <ul className="mt-3 space-y-4">
                {reasonRuns.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-violet-100 border-l-4 border-l-violet-400 bg-white p-4 dark:border-violet-900/35 dark:border-l-violet-500 dark:bg-violet-950/20"
                  >
                    <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {formatActivityDateTime(r.decidedAt)}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {r.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.focusAreas.map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">Prompt alignment: </span>
                      {r.promptAlignment}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Triggered / Act */}
          <section
            aria-labelledby="triggered-heading"
            className="rounded-2xl border border-amber-200/90 bg-white p-5 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/10 sm:p-6"
          >
            <h2
              id="triggered-heading"
              className="flex items-center gap-2 text-lg font-semibold text-amber-950 dark:text-amber-100"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.28)] dark:bg-amber-400"
                aria-hidden
              />
              Triggered
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Actions emitted after reasoning: swaps, prediction-market moves, on-chain txs.
            </p>

            {actQ.isLoading ? (
              <ul className="mt-5 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </ul>
            ) : actActions.length === 0 ? (
              <EmptyState message="No actions executed yet — trigger a run via the chat panel above." />
            ) : (
              <ul className="mt-5 space-y-4">
                {actActions.map((t) => {
                  const kind = triggerKindPresentation(t.kind);
                  return (
                    <li
                      key={t.id}
                      className="flex flex-col gap-3 rounded-xl border border-amber-100 border-l-4 border-l-amber-400 bg-amber-50/40 p-4 dark:border-amber-900/35 dark:border-l-amber-500 dark:bg-amber-950/25 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kind.pillClass}`}>
                            {kind.label}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            {formatActivityDateTime(t.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.label}</p>
                        {t.extraDetail ? (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t.extraDetail}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 sm:pt-1">
                        {t.primaryUrl ? (
                          <a
                            href={t.primaryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                          >
                            {t.primaryUrlLabel ?? "Open link"}
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
