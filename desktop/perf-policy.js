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

// ── The thresholds. Calibration lives HERE, in one place, on purpose: every one of these numbers is a
// guess until it has been measured on a real low-end laptop, and the follow-up work is expected to be
// "change these three lines", not "find where this decision is made".
const NEEDS_FOR_SPECTACLE = { cores: 8, memMB: 15000 };   // 16 GB machines report ~15.7 GB
const NEEDS_FOR_BALANCED  = { cores: 4, memMB: 7000 };    // 8 GB machines report ~7.8 GB

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
