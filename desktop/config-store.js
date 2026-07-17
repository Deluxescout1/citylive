// CityLive — persistent user settings store (birthdays, location, speed, quality,
// era, disaster frequency).
//
// Deliberately has NO Electron dependency: it takes the config-file path as an
// argument, so the real read/write/validate logic can be unit-tested under plain
// node. The Electron main process (main.js) owns the path (app userData) and calls
// these. The file lives OUTSIDE the app bundle, so auto-updates never overwrite it.

'use strict';
const fs = require('fs');

// A brand-new install: no birthdays, one lifetime per week. (No lat/lon → the engine
// keeps its built-in default location.)
const DEFAULT_CONFIG = { birthdays: [], cycle: '1w' };

// Timeline choices the app offers. "weekly"/"monthly" are accepted as aliases (older
// configs) and normalized; anything unrecognized falls back to one week.
const CYCLES = ['1w', '2w', '3w', '1mo'];
function normalizeCycle(v) {
  if (v === 'weekly') return '1w';
  if (v === 'monthly') return '1mo';
  if (v === 'test') return 'test';               // hidden fast-preview mode (not in the UI)
  return CYCLES.indexOf(v) >= 0 ? v : '1w';
}

// The pixel font only has A-Z, 0-9, space and hyphen — sanitize labels to that set so a
// banner can never render as garbage. Uppercase, collapse whitespace, cap the length.
function sanitizeLabel(s) {
  return String(s == null ? '' : s)
    .toUpperCase()
    .replace(/[^A-Z0-9 \-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

// Coerce arbitrary (possibly hand-edited / corrupt) input into a valid config object.
// Never throws: anything unusable is dropped, not fatal.
function sanitizeConfig(raw) {
  const cfg = (raw && typeof raw === 'object') ? raw : {};
  const out = { birthdays: [], cycle: normalizeCycle(cfg.cycle) };

  const list = Array.isArray(cfg.birthdays) ? cfg.birthdays : [];
  for (let i = 0; i < list.length && out.birthdays.length < 50; i++) {
    const b = list[i];
    if (!b || typeof b !== 'object') continue;
    const m = parseInt(b.m, 10), d = parseInt(b.d, 10);
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) continue;
    const entry = { m: m, d: d, label: sanitizeLabel(b.label) || 'HAPPY BIRTHDAY' };
    if (b.pink) entry.pink = true;
    out.birthdays.push(entry);
  }

  const lat = parseFloat(cfg.lat), lon = parseFloat(cfg.lon);
  if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    out.lat = lat; out.lon = lon;
    // locationName (the human-friendly "Norwich, CT" shown in Settings) only ever
    // persists alongside a valid lat/lon pair — without coordinates it's a stray
    // label with nothing to describe, so it's dropped rather than saved half-formed.
    const name = String(cfg.locationName == null ? '' : cfg.locationName)
      .replace(/[\x00-\x1F\x7F]/g, '')   // strip control chars
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    if (name) out.locationName = name;
  }
  // Tri-state behind-the-icons wallpaper flag (Windows): true = on, explicit false =
  // the user turned it off (never auto-retry), key ABSENT = never decided — on a fresh
  // install the app defaults to wallpaper mode. Only a strict `false` survives as the
  // opt-out; other falsy junk (0/null/'') stays "undecided". See main.js startup gate.
  if (cfg.wallpaper) out.wallpaper = true;
  else if (cfg.wallpaper === false) out.wallpaper = false;

  // Render quality override: only these two exact strings survive; absent lets the
  // engine pick its own default (currently "spectacle").
  if (cfg.quality === 'spectacle' || cfg.quality === 'performance') out.quality = cfg.quality;

  // City era override: 'auto' (follow the live evolving city) or a lowercase-alpha
  // engine era name. Stored as-is — the engine itself resolves an unrecognized name
  // to auto, so we don't need to validate against the live ERAS table here. Absent
  // means auto.
  if (cfg.era === 'auto' || (typeof cfg.era === 'string' && /^[a-z]{2,24}$/.test(cfg.era))) {
    out.era = cfg.era;
  }

  // Disaster frequency: only these three exact strings survive; absent = engine default.
  if (cfg.disasters === 'rare' || cfg.disasters === 'normal' || cfg.disasters === 'frequent') {
    out.disasters = cfg.disasters;
  }

  // Finale pin: 'auto' (a different fate each life, the engine's own default) or one of
  // the 11 exact apocalypse names below; absent/junk drops so the engine picks auto.
  const FINALES = ['meteors', 'nuke', 'sunburst', 'ai', 'bh', 'alienwar', 'frost', 'kaiju', 'flood', 'kaijuwar', 'pollution', 'moonfall'];
  if (cfg.finale === 'auto' || FINALES.indexOf(cfg.finale) >= 0) {
    out.finale = cfg.finale;
  }

  // World-restart request: a "pick your apocalypse now" click. worldRestartAt is the ms
  // timestamp of that click (only finite positive integers survive — Number-coerce, then
  // floor so a stray fractional value can't sneak through), worldRestartMode says whether
  // the chosen finale plays out first ('apoc') or the world reborns instantly ('fresh').
  // These persist independently of `finale` — the pinned fate and the "end it now" request
  // are separate decisions.
  const restartAt = Math.floor(Number(cfg.worldRestartAt));
  if (isFinite(restartAt) && restartAt > 0) out.worldRestartAt = restartAt;
  if (cfg.worldRestartMode === 'apoc' || cfg.worldRestartMode === 'fresh') {
    out.worldRestartMode = cfg.worldRestartMode;
  }
  return out;
}

// Read + validate. A missing OR corrupt file falls back to defaults — the app must
// never black-screen because of a bad config the user could have hand-edited.
function readConfig(pathToFile) {
  try {
    return sanitizeConfig(JSON.parse(fs.readFileSync(pathToFile, 'utf8')));
  } catch (e) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

// Validate then persist as pretty JSON. Returns the cleaned object that was written.
function writeConfig(pathToFile, cfg) {
  const clean = sanitizeConfig(cfg);
  fs.writeFileSync(pathToFile, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return clean;
}

// Create the file with defaults on first run so it is discoverable / openable.
function ensureConfig(pathToFile) {
  try { fs.accessSync(pathToFile); }
  catch (e) { try { writeConfig(pathToFile, DEFAULT_CONFIG); } catch (_) { /* ignore */ } }
}

module.exports = { DEFAULT_CONFIG, CYCLES, normalizeCycle, sanitizeLabel, sanitizeConfig, readConfig, writeConfig, ensureConfig };
