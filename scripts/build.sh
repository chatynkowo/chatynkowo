#!/usr/bin/env bash
# Single build entry point for Chatynkowo.
#
# Run locally via `npm run build` and from .github/workflows/pages.yml on
# deploy, so local dev and the official build produce the same artifacts.
# Every generated file lands in the gitignored output dir ($OUT, default
# "dist") — nothing is written back into the source tree.
set -euo pipefail

# Always operate from the repo root, wherever this script is invoked from.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-dist}"

echo "[build] cleaning $OUT/"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "[build] generating tourist route -> $OUT/"
node scripts/build-route.js "$OUT"

echo "[build] done"
