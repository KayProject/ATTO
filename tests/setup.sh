#!/usr/bin/env bash
# Builds everything the sandbox tests deploy:
#   - the House of Stake registry, wallet and extension, from source at a pinned commit
#   - the NEAR Intents contract, fetched from mainnet (intents.near) so tests run the deployed code
#   - ATTO's own contracts
set -euo pipefail
cd "$(dirname "$0")"

TLA_REPO=https://github.com/houseofstake/tla-contracts.git
TLA_COMMIT=${TLA_COMMIT:-d85860a8cc2bfcb8b617b28cab558da5d39333fc}
DEPS=$PWD/target/deps
RPC=${MAINNET_RPC:-https://rpc.mainnet.fastnear.com}
mkdir -p "$DEPS"

if [ ! -d "$DEPS/tla-contracts" ]; then
  git clone -q "$TLA_REPO" "$DEPS/tla-contracts"
fi
git -C "$DEPS/tla-contracts" fetch -q origin "$TLA_COMMIT" 2>/dev/null || true
git -C "$DEPS/tla-contracts" checkout -q "$TLA_COMMIT"

for c in contracts/hos-wallet contracts/wallet-impl-deployer contracts/registrar \
         contracts/hos-extension contracts/mpc-recovery contracts/tla-registry dev-contracts/test-ft; do
  name=$(basename "$c" | tr - _)
  if [ ! -s "$DEPS/tla-contracts/target/near/$name/$name.wasm" ]; then
    echo "building $c"
    (cd "$DEPS/tla-contracts/$c" && cargo near build non-reproducible-wasm --locked --no-abi >/dev/null)
  fi
done

SANDBOX_VERSION=2.13.0
if [ ! -x "$DEPS/near-sandbox" ]; then
  echo "downloading near-sandbox $SANDBOX_VERSION"
  platform="$(uname -s)-$(uname -m)"
  curl -sSfL "https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/$platform/$SANDBOX_VERSION/near-sandbox.tar.gz" \
    | tar xz -C "$DEPS" --strip-components 1 "$platform/near-sandbox"
fi

if [ ! -s "$DEPS/intents.wasm" ]; then
  echo "fetching intents.near code from mainnet"
  curl -sS -X POST "$RPC" -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_code","finality":"final","account_id":"intents.near"}}' \
    | jq -er '.result.code_base64' | base64 -d > "$DEPS/intents.wasm"
fi

for c in escrow keeper dev/driver dev/test-nft; do
  [ -d "../contracts/$c" ] || continue
  (cd "../contracts/$c" && cargo near build non-reproducible-wasm --no-abi >/dev/null)
done
echo "ready: $DEPS"
