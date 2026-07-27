#!/usr/bin/env bash
# Back-to-back A/B of two ENGINE builds against real plasmashell CPU.
#
# perf-ab.sh A/Bs main.qml settings; this A/Bs city.js itself. Same discipline applies and it is the
# reason this exists at all: the city is a moving target — a disaster, a festival, or simply which
# LAND rolled costs wildly different amounts (18.6% and 30.9% measured on two lands within an hour).
# So the two builds are alternated A/B/A/B within a few minutes, never compared across a re-roll.
set -euo pipefail
W="$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js"
OLD="$1"; NEW="$2"; SAMPLE="${SAMPLE:-40}"; SETTLE="${SETTLE:-14}"

if pgrep -x qml6 >/dev/null; then echo "REFUSING: a qml6 benchmark is running and would poison every sample"; exit 1; fi

sample() {
  cp "$1" "$W"
  kquitapp6 plasmashell >/dev/null 2>&1 || true
  sleep 3
  (setsid plasmashell >/dev/null 2>&1 &) || true
  sleep "$SETTLE"
  local P T0 T1 HZ
  P=$(pgrep -x plasmashell | head -1)
  HZ=$(getconf CLK_TCK)
  T0=$(awk '{print $14+$15}' "/proc/$P/stat")
  sleep "$SAMPLE"
  T1=$(awk '{print $14+$15}' "/proc/$P/stat")
  awk -v a="$T0" -v b="$T1" -v s="$SAMPLE" -v hz="$HZ" 'BEGIN{printf "%.1f", (b-a)/s/hz*100}'
}

printf '%-10s %s\n' "BUILD" "plasmashell (% of one core)"
for round in 1 2; do
  printf '%-10s %s\n' "before$round" "$(sample "$OLD")"
  printf '%-10s %s\n' "after$round"  "$(sample "$NEW")"
done
cp "$NEW" "$W"
echo "(left the NEW build deployed)"
