#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../tests"
# Connects only to the existing loopback sandbox with its local fixture signer.
cargo test --test deploy_keeper -- --ignored --nocapture
