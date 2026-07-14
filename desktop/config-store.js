// CityLive — persistent user settings store (birthdays, location, speed).
//
// Deliberately has NO Electron dependency: it takes the config-file path as an
// argument, so the real read/write/validate logic can be unit-tested under plain
// node. The Electron main process (main.js) owns the path (app userData) and calls
// these. The file lives OUTSIDE the app bundle, so auto-updates never overwrite it.

'use strict';
const fs = require('fs');

// A brand-new install: no birthdays, one lifetime per week. (No lat/lon → the engine
// keeps its built-in default location.)
const DEFAULT_CONFIG = { birthdays: [], cycle: 'weekly' };

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
  const out = { birthdays: [], cycle: (cfg.cycle === 'test') ? 'test' : 'weekly' };

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

module.exports = { DEFAULT_CONFIG, sanitizeLabel, sanitizeConfig, readConfig, writeConfig, ensureConfig };
