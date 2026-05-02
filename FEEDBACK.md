# Uniswap API Feedback

> Submitted as part of the **predict-intelligence** hackathon project.

## What We Built

We integrated the **Uniswap Trading API** (`trade-api.gateway.uniswap.org/v1`) into an autonomous AI trading agent built on LangGraph + ENS user profiles, running on Sepolia testnet.

The agent analyses prediction markets, builds conviction from a knowledge graph, and routes token swaps through the Uniswap Trading API — following the `check_approval → quote → sign permitData → swap/order → broadcast` flow using viem.

---

## What Worked Well

- **Clean three-step flow.** The `check_approval → quote → swap` sequence mapped naturally behind a hexagonal architecture port. Very little glue code was needed.
- **`routing` field in the quote response.** Branching between `/swap` (CLASSIC) and `/order` (UniswapX) based on the routing field was straightforward and well-documented.
- **`permitData` inline with the quote.** No extra round-trip for the signing payload — good DX.
- **Sepolia fully supported.** The testnet integration worked without special flags. Being able to test with no real funds at risk was essential for a hackathon.
- **Code examples in the docs.** The TypeScript samples on the "Swapping Code Examples" page were the most useful reference and saved a lot of time.

---

## Suggestions

- **Testnet liquidity guidance.** Most token pairs on Sepolia have no active liquidity, so quotes fail with `404 / No quotes available` for anything beyond WETH/USDC. A note in the docs on which pairs are reliably liquid on each testnet would help a lot.
- **More descriptive error codes.** When a swap fails due to insufficient balance or liquidity, the error surfaces as `FAILED_TO_ESTIMATE_GAS: execution reverted` — which points at gas rather than the real cause. Error codes like `INSUFFICIENT_BALANCE` or `INSUFFICIENT_LIQUIDITY` would make debugging much faster.
- **TypeScript types for API responses.** We hand-wrote all `fetch` calls and typed the response shapes ourselves (including `permitData`). Even a lightweight `@uniswap/trading-api` package with typed interfaces would reduce boilerplate and prevent easy mistakes.

---

## Summary

The Uniswap Trading API was a great fit for an agentic finance use case. The quote→sign→swap flow is clean and consistent. The main areas where we'd love to see improvement are testnet liquidity documentation, more granular error codes, and typed TypeScript support for the REST layer.
