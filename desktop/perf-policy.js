// CityLive — how expensive should this machine's city be?
//
// 🚨 THE BUG THIS REPLACES. The auto tier was `(width * height > 2200000) ? "balanced" : "spectacle"`
// — screen AREA, used as a proxy for how much machine is available. That proxy is not merely weak, it
// is INVERTED exactly on the machine we now care about: a cheap laptop has a SMALL screen, so it fell
// through to `spectacle`, the most expensive tier, on the weakest hardware we ship to. A 4K desktop
// with 28 threads got the cheap tier and a 4-core Surface got the expensive one. The Electron app was
// worse still — it defaulted to `spectacle` with no hardware check of any kind.
//
// 🔑 THE RULE IS A CAP, NOT A REPLACEMENT, AND THAT IS DELIBERATE. Screen area still decides the tier;
// the machine can only ever pull it DOWN. Nick's three-monitor desktop is the surface this project is
// judged on and its look is settled (8 fps + coarse texels, chosen explicitly and confirmed) — a rule
// that re-derived his tier from scratch would risk changing it to fix a laptop he is not looking at.
// With a cap, 28 threads and 64 GB cap at `spectacle`, which is no cap at all, and his desktop keeps
// the exact tier it resolves to today. Only machines that genuinely cannot afford it move.
//
// 🔑 AN EXPLICIT CHOICE IS NEVER OVERRIDDEN. If the user picked a tier in Settings, that is the tier.
// A performance guard that quietly countermands the human is a bug report waiting to happen.
//
// ⚠ DECIDED AT STARTUP AND ON DISCRETE EVENTS ONLY (AC↔battery, display change) — never continuously
// retuned. Nick's own call, and he is right: a loop that keeps re-picking reads as stutter.

// Cheapest last. Index order IS the cost order and several comparisons below depend on it.
const TIERS = ['spectacle', 'balanced', 'performance'];

function idx(t) { const i = TIERS.indexOf(t); return i < 0 ? 0 : i; }
function name(i) { return TIERS[Math.max(0, Math.min(TIERS.length - 1, i))]; }
// "Cheaper wins" — the whole policy is a max() over independent opinions about cost.
function cheaper(a, b) { return name(Math.max(idx(a), idx(b))); }

// ── The thresholds. Calibration lives HERE, in one place, on purpose — and these are no longer
// guesses: they were moved after measuring a real Surface-class laptop (i5-1035G7, 8 logical cores,
// 7.5 GB, HiDPI panel), with the desktop genuinely visible and the guard confirmed not suspending:
//     balanced    (8 fps)   78.7% of one core  =  9.84% of TOTAL CPU   ← nearly 2x over budget
//     performance (2 fps)   23.8% of one core  =  2.98% of TOTAL CPU   ← passes
// The first version of these thresholds gave that machine `balanced`, i.e. it "fixed" the inverted
// tier and still shipped a wallpaper costing a tenth of the whole CPU, continuously, on the exact
// class of machine this work exists for.
//
// ⚠ FRAME RATE IS THE ONLY LEVER THAT WORKS. Canvas size was the obvious alternative — spend pixels
// instead of smoothness — and it was measured and it does NOTHING: pxk 3, 5 and 6 cost 77.7%, 78.4%
// and 80.1% on that laptop, because the engine holds the world size constant and compensates with
// zoom, so the canvas never actually shrinks. Do not re-propose it without re-measuring.
//
// ⚠⚠ AND THESE ARE STILL A PROXY, WHICH IS THE ORIGINAL SIN OF THE RULE THEY REPLACED. Cores and RAM
// predict CPU cost about as honestly as screen area did — an 8-core 16 GB ultrabook will pass the
// `balanced` test here and may well be as slow as the machine above. The principled fix is a ONE-TIME
// calibration at first boot (time some real frames, pick a tier, cache it, re-decide only on discrete
// events). It is not done here because the first frames of a life are legitimately slow — the cold
// P_sim fold and the first backdrop paint — so a naive measurement downgrades every machine, and that
// trap needs verifying across several machines before it can be trusted more than these numbers.
// ⚠ THE BALANCED THRESHOLD WAS RELAXED BACK once the real cost driver was found. It was briefly
// tightened to force a laptop onto `performance` (2 fps) — which fixed the CPU number by destroying
// the thing the wallpaper is for. Nick, immediately: "the whole CityLive wallpaper isn't moving… it
// needs to run like it SHOULD look, and have all the same features." The laptop was expensive because
// it rendered at full device resolution, not because 8 fps is unaffordable; with that fixed it runs
// the same tier as a 4K desktop at 4.01% of total CPU.
// 🔑 BUY THE FRAMES BACK BY DRAWING FEWER PIXELS, NEVER BY DRAWING FEWER FRAMES. A performance guard
// that reaches its number by making the product worse has not solved the problem, it has renamed it.
const NEEDS_FOR_SPECTACLE = { cores: 12, memMB: 15000 };  // a real desktop
const NEEDS_FOR_BALANCED  = { cores: 4,  memMB: 7000 };   // an ordinary laptop can afford 8 fps

// What the hardware alone can afford, ignoring the screen.
function hardwareCap(m) {
  const cores = (m && m.cores) || 1;
  const memMB = (m && m.memMB) || 0;
  if (cores >= NEEDS_FOR_SPECTACLE.cores && memMB >= NEEDS_FOR_SPECTACLE.memMB) return 'spectacle';
  if (cores >= NEEDS_FOR_BALANCED.cores && memMB >= NEEDS_FOR_BALANCED.memMB) return 'balanced';
  return 'performance';
}

// The screen's own opinion — the original rule, preserved exactly so existing machines resolve
// identically. `pixels` is the canvas load: width x height of ONE wallpaper surface.
function screenTier(pixels) {
  return (pixels > 2200000) ? 'balanced' : 'spectacle';
}

// Every extra monitor is another full-screen canvas rastered and uploaded every frame. Three screens
// is three times the paint, and paint — not JavaScript — is where this app's cost actually lives.
function displayPenalty(tier, displayCount) {
  if (!(displayCount > 2)) return tier;
  return cheaper(tier, 'balanced');
}

// ⚠ ONE STEP, NOT STRAIGHT TO THE FLOOR. Unplugging a laptop should visibly calm the city down, not
// freeze it — a wallpaper that turns into a slideshow the moment the charger comes out reads as broken.
function batteryStep(tier, onBattery) {
  return onBattery ? name(idx(tier) + 1) : tier;
}

// The whole decision.
//   m = { cores, memMB, pixels, displayCount, onBattery, userChoice }
// Returns { tier, reason } — `reason` is logged and written into the perf log, because a tier nobody
// can explain is a tier nobody can debug.
function decide(m) {
  const o = m || {};
  if (o.userChoice && TIERS.indexOf(o.userChoice) >= 0) {
    return { tier: o.userChoice, reason: 'user' };
  }
  const scr = screenTier(o.pixels || 0);
  const hw = hardwareCap(o);
  let tier = cheaper(scr, hw);
  const afterDisplays = displayPenalty(tier, o.displayCount || 1);
  const afterBattery = batteryStep(afterDisplays, !!o.onBattery);
  const reason =
    afterBattery !== afterDisplays ? 'battery' :
    afterDisplays !== tier ? 'displays' :
    idx(hw) > idx(scr) ? 'hardware' : 'screen';
  return { tier: afterBattery, reason: reason };
}

module.exports = { TIERS, decide, hardwareCap, screenTier, displayPenalty, batteryStep, cheaper };
