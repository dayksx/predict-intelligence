#!/usr/bin/env bash
# Liste les sous-noms connus de agentic.eth via le subgraph ENS Sepolia (index = événements on-chain).
# Pas d’API RPC native pour « énumérer les enfants » sur le Registry / NameWrapper.
#
# Réseau : ce subgraph reflète la Sepolia *réelle* indexée par The Graph — pas ton Anvil / fork local.
# Les créations faites uniquement sur un fork (sans broadcast sur Sepolia) n’y apparaissent pas.
# Pour un fork : utiliser `cast logs` contre --rpc-url http://127.0.0.1:8545 (voir README §8).
#
# Usage:
#   ./script/list_agentic_subdomains.sh
#   SUBGRAPH_URL=https://... ./script/list_agentic_subdomains.sh
#
# Dépendances: curl, jq

set -euo pipefail

SUBGRAPH_URL="${SUBGRAPH_URL:-https://api.studio.thegraph.com/query/49574/enssepolia/version/latest}"
PARENT_NAME="${PARENT_NAME:-agentic.eth}"

# Pagination simple si tu dépasses ~1000 sous-noms (rare)
FIRST="${FIRST:-1000}"

QUERY=$(cat <<EOF
{"query":"query { domains(where: { name: \"$PARENT_NAME\" }) { name id subdomainCount subdomains(first: $FIRST) { name } } }"}
EOF
)

RESPONSE="$(curl -fsS -X POST "$SUBGRAPH_URL" \
  -H 'Content-Type: application/json' \
  -d "$QUERY")"

echo "$RESPONSE" | jq -r '
  .data.domains[0] | 
  if . == null then "Aucun domaine « '"$PARENT_NAME"' » dans ce subgraph (nom incorrect ou pas encore indexé)." 
  else 
    "Parent: \(.name) (subdomainCount=\(.subdomainCount // "n/a"))",
    (.subdomains // [] | .[] | .name)
  end'
