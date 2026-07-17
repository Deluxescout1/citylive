# PLAN — "Real Sky & Space" batch (→ v1.7.0)

Fable-planned 2026-07-16 late night (post-v1.6.0). Branch `sky-space`.
Rules: canonical engine + sync ×4 + md5; both-platform gate; pure clock+hash (fetches use
shared wall-clock buckets like weather/airq); KDE QUAL 0/1/2 budget; verify via
desktop/kde-repro (SYNC renderer/city.js FIRST — probe=heli/bus/pub/exp exist; clock param
= epoch-ms wall-clock pin, e.g. 63000000=12:30PM EST; capture=window×DPR 1.65625,
engine→capture ×3.3125 at scale=2; FORCEAGE number changes which world renders).

## Nick's locked answers (2026-07-16 AskUserQuestion)
- Dark sky: REALISTIC + BLACKOUT RETURNS — village = full Milky Way/Andromeda spectacle;
  metropolis washes it out; it RETURNS during pollution finale lights-out, storm blackouts,
  and deep 3-4am tower-dark hours. The sky is a story beat.
- Aurora: REAL NOAA KP data, generous threshold — KP≥5 faint north-horizon shimmer,
  KP≥7 full curtains. Event nights match real news.
- Space age: EVERY LIFE'S FINAL ACT — after peak, before finale.
- Scope: ONE batch → v1.7.0.

## KEY DISCOVERY (verified in code)
The SPACE AGE already exists, fully built, DORMANT: `curSpace` (1735) is consumed by
drawFutureBuilding 3144, skybridges gen 2027/draw, hover fleet 2325, streetlight orbs 3712,
ticker 4470, landmark future-claim 5370, SPACEPORT + ROCKET LAUNCHES 8532-8600 (gantry
build-out, fueling, rumble, liftoff, sky lanes 8598, teaser rings 8671, shuttle re-entry
8708) — but curSpace is NEVER SET outside DEMO_APOC test (9610). The driver is the batch.
Also already real: meteor showers on real dates 368/4308-4347 (Perseids/Geminids/Quadrantids),
storm blackouts L1 4348+, real STARS/altAz/lst 269-360, light-pollution star thinning 1432,
drawMoon real phase 257, drawShootingStar 4268.

## Work items
S1 curSpace driver: in the frame-state block where cityG/cityPhase set from cityGrowth(now):
   `curSpace = (phase!=="apoc") ? clamp((cy-0.87)/0.075, 0..1) : 1` — ramps through the
   final ~15% of peak (last ~13h of a week life), holds 1 into the apocalypse. FORCEAGE
   number path: cy=g*0.78 means forced-age never reaches 0.87 — ALSO honor
   FORCEAGE.sp (add {sp} support in the object form) + kde-repro `space` query param
   for render tests. VERIFY the whole dormant kit at curSpace .3/.7/1: future towers,
   skybridges, hovercars, spaceport build→launch, sky lanes, day+night.
S2 MOON COLONY: drawMoon(257) gains colony=curSpace arg: lights cluster on the dark limb
   (2-6 cyan/warm pixels growing with curSpace), a dome arc at curSpace>0.6, faint
   shuttle pixel streaking moon-ward on a slow slot. Night only (moon drawn when dark).
S3 MILKY WAY + ANDROMEDA (the flagship): precompute MWPTS once (~170 pts): galactic
   equator sampled every 2° of longitude ℓ, galactic→equatorial rotation (pole RA 192.859°
   Dec 27.128°, l_NCP 122.932°), width/density vary with |b| jitter + bulge ×2.2 density
   near ℓ=0 (Sagittarius core, RA 17.76h Dec -29°) + dark rift (skip ℓ 20-50° half-density)
   + ~30 bright knots. Per frame when dark & clear: altAz project (same as STARS), draw
   lighter-blend 1-2px dabs, alpha = base(mag) × skyDark × (1-lpK). ANDROMEDA: elongated
   4×2 smudge + core pixel at RA 0.712h Dec +41.27°, slightly stronger alpha law.
   LIGHT-POLLUTION LAW (new global, set once per frame beside goldenK):
   lpK = min(1, cityG × (0.30+0.70×litK)) where litK = city-lights activity:
   1 in the evening, ~0.4 at 3-4am (deep-night dimming), ×(1-apocKill) during pollution
   lights-out, and ×(1-blackoutK) if the L1 storm blackout is citywide-ish. Zenith bias:
   points at alt>50° suffer 0.6×lpK (glow hugs the horizon — matches existing 1432 law).
   QUAL===0: stride 2 through MWPTS.
S4 AURORA: fetch NOAA KP shared-bucket (30 min, same idiom as airq — one URL:
   services.swpc.noaa.gov/products/noaa-planetary-k-index.json, last row = latest KP).
   Global kpNow (default 0 offline → feature silently absent; FORCEKP test hook + kde-repro
   `kp` param). Draw when dark & clear-ish: NORTH = azimuth 0 → the az→worldX mapping from
   the star projector (355-360) localizes the display over the world's north span.
   KP 5-6: low green horizon band, gentle sine shimmer. KP≥7: full curtains — 8-14 vertical
   lighter-blend gradient streaks, heights 30-80px, sway sin(now*0.0004+i), green
   [90,255,150] core + magenta [200,90,220] crowns, alpha ramps (kp-4)/4. Behind clouds law
   (vis factor like stars). QUAL===0: band only, no curtains.
S5 ISS: 1-2 passes per clear night (hash slot on date), pass ≈ 200s: bright white 1px dot
   + 1px trailing fade crossing the whole world on a shallow arc (worldX sweeps WW,
   y = 20+18*sin(progress*π) inverted arc), only when dark. Marker: subtle — it's a dot,
   not a plane (planes blink; ISS is steady).
S6 Shower dates: add Lyrids (Apr 21-23), Orionids (Oct 20-22), Leonids (Nov 16-18) to
   meteorShowerActive (BOTH copies 368 + 4309 — they're duplicates, keep in lockstep).
S7 sync ×4 + md5 + tests; matrix: village dark-sky night (Milky Way full), metropolis
   night (washed out), 3am deep-night (partial return), pollution mid (sky returns as
   lights die — the story beat), aurora kp=5/kp=8 forced, ISS pass, space age .3/.7/1
   day+night incl spaceport launch moment + moon colony, showers regression, v1.5/1.6
   feature regression (golden hour, expeditions, pub).
S8 BOTH-PLATFORM GATE (KDE live + WinTest VM) per standing rule → merge → 1.7.0 → tag →
   watch release (rerun --failed on fpm/CDN flakes).

## What NOT to do
Don't touch the existing STARS/asterism/moon-phase math. Don't let MW/aurora/ISS draw in
daylight/overcast (vis gates like stars 1427). No per-frame allocations: MWPTS/AURORA
streak params precomputed or derived arithmetically. Every lighter block restores
source-over. NOAA fetch must be shared-bucket + never-throw (geocode.js discipline).
curSpace driver must NOT fire during "grow" phase or after FORCEDEATH-forced apoc replay
weirdness (drive only from cy in peak). DEMO_APOC 9610 already sets curSpace=1 — leave it.
Engine copies ×4 + md5 before any kde-repro render (bitten once already).

## Ordered steps & state  ⟵ UPDATE AS EXECUTED
- [x] 0 branch `sky-space` + this doc
- [x] 1 S1 curSpace driver + FORCEAGE.sp + kde-repro space param; dormant-kit renders
- [x] 2 S2 moon colony (renders: colony growth at space .3/.7/1)
- [x] 3 S3 Milky Way/Andromeda + lpK law (renders: village vs metropolis vs 3am vs pollution)
- [x] 4 S4 aurora fetch + renderer (renders: kp 5 band, kp 8 curtains)
- [x] 5 S5 ISS pass (render: dot on arc mid-pass)
- [x] 6 S6 extra shower dates (code-only + one Lyrids-night render)
- [ ] 7 S7 sync ×4 + tests + full matrix
- [ ] 8 S8 both-platform gate → SHIP v1.7.0
