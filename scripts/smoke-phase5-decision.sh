#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUT1="$(npm run -s cli -- decide --input "Decyduję: provider - ollama" --json)"
OUT2="$(npm run -s cli -- infer --input "Wybieram: model - qwen" --json)"

echo "$OUT1" | grep -q '"ok": true'
echo "$OUT1" | grep -q '"detected": true'
echo "$OUT2" | grep -q '"ok": true'
echo "$OUT2" | grep -q '"detected": true'

echo "[smoke-phase5-decision] PASS"
