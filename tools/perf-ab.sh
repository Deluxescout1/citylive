#!/usr/bin/env bash
# Back-to-back A/B of wallpaper settings against REAL plasmashell CPU.
#
# Nothing else may be running: a stray offscreen qml6 benchmark competing for a core once made
# 10 fps read 117% when a clean re-measure said 62%. And the city itself is a moving target — a
# disaster, a festival or simply daytime costs more than a quiet night — so every configuration
# has to be sampled within minutes of the others, never compared across hours.
#
# usage: perf-ab.sh "<label>;<texelBuf-expr>;<balanced-frameMs>" ...
# Fields are ";"-separated because the texelBuf expression contains colons.
set -euo pipefail
W="$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents"
QML="$W/ui/main.qml"
SAMPLE="${SAMPLE:-40}"
SETTLE="${SETTLE:-22}"
cp "$QML" "/tmp/main.qml.abbackup.$$"
restore() { cp "/tmp/main.qml.abbackup.$$" "$QML"; rm -f "/tmp/main.qml.abbackup.$$"; }
trap restore EXIT

if pgrep -x qml6 >/dev/null; then echo "REFUSING: a qml6 benchmark is running and would poison every sample"; exit 1; fi

printf '%-28s %s\n' "CONFIG" "plasmashell (% of one core)"
for spec in "$@"; do
  label="${spec%%;*}"; rest="${spec#*;}"
  texel="${rest%%;*}"; frame="${rest##*;}"
  # rewrite the two lines that define canvas size and live-pass cadence
  sed -i -E "s@^    readonly property real texelBuf: .*@    readonly property real texelBuf: ${texel}@" "$QML"
  sed -i -E "s|(readonly property int frameMs: quality === \"performance\" \? 500 : \(quality === \"balanced\" \? )[0-9]+|\1${frame}|" "$QML"
  systemctl --user restart plasma-plasmashell.service
  sleep "$SETTLE"
  out="$("$HOME/CityLive/tools/plasma-cpu.sh" "$SAMPLE")"
  # ~0% means the wallpaper is not drawing at all — a broken edit reads as a fantastic result
  case "$out" in *" 0.0% "*|*" 0."[0-9]"% "*) out="$out   <-- SUSPECT: wallpaper not rendering?";; esac
  printf '%-28s %s\n' "$label" "${out#plasmashell }"
done
