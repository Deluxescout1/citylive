#!/usr/bin/env bash
# Steady-state plasmashell CPU, sampled from /proc so it is a real average over a window rather
# than top's first-sample lie. Prints % of ONE core.
#
# Why this exists: every projection from the offscreen QML harness to real desktop CPU has been
# wrong (see docs/PERF-freeze-diagnosis-20260724.md — a predicted 33%->23% was really 40%->36%).
# The harness measures engine JS only; rasterising, texture upload and compositing are most of the
# cost and none of it shrinks the way JS does. So: A/B on the real desktop, back to back.
#
# ⚠ Time of day is a confound — a daytime city costs noticeably more than a night one. Compare runs
# taken minutes apart, never hours.
#
# usage: plasma-cpu.sh [seconds]   (default 45)
set -euo pipefail
WINDOW="${1:-45}"
PID="$(pgrep -x plasmashell | head -1)"
[ -n "$PID" ] || { echo "plasmashell is not running"; exit 1; }
CLK="$(getconf CLK_TCK)"

read_jiffies() { awk '{print $14+$15}' "/proc/$PID/stat"; }

T0="$(read_jiffies)"; W0="$(date +%s.%N)"
sleep "$WINDOW"
T1="$(read_jiffies)"; W1="$(date +%s.%N)"

awk -v t0="$T0" -v t1="$T1" -v w0="$W0" -v w1="$W1" -v clk="$CLK" -v win="$WINDOW" \
  'BEGIN { printf "plasmashell %.1f%% of one core over %.1fs\n", 100*((t1-t0)/clk)/(w1-w0), w1-w0 }'
