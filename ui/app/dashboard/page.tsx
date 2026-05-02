"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AgenticSubdomainAgentCard } from "@/components/AgenticSubdomainAgentCard";
import { useUserAgenticSubdomains } from "@/hooks/useUserAgenticSubdomains";
import { mockEnsIdentity, shortAddress } from "@/lib/mock-dashboard";
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

function friendlyRecordLabel(key: string): string {
  const map: Record<string, string> = {
    profile: "Bio",
    url: "Website",
    "com.twitter": "X / Twitter",
    description: "About",
  };
  return map[key] ?? key.replace(/[._]/g, " ");
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M9.5 1.5c.3 0 .6.2.7.5l1.1 3.2 3.2 1.1a.8.8 0 010 1.5l-3.2 1.1-1.1 3.2a.8.8 0 01-1.5 0l-1.1-3.2-3.2-1.1a.8.8 0 010-1.5l3.2-1.1 1.1-3.2c.1-.3.4-.5.7-.5zm10 8c.3 0 .6.2.7.5l.7 2 .8.3c.5.2.5.9 0 1.1l-.8.3-.7 2a.8.8 0 01-1.5 0l-.7-2-2-.7a.8.8 0 010-1.5l2-.7.7-2c.1-.3.4-.5.7-.5zm-6 5.5c.3 0 .6.2.7.5l.9 2.6 2.6.9c.5.2.5.9 0 1.1l-2.6.9-.9 2.6a.8.8 0 01-1.5 0l-.9-2.6-2.6-.9a.8.8 0 010-1.1l2.6-.9.9-2.6c.1-.3.4-.5.7-.5z" />
    </svg>
  );
}

export default function DashboardPage() {
  const user = mockEnsIdentity;
  const { address } = useAccount();
  const {
    data: agenticSubdomains,
    isPending: agenticListPending,
    isError: agenticListError,
    error: agenticListErr,
  } = useUserAgenticSubdomains(address);
  const chainId = useChainId();
  const { data: name } = useEnsName({ address, chainId });
  const { data: avatar } = useEnsAvatar({
    name: name ?? "",
    chainId,
  });
  const {
    data: ensProfilText,
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

  const displayFirstName = useMemo(() => {
    if (!name?.trim()) return null;
    const seg = name.split(".")[0]?.trim();
    if (!seg) return name;
    return seg.slice(0, 1).toUpperCase() + seg.slice(1);
  }, [name]);

  const heroSubtitle = address
    ? "Here’s your ENS identity and the agents you’ve brought to life."
    : "Connect your wallet to see your profile and agents in one calm place.";

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-50/80 via-zinc-50 to-amber-50/30 font-sans dark:from-slate-950 dark:via-zinc-950 dark:to-slate-950">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(56,189,248,0.12),transparent)] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]"
        aria-hidden
      />
      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200/60 bg-white/80 px-3 py-1 text-[11px] font-medium text-sky-800 shadow-sm backdrop-blur-sm dark:border-sky-800/50 dark:bg-slate-900/70 dark:text-sky-200">
              <SparklesIcon className="h-3.5 w-3.5 text-amber-400 dark:text-amber-300" />
              Your dashboard
            </div>
            <h1 className="mt-1 max-w-xl text-balance text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              {address
                ? displayFirstName
                  ? `Welcome back, ${displayFirstName}`
                  : "Welcome back"
                : "Almost there"}
            </h1>
            <p className="mt-2 max-w-lg text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {heroSubtitle}
            </p>
          </div>
        </header>

        {/* Identity — subtle hover (no movement) */}
        <section
          aria-label="Your ENS profile"
          className={
            "relative overflow-hidden rounded-3xl border border-zinc-200/90 " +
            "border-t-[5px] border-t-sky-400 bg-white/95 shadow-md shadow-zinc-900/5 backdrop-blur-[2px] " +
            "transition-[box-shadow,border-color] duration-200 ease-out " +
            "hover:border-sky-300/90 hover:border-t-sky-400 " +
            "hover:shadow-lg hover:shadow-sky-900/[0.06] " +
            "dark:border-zinc-700/90 dark:bg-zinc-950/90 dark:hover:border-sky-700/90 dark:hover:border-t-sky-400 " +
            "dark:hover:shadow-xl dark:hover:shadow-black/40"
          }
        >
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
                className="h-full w-full bg-gradient-to-br from-sky-100 via-indigo-50 to-amber-50 dark:from-slate-800 dark:via-sky-950/40 dark:to-slate-950"
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
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-sky-100/90 to-indigo-100/80 text-[10px] font-medium text-sky-800 dark:from-slate-700 dark:to-slate-800 dark:text-sky-200/90">
                    <span className="text-lg leading-none" aria-hidden>
                      ✦
                    </span>
                    <span className="px-1 text-center leading-tight">You</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 min-w-0 sm:mt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                ENS name
              </p>
              <p className="mt-1 max-w-full text-pretty break-words text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                {name ?? "Connect a wallet to show your name"}
              </p>
              <p className="mt-3 text-[13px] text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  Wallet
                </span>{" "}
                <span className="font-mono text-xs text-zinc-700 tabular-nums dark:text-zinc-300">
                  {address ? shortAddress(address) : "—"}
                </span>
              </p>
            </div>

            <div className="mt-6 min-w-0 space-y-4 border-t border-zinc-100/90 pt-6 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                On your profile
              </h2>
              {(ensProfilLoaded && ensProfilText != null
                ? [{ key: "profile", value: ensProfilText || "—" }]
                : []
              ).concat(user.records).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
                  Add a short bio and links in the ENS app— they’ll show up
                  here automatically.
                </p>
              ) : (
                <ul className="space-y-3">
                  {(ensProfilLoaded && ensProfilText != null
                    ? [{ key: "profile", value: ensProfilText || "—" }]
                    : []
                  ).concat(user.records).map((r) => (
                    <li
                      key={r.key}
                      className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        {friendlyRecordLabel(r.key)}
                      </p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                        {r.value}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>


        {/* Agents */}
        <section aria-labelledby="agents-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="agents-heading"
                className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                Your agents
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Each card is an{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  agentic.eth
                </span>{" "}
                name you own—tap a card to see how it perceives, reasons, and
                acts.
              </p>
            </div>
            <Link
              href="/#register-agent"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              Register another agent
            </Link>
          </div>

          {!address ? (
            <div className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                Connect your wallet to see your agents
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                We’ll load the names tied to your address—nothing to configure
                here.
              </p>
            </div>
          ) : agenticListPending ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span
                className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 dark:border-sky-900 dark:border-t-sky-400"
                aria-hidden
              />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Gathering your agents…
              </p>
            </div>
          ) : agenticListError ? (
            <div className="mt-6 rounded-2xl border border-rose-200/90 bg-rose-50/90 px-5 py-4 text-sm text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
              <p className="font-medium">We couldn’t refresh this list</p>
              <p className="mt-1 text-rose-900/90 dark:text-rose-200/95">
                {agenticListErr instanceof Error
                  ? agenticListErr.message
                  : "Something went wrong."}{" "}
                Try again in a moment.
              </p>
            </div>
          ) : agenticSubdomains?.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-zinc-200/90 bg-gradient-to-br from-white to-sky-50/40 px-6 py-10 text-center dark:border-zinc-800 dark:from-zinc-950 dark:to-sky-950/20">
              <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                No agents yet under agentic.eth
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Create your first handle on the home page—it only takes two quick
                confirmations on Sepolia.
              </p>
              <Link
                href="/#register-agent"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                Create an agent
              </Link>
            </div>
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {agenticSubdomains!.map((row) => (
                <AgenticSubdomainAgentCard key={row.name} row={row} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
