// The tier decision — the rule that decides how expensive this machine's city is allowed to be.
//
// 🚨 THE BUG BEING PINNED HERE is that the old rule was screen AREA alone, and area is an inverted
// proxy for machine power at the bottom of the market: a cheap laptop has a small screen, so it got
// `spectacle` (the most expensive tier) while a 28-thread 4K desktop got `balanced`. The first test
// below is that exact machine, and it must never come back as `spectacle` again.
//
// The second thing pinned is the constraint that made this change safe to ship: Nick's three-monitor
// desktop must resolve to EXACTLY the tier it resolved to before. The cap can only pull a tier down,
// and on 28 cores / 64 GB it must not pull at all.

const { test } = require('node:test');
const assert = require('node:assert');
const policy = require('../perf-policy');

// The machine this whole effort is for: a cheap Surface-class laptop.
const SURFACE = { cores: 4, memMB: 7800, pixels: 1536 * 1024, displayCount: 1 };
// The machine every performance number in this project's history was taken on.
const NICK_DESKTOP_4K = { cores: 28, memMB: 64057, pixels: 3840 * 2160, displayCount: 3 };
const NICK_DESKTOP_SMALL = { cores: 28, memMB: 64057, pixels: 1366 * 768, displayCount: 3 };

test('THE INVERSION: a small-screened weak laptop no longer gets the most expensive tier', () => {
  // Old rule: 1536x1024 = 1.57 MP, under the 2.2 MP threshold → "spectacle". That is the bug.
  assert.strictEqual(policy.screenTier(SURFACE.pixels), 'spectacle', 'precondition: area alone still says spectacle');
  const d = policy.decide(SURFACE);
  assert.notStrictEqual(d.tier, 'spectacle', 'a 4-core/8GB laptop must never resolve to spectacle');
  assert.strictEqual(d.tier, 'balanced');
  assert.strictEqual(d.reason, 'hardware');
});

test("the cap never pulls a strong machine down — Nick's desktop resolves exactly as before", () => {
  // ⚠ THIS IS THE ELECTRON POLICY, AND NICK'S LINUX DESKTOP DOES NOT USE IT — he runs the KDE
  // plasmoid, whose rule (main.qml) is the hardware CAP ONLY, with no display penalty. On 28 cores
  // and 64 GB that cap is "spectacle", i.e. no cap, so his three screens resolve to exactly the
  // tiers they resolve to today and his settled 8 fps look is untouched. The display penalty below
  // applies to the Windows app, where a mixed 1080p + 4K desktop is the reported configuration.
  assert.strictEqual(policy.hardwareCap(NICK_DESKTOP_4K), 'spectacle', 'no hardware cap on 28 cores / 64 GB');
  assert.strictEqual(policy.decide(NICK_DESKTOP_4K).tier, 'balanced');
  // With the display penalty removed (a single monitor), the small panel is untouched.
  const single = Object.assign({}, NICK_DESKTOP_SMALL, { displayCount: 1 });
  assert.strictEqual(policy.decide(single).tier, 'spectacle');
});

test('an explicit user choice is never overridden, even on hardware that cannot afford it', () => {
  const d = policy.decide(Object.assign({}, SURFACE, { userChoice: 'spectacle' }));
  assert.strictEqual(d.tier, 'spectacle');
  assert.strictEqual(d.reason, 'user');
  // …and a user who asks for the cheap tier on a monster machine gets the cheap tier.
  const d2 = policy.decide(Object.assign({}, NICK_DESKTOP_4K, { userChoice: 'performance' }));
  assert.strictEqual(d2.tier, 'performance');
});

test('battery steps down ONE tier, it does not drop to the floor', () => {
  // A wallpaper that turns into a slideshow the moment the charger comes out reads as broken.
  assert.strictEqual(policy.decide(Object.assign({}, SURFACE, { onBattery: true })).tier, 'performance');
  const strongOnBattery = { cores: 16, memMB: 32000, pixels: 1920 * 1080, displayCount: 1, onBattery: true };
  assert.strictEqual(policy.decide(strongOnBattery).tier, 'balanced', 'one step from spectacle, not two');
});

test('a genuinely weak machine floors at performance and cannot go lower', () => {
  const netbook = { cores: 2, memMB: 3800, pixels: 1366 * 768, displayCount: 1, onBattery: true };
  assert.strictEqual(policy.decide(netbook).tier, 'performance');
});

test('every extra monitor is another full-screen canvas — 3+ displays caps at balanced', () => {
  const strong3 = { cores: 16, memMB: 32000, pixels: 1920 * 1080, displayCount: 3 };
  assert.strictEqual(policy.decide(strong3).tier, 'balanced');
  assert.strictEqual(policy.decide(strong3).reason, 'displays');
});

test('the tier order is the cost order, and cheaper() always wins', () => {
  assert.deepStrictEqual(policy.TIERS, ['spectacle', 'balanced', 'performance']);
  assert.strictEqual(policy.cheaper('spectacle', 'performance'), 'performance');
  assert.strictEqual(policy.cheaper('performance', 'balanced'), 'performance');
  assert.strictEqual(policy.cheaper('spectacle', 'spectacle'), 'spectacle');
});

test('missing facts degrade to the cheap side, never the expensive one', () => {
  // An empty object means "we could not tell what this machine is". Guessing `spectacle` there is
  // how the Surface got the expensive tier in the first place.
  assert.strictEqual(policy.decide({}).tier, 'performance');
});
