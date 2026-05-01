"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  AGENTIC_ENS_TEXT_KEYS,
  buildAgenticRegistrationTextRecords,
  encodeSetTextMulticallPayload,
  ENS_PUBLIC_RESOLVER_ABI,
} from "@/lib/ens-registration-metadata";
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
import { useHasMounted } from "@/lib/useHasMounted";

function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

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

/** Empty string is valid (optional field). */
function validateDelegationEth(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d*\.?\d+$/.test(t) || Number.isNaN(Number(t))) {
    return "Enter a valid ETH amount (e.g. 0.25).";
  }
  const n = Number(t);
  if (n <= 0) return "Delegation amount must be greater than zero.";
  if (n > 1_000_000) return "Amount seems unreasonably large.";
  return null;
}

function contractorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Primary label for individual controls (compact, uppercase). */
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
      className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase dark:text-slate-400"
    >
      {children}
    </label>
  );
}

/** Step / section title — matches breadcrumb wording, sentence case. */
function SectionTitle({
  children,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <Tag className="mb-1 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
      {children}
    </Tag>
  );
}

function HelperText({
  children,
  id,
  className = "",
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      className={`text-xs leading-relaxed text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </p>
  );
}

const formCardClass =
  "rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950 sm:p-6";

function FormStepCard({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-28 ${formCardClass} ${className}`}
    >
      {children}
    </div>
  );
}

/** Section titles: keep in sync with `REGISTRATION_STEPS` labels and form `FieldLabel`s */
const REGISTRATION_SECTION_LABELS = {
  focus: "Share your thesis",
  agent: "Choose your agent",
  delegate: "Amount to delegate",
  claim: "Claim a name",
  register: "Perceive · Reason · Act",
} as const;

const REGISTRATION_STEPS = [
  { id: "step-focus", label: REGISTRATION_SECTION_LABELS.focus },
  { id: "step-agent", label: REGISTRATION_SECTION_LABELS.agent },
  { id: "step-delegate", label: REGISTRATION_SECTION_LABELS.delegate },
  { id: "step-claim", label: REGISTRATION_SECTION_LABELS.claim },
  { id: "step-register", label: REGISTRATION_SECTION_LABELS.register },
] as const;

type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

/** Breadcrumb / step links aligned with form sections */
function RegistrationStepsNav({
  navClassName = "border-b border-slate-100 bg-slate-50/90 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40",
}: {
  navClassName?: string;
}) {
  const [activeId, setActiveId] = useState<RegistrationStepId>("step-focus");

  useEffect(() => {
    const headerReserve = 72;

    function updateActive() {
      let current: RegistrationStepId = "step-focus";
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
                <span
                  className="text-slate-300 select-none dark:text-slate-600"
                  aria-hidden
                >
                  ·
                </span>
              ) : null}
              <a
                href={`#${step.id}`}
                className={`rounded-md px-1.5 py-1 leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
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
      </ol>
    </nav>
  );
}

export function AgentRegistrationForm() {
  const hasMounted = useHasMounted();
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
  const [delegationEth, setDelegationEth] = useState("");
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
      const delegErr = validateDelegationEth(delegationEth);
      if (delegErr) {
        setStatusMsg(delegErr);
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
          let line = publicClient
            ? `Confirmed. Subdomain « ${label}.agentic.eth » created (tx: ${hash.slice(0, 10)}…).`
            : `Transaction sent: ${hash.slice(0, 10)}… — check Sepolia explorer.`;

          if (publicClient && receipt?.status === "success") {
            const agent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);
            if (agent) {
              try {
                const resolver = await publicClient.readContract({
                  address: registrar,
                  abi: agenticSubdomainAbi,
                  functionName: "publicResolver",
                });
                const fullName = `${label}.agentic.eth`;
                const pairs = buildAgenticRegistrationTextRecords({
                  label,
                  topicValues: selectedInterests,
                  thesisPrompt,
                  agent,
                  delegationEthIntent: delegationEth.trim(),
                });
                const calldatas = encodeSetTextMulticallPayload(
                  fullName,
                  pairs,
                );
                const metaHash = await writeContractAsync({
                  address: resolver,
                  abi: ENS_PUBLIC_RESOLVER_ABI,
                  functionName: "multicall",
                  args: [calldatas as readonly `0x${string}`[]],
                  chainId: sepolia.id,
                });
                line += ` ENS text records written (tx: ${metaHash.slice(0, 10)}…).`;
              } catch (metaErr) {
                const hint =
                  metaErr instanceof Error ? metaErr.message : "Unknown error";
                line += ` Subdomain is live, but metadata could not be written: ${hint}`;
              }
            } else {
              line +=
                " Subdomain is live; skipped ENS metadata (no matching agent profile).";
            }
          }

          setStatusMsg(line);
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
      delegationEth,
      labelInput,
      parentExpiry,
      registrar,
      selectedAgentId,
      selectedInterests,
      thesisPrompt,
      switchChainAsync,
      writeContractAsync,
    ],
  );

  const selectedAgent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400";

  const submitDisabled =
    !hasMounted ||
    !isConnected ||
    isSubmitting ||
    parentExpiry === undefined;

  const submitDisabledTitle = (() => {
    if (!submitDisabled) return undefined;
    if (!hasMounted) return "Loading wallet interface…";
    if (!isConnected) return "Connect your wallet to register.";
    if (parentExpiry === undefined) return "Loading contract data from Sepolia…";
    if (isSubmitting) return "Waiting for wallet confirmation.";
    return undefined;
  })();

  return (
    <div className="w-full max-w-4xl">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <header className="border-b border-slate-100 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/40">
          <h1 className="sr-only">Registration</h1>
          <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <RegistrationStepsNav navClassName="min-w-0 flex-1 border-0 bg-transparent p-0 dark:bg-transparent" />
            <div className="flex shrink-0 flex-col items-stretch justify-center sm:items-end">
              {!hasMounted ? (
                <p className="text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Connect to continue
                </p>
              ) : isConnected && address ? (
                <p className="text-[11px] text-right whitespace-nowrap">
                  <span className="font-medium text-slate-500 dark:text-slate-500">
                    Owner:{" "}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
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
          <div className="space-y-8">
            {/* Focus + thesis */}
            <FormStepCard id="step-focus">
              <fieldset className="min-w-0 space-y-6 border-0 p-0">
                <legend className="sr-only">
                  {REGISTRATION_SECTION_LABELS.focus}
                </legend>

                <div className="space-y-2">
                  <SectionTitle>{REGISTRATION_SECTION_LABELS.focus}</SectionTitle>
                  <HelperText className="max-w-2xl">
                    Here you shape your public agent profile:{" "}
                    <strong className="font-medium text-slate-700 dark:text-slate-300">
                      Focus
                    </strong>{" "}
                    tags the themes you care about;{" "}
                    <strong className="font-medium text-slate-700 dark:text-slate-300">
                      Thesis
                    </strong>{" "}
                    is where you spell out your view, what you monitor, and what
                    would prove you wrong. Together they don’t create your
                    subdomain—that happens when you claim a name later. After
                    registration succeeds, a separate step writes these fields (and
                    your later choices) into ENS text records on Sepolia so they’re
                    readable on-chain with your{" "}
                    <span className="font-mono text-[13px] text-slate-700 dark:text-slate-300">
                      *.agentic.eth
                    </span>{" "}
                    name.
                  </HelperText>
                </div>

                <div className="space-y-6">
                  <div>
                    <FieldLabel>Focus</FieldLabel>
                    <HelperText id="areas-interest-hint" className="mb-3">
                      Add themes that describe what you track (optional).
                    </HelperText>
                    <div
                      className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
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
                    className="h-8 min-w-[8.5rem] cursor-pointer appearance-none rounded-md border border-slate-200 bg-slate-50/80 py-1 pr-7 pl-2.5 text-xs text-slate-800 outline-none transition hover:border-slate-300 hover:bg-slate-100/80 focus-visible:border-slate-400 focus-visible:ring-0 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
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
                    <li className="text-xs text-slate-400 not-italic dark:text-slate-600">
                      No themes yet
                    </li>
                  ) : null}
                </ul>
              </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor="thesis-prompt">Thesis</FieldLabel>
                    <HelperText id="thesis-prompt-hint" className="mb-3">
                      Your view, what you watch, and what would change your mind
                      (optional).
                    </HelperText>
                    <textarea
                      id="thesis-prompt"
                      name="thesisPrompt"
                      rows={5}
                      maxLength={4000}
                      placeholder="Core thesis, signals you track, upside and downside risks…"
                      value={thesisPrompt}
                      onChange={(e) => setThesisPrompt(e.target.value)}
                      aria-describedby="thesis-prompt-hint"
                      className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
                    />
                  </div>
                </div>
              </fieldset>
            </FormStepCard>

            {/* Agents */}
            <FormStepCard id="step-agent">
              <fieldset className="min-w-0 space-y-4 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.agent}
              </legend>
              <SectionTitle>{REGISTRATION_SECTION_LABELS.agent}</SectionTitle>
              <HelperText className="max-w-2xl">
                Each profile includes an access fee (shown in ETH). Your choice
                is saved with the metadata transaction, not the subdomain call.
              </HelperText>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETPLACE_AGENTS.map((agent: MarketplaceAgent) => {
                  const selected = agent.id === selectedAgentId;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      aria-pressed={selected}
                      className={`flex flex-col rounded-xl border p-5 text-left transition-colors ${
                        selected
                          ? "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-900/70"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/40"
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
                          Selected
                        </p>
                      ) : (
                        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-600">
                          Select
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              </fieldset>
            </FormStepCard>

            <FormStepCard id="step-delegate">
              <fieldset className="min-w-0 space-y-4 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.delegate}
              </legend>
              <SectionTitle as="h3">
                {REGISTRATION_SECTION_LABELS.delegate}
              </SectionTitle>
              <HelperText id="delegation-eth-hint">
                Optional intent for how much you plan to delegate—stored with
                metadata (not settled in this flow).
              </HelperText>
              <FieldLabel htmlFor="delegation-eth">Amount</FieldLabel>
              <div className="flex max-w-[14rem] items-center gap-2">
                <input
                  id="delegation-eth"
                  name="delegationEth"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.0"
                  value={delegationEth}
                  onChange={(e) => setDelegationEth(e.target.value)}
                  aria-describedby="delegation-eth-hint"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-400"
                />
                <span className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-400">
                  ETH
                </span>
              </div>

              {selectedAgent ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Agent{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAgent.name}
                  </span>{" "}
                  ·{" "}
                  <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {selectedAgent.accessPriceEth} ETH
                  </span>{" "}
                  access
                  {delegationEth.trim() ? (
                    <>
                      {" "}
                      · delegate{" "}
                      <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {delegationEth.trim()}
                      </span>{" "}
                      ETH
                    </>
                  ) : null}{" "}
                  —{" "}
                  <span className="text-slate-500 dark:text-slate-500">
                    Paid access is separate from the ENS transactions.
                  </span>
                </p>
              ) : null}
              </fieldset>
            </FormStepCard>

            <FormStepCard id="step-claim">
              <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.claim}
              </legend>
              <SectionTitle as="h3">
                {REGISTRATION_SECTION_LABELS.claim}
              </SectionTitle>
              <HelperText>
                3–63 characters: lowercase letters, digits, and hyphens only.
              </HelperText>
              <FieldLabel htmlFor="ens-label">Subdomain</FieldLabel>
              <div className="flex min-w-0 max-w-md flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  id="ens-label"
                  name="ensLabel"
                  type="text"
                  autoComplete="off"
                  placeholder="myagent"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className={`${inputBase} min-w-0 flex-1 sm:min-w-[12rem]`}
                />
                <span className="shrink-0 font-mono text-sm font-semibold text-slate-600 tabular-nums dark:text-slate-400">
                  .agentic.eth
                </span>
              </div>
              </fieldset>
            </FormStepCard>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-700 dark:bg-slate-900">
              <summary className="cursor-pointer list-none font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[10px] transition-transform group-open:rotate-90">
                    ▸
                  </span>
                  Technical details (contract, expiry, metadata keys)
                </span>
              </summary>
              <div className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3 font-mono text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-500">
                <p className="break-all">{registrar}</p>
                <p>
                  Parent expiry ·{" "}
                  {parentExpiry !== undefined
                    ? parentExpiry.toString()
                    : expiryError
                      ? "unavailable"
                      : "loading…"}
                </p>
                <div className="font-sans text-[11px]">
                  <p className="mb-1.5 font-medium text-slate-600 dark:text-slate-400">
                    Metadata keys (public resolver / multicall)
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-slate-500 dark:text-slate-500">
                    {Object.values(AGENTIC_ENS_TEXT_KEYS).map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>

            <FormStepCard
              id="step-register"
              className="border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
            >
              <div className="space-y-4">
                <SectionTitle as="h3">
                  {REGISTRATION_SECTION_LABELS.register}
                </SectionTitle>
                <HelperText>
                  Submits two on-chain steps on Sepolia: subdomain registration,
                  then metadata. Connect your wallet first.
                </HelperText>
                <button
                  type="submit"
                  disabled={submitDisabled}
                  title={submitDisabledTitle}
                  className="w-full rounded-lg border border-slate-900 bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:opacity-35"
                >
                  {isSubmitting
                    ? "Confirm in wallet…"
                    : "Register on Sepolia · write metadata"}
                </button>
              </div>
            </FormStepCard>
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
