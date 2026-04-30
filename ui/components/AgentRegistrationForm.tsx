"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { waitForTransactionReceipt } from "viem/actions";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  MARKETPLACE_AGENTS,
  agenticSubdomainAbi,
  getRegistrarAddress,
  INTEREST_TOPICS,
  nameWrapperViewAbi,
  validateEnsLabel,
  type InterestTopicValue,
  type MarketplaceAgent,
  type MarketplaceAgentId,
} from "@/lib/agentic-registrar";

function readExpiryFromGetData(data: unknown): bigint | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data) && data.length >= 3) {
    const v = data[2];
    return typeof v === "bigint" ? v : BigInt(String(v));
  }
  if (typeof data === "object" && data !== null && "expiry" in data) {
    const v = (data as { expiry: bigint | number | string }).expiry;
    return typeof v === "bigint" ? v : BigInt(String(v));
  }
  return undefined;
}

function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function contractorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block border-l-2 border-slate-300 pl-2.5 text-[11px] font-semibold tracking-[0.12em] text-slate-600 uppercase dark:border-slate-600 dark:text-slate-400"
    >
      {children}
    </label>
  );
}

const REGISTRATION_STEPS = [
  { id: "step-overview", label: "Overview" },
  { id: "step-focus", label: "Define focus" },
  { id: "step-thesis", label: "Thesis" },
  { id: "step-agent", label: "Choose agent" },
  { id: "step-claim", label: "Claim name" },
  { id: "step-register", label: "Register" },
] as const;

type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

/** Breadcrumb / step links aligned with form sections */
function RegistrationStepsNav({
  navClassName = "border-b border-slate-100 bg-slate-50/90 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40",
}: {
  navClassName?: string;
}) {
  const [activeId, setActiveId] = useState<RegistrationStepId>("step-overview");

  useEffect(() => {
    const headerReserve = 72;

    function updateActive() {
      let current: RegistrationStepId = "step-overview";
      for (const { id } of REGISTRATION_STEPS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= headerReserve) current = id;
      }
      setActiveId(current);
    }

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  return (
    <nav aria-label="Registration steps" className={navClassName}>
      <ol className="flex list-none flex-wrap items-center gap-x-1.5 gap-y-2 pl-0 text-[11px] font-medium">
        {REGISTRATION_STEPS.map((step, i) => {
          const isActive = activeId === step.id;
          return (
            <li key={step.id} className="flex items-center gap-x-1.5">
              {i > 0 ? (
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  /
                </span>
              ) : null}
              <a
                href={`#${step.id}`}
                className={`rounded-md px-1.5 py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                  isActive
                    ? "bg-slate-200/90 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                {step.label}
              </a>
            </li>
          );
        })}
        <li className="flex items-center gap-x-1.5">
          <span className="text-slate-300 dark:text-slate-600" aria-hidden>
            /
          </span>
          <span className="text-slate-400 dark:text-slate-600">
            Perceive · Reason · Act
          </span>
        </li>
      </ol>
      <p className="mt-1.5 max-w-2xl text-[10px] leading-snug text-slate-400 dark:text-slate-600">
        Post-registration execution loop (outside this form).
      </p>
    </nav>
  );
}

export function AgentRegistrationForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const registrar = useMemo(() => getRegistrarAddress(), []);

  const [selectedInterests, setSelectedInterests] = useState<
    InterestTopicValue[]
  >([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState<MarketplaceAgentId>("strategist");
  const [labelInput, setLabelInput] = useState("");
  const [thesisPrompt, setThesisPrompt] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: parentNode } = useReadContract({
    address: registrar,
    abi: agenticSubdomainAbi,
    functionName: "parentNode",
    chainId: sepolia.id,
  });

  const { data: nameWrapperAddress } = useReadContract({
    address: registrar,
    abi: agenticSubdomainAbi,
    functionName: "nameWrapper",
    chainId: sepolia.id,
  });

  const parentId =
    parentNode !== undefined
      ? BigInt(parentNode as `0x${string}`)
      : undefined;

  const { data: parentWrap, error: expiryError } = useReadContract({
    address: nameWrapperAddress,
    abi: nameWrapperViewAbi,
    functionName: "getData",
    args: parentId !== undefined ? [parentId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled:
        Boolean(nameWrapperAddress) &&
        parentId !== undefined &&
        nameWrapperAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  const parentExpiry = readExpiryFromGetData(parentWrap);

  const { writeContractAsync } = useWriteContract();

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatusMsg(null);

      if (!isConnected || !address) {
        setStatusMsg("Connect your wallet first.");
        return;
      }

      if (chainId !== sepolia.id) {
        try {
          await switchChainAsync({ chainId: sepolia.id });
        } catch {
          setStatusMsg("Switch to the Sepolia network to register.");
          return;
        }
      }

      const labelErr = validateEnsLabel(labelInput);
      if (labelErr) {
        setStatusMsg(labelErr);
        return;
      }
      const label = labelInput.trim().toLowerCase();

      if (parentExpiry === undefined) {
        setStatusMsg(
          expiryError
            ? "Could not read parent expiry on Sepolia. Check your RPC."
            : "Loading parent expiry… try again in a moment.",
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const expiry =
          parentExpiry > BigInt("18446744073709551615")
            ? BigInt("18446744073709551615")
            : parentExpiry;

        const hash = await writeContractAsync({
          address: registrar,
          abi: agenticSubdomainAbi,
          functionName: "setSubdomain",
          args: [label, address, expiry],
          chainId: sepolia.id,
        });
        const receipt = publicClient
          ? await waitForTransactionReceipt(publicClient, { hash })
          : null;
        if (receipt?.status === "success" || !publicClient) {
          setStatusMsg(
            publicClient
              ? `Confirmed. Subdomain « ${label}.agentic.eth » created (tx: ${hash.slice(0, 10)}…).`
              : `Transaction sent: ${hash.slice(0, 10)}… — check Sepolia explorer.`,
          );
        } else if (receipt) {
          setStatusMsg("The transaction failed on-chain.");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Transaction cancelled or error.";
        setStatusMsg(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      address,
      chainId,
      publicClient,
      expiryError,
      isConnected,
      labelInput,
      parentExpiry,
      registrar,
      switchChainAsync,
      writeContractAsync,
    ],
  );

  const selectedAgent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);

  const inputUnderline =
    "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-0 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400";

  return (
    <div className="w-full max-w-4xl">
      <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none dark:ring-white/[0.06]">
        <header className="border-b border-slate-100 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/40">
          <h1 className="sr-only">Registration</h1>
          <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <RegistrationStepsNav navClassName="min-w-0 flex-1 border-0 bg-transparent p-0 dark:bg-transparent" />
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end sm:pt-px">
              <div className="[&_button]:!rounded-lg [&_button]:!text-xs [&_button]:!font-medium">
                <ConnectKitButton />
              </div>
              {isConnected && address ? (
                <p className="text-[11px] text-right whitespace-nowrap">
                  <span className="text-slate-500 dark:text-slate-500">
                    Owner ·{" "}
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {shortenAddress(address)}
                  </span>
                </p>
              ) : (
                <p className="text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Connect to continue
                </p>
              )}
            </div>
          </div>
        </header>

        <form onSubmit={onSubmit} className="px-6 py-8">
          <div className="space-y-10">
            <fieldset
              id="step-overview"
              className="scroll-mt-28"
            >
              <legend className="sr-only">Overview</legend>
              <FieldLabel>Overview</FieldLabel>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                Define your focus and choose an agent suited to the markets you
                care about—prediction markets, crypto, and beyond. Claim{" "}
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  name.agentic.eth
                </span>{" "}
                on Sepolia to register; perceive → reason → act is how execution
                unfolds afterward. Wallet required.
              </p>
            </fieldset>

            {/* Interests */}
            <fieldset id="step-focus" className="scroll-mt-28">
              <legend className="sr-only">Define focus</legend>
              <FieldLabel>Define focus</FieldLabel>
              <p
                id="areas-interest-hint"
                className="mb-3 text-xs text-slate-500 dark:text-slate-500"
              >
                Optional themes for your thesis · not stored on-chain with this
                tx
              </p>
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-100 pb-3 dark:border-slate-800"
                role="group"
                aria-describedby="areas-interest-hint"
              >
                <div className="relative shrink-0">
                  <select
                    aria-label="Add focus theme"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value as InterestTopicValue | "";
                      if (!v || selectedInterests.includes(v)) return;
                      setSelectedInterests((prev) => [...prev, v]);
                      e.target.value = "";
                    }}
                    className="h-8 min-w-[8.5rem] cursor-pointer appearance-none rounded-md border border-slate-200 bg-slate-50/80 py-1 pr-7 pl-2.5 text-xs text-slate-800 outline-none transition hover:border-slate-300 hover:bg-slate-100/80 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400/15 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:focus-visible:ring-slate-500/20"
                  >
                    <option value="">Add topic…</option>
                    {INTEREST_TOPICS.filter(
                      (t) => !selectedInterests.includes(t.value),
                    ).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-500"
                    aria-hidden
                  >
                    ▾
                  </span>
                </div>
                <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {selectedInterests.map((value) => {
                    const topicLabel =
                      INTEREST_TOPICS.find((t) => t.value === value)?.label ??
                      value;
                    return (
                      <li key={value}>
                        <span className="inline-flex max-w-full items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 py-0.5 pr-0.5 pl-2 text-[11px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                          <span className="truncate">{topicLabel}</span>
                          <button
                            type="button"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            aria-label={`Remove ${topicLabel}`}
                            onClick={() =>
                              setSelectedInterests((prev) =>
                                prev.filter((x) => x !== value),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    );
                  })}
                  {selectedInterests.length === 0 ? (
                    <li className="text-xs text-slate-400 italic dark:text-slate-600">
                      None selected
                    </li>
                  ) : null}
                </ul>
              </div>
            </fieldset>

            <fieldset id="step-thesis" className="scroll-mt-28">
              <legend className="sr-only">Thesis</legend>
              <FieldLabel htmlFor="thesis-prompt">Thesis prompt</FieldLabel>
              <p
                id="thesis-prompt-hint"
                className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-500"
              >
                Optional · spell out your thesis and how you analyse markets
                (drivers, evidence, risks). Not stored on-chain with this
                transaction.
              </p>
              <textarea
                id="thesis-prompt"
                name="thesisPrompt"
                rows={5}
                maxLength={4000}
                placeholder="e.g. Core view, what you monitor, what would confirm or invalidate your thesis…"
                value={thesisPrompt}
                onChange={(e) => setThesisPrompt(e.target.value)}
                aria-describedby="thesis-prompt-hint"
                className="w-full max-w-2xl resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-500/20"
              />
            </fieldset>

            {/* Agents */}
            <fieldset id="step-agent" className="scroll-mt-28 space-y-3">
              <FieldLabel>Choose agent</FieldLabel>
              <p className="mb-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                Pick a profile aligned with how you trade or forecast—prediction
                markets, crypto, and other contexts. Access fee (ETH) is per
                agent and is not collected by the ENS registration below.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETPLACE_AGENTS.map((agent: MarketplaceAgent) => {
                  const selected = agent.id === selectedAgentId;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      aria-pressed={selected}
                      className={`flex flex-col rounded-2xl border p-5 text-left transition-all ${
                        selected
                          ? "border-slate-400 bg-slate-50/90 shadow-sm ring-1 ring-slate-900/[0.06] dark:border-slate-500 dark:bg-slate-900/60 dark:ring-white/[0.08]"
                          : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold tracking-tight ${
                              selected
                                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                            aria-hidden
                          >
                            {contractorInitials(agent.name)}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                              {agent.name}
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                              {agent.tagline}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right dark:border-slate-700 dark:bg-slate-900/70">
                          <span className="block font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {agent.accessPriceEth}
                          </span>
                          <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            ETH access
                          </span>
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {agent.description}
                      </p>
                      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-500">
                          Capabilities
                        </p>
                        <ul className="mt-2.5 flex flex-wrap gap-1.5">
                          {agent.capabilities.map((cap) => (
                            <li
                              key={cap}
                              className="rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] leading-tight font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                            >
                              {cap}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {selected ? (
                        <p className="mt-4 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Chosen agent
                        </p>
                      ) : (
                        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-600">
                          Tap to choose
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedAgent ? (
                <p className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  Agent{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAgent.name}
                  </span>{" "}
                  ·{" "}
                  <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {selectedAgent.accessPriceEth} ETH
                  </span>{" "}
                  access —{" "}
                  <span className="text-slate-500 dark:text-slate-500">
                    settle separately from the ENS tx.
                  </span>
                </p>
              ) : null}
            </fieldset>

            {/* ENS label */}
            <fieldset id="step-claim" className="scroll-mt-28">
              <FieldLabel htmlFor="ens-label">Claim name</FieldLabel>
              <div className="flex flex-wrap items-end gap-2 sm:items-center">
                <input
                  id="ens-label"
                  type="text"
                  autoComplete="off"
                  placeholder="myagent"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className={`${inputUnderline} min-w-[10rem] flex-1 sm:max-w-[14rem]`}
                />
                <span className="pb-2.5 font-mono text-sm font-semibold text-slate-600 dark:text-slate-400">
                  .agentic.eth
                </span>
              </div>
            </fieldset>

            {/* Technical */}
            <details className="group text-xs">
              <summary className="cursor-pointer list-none text-slate-500 transition hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[10px] transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  Contract · expiry
                </span>
              </summary>
              <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 font-mono text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-500">
                <p className="break-all">{registrar}</p>
                <p>
                  Parent expiry ·{" "}
                  {parentExpiry !== undefined
                    ? parentExpiry.toString()
                    : expiryError
                      ? "unavailable"
                      : "loading…"}
                </p>
              </div>
            </details>

            {/* Submit */}
            <div id="step-register" className="scroll-mt-28 pt-2">
              <button
                type="submit"
                disabled={
                  !isConnected ||
                  isSubmitting ||
                  parentExpiry === undefined
                }
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:opacity-35"
              >
                {isSubmitting ? "Confirm in wallet…" : "Register on Sepolia"}
              </button>
            </div>
          </div>
        </form>
      </article>

      {statusMsg ? (
        <div
          className="mt-6 rounded-lg border border-slate-200/90 border-l-[3px] border-l-slate-400 bg-slate-50 py-3 pl-4 pr-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:border-l-slate-500 dark:bg-slate-900/60 dark:text-slate-200"
          role="status"
        >
          {statusMsg}
        </div>
      ) : null}
    </div>
  );
}
