# AgenticSubdomain (ENS / Sepolia)

`AgenticSubdomain` is a minimal **registrar** contract: it calls the ENS **NameWrapper** to create subnames under the wrapped parent **`agentic.eth`** (namehash fixed at deployment), using the **Public Resolver** on Sepolia.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`, `anvil`)
- The parent name **`agentic.eth` must be wrapped** on the target network, and **you must control** the on-chain account that owns it (for the approval step).
- **RPC**: a Sepolia URL (Alchemy, Infura, etc.) for a real deployment; `http://127.0.0.1:8545` if you use Anvil (fork or local).

## Sepolia contracts (reference)

| Role            | Address |
|-----------------|---------|
| NameWrapper     | `0x0635513f179D50A207757E05759CbD106d7dFcE8` |
| Public Resolver | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` |

Sepolia chain ID: **11155111**.

## Glossary (names and addresses)

| Term / variable | What it is |
|-----------------|------------|
| **`AgenticSubdomain` contract** | Your **smart contract** (registrar) that you deploy. It calls the NameWrapper on your behalf once approved. |
| **`REGISTRAR_CONTRACT_ADDRESS`** | **0x… address of the deployed contract** (the one shown after `forge script` deploy). Same as “registrar address”. **Not** your wallet address, **nor** the ENS name `agentic.eth`. |
| **`SUBNAME_OWNER_ADDRESS`** | (Optional, registration script) **0x… wallet address** that receives the wrapped subname **ERC-1155 NFT**. If unset, the script uses the address derived from `--private-key`. See §5 and *ERC1155* troubleshooting. |
| **`runWithAddress(address)`** | Explicit variant when you pass the address on the CLI: it is the **`AgenticSubdomain` contract** (registrar) address, not a wallet. |
| **“Deployer” key** | Account that pays **deployment** gas (`PRIVATE_KEY_DEPLOYER`). May differ from the ENS name owner. |
| **“Parent owner” key** | Account that **owns wrapped `agentic.eth`** on the NameWrapper (`PRIVATE_KEY_PARENT_OWNER`). Required for `setApprovalForAll`. |
| **“Caller” key** | Account that sends `setSubdomain` txs / registration scripts (`PRIVATE_KEY_CALLER`). Often the same as the deployer in tests. |

Foundry scripts read the registrar address from the **`REGISTRAR_CONTRACT_ADDRESS`** environment variable (deployed contract address).

**Why `runWithAddress`?** `forge script` allows only **one** `run` function per contract (otherwise *Multiple functions with same name `run` in the ABI*). The registrar address is therefore passed via **`runWithAddress(address)`** and `--sig "runWithAddress(address)" 0x...`, not a second `run(address)` overload.

---

## Why three steps?

1. **Deploy** `AgenticSubdomain`: it stores the NameWrapper, `parentNode` (namehash of `agentic.eth`), and the resolver.
2. **Approve the registrar**: the NameWrapper is **ERC-1155**. Only the **owner** of the wrapped parent can call `setApprovalForAll(registrar, true)` to let **your deployed contract** call `setSubnodeRecord`.  
   - The key used here must be the **wallet that owns wrapped `agentic.eth`** (often different from the deploy key).
3. **Register subnames**: calls to `setSubdomain(label, owner, expiry)` on your contract. Subname expiry cannot exceed the parent’s: the example script reads parent expiry via `getData` on the NameWrapper.

**ABI note**: on the NameWrapper, `setSubnodeRecord` expects a `string label` (e.g. `"dayan"`), not the raw `labelhash`. The local contract matches that.

---

## Environment variables (optional)

**Contract** address of deployed `AgenticSubdomain` (see glossary):

```bash
export REGISTRAR_CONTRACT_ADDRESS=0x...   # 0x address of the AgenticSubdomain smart contract
```

Under **bash**, you must **`export`** (or put `REGISTRAR_CONTRACT_ADDRESS=0x... forge script ...` on **one line** before the command). A line like `REGISTRAR_CONTRACT_ADDRESS=0x...` **without** `export` is not visible to child processes such as `forge`.

Alternatively, pass the same address as an argument: `--sig "runWithAddress(address)" 0x...`.

**Never commit** private keys or RPC URLs containing API keys. Use a local `.env` file (gitignored) if needed.

---

## 1. Fork Sepolia locally (Anvil)

In a dedicated terminal (keep it running):

```bash
anvil --fork-url "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
```

Then, from the `sc/` directory:

```bash
export RPC_URL=http://127.0.0.1:8545
```

All `forge script` commands below use `--rpc-url $RPC_URL`: on a fork, use `http://127.0.0.1:8545`; on Sepolia, use your HTTPS Sepolia URL.

---

## 2. Compile

```bash
cd sc
forge build
```

If stale artifacts remain (deleted files):

```bash
forge clean && forge build
```

---

## 3. Step A — Deploy `AgenticSubdomain`

Replace `PRIVATE_KEY_DEPLOYER` with the key of the account that pays deployment gas (often a test account locally).

```bash
forge script script/AgenticSubdomainDeploy.s.sol:AgenticSubdomainDeploy \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_DEPLOYER \
  --broadcast
```

At the end, the output shows **Contract Address** (or check `broadcast/AgenticSubdomainDeploy.s.sol/11155111/run-latest.json`).

Save the **deployed contract** address:

```bash
export REGISTRAR_CONTRACT_ADDRESS=0x...   # AgenticSubdomain smart contract (registrar)
```

### Verify source on Etherscan (Sepolia)

After deploying to **real** Sepolia, you can publish source with Foundry — explorer: [sepolia.etherscan.io](https://sepolia.etherscan.io).

1. Create an API key at [etherscan.io/apis](https://etherscan.io/apis) (works for Etherscan explorers including Sepolia).
2. Export it (do not commit): `export ETHERSCAN_API_KEY=...`

**With constructor arguments** (same values as the deploy script: NameWrapper, `namehash(agentic.eth)`, Public Resolver):

```bash
forge verify-contract REGISTRAR_CONTRACT_ADDRESS \
  src/AgenticSubdomain.sol:AgenticSubdomain \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args $(cast abi-encode "constructor(address,bytes32,address)" \
    0x0635513f179D50A207757E05759CbD106d7dFcE8 \
    0xa5a5de1b77998a2f087d62b345f66c119d03c7137e0dc19724a45235b1cd9bcf \
    0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5) \
  --watch
```

Replace `REGISTRAR_CONTRACT_ADDRESS` with the address from deploy (e.g. `0x6106...`).

**Variant**: let Foundry infer encoded arguments (sometimes enough):

```bash
forge verify-contract REGISTRAR_CONTRACT_ADDRESS \
  src/AgenticSubdomain.sol:AgenticSubdomain \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --guess-constructor-args \
  --watch
```

On failure (compiler version, optimizer), see `forge verify-contract --help` (`--compiler-version`, `--num-of-optimizations`).

Direct link once verified: `https://sepolia.etherscan.io/address/<REGISTRAR_CONTRACT_ADDRESS>#code`

---

## 4. Step B — Approve the registrar on the NameWrapper

**Required**: key for the account that **owns** wrapped `agentic.eth` on this network (`PRIVATE_KEY_PARENT_OWNER`).

**Option 1 — registrar address via environment variable:**

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... forge script script/AgenticSubdomainApprove.s.sol:AgenticSubdomainApprove \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_PARENT_OWNER \
  --broadcast
```

**Option 2 — same address passed as argument (no env):**

```bash
forge script script/AgenticSubdomainApprove.s.sol:AgenticSubdomainApprove \
  --sig "runWithAddress(address)" 0xYourAgenticSubdomainContract \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_PARENT_OWNER \
  --broadcast
```

This calls `NameWrapper.setApprovalForAll(registrarContract, true)` where `registrarContract` is your **deployed** contract.

---

## 5. Step C — Create the three example subnames

The script registers `agent0`, `agent1`, `agent2` under `agentic.eth`; edit labels in `script/AgenticSubdomainRegisterThree.s.sol` if needed.

**Option 1 — registrar address via env:**

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

**Option 1b — same, specifying subname owner** (recommended on a Sepolia fork if you use the default Anvil key — see troubleshooting):

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... \
SUBNAME_OWNER_ADDRESS=0xYourWalletReceivingSubnames \
forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

**Option 2 — registrar address as argument:**

```bash
forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --sig "runWithAddress(address)" 0xYourAgenticSubdomainContract \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

- **`--slow`**: each transaction is sent **only after** the previous one confirms. Required on some RPCs (e.g. Alchemy) that limit *in-flight* txs in a burst — otherwise *in-flight transaction limit*.
- `parentExpiry` is read automatically (ENS constraint).
- **Subname owner**: `SUBNAME_OWNER_ADDRESS` if set, otherwise the address from `PRIVATE_KEY_CALLER` (`msg.sender`).

> **Security**: today `setSubdomain` has no `onlyOwner` — anyone can call the contract if the NameWrapper allows it. Harden the contract before production.

---

## 6. Deploy to Sepolia (not only a fork)

Same flow, for example:

```bash
export RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
```

Then run the same three `forge script` steps (A, B, C) with **real** keys and **Sepolia ETH** on the deployer (and the owner for approval).

---

## 7. Single call with `cast` (example)

After approval, for one subname (adapt expiry: ≤ parent expiry; read parent with `cast call` on `getData`).

```bash
# Example: expiry = parent expiry (replace with value read on-chain)
cast send "$REGISTRAR_CONTRACT_ADDRESS" \
  "setSubdomain(string,address,uint64)" "dayan" 0xWalletOwnerOfSubname 2100769908 \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER
```

---

## 8. List all subnames of `agentic.eth`

There is **no** Registry / NameWrapper function like “give me all children of this parent”. For a list you need either an **indexer** (aggregated events) or the **ENS subgraph**.

### Recommended: ENS subgraph (Sepolia)

Same source as [ENS docs](https://docs.ens.domains/web/subgraph/): Sepolia endpoint `https://api.studio.thegraph.com/query/49574/enssepolia/version/latest`.

This subgraph reflects **real** Sepolia indexed by The Graph, **not** a local Anvil fork: subnames created **only** on your fork (never broadcast to Sepolia) will not appear. For that, use **`cast logs`** with `--rpc-url http://127.0.0.1:8545` (next section).

Repo script (requires `curl` + `jq`):

```bash
cd sc
chmod +x script/list_agentic_subdomains.sh   # once
./script/list_agentic_subdomains.sh
```

Default parent is `agentic.eth`; another parent: `PARENT_NAME=other.eth ./script/list_agentic_subdomains.sh`.

The subgraph may **miss** very new names (indexing lag) or edge cases — see [listing ENS names](https://docs.ens.domains/web/enumerate).

### Alternative: on-chain logs (`cast logs`)

NameWrapper emits `NameWrapped` among others. You can filter the Sepolia NameWrapper contract and decode / filter off-chain (noisy; pick a block range):

```bash
export NW=0x0635513f179D50A207757E05759CbD106d7dFcE8
# Example filter by NameWrapped topic0 (all wraps — refine client-side)
cast logs --from-block 0 --to-block latest --address "$NW" \
  'NameWrapped(bytes32,bytes,address,uint32,uint64)' \
  --rpc-url "$RPC_URL"
```

In practice, for “all subnames of a parent”, the **subgraph** (`subdomains` on the parent domain) remains the right tool.

---

## 9. Quick troubleshooting

| Issue | What to try |
|-------|-------------|
| `Multiple functions with the same name run found in the ABI` | Scripts expose only **one** `run()`. To pass the address on the CLI, use `--sig "runWithAddress(address)" 0x...` (not two `run` overloads). |
| Revert on `setSubnodeRecord` with huge expiry | Use expiry **≤** parent (`getData(uint256(parentNode))`). |
| Revert with no message after ABI change | **Redeploy** the contract and **re-approve** the new address. |
| Revert after restarting Anvil | Fork state resets: **redeploy**, **re-approve**, re-register. |
| `setSubdomain` fails though you own the parent | Confirm step **B** was done with the **`agentic.eth` owner** key, for **`REGISTRAR_CONTRACT_ADDRESS`** (correct deployed contract). |
| `ERC1155: transfer to non ERC1155Receiver implementer` | The NameWrapper **mints** an NFT to the subname `owner` address. If that address has **code** (contract without `onERC1155Received`), or a fork edge case, it reverts. On a Sepolia fork, **avoid Anvil default key #0** (`0xf39F…`) as owner: use your **real wallet**: `SUBNAME_OWNER_ADDRESS=0x...` (EOA with no code). Check with `cast code 0x... --rpc-url "$RPC_URL"` (should be `0x`). |
| `in-flight transaction limit reached for delegated accounts` (RPC **-32000**) | The provider (often **Alchemy**) rejects several **pending** txs in a row. Re-run the script with **`--slow`** (wait for confirmation between txs). Or wait and retry; or switch **RPC** temporarily. |

---

## General Foundry commands

```bash
forge build
forge test
forge fmt
cast --help
```

Foundry book: https://book.getfoundry.sh/
