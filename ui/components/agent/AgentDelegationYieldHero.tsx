"use client";

import { useMemo, type ReactNode } from "react";
import {
  formatEthDisplay,
  getDelegationYieldSnapshot,
  type DelegationYieldSnapshot,
} from "@/lib/delegation-yield-snapshot";

/** Grouped bars: Swap / Perps / Predict — gain up (emerald), loss down (rose). */
function ServicePnLChart({ snap }: { snap: DelegationYieldSnapshot }) {
  const rows = useMemo(
    () =>
      [
        {
          key: "swap",
          label: "Swap",
          gain: snap.servicePnL.swap.gainEth,
          loss: snap.servicePnL.swap.lossEth,
        },
        {
          key: "perps",
          label: "Perps",
          gain: snap.servicePnL.perps.gainEth,
          loss: snap.servicePnL.perps.lossEth,
        },
        {
          key: "predict",
          label: "Predict",
          gain: snap.servicePnL.predict.gainEth,
          loss: snap.servicePnL.predict.lossEth,
        },
      ] as const,
    [snap.servicePnL],
  );

  const layout = useMemo(() => {
    const peak = Math.max(...rows.flatMap((r) => [r.gain, r.loss]), 1e-18);
    const scaleMax = peak > 0 ? peak * 1.08 : 1;
    const baselineY = 100;
    const plotH = 72;
    const barW = 11;
    const groupGap = 52;
    const startX = 34;

    const yAt = (v: number) => baselineY - (v / scaleMax) * plotH;

    const groups = rows.map((r, i) => {
      const cx = startX + i * groupGap;
      const gainY = yAt(r.gain);
      const gainH = Math.max(0, baselineY - gainY);
      const lossH = (r.loss / scaleMax) * plotH;
      return {
        ...r,
        cx,
        gainY,
        gainH: Math.max(gainH, r.gain > 0 ? 0.5 : 0),
        lossY: baselineY,
        lossH: Math.max(lossH, r.loss > 0 ? 0.5 : 0),
        barW,
      };
    });

    return { baselineY, scaleMax, groups };
  }, [rows]);

  const summary = rows
    .map(
      (r) =>
        `${r.label}: +${formatEthDisplay(r.gain)} / −${formatEthDisplay(r.loss)} ETH`,
    )
    .join(" · ");

  return (
    <div className="flex h-full w-full items-center justify-center" title={summary}>
      <svg
        viewBox="0 0 238 118"
        className="h-[104px] w-[210px] shrink-0 sm:h-[112px] sm:w-[226px]"
        role="img"
        aria-label={`P&amp;L by venue (ETH): ${summary}`}
      >
        <title>{summary}</title>

        <g>
          <title>Baseline</title>
          <line
            x1="14"
            y1={layout.baselineY}
            x2="224"
            y2={layout.baselineY}
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeWidth="1.25"
          />
        </g>

        {layout.groups.map((g) => (
          <g key={g.key}>
            <title>{`${g.label}: gains +${formatEthDisplay(g.gain)} ETH, losses ${formatEthDisplay(g.loss)} ETH`}</title>
            <rect
              x={g.cx - g.barW - 3}
              y={g.gainY}
              width={g.barW}
              height={g.gainH}
              rx="2"
              className="fill-emerald-500/92 dark:fill-emerald-400/88"
            />
            <rect
              x={g.cx + 3}
              y={g.lossY}
              width={g.barW}
              height={g.lossH}
              rx="2"
              className="fill-rose-500/90 dark:fill-rose-400/82"
            />
            <text
              x={g.cx}
              y={layout.baselineY + 13}
              textAnchor="middle"
              fontSize="8"
              className="fill-zinc-500 dark:fill-zinc-400"
            >
              {g.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Wins on top half, Losses on bottom half — equal row height share. */
function WinsLossesSplitCard({
  winsEth,
  lossesEth,
  className = "",
}: {
  winsEth: number;
  lossesEth: number;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200/85 shadow-sm ring-1 ring-inset ring-zinc-400/10 dark:border-zinc-600/80 dark:ring-zinc-500/10 ${className}`}
    >
      <div className="flex min-h-0 flex-1 flex-col justify-center border-b border-zinc-200/75 bg-emerald-50/95 px-2 py-1.5 dark:border-zinc-700 dark:bg-emerald-950/40">
        <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
          Wins
        </dt>
        <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-emerald-950 dark:text-emerald-100 sm:text-base">
          {formatEthDisplay(winsEth)}
          <span className="ml-0.5 text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
            ETH
          </span>
        </dd>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center bg-rose-50/95 px-2 py-1.5 dark:bg-rose-950/40">
        <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-300">
          Losses
        </dt>
        <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-rose-950 dark:text-rose-100 sm:text-base">
          {formatEthDisplay(lossesEth)}
          <span className="ml-0.5 text-[10px] font-normal text-rose-700 dark:text-rose-400">
            ETH
          </span>
        </dd>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  variant,
  className = "",
}: {
  label: string;
  value: ReactNode;
  variant:
    | "sky"
    | "transparent"
    | "emerald"
    | "rose"
    | "violet"
    | "neutral"
    | "netPos"
    | "netNeg";
  className?: string;
}) {
  const shell =
    variant === "sky"
      ? "border-sky-200/90 bg-sky-50/95 ring-sky-500/15 dark:border-sky-800/80 dark:bg-sky-950/45 dark:ring-sky-400/10"
      : variant === "emerald"
        ? "border-emerald-200/90 bg-emerald-50/95 ring-emerald-500/15 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:ring-emerald-400/10"
        : variant === "rose"
          ? "border-rose-200/90 bg-rose-50/95 ring-rose-500/15 dark:border-rose-900/55 dark:bg-rose-950/35 dark:ring-rose-400/10"
          : variant === "violet"
            ? "border-violet-200/90 bg-violet-50/95 ring-violet-500/15 dark:border-violet-900/55 dark:bg-violet-950/40 dark:ring-violet-400/10"
            : variant === "netPos"
              ? "border-emerald-200/85 bg-emerald-50/90 ring-emerald-500/15 dark:border-emerald-900/55 dark:bg-emerald-950/40 dark:ring-emerald-400/10"
              : variant === "netNeg"
                ? "border-rose-200/85 bg-rose-50/90 ring-rose-500/15 dark:border-rose-900/55 dark:bg-rose-950/40 dark:ring-rose-400/10"
                : "border-zinc-200/90 bg-zinc-50/90 ring-zinc-400/10 dark:border-zinc-700/70 dark:bg-zinc-900/50 dark:ring-zinc-500/10";

  const cardFrame =
    variant === "transparent"
      ? `flex h-full min-h-0 flex-col justify-center items-end text-right rounded-lg border-0 bg-transparent px-2 py-2 shadow-none ring-0 sm:px-2.5 sm:py-2 ${className}`
      : `flex h-full min-h-0 flex-col justify-center rounded-lg border px-2 py-2 shadow-sm ring-1 ring-inset sm:px-2.5 sm:py-2 ${shell} ${className}`;

  return (
    <div className={cardFrame}>
      <dt
        className={`truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
          variant === "transparent" ? "w-full text-right" : ""
        }`}
      >
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums leading-tight sm:text-base ${
          variant === "sky"
            ? "text-sky-950 dark:text-sky-100"
            : variant === "transparent"
              ? "text-sky-900 dark:text-sky-100"
              : variant === "emerald"
                ? "text-emerald-900 dark:text-emerald-200"
                : variant === "rose"
                  ? "text-rose-900 dark:text-rose-200"
                  : variant === "violet"
                    ? "text-violet-950 dark:text-violet-200"
                    : variant === "netPos"
                      ? "text-emerald-900 dark:text-emerald-200"
                      : variant === "netNeg"
                        ? "text-rose-900 dark:text-rose-200"
                        : "text-zinc-900 dark:text-zinc-100"
        } ${variant === "transparent" ? "w-full text-right" : ""}`}
      >
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-zinc-500 dark:text-zinc-400 sm:text-xs">
          ETH
        </span>
      </dd>
    </div>
  );
}

/** Metrics row + venue P&amp;L chart (delegated left, chart, then wins/losses / net / book). */
export function AgentDelegationMetricsStrip({
  ensDelegatedAmount,
}: {
  ensDelegatedAmount: string | null | undefined;
}) {
  const snap = useMemo(
    () => getDelegationYieldSnapshot(ensDelegatedAmount),
    [ensDelegatedAmount],
  );

  const netPositive = snap.netTradingEth > 0;
  const netNegative = snap.netTradingEth < 0;

  return (
    <section
      aria-label="Delegation amounts and outcomes"
      className="w-full rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white to-zinc-50/85 px-2 py-2 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-900/45 dark:from-sky-950/35 dark:via-zinc-950 dark:to-zinc-950 dark:ring-sky-400/10 sm:px-3 sm:py-2.5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3 md:gap-4">
        <div className="flex min-h-[120px] w-full min-w-0 flex-col justify-center self-stretch bg-transparent px-2 py-1 sm:min-h-[128px] sm:w-auto sm:max-w-[7.5rem] sm:flex-none sm:shrink-0 sm:pr-1 md:max-w-[8rem] md:pr-2">
          <dl className="m-0 min-w-0 bg-transparent">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Delegated
            </dt>
            <dd className="mt-0.5 truncate font-mono text-base font-semibold tabular-nums leading-tight text-sky-900 dark:text-sky-100 sm:text-lg" title={formatEthDisplay(snap.delegatedEth) + " ETH"}>
              {formatEthDisplay(snap.delegatedEth)}
              <span className="ml-0.5 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                ETH
              </span>
            </dd>
          </dl>
        </div>

        <div className="flex min-h-[120px] shrink-0 flex-col justify-center self-stretch rounded-lg border border-sky-200/80 bg-white/90 px-2 py-2 shadow-sm ring-1 ring-inset ring-zinc-950/[0.05] dark:border-sky-900/50 dark:bg-zinc-900/50 dark:ring-white/[0.06] sm:min-h-[128px] sm:max-w-[240px]">
          <ServicePnLChart snap={snap} />
        </div>

        <div className="flex min-h-[120px] min-w-0 w-full flex-nowrap items-stretch gap-1.5 self-stretch overflow-x-auto pb-0.5 sm:min-h-[128px] sm:basis-0 sm:flex-[3] sm:gap-2 md:gap-3">
          <WinsLossesSplitCard
            className="min-w-0 flex-1 basis-0"
            winsEth={snap.realizedWinsEth}
            lossesEth={snap.realizedLossesEth}
          />
          <MetricCard
            className="min-w-0 flex-1 basis-0"
            label="Net P&L"
            variant={
              netPositive ? "netPos" : netNegative ? "netNeg" : "neutral"
            }
            value={
              snap.netTradingEth === 0
                ? "0"
                : `${netPositive ? "+" : ""}${formatEthDisplay(snap.netTradingEth)}`
            }
          />
          <MetricCard
            className="min-w-0 flex-1 basis-0"
            label="Book"
            variant="transparent"
            value={formatEthDisplay(snap.bookEth)}
          />
        </div>
      </div>
    </section>
  );
}

/** Vertical stack: initial (sky), gains (emerald), losses drawdown (rose), book (violet dashed). Tooltips via <title>. */
function DelegationOutcomeDiagram({ snap }: { snap: DelegationYieldSnapshot }) {
  const D = snap.delegatedEth;
  const W = snap.realizedWinsEth;
  const L = snap.realizedLossesEth;
  const book = snap.bookEth;
  const peak = D + W;

  const layout = useMemo(() => {
    const norm = Math.max(peak, book, D, 1e-18);
    const scaleMax = norm > 0 ? norm * 1.06 : 1;
    const baselineY = 158;
    const plotH = 104;
    const barW = 46;
    const cx = 86;

    const yAt = (v: number) => baselineY - (v / scaleMax) * plotH;

    const yD = yAt(D);
    const yPeak = yAt(peak);
    const yBook = yAt(book);

    return {
      baselineY,
      scaleMax,
      cx,
      barW,
      yD,
      yPeak,
      yBook,
      delH: Math.max(0, baselineY - yD),
      delY: yD,
      winH: Math.max(0, yD - yPeak),
      winY: yPeak,
      lossH: L > 0 && peak > book ? Math.max(0, yBook - yPeak) : 0,
      lossY: yPeak,
    };
  }, [D, W, L, peak, book]);

  const lossActive = L > 0 && layout.lossH > 0.5;

  const summary = `Initial ${formatEthDisplay(D)} ETH · Gains +${formatEthDisplay(W)} · Losses −${formatEthDisplay(L)} · Book ${formatEthDisplay(book)} ETH`;

  return (
    <div className="flex justify-center" title={summary}>
      <svg
        viewBox="0 0 172 164"
        className="h-[108px] w-[106px] shrink-0 sm:h-[120px] sm:w-[118px]"
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>

        <g>
          <title>Baseline (0 ETH)</title>
          <line
            x1="24"
            y1={layout.baselineY}
            x2="148"
            y2={layout.baselineY}
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeWidth="1.25"
          />
        </g>

        <g>
          <title>{`Initial delegation — ${formatEthDisplay(D)} ETH`}</title>
          <rect
            x={layout.cx - layout.barW / 2}
            y={layout.delY}
            width={layout.barW}
            height={Math.max(layout.delH, D === 0 ? 1.25 : 0)}
            rx="4"
            className="fill-sky-500/92 dark:fill-sky-400/88"
          />
        </g>

        <g>
          <title>{`Gains — +${formatEthDisplay(W)} ETH`}</title>
          <rect
            x={layout.cx - layout.barW / 2}
            y={layout.winY}
            width={layout.barW}
            height={Math.max(layout.winH, 0)}
            rx="4"
            className="fill-emerald-500/93 dark:fill-emerald-400/88"
          />
        </g>

        {lossActive ? (
          <g>
            <title>{`Losses (drawdown from peak) — −${formatEthDisplay(L)} ETH`}</title>
            <rect
              x={layout.cx - layout.barW / 2}
              y={layout.lossY}
              width={layout.barW}
              height={layout.lossH}
              rx="3"
              className="fill-rose-500/88 dark:fill-rose-400/82"
            />
          </g>
        ) : null}

        <g>
          <title>{`Book — ${formatEthDisplay(book)} ETH`}</title>
          <line
            x1="22"
            y1={layout.yBook}
            x2="150"
            y2={layout.yBook}
            className="stroke-violet-500/85 dark:stroke-violet-400/75"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </g>

        {W > 0 ? (
          <g>
            <title>Peak after gains</title>
            <line
              x1={layout.cx + layout.barW / 2 + 6}
              y1={layout.yPeak}
              x2="150"
              y2={layout.yPeak}
              className="stroke-emerald-600/40 dark:stroke-emerald-400/35"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/** Outcome waterfall diagram only (narrow left column next to live chat). */
export function AgentDelegationOutcomeDiagramPanel({
  ensDelegatedAmount,
}: {
  ensDelegatedAmount: string | null | undefined;
}) {
  const snap = useMemo(
    () => getDelegationYieldSnapshot(ensDelegatedAmount),
    [ensDelegatedAmount],
  );

  return (
    <div className="flex h-full min-h-0 w-full justify-center rounded-xl border border-sky-100/90 bg-white/80 px-3 py-3 shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-sky-900/40 dark:bg-zinc-900/40 dark:ring-white/[0.06] sm:justify-start">
      <DelegationOutcomeDiagram snap={snap} />
    </div>
  );
}
