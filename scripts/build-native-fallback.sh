#!/usr/bin/env bash
set -e

BINARY_NAME="crates/memphis-napi/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).node"

if [ ! -f "$BINARY_NAME" ]; then
  echo "Pre-built binary not found, compiling from source..."
  source $HOME/.cargo/env 2>/dev/null || true
  cargo build --release -p memphis-napi
  cp target/release/libmemphis_napi.* "$BINARY_NAME" || cp target/release/memphis_napi.* "$BINARY_NAME"
fi
