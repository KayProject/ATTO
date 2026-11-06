#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../tests"
# Local sandbox only; the process owns its lifetime.
cargo test --test deploy_sandbox -- --ignored --nocapture
