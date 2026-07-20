#!/usr/bin/env bash
# v1.24 CONTAINMENT GUARD (advisor). Every Total-Control effect is gated on curRegime.active, but
# regime-diff.js only covers STATE (ticker/mayor) — it cannot see a flag/wash/curfew render leaking
# into a non-regime life. This renders a pinned, GUARANTEED non-regime, grown night metropolis (cy 0.85
# > the regime window → regimeState always null) on BOTH the current engine and the pinned pre-v1.24
# reference engine (regime-contain.ref.js) IN THE SAME RUN, and asserts the two PNGs are byte-identical.
# In-run A/B cancels environmental drift (kde-repro doesn't pin weather; some code reads the real date),
# so ANY difference is purely code = a regime effect leaked outside curRegime, or draw order/a shared
# global changed. Run after EACH phase.  Usage: bash tools/regime-contain.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="now=1784255400000&clock=1784255400000&space=0.4&woff=0&noflights=1&nolivesky=1&nonewstv=1"   # noflights/nolivesky/nonewstv: post-v1.24 overlays (live aircraft, live sky, rooftop news jumbotrons) the pre-v1.24 ref lacks — suppress them so the A/B stays byte-identical
REF="tools/regime-contain.ref.js"
CUR="renderer/city.js"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
render(){ KRQ="$BASE" KROUT="$1" xvfb-run -a node_modules/.bin/electron kde-repro.js >/dev/null 2>&1; }
# current engine
render "$TMP/cur.png"; sha_cur=$(sha256sum "$TMP/cur.png" | awk '{print $1}')
# reference engine (swap in, render, restore) — same environment as the current render just above
cp "$CUR" "$TMP/backup.js"; cp "$REF" "$CUR"
render "$TMP/ref.png"; cp "$TMP/backup.js" "$CUR"
sha_ref=$(sha256sum "$TMP/ref.png" | awk '{print $1}')
if [ "$sha_cur" = "$sha_ref" ]; then echo "CONTAIN_OK (non-regime render byte-identical to pre-v1.24: $sha_cur)";
else echo "CONTAIN_LEAK — a regime effect leaked into a non-regime life"; echo "  current:   $sha_cur"; echo "  pre-v1.24: $sha_ref"; exit 1; fi
