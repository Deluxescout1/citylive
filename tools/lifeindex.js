#!/usr/bin/env node
'use strict';
// LIFEINDEX — the clock numbers the chronicle/timelapse side needs, computed THE WAY THE ENGINE
// ACTUALLY COMPUTES THEM.
//
// ⚠ WHY THIS TOOL EXISTS: the weekly unit and timelapse.sh used to scrape the engine source with
// /GROW_EPOCH=(\d+)/ and /GROW_CYCLE=(\d+)/. GROW_EPOCH is a literal; GROW_CYCLE has not been one
// since config cycles arrived (`var GROW_CYCLE=cycleMs(CFG.cycle)`), so the second regex matched
// nothing → null[1] → TypeError → citylive-weekly.service failed every run and no timelapse was
// produced since. Scraping declarations is the "test a hand-copied reimplementation" trap again:
// this tool loads the engine in a vm and asks IT.
//
// Usage:
//   node lifeindex.js life          → index of the life that is LIVE RIGHT NOW
//   node lifeindex.js life-prev     → the life that just ended (what the weekly chronicles)
//   node lifeindex.js epoch cycle   → "EPOCH CYCLE" (two integers, for `read EPOCH CYCLE < <(...)`)
const fs = require('fs'), vm = require('vm'), os = require('os'), path = require('path');

const ENGINE = path.join(os.homedir(), '.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');
const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
  isNaN, isFinite, parseInt, parseFloat, console,
  performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
sb.window = sb; sb.self = sb; sb.globalThis = sb;
const c = vm.createContext(sb);
vm.runInContext(SRC, c, { filename: 'city.js' });
c.NOFETCH = true;

const mode = (process.argv.slice(2).join(' ') || 'life-prev').trim();
const now = Date.now();
if (mode === 'life') console.log(c.lifeIndexOf(now));
else if (mode === 'life-prev') console.log(c.lifeIndexOf(now) - 1);
else if (mode === 'epoch cycle') console.log(c.GROW_EPOCH, c.GROW_CYCLE);
else { console.error('usage: lifeindex.js [life|life-prev|epoch cycle]'); process.exit(2); }