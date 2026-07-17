# PLAN — "Beautiful Update" batch (→ v1.5.0)

Fable-planned 2026-07-16 (engine md5 0e3f5db2…, 10269 lines). Branch `beautiful-update`.
Rules: canonical engine only + sync ×4 + md5; both-platform gate before merge/tag; pure
clock+hash determinism; KDE 3×10fps budget (QUAL 0/1/2 numeric!); render-verify via
desktop/kde-repro.{html,js} (verify-scale CLDEATH/CLAPOC still clobbered by index.html
applyOverrides:143-147/177 — NOT fixed this batch, use kde-repro).

## Scope: #1 golden light/glow · #14 fire · #15 haze · #26 clouds · #22 rooftop signs · #28 waterfront

## Key anchors (verified; engine lines at plan time)
- SKY palette 215/dayPhase 236-245 · sky gradient (2-stop) 9344-9348 · night dome (3-stop model) 9350-9358
- sun disc/halo/god-rays 9375-9400 (lowSun<0.14 @9390) · curSunDf 1726/9366
- facade dir-light 3059-3064 · ground shadows 3084-3088 (cap 2+16px) · building color composition 3043-3046
- sunsetK ONLY at mountains 6593-6601 + clouds 9443-9445/9461-9462 (→ replace with global goldenK)
- night bloom targets: radiance halo 3145-3153 (QUAL>0) · LED 3177 · neon glyph 3186-3198 (backing 0.20*buzz)
  · billboard 3200-3208 · storefront 3168-3170 · windows 3110-3138 (NO per-window bloom — forbidden)
- HAZE offenders: smog band two flat rects 9500-9502 · fog 4 bands+flat 10196-10199 · wildfire low band 10210-10214
  · per-building haze MIX law 9498/9503/9510→3046 = LEAVE ALONE. Existing gradients: 4304,6855,9345,9353,9611
- DEAD CODE: QUAL==="performance" at 8068 & 10221 (QUAL numeric 0/1/2 per 1717/1905) → QUAL===0 (step 0)
- FIRE: shared drawFlame 705-728 (parabola+2-octave hash turb) / drawFireSmoke 730-737; callers trees 775,
  building-fire 3899, cook-fire 6690, campfire 6983. Blocky inline: disaster STRIKE 5575-5582 / AFTERMATH
  5596-5599 (cold/wet branches 5564-5574 STAY) · apoc meteors 9086-9090 · sunburst 9101-9105 · alienwar ~9146 · crash 2133+
- CLOUDS: gen 1967-1969 (no type/QUAL) · draw 9436-9463 (drift 9440, wrap 9441, tint 9443) · overcast 9465-74 (leave)
  · fillEllipse 8403 · fg-canvas every frame
- SIGN: drawCorpHQ 5107-5126 · pole 5116 · sy=top-15 @5112 · mst anchor 5111 + gate 5256 = DO NOT BREAK
- WATERFRONT: eachWaterSpan 3736 · drawHarbor 3799-3842 (sand strips 3810-26 = replace; neon refl 3827-31;
  bridge gstage(0.52,0.66); boats 3835) · GOOD idiom to port: drawOpenSea beach/foam/breakers 4362-4375
  · waterTex 4301-4333 · gstage 1714 · hasOcean 2059 · NO island exists yet
- kde-repro params: cw/ch/woff/ww/scale/screenw/screenh/smooth/age/death/apoc/now/clock + step-0 adds dis/disf

## Design specs (condensed — full stops/alphas in the Fable plan, reproduced inline where non-obvious)
A1: global goldenK=max(0,1-|L-0.5|*2.4) + goldC (dawn [255,196,140]/dusk [255,158,96]) set once per frame;
  horizon additive gradient (0,H*0.35)→(0,H+4) stops 0/.16k/.30k; buildings mixc(col,goldC,.22k*dayLit) at 3046;
  terrain/road/water/harbor one-line folds ≤.25k; shadows cap 16→26 + soft half-alpha tail; mountains+clouds
  read the GLOBAL. Night bloom: radiance 3rd rect above roofline .35glow; neon nested ±1px .10buzz; billboard
  ±1px half-alpha; storefront .14→.18+1px. NO shadowBlur/filter ever.
A2: drawFlame envelope × per-column lick (sin(dx*2.3+seed*.7+floor(now/450)) → 2-4 tongues); tip taper; keep
  color ramp + add 1px deep-red tip cap; global breath .85+.15sin(now*.006+seed*2.1); embers longer+wind arg;
  smoke blends toward sky [140,150,165] as it thins; fw cap ≤24 defensively. Convert inline sites to shared calls
  (disaster strike: 2 flames + keep firelight wash 5577; aftermath: 1 low flame ×fade; apoc sites 1-3 flames).
A3 (Sonnet): smog band → ONE gradient (0,H*.42)→(0,H*.78) magenta→teal stops, sine wobble on origins; fog bands
  get 2px feather rects + flat rect → gradient peak .45; wildfire band → gradient (0,H*.4)→(0,H+GROUND).
A4 (Sonnet): cloud gen adds t:(i%7<3?0:(i%7<6?1:2)) wisp/cumulus/streak + count WW/(QUAL===0?95:70)+3; cumulus =
  base rect + 3 fillEllipse lobes (.25/.55/.8 centres, ry 3-5) + top-light ellipse + keep base shade/underside;
  wisp = 2 rects + feather; streak = thin wide rect + feather; keep drift/wrap/tint laws byte-wise.
A5 (Sonnet): sy=top-12; pole → base beam (cX-panelW/4,top-1,panelW/2,1) + 2 angled 3-step struts from panel
  corners + 2px centre post; panel/rails/logo/text byte-identical; all geometry f(top,panelW) only.
A6: port meander/foam/breakers from drawOpenSea into drawHarbor replacing 3810-3826 (scale by (1-dockA));
  reeds/rocks/driftwood hash-placed ×(1-dockA); fishing pier gstage(.18,.38) + boardwalk gstage(.5,.7) w/ lamps;
  1 layered island per span — NICK LOCKED: LIGHTHOUSE ISLAND on one shore (small working lighthouse,
  red/white stripes, ROTATING BEAM sweeping the water at night) + trees/cottage-light island on the other;
  mound rows + reflection rows for both;
  warm goldenK water reflections (gate cityG>.15) alongside neon (cityG>.5).

## Ordered steps & state  ⟵ UPDATE AS EXECUTED
- [x] 0 (inline) branch ✓ + QUAL==="performance"→===0 (8068,10221) + kde-repro dis/disf params + this doc
- [x] 1 A1 golden pass DONE render-verified (sunset cinematic, noon untouched) (globals, sky gradient, folds, shadows, mountains/clouds→global) + sunrise/sunset renders
- [x] 2 night bloom DONE (subtle, night-render verified)
- [x] 3 A3 haze gradients DONE (Sonnet, render-verified incl forced fog/smoke contrast)
- [x] 4a flame idiom DONE (committed); - [ ] 4b inline-site conversions (disaster STRIKE/AFTERMATH ~5575/5596, apoc meteors/sunburst/alienwar ~9086/9101/9146, crash ~2133) + burning-city render proof
- [x] 5 A4 clouds DONE (Sonnet, cross-slice verified)
- [x] 6 A5 sign truss DONE (Sonnet, age sweep verified)
- [ ] 7 (Opus) A6 waterfront (incl. LIGHTHOUSE island w/ rotating night beam — Nick locked)
- [ ] 7b (Opus) A8 NICK BUG: floating lit-window row in empty sky (likely train w/o viaduct — gate train render by track existence; reproduce village/dusk) +  A7 NICK ADD: flowers NEVER on road/asphalt (grass only); wildlife looks like real animals (deer silhouette w/ head/legs/tail), grass-only, street-dashes allowed only while cityG low
- [ ] 8 sync ×4 + md5 + npm test
- [ ] 9 verification matrix (see Fable plan §4: A1 4tod×3ages+bloom-banding scale3smooth1; A2 disaster/apoc/campfire
      set; A3 dusk seam checks; A4 cross-slice continuity woff 776/1629; A5 age sweep; A6 9-frame grid + edge woffs;
      cross-screen seam diffs; fps spot-check night metropolis vs main)
- [ ] 10 both-platform gate (KDE deploy 3-monitor dusk+disaster watch · VM app run + tests)
- [ ] 11 bump 1.5.0 → merge → tag (after v1.4.0 finally publishes — GitHub outage queue)

## What NOT to do
Canonical-only sync; no Math.random in painters; ±WW wrap for world props; golden folds NEVER replace base
palettes (≤.25 alpha mixes over cityEra.tint/district colors); mst anchoring 5111/5256 untouched; v1.4 apoc/
invasion renderers untouched beyond listed flame rects; haze MIX constants untouched; no per-window bloom;
no shadowBlur/filter; no per-frame allocations in building loops; bounded loops (flame ≤24 cols, fixed lobes,
stride ≥3); every lighter block restores source-over.
