"use client";

import { useMemo, type ReactNode } from "react";
import {
  formatEthDisplay,
  getDelegationYieldSnapshot,
  type DelegationYieldSnapshot,
} from "@/lib/delegation-yield-snapshot";

/** Vertical stack: initial (sky), gains (emerald), losses drawdown (rose), book (violet dashed). Tooltips via &lt;title&gt;. */
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

function MetricCard({
  label,
  value,
  variant,
  className = "",
}: {
  label: string;
  value: ReactNode;
  variant: "sky" | "emerald" | "rose" | "violet" | "neutral" | "netPos" | "netNeg";
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

  return (
    <div
      className={`rounded-lg border px-2 py-2 shadow-sm ring-1 ring-inset sm:px-2.5 sm:py-2 ${shell} ${className}`}
    >
      <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums leading-tight sm:text-base ${
          variant === "sky"
            ? "text-sky-950 dark:text-sky-100"
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
        }`}
      >
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-zinc-500 dark:text-zinc-400 sm:text-xs">
          ETH
        </span>
      </dd>
    </div>
  );
}

/** Full-width row: Delegated, Wins, Losses, Net P&amp;L, Book — equal columns. */
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
      <div className="flex w-full min-w-0 gap-1.5 sm:gap-2 md:gap-3">
        <MetricCard
          className="min-w-0 flex-1 basis-0"
          label="Delegated"
          variant="sky"
          value={formatEthDisplay(snap.delegatedEth)}
        />
        <MetricCard
          className="min-w-0 flex-1 basis-0"
          label="Wins"
          variant="emerald"
          value={formatEthDisplay(snap.realizedWinsEth)}
        />
        <MetricCard
          className="min-w-0 flex-1 basis-0"
          label="Losses"
          variant="rose"
          value={formatEthDisplay(snap.realizedLossesEth)}
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
          variant="violet"
          value={formatEthDisplay(snap.bookEth)}
        />
      </div>
    </section>
  );
}

/** Outcome waterfall diagram only (for row below the metrics strip). */
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
