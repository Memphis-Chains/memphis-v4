#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS() { echo "[PASS] $1"; }
FAIL() { echo "[FAIL] $1"; exit 1; }
STEP() { echo "[STEP] $1"; }

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

STEP "Rust workspace tests"
if command -v cargo >/dev/null 2>&1; then
  cargo test --workspace >/tmp/mv4-vault-cargo-test.out 2>&1 || {
    cat /tmp/mv4-vault-cargo-test.out
    FAIL "cargo test --workspace"
  }
  PASS "cargo test --workspace"
else
  FAIL "cargo not found"
fi

STEP "TS checks"
npm run lint >/tmp/mv4-vault-lint.out 2>&1 || { cat /tmp/mv4-vault-lint.out; FAIL "npm run lint"; }
PASS "npm run lint"

npm run typecheck >/tmp/mv4-vault-typecheck.out 2>&1 || {
  cat /tmp/mv4-vault-typecheck.out
  FAIL "npm run typecheck"
}
PASS "npm run typecheck"

npm test >/tmp/mv4-vault-test.out 2>&1 || { cat /tmp/mv4-vault-test.out; FAIL "npm test"; }
PASS "npm test"

echo "SMOKE_VAULT_PHASE1_OK"
