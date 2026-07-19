#!/usr/bin/env bash
# v1.24 CONTAINMENT GUARD (advisor): every Total-Control effect is gated on curRegime.active, but
# regime-diff.js only covers STATE (ticker/mayor) — it CANNOT see a flag/wash/curfew render leaking
# into a non-regime life. This renders a pinned, GUARANTEED non-regime, grown night metropolis
# (cy 0.85 > the regime window → regimeState always null) and asserts the PNG is byte-identical to the
# pre-v1.24 baseline. Any drift = a regime effect leaked outside curRegime, or draw order/a shared
# global changed. Run after EACH phase.  Usage: bash tools/regime-contain.sh [--rebase]
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="now=1784255400000&clock=1784255400000&space=0.4&woff=0"
REF="tools/regime-contain.base"
OUT="/tmp/regime-contain-out.png"
KRQ="$BASE" KROUT="$OUT" xvfb-run -a node_modules/.bin/electron kde-repro.js >/dev/null 2>&1
SHA=$(sha256sum "$OUT" | awk '{print $1}')
if [ "${1:-}" = "--rebase" ]; then echo "$SHA" > "$REF"; echo "CONTAIN_REBASED $SHA"; exit 0; fi
if [ ! -f "$REF" ]; then echo "$SHA" > "$REF"; echo "CONTAIN_BASELINE_SET $SHA"; exit 0; fi
WANT=$(cat "$REF")
if [ "$SHA" = "$WANT" ]; then echo "CONTAIN_OK (non-regime render byte-identical: $SHA)";
else echo "CONTAIN_LEAK — non-regime render CHANGED"; echo "  baseline: $WANT"; echo "  now:      $SHA"; exit 1; fi
