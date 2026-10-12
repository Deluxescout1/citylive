#!/usr/bin/env node
'use strict';
// CHRONICLE GALLERY — build chronicles/index.html: the browsable history of worlds.
//
// One card per chronicle .md (they are the source of truth, written by the weekly run), richest
// data derivable from the file itself: the life number, the city name, the dates, the disaster
// load (CAT-n lines), the dead it named, and whether the chronicle ends with an ENDING (the
// endtimes messages) — plus the life's timelapse video when timelapses/ has one.
// Embeds are RELATIVE (../timelapses/…), so the file works from file:// with no server.
//
// Usage: node tools/chronicle-gallery.js
// Wired into nothing yet; run it after a weekly chronicle (or wire into citylive-weekly.service
// by appending ` && node $HOME/CityLive/tools/chronicle-gallery.js` to the ExecStart chain).

const fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(os.homedir(), 'CityLive');
const CHRON = path.join(ROOT, 'chronicles');
const VID = path.join(ROOT, 'timelapses');

const chronicles = fs.readdirSync(CHRON).filter(f => /^life-\d+.*\.md$/.test(f)).sort((a, b) => {
  const na = +(/life-(\d+)/.exec(a)[1]), nb = +(/life-(\d+)/.exec(b)[1]);
  return na - nb;
});

function parse(file) {
  const md = fs.readFileSync(path.join(CHRON, file), 'utf8');
  const life = +(/life-(\d+)/.exec(file)[1]);
  const title = /^# The Chronicle of (.+)$/m.exec(md);
  const dates = /^\*Life \d+ · (.+)\*$/m.exec(md);
  const rows = md.split('\n').filter(l => /^\| \d+\.\d+ \|/.test(l));
  const cats = rows.map(r => (/\bCAT-(\d)\b/.exec(r) || [])[1]).filter(Boolean);
  const dead = rows.filter(r => /NAMED AMONG THE DEAD/.test(r));
  // the ending: the live finale is the emergency evacuation broadcast — the last row of a life
  // that ran its whole course (⚠ "THE AIR IS OPENING" is one POSSIBLE death's herald, not the ending)
  const evacs = rows.filter(r => /EMERGENCY BROADCAST - EVACUATE .* NOW/.test(r));
  const ending = evacs.length ? 'EVACUATION BROADCAST' : null;
  const death = evacs.length ? evacs[evacs.length - 1].split('|')[3].trim() : null;
  const worst = cats.length ? Math.max.apply(null, cats.map(Number)) : 0;
  const flash = (rows.find(r => /CAT-[34]/.test(r)) || rows[0] || '').split('|')[3].trim();
  const vid = fs.existsSync(path.join(VID, `life-${life}-timelapse.mp4`)) ? `../timelapses/life-${life}-timelapse.mp4` : null;
  const name = title ? title[1] : (file.replace(/\.md$/, '').replace(/-/g, ' ').replace(/^life \d+ /i, ''));
  return { file: file, name: name, life: life, dates: dates ? dates[1] : '', rows: rows.length,
    disasters: cats.length, worst: worst, dead: dead.length, ending: ending, death: death, vid: vid, flash: flash };
}

const P = chronicles.map(parse);
const sev = w => w ? ['#6ad2ff', '#7af5a8', '#ffd76a', '#ff9a4a', '#ff5c5c'][Math.min(4, w - 1)] : '#8a93a8';

const cards = P.map(p => `
<details class="card"${p.ending ? '' : ''}>
  <summary><span class="life">#${p.life}</span> <b>${p.name}</b>
    <span class="pill" style="border-color:${sev(p.worst)}">CAT-${p.worst || '—'}${p.disasters ? ' ×' + p.disasters : ''}</span>
    ${p.dead ? '<span class="pill" style="border-color:#ff5c5c">' + p.dead + ' dead</span>' : ''}
    ${p.vid ? '<span class="pill" style="border-color:#7af5ff">▶ timelapse</span>' : ''}
    ${p.ending ? '<span class="pill" style="border-color:#c9a0e8">◇ ' + (p.death || 'ended') + '</span>' : ''}</summary>
  <div class="dates">${p.dates} · ${p.rows} recorded moments</div>
  ${p.flash ? '<div class="flash">“' + p.flash + '”</div>' : ''}
  ${p.vid ? '<video controls preload="none" src="' + p.vid + '" width="480"></video>' : ''}
  <a href="${p.file}">read the full chronicle →</a>
</details>`).join('\n');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CityLive — history of worlds</title><style>
body{background:#0c0f1a;color:#dfe6f4;font-family:monospace;margin:0;padding:18px;max-width:680px;margin:auto}
h1{color:#7af5ff;font-size:20px} .k{color:#8a93a8}
.card{background:#12162a;border-radius:8px;padding:10px 12px;margin:10px 0}
summary{cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} summary b{color:#ffd76a}
.life{color:#7af5ff} .pill{border:1px solid #444;border-radius:9px;padding:1px 8px;font-size:11px;margin-left:6px}
.dates{color:#8a93a8;font-size:12px;margin:6px 0}
.flash{color:#dfe6f4;font-style:italic;margin:6px 0;font-size:13px}
video{max-width:100%;border-radius:6px;margin:6px 0}
a{color:#7af5ff;text-decoration:none}
</style></head><body>
<h1>■ history of worlds</h1>
<div class="k">${P.length} chronicles · lives ${P.length ? P[0].life + '–' + P[P.length - 1].life : '—'} · built ${new Date().toLocaleString()} · source: the deterministic clock</div>
${cards}
</body></html>`;

fs.writeFileSync(path.join(CHRON, 'index.html'), html);
const done = P.filter(p => p.ending).length;
console.log('chronicle-gallery written:', P.length, 'chronicles,', done, 'ended, video for',
  P.filter(p => p.vid).length, 'lives');