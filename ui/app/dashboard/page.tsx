"use client";

import {
  type AgentEngagementStatus,
  formatDomain,
  type InterestDomain,
  mockDelegatedAgents,
  mockEnsIdentity,
  mockUserProfile,
  shortAddress,
} from "@/lib/mock-dashboard";
import {
  useAccount,
  useChainId,
  useEnsAvatar,
  useEnsName,
  useEnsText,
} from "wagmi";

/** ENS text records often store ipfs:// or https URLs for assets. */
function ensAssetUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = raw.trim();
  if (u.startsWith("ipfs://")) {
    const path = u.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  return u;
}

const domainCardAccent: Record<InterestDomain, string> = {
  geopolitic: "border-t-amber-500",
  crypto: "border-t-emerald-500",
  soccer: "border-t-rose-500",
  energy: "border-t-sky-500",
};

const statusPresentation: Record<
  AgentEngagementStatus,
  { label: string; pillClass: string }
> = {
  active: {
    label: "Active",
    pillClass:
      "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200",
  },
  paused: {
    label: "Paused",
    pillClass:
      "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  },
  ending_soon: {
    label: "Ending soon",
    pillClass:
      "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
};

function formatEngagementDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardPage() {
  const user = mockEnsIdentity;
  const profile = mockUserProfile;
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: name } = useEnsName({ address, chainId });
  const { data: avatar } = useEnsAvatar({
    name: name ?? "",
    chainId,
  });
  const {
    data: ensProfilText,
    isPending: ensProfilPending,
    isSuccess: ensProfilLoaded,
  } = useEnsText({
    name: name ?? "",
    key: "profile",
    chainId,
    query: { enabled: Boolean(name) },
  });

  const ensQuery = { query: { enabled: Boolean(name) } as const };
  const { data: headerBanner } = useEnsText({
    name: name ?? "",
    key: "header",
    chainId,
    ...ensQuery,
  });
  const { data: coverBanner } = useEnsText({
    name: name ?? "",
    key: "cover",
    chainId,
    ...ensQuery,
  });
  const { data: logoRecord } = useEnsText({
    name: name ?? "",
    key: "logo",
    chainId,
    ...ensQuery,
  });

  const bannerSrc = ensAssetUrl(headerBanner ?? coverBanner ?? undefined);
  const logoSrc = ensAssetUrl(logoRecord ?? undefined);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Connected
          </p>
        </div>
        {/* Identity */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {/* Cover + gradient fallback */}
          <div className="relative h-36 sm:h-44">
            {bannerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary ENS / IPFS URLs
              <img
                src={bannerSrc}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full bg-gradient-to-br from-slate-200/90 via-slate-100 to-slate-300/80 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950"
                aria-hidden
              />
            )}
            <div
              className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-zinc-950/10 to-transparent dark:from-zinc-950/70"
              aria-hidden
            />
          </div>

          <div className="relative px-5 pb-6 pt-0 sm:px-8">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4 -mt-14 sm:-mt-16">
              {logoSrc ? (
                <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-lg ring-4 ring-white dark:border-zinc-600 dark:bg-zinc-900 dark:ring-zinc-950 sm:h-[5.25rem] sm:w-[5.25rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div
                className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-lg ring-4 ring-white dark:border-zinc-600 dark:bg-zinc-800 dark:ring-zinc-950 ${logoSrc ? "h-14 w-14 sm:h-16 sm:w-16" : "h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]"}`}
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    ENS
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 min-w-0 sm:mt-6">
              <p className="mt-2 max-w-full text-pretty break-words text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                {name ?? "—"}
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {shortAddress(address ?? "")}
                </span>
              </p>
            </div>

            <div className="mt-6 min-w-0 space-y-5 border-t border-zinc-100 pt-6 dark:border-zinc-800">

              <div>
                <ul className="mt-2 space-y-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {(ensProfilLoaded && ensProfilText != null
                    ? [{ key: "profile", value: ensProfilText || "—" }]
                    : []
                  ).concat(user.records).map((r) => (
                    <li key={r.key} className="flex flex-wrap gap-2">
                      <span className="text-zinc-500 dark:text-zinc-500">
                        {r.key}
                      </span>
                      <span className="break-all text-zinc-800 dark:text-zinc-200">
                        {r.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Profile — compact two-column row */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8 md:items-start">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Domains of interest
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.interests.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {formatDomain(d)}
                  </span>
                ))}
                
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Macro theses
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {profile.macroTheses.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex max-w-full items-baseline gap-0.5 rounded-md border border-zinc-200/80 bg-zinc-50/80 px-1.5 py-0.5 text-[10px] leading-snug text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900/30 dark:text-zinc-400"
                  >
                    <span
                      className="shrink-0 select-none font-serif text-[10px] text-zinc-400 dark:text-zinc-500"
                      aria-hidden
                    >
                    </span>
                    <span className="min-w-0">{t}</span>
                    <span
                      className="shrink-0 select-none font-serif text-[10px] text-zinc-400 dark:text-zinc-500"
                      aria-hidden
                    >
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Delegated agents — hired agent roster */}
        <section>

          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mockDelegatedAgents.map((agent) => {
              const st = statusPresentation[agent.status];
              return (
                <li
                  key={agent.id}
                  className={`flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 border-t-4 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${domainCardAccent[agent.domain]}`}
                >
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex gap-3">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-sm font-bold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                        aria-hidden
                      >
                        {agentInitials(agent.displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-zinc-950 dark:text-zinc-50">
                            {agent.displayName}
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${st.pillClass}`}
                          >
                            {st.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDomain(agent.domain)} · {agent.profileType}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Delegated assets
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {agent.delegatedAssets}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Engagement
                        </p>
                        <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                          {formatEngagementDate(agent.engagementStart)} →{" "}
                          {formatEngagementDate(agent.engagementEnd)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Contract
                        </p>
                        <p
                          className="mt-0.5 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
                          title={agent.contractAddress}
                        >
                          {shortAddress(agent.contractAddress, 5)}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {agent.contractLabel}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Service
                      </p>
                      <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {agent.serviceSummary}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
