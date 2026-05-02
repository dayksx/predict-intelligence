"use client";

import Link from "next/link";
import { AGENTIC_ENS_TEXT_KEYS } from "@/lib/ens-registration-metadata";
import type { UserAgenticSubdomain } from "@/lib/fetch-user-agentic-subdomains";
import { useEnsAvatar, useEnsText } from "wagmi";
import { sepolia } from "wagmi/chains";

function ensSepoliaAppNameUrl(fullName: string): string {
  return `https://sepolia.app.ens.domains/${encodeURIComponent(fullName)}`;
}

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

function formatUnixSeconds(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(n * 1000));
  } catch {
    return null;
  }
}

function labelFromFullName(fullName: string): string {
  const i = fullName.indexOf(".");
  return i === -1 ? fullName : fullName.slice(0, i);
}

function agentInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AgenticSubdomainAgentCard({
  row,
}: {
  row: UserAgenticSubdomain;
}) {
  const chainId = sepolia.id;
  const fullName = row.name;
  const enabled = Boolean(fullName);

  const { data: avatar } = useEnsAvatar({
    name: fullName,
    chainId,
    query: { enabled },
  });
  const { data: headerBanner } = useEnsText({
    name: fullName,
    key: "header",
    chainId,
    query: { enabled },
  });
  const { data: coverBanner } = useEnsText({
    name: fullName,
    key: "cover",
    chainId,
    query: { enabled },
  });
  const { data: logoRecord } = useEnsText({
    name: fullName,
    key: "logo",
    chainId,
    query: { enabled },
  });
  const { data: description } = useEnsText({
    name: fullName,
    key: "description",
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
  const { data: agentNameRecord } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.agentName,
    chainId,
    query: { enabled },
  });
  const { data: delegatedAmount } = useEnsText({
    name: fullName,
    key: AGENTIC_ENS_TEXT_KEYS.delegatedAmount,
    chainId,
    query: { enabled },
  });

  const bannerSrc = ensAssetUrl(headerBanner ?? coverBanner ?? undefined);
  const logoSrc = ensAssetUrl(logoRecord ?? undefined);

  const displayName =
    (agentNameRecord?.trim() ? agentNameRecord.trim() : null) ??
    (row.labelName?.trim() ? row.labelName.trim() : null) ??
    labelFromFullName(fullName);

  const created = formatUnixSeconds(row.createdAt);
  const expires = formatUnixSeconds(row.expiryDate);

  const activitiesHref = `/dashboard/agents/${encodeURIComponent(labelFromFullName(fullName))}`;

  return (
    <li
      className={
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-200 " +
        "border-t-4 border-t-sky-500 bg-white shadow-sm " +
        "transition-[box-shadow,border-color,background-color] duration-200 ease-out " +
        "hover:border-sky-300/90 hover:border-t-sky-500/90 hover:bg-sky-100/45 " +
        "hover:shadow-md hover:shadow-sky-900/[0.07] " +
        "dark:border-zinc-800 dark:bg-zinc-950 " +
        "dark:hover:border-sky-600/80 dark:hover:border-t-sky-400/90 dark:hover:bg-sky-950/55 " +
        "dark:hover:shadow-lg dark:hover:shadow-black/35"
      }
    >
      <Link
        href={activitiesHref}
        className="absolute inset-0 z-[5] rounded-2xl outline-none ring-sky-500/0 transition focus-visible:ring-2 focus-visible:ring-sky-500/70"
        aria-label={`Open activities for ${displayName}`}
      />
      <div className="relative z-[10] flex min-h-0 flex-1 flex-col pointer-events-none">
      <div className="relative h-28 sm:h-32">
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- ENS / IPFS URLs
          <img
            src={bannerSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-br from-sky-200/90 via-sky-50 to-zinc-100 dark:from-sky-950 dark:via-slate-900 dark:to-slate-950"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-zinc-950/5 to-transparent dark:from-zinc-950/65"
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="-mt-10 flex gap-3 sm:-mt-11">
          {logoSrc ? (
            <div className="relative z-10 h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div
            className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-zinc-100 text-sm font-bold text-zinc-700 shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 ${logoSrc ? "h-12 w-12" : "h-14 w-14"}`}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden>{agentInitials(displayName)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-8">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-zinc-950 dark:text-zinc-50">
                {displayName}
              </p>
              <span className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
                Agentic
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-sky-700 dark:text-sky-300">
              {fullName}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              What it watches
            </p>
            <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
              {focusDomain?.trim() ? focusDomain : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              ETH you noted
            </p>
            <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
              {delegatedAmount?.trim() ? (
                <span className="font-mono tabular-nums">
                  {delegatedAmount.trim()} ETH
                </span>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Thesis
          </p>
          <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {thesisPrompt?.trim() ? thesisPrompt.trim() : "—"}
          </p>
        </div>

        {(description?.trim() ?? "") !== "" ? (
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              About
            </p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {description!.trim()}
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Joined
            </p>
            <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
              {created ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Renews
            </p>
            <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
              {expires ?? "—"}
            </p>
          </div>
        </div>

        <div className="relative z-[20] mt-4 flex flex-wrap items-center gap-4 pointer-events-auto">
          <a
            href={ensSepoliaAppNameUrl(fullName)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            onClick={(e) => e.stopPropagation()}
          >
            View on ENS
          </a>
        </div>
      </div>
      </div>
    </li>
  );
}
