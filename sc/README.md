# AgenticSubdomain (ENS / Sepolia)

`AgenticSubdomain` est un **registrar** minimal : il appelle le **NameWrapper** ENS pour créer des sous-noms sous le parent wrappé **`agentic.eth`** (namehash fixé au déploiement), avec le **Public Resolver** Sepolia.

## Prérequis

- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`, `anvil`)
- Le nom parent **`agentic.eth` doit être wrappé** sur le réseau cible, et **tu dois contrôler** le compte qui en est propriétaire on-chain (pour l’étape d’approbation).
- **RPC** : URL Sepolia (Alchemy, Infura, etc.) pour un déploiement réel ; `http://127.0.0.1:8545` si tu utilises Anvil (fork ou local).

## Contrats Sepolia (référence)

| Rôle            | Adresse |
|-----------------|---------|
| NameWrapper     | `0x0635513f179D50A207757E05759CbD106d7dFcE8` |
| Public Resolver | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` |

Chain ID Sepolia : **11155111**.

## Glossaire (noms et adresses)

| Terme / variable | Ce que c’est |
|------------------|--------------|
| **Contrat `AgenticSubdomain`** | Ton **smart contract** (registrar) que tu déploies toi-même. Il appelle le NameWrapper en ton nom une fois approuvé. |
| **`REGISTRAR_CONTRACT_ADDRESS`** | Adresse **0x… du contrat déployé** ci-dessus (celle affichée après `forge script` Deploy). Même chose que « adresse du registrar ». **Ce n’est pas** ton adresse wallet, **ni** le nom ENS `agentic.eth`. |
| **`SUBNAME_OWNER_ADDRESS`** | (Optionnel, script d’enregistrement) Adresse **0x… du wallet** qui recevra le **NFT ERC-1155** du sous-nom wrappé. Si absente, le script utilise l’adresse dérivée de `--private-key`. Voir § 5 et dépannage *ERC1155*. |
| **`runWithAddress(address)`** | Variante explicite quand tu passes l’adresse en CLI : c’est l’adresse **du contrat** `AgenticSubdomain` (registrar), pas un wallet. |
| **Clé « déployeur »** | Compte qui paie le **déploiement** du registrar (`PRIVATE_KEY_DEPLOYER`). Peut être différent du propriétaire du nom ENS. |
| **Clé « propriétaire du parent »** | Compte qui **possède `agentic.eth` wrappé** sur le NameWrapper (`PRIVATE_KEY_PARENT_OWNER`). Obligatoire pour `setApprovalForAll`. |
| **Clé « appelant »** | Compte qui envoie les txs `setSubdomain` / scripts d’enregistrement (`PRIVATE_KEY_CALLER`). Souvent le même que le déployeur en test. |

Les scripts Foundry lisent l’adresse du registrar via la variable d’environnement **`REGISTRAR_CONTRACT_ADDRESS`** (adresse du contrat déployé).

**Pourquoi `runWithAddress` ?** `forge script` n’accepte qu’**une** fonction `run` par contrat (sinon erreur *Multiple functions with same name `run` in the ABI*). L’adresse du registrar en argument est donc passée via **`runWithAddress(address)`** et `--sig "runWithAddress(address)" 0x...`, pas via une seconde surcharge `run(address)`.

---

## Pourquoi trois étapes ?

1. **Déployer** `AgenticSubdomain` : il connaît le NameWrapper, le `parentNode` (namehash de `agentic.eth`) et le resolver.
2. **Approuver le registrar** : le NameWrapper est en **ERC-1155**. Seul le **propriétaire** du parent wrappé peut appeler `setApprovalForAll(registrar, true)` pour autoriser **ton contrat déployé** à appeler `setSubnodeRecord`.  
   - La clé utilisée ici doit être celle du **wallet qui possède `agentic.eth` wrappé** (souvent différente de la clé de déploiement).
3. **Enregistrer des sous-noms** : appels à `setSubdomain(label, owner, expiry)` sur ton contrat. L’expiry d’un sous-nom ne peut pas dépasser celle du parent : le script d’exemple lit l’expiry parent via `getData` sur le NameWrapper.

**Note ABI** : sur le NameWrapper, `setSubnodeRecord` attend un `string label` (ex. `"dayan"`), pas le `labelhash` seul. Le contrat local est aligné sur ça.

---

## Variables d’environnement (optionnel)

Adresse **du contrat** `AgenticSubdomain` une fois déployé (voir glossaire) :

```bash
export REGISTRAR_CONTRACT_ADDRESS=0x...   # adresse 0x du smart contract AgenticSubdomain
```

Sous **bash**, il faut bien **`export`** (ou `REGISTRAR_CONTRACT_ADDRESS=0x... forge script ...` sur **une seule ligne** devant la commande). Une ligne du type `REGISTRAR_CONTRACT_ADDRESS=0x...` **sans** `export` ne sera pas visible pour `forge` (processus fils).

Sinon, passe la même adresse en argument : `--sig "runWithAddress(address)" 0x...`.

**Ne commite jamais** de clé privée ni d’URL RPC avec clé API. Utilise un fichier `.env` local (non versionné) si besoin.

---

## 1. Fork Sepolia en local (Anvil)

Dans un terminal dédié (laisse tourner) :

```bash
anvil --fork-url "https://eth-sepolia.g.alchemy.com/v2/VOTRE_CLE"
```

Puis, dans le dossier `sc/` :

```bash
export RPC_URL=http://127.0.0.1:8545
```

Toutes les commandes `forge script` ci-dessous utilisent `--rpc-url $RPC_URL` : sur un fork, mets `http://127.0.0.1:8545` ; sur Sepolia, mets ton URL HTTPS Sepolia.

---

## 2. Compiler

```bash
cd sc
forge build
```

Si des anciens artefacts traînent (fichiers supprimés) :

```bash
forge clean && forge build
```

---

## 3. Étape A — Déployer `AgenticSubdomain`

Remplace `PRIVATE_KEY_DEPLOYER` par la clé du compte qui paie le gas du déploiement (souvent un compte de test en local).

```bash
forge script script/AgenticSubdomainDeploy.s.sol:AgenticSubdomainDeploy \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_DEPLOYER \
  --broadcast
```

À la fin, la sortie indique **Contract Address** (ou regarde `broadcast/AgenticSubdomainDeploy.s.sol/11155111/run-latest.json`).

Enregistre l’adresse **du contrat déployé** :

```bash
export REGISTRAR_CONTRACT_ADDRESS=0x...   # smart contract AgenticSubdomain (registrar)
```

### Vérifier le code sur Etherscan (Sepolia)

Après un déploiement sur la **vraie** Sepolia, tu peux publier le source avec Foundry — l’explorateur est [sepolia.etherscan.io](https://sepolia.etherscan.io).

1. Crée une clé API sur [etherscan.io/apis](https://etherscan.io/apis) (valable pour les explorateurs Etherscan, dont Sepolia).
2. Exporte-la (ne la commite pas) : `export ETHERSCAN_API_KEY=...`

**Avec les arguments du constructor** (mêmes valeurs que le script de deploy : NameWrapper, `namehash(agentic.eth)`, Public Resolver) :

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

Remplace `REGISTRAR_CONTRACT_ADDRESS` par l’adresse affichée au deploy (ex. `0x6106...`).

**Variante** : laisser Foundry inférer les arguments encodés (parfois suffisant) :

```bash
forge verify-contract REGISTRAR_CONTRACT_ADDRESS \
  src/AgenticSubdomain.sol:AgenticSubdomain \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --guess-constructor-args \
  --watch
```

En cas d’échec (version de compilateur, optimiser), voir `forge verify-contract --help` (`--compiler-version`, `--num-of-optimizations`).

Lien direct une fois vérifié : `https://sepolia.etherscan.io/address/<REGISTRAR_CONTRACT_ADDRESS>#code`

---

## 4. Étape B — Approuver le registrar sur le NameWrapper

**Obligatoire** : clé du compte qui **possède** `agentic.eth` wrappé sur ce réseau (`PRIVATE_KEY_PARENT_OWNER`).

**Option 1 — adresse du registrar via variable d’environnement :**

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... forge script script/AgenticSubdomainApprove.s.sol:AgenticSubdomainApprove \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_PARENT_OWNER \
  --broadcast
```

**Option 2 — même adresse passée en argument (sans env) :**

```bash
forge script script/AgenticSubdomainApprove.s.sol:AgenticSubdomainApprove \
  --sig "runWithAddress(address)" 0xAdresseDuContratAgenticSubdomain \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_PARENT_OWNER \
  --broadcast
```

Cela appelle `NameWrapper.setApprovalForAll(registrarContract, true)` où `registrarContract` est ton **contrat** déployé.

---

## 5. Étape C — Créer les trois sous-noms d’exemple

Le script enregistre `dayan`, `nicolas`, `gabriel` sous `agentic.eth` ; modifie les labels dans `script/AgenticSubdomainRegisterThree.s.sol` si besoin.

**Option 1 — adresse du registrar via env :**

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

**Option 1 bis — même chose en précisant qui possède les sous-noms** (recommandé sur un fork Sepolia si tu utilises la clé Anvil par défaut, voir dépannage) :

```bash
REGISTRAR_CONTRACT_ADDRESS=0x... \
SUBNAME_OWNER_ADDRESS=0xTonWalletQuiRecoitLesSousNoms \
forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

**Option 2 — adresse du registrar en argument :**

```bash
forge script script/AgenticSubdomainRegisterThree.s.sol:AgenticSubdomainRegisterThree \
  --sig "runWithAddress(address)" 0xAdresseDuContratAgenticSubdomain \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER \
  --slow \
  --broadcast
```

- **`--slow`** : une transaction est envoyée **seulement après** confirmation de la précédente. Indispensable sur certains RPC (ex. Alchemy) qui limitent les txs « en vol » sur une même séquence — sinon erreur *in-flight transaction limit*.
- `parentExpiry` est lue automatiquement (contrainte ENS).
- **Propriétaire des sous-noms** : `SUBNAME_OWNER_ADDRESS` si défini, sinon l’adresse de `PRIVATE_KEY_CALLER` (`msg.sender`).

> **Sécurité** : aujourd’hui `setSubdomain` n’a pas de `onlyOwner` — n’importe qui peut appeler le contrat si le NameWrapper l’autorise. Renforce le contrat si tu ouvres en production.

---

## 6. Déploiement sur Sepolia (pas seulement le fork)

Même enchaînement, avec par exemple :

```bash
export RPC_URL="https://eth-sepolia.g.alchemy.com/v2/VOTRE_CLE"
```

Puis les mêmes trois `forge script` (A, B, C) avec des clés **réelles** et de l’**ETH Sepolia** sur le compte déployeur (et le owner pour l’approbation).

---

## 7. Appel unitaire avec `cast` (exemple)

Après approbation, pour un seul sous-nom (adapte l’expiry : ≤ expiry du parent ; tu peux lire le parent avec `cast call` sur `getData`).

```bash
# Exemple : expiry = celle du parent (à remplacer par la valeur lue on-chain)
cast send "$REGISTRAR_CONTRACT_ADDRESS" \
  "setSubdomain(string,address,uint64)" "dayan" 0xAdresseWalletOwnerDuSousNom 2100769908 \
  --rpc-url "$RPC_URL" \
  --private-key PRIVATE_KEY_CALLER
```

---

## 8. Lister tous les sous-noms de `agentic.eth`

Il **n’existe pas** sur le Registry / NameWrapper une fonction du type « donne-moi tous les enfants de ce parent ». Pour une liste, il faut **soit** un **indexeur** (événements agrégés), **soit** le **subgraph ENS**.

### Recommandé : subgraph ENS (Sepolia)

Même source que [la doc ENS](https://docs.ens.domains/web/subgraph/) : endpoint Sepolia `https://api.studio.thegraph.com/query/49574/enssepolia/version/latest`.

Ce subgraph décrit la **Sepolia réelle** indexée par The Graph, **pas** un fork Anvil local : les sous-noms créés **uniquement** sur ton fork (sans les envoyer sur Sepolia) n’y sont pas. Pour ça, passe par **`cast logs`** sur `--rpc-url http://127.0.0.1:8545` (section suivante).

Script du dépôt (requiert `curl` + `jq`) :

```bash
cd sc
chmod +x script/list_agentic_subdomains.sh   # une fois
./script/list_agentic_subdomains.sh
```

Le parent par défaut est `agentic.eth` ; autre parent : `PARENT_NAME=autre.eth ./script/list_agentic_subdomains.sh`.

Le subgraph peut **manquer** des noms très récents (latence d’indexation) ou des cas particuliers — voir [lister des noms ENS](https://docs.ens.domains/web/enumerate).

### Alternative : journaux on-chain (`cast logs`)

Les créations côté NameWrapper émettent notamment `NameWrapped`. Tu peux filtrer le contrat NameWrapper Sepolia et décoder / filtrer off-chain (beaucoup de bruit, plage de blocs à choisir) :

```bash
export NW=0x0635513f179D50A207757E05759CbD106d7dFcE8
# Exemple de filtre par topic0 de NameWrapped (tous les wrap, à affiner côté client)
cast logs --from-block 0 --to-block latest --address "$NW" \
  'NameWrapped(bytes32,bytes,address,uint32,uint64)' \
  --rpc-url "$RPC_URL"
```

En pratique, pour « tous les sous-noms d’un parent », le **subgraph** (`subdomains` sur le domaine parent) reste l’outil adapté.

---

## 9. Dépannage rapide

| Problème | Piste |
|----------|--------|
| `Multiple functions with the same name run found in the ABI` | Les scripts n’exposent qu’**une** fonction `run()`. Pour passer l’adresse en CLI, utilise `--sig "runWithAddress(address)" 0x...` (et non deux surcharges `run`). |
| Revert sur `setSubnodeRecord` avec expiry énorme | Utiliser une expiry **≤** celle du parent (`getData(uint256(parentNode))`). |
| Revert sans message après changement d’ABI | **Redéployer** le contrat et refaire l’**approve** pour la nouvelle adresse. |
| Revert après redémarrage d’Anvil | Le fork repart à zéro : **redéployer**, **ré-approuver**, ré-enregistrer. |
| `setSubdomain` refuse alors que tu es owner du parent | Vérifie que l’étape **B** a bien été faite avec la clé du **owner** de `agentic.eth`, pour **`REGISTRAR_CONTRACT_ADDRESS`** (le bon contrat déployé). |
| `ERC1155: transfer to non ERC1155Receiver implementer` | Le NameWrapper **mint** un NFT vers l’adresse `owner` du sous-nom. Si cette adresse a du **code** (contrat sans `onERC1155Received`), ou un edge case sur un fork, ça revert. Sur fork Sepolia, **évite la clé Anvil #0** (`0xf39F…`, clé publique) comme owner : utilise ton **vrai wallet** : `SUBNAME_OWNER_ADDRESS=0x...` (EOA sans code). Vérifie avec `cast code 0x... --rpc-url "$RPC_URL"` (doit être `0x`). |
| `in-flight transaction limit reached for delegated accounts` (RPC **-32000**) | Le fournisseur (souvent **Alchemy**) refuse plusieurs txs **pending** d’affilée. Relance le script avec **`--slow`** (attend la confirmation entre chaque tx). Ou attends une minute et réessaie ; ou change temporairement de **RPC**. |

---

## Commandes Foundry générales

```bash
forge build
forge test
forge fmt
cast --help
```

Documentation Foundry : https://book.getfoundry.sh/
