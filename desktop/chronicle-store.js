'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LIVES = 25;
const MAX_EVENTS = 500;
const EMPTY = Object.freeze({ version: 1, enabled: true, lives: [] });

function fresh() { return { version: 1, enabled: true, lives: [] }; }
function text(v, max) { return String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function finite(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function sanitizePerson(p) {
  if (!p || typeof p !== 'object') return null;
  const name = text(p.name, 80); if (!name) return null;
  return { name, role: text(p.role, 40), party: text(p.party, 40) };
}
function sanitizeEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const key = text(e.key, 160), title = text(e.title, 140);
  if (!key || !title) return null;
  const people = Array.isArray(e.people) ? e.people.map(sanitizePerson).filter(Boolean).slice(0, 12) : [];
  return { key, at: Math.max(1, Math.floor(finite(e.at, Date.now()))), kind: text(e.kind, 40) || 'city',
    title, detail: text(e.detail, 240), stage: text(e.stage, 80), people };
}
function sanitizeLife(l) {
  if (!l || typeof l !== 'object') return null;
  const rawLife = Number(l.life);
  if (!Number.isFinite(rawLife) || rawLife < 1) return null;
  const life = Math.floor(rawLife);
  const events = Array.isArray(l.events) ? l.events.map(sanitizeEvent).filter(Boolean).slice(-MAX_EVENTS) : [];
  return { life, cityName: text(l.cityName, 80) || ('Civilization ' + life), era: text(l.era, 60),
    firstSeenAt: Math.max(1, Math.floor(finite(l.firstSeenAt, events[0] && events[0].at || Date.now()))),
    lastSeenAt: Math.max(1, Math.floor(finite(l.lastSeenAt, events.length && events[events.length - 1].at || Date.now()))), events };
}
function sanitize(data) {
  const out = fresh();
  if (!data || typeof data !== 'object') return out;
  out.enabled = data.enabled !== false;
  out.lives = (Array.isArray(data.lives) ? data.lives : []).map(sanitizeLife).filter(Boolean).slice(-MAX_LIVES);
  return out;
}
function read(file) {
  try { return sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (_e) { return fresh(); }
}
function write(file, data) {
  const clean = sanitize(data); fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', { mode: 0o600 }); fs.renameSync(tmp, file); return clean;
}
function record(file, snapshot) {
  const data = read(file); if (!data.enabled || !snapshot || snapshot.recordable !== true) return data;
  const rawLife = Number(snapshot.life);
  if (!Number.isFinite(rawLife) || rawLife < 1) return data;
  const lifeNo = Math.floor(rawLife);
  let life = data.lives.find((l) => l.life === lifeNo);
  const now = Math.max(1, Math.floor(finite(snapshot.at, Date.now())));
  const event = sanitizeEvent({ key: snapshot.eventKey, at: now, kind: snapshot.kind, title: snapshot.title,
    detail: snapshot.detail, stage: snapshot.stage, people: snapshot.people });
  if (!event) return data;
  if (life && life.events.length && life.events[life.events.length - 1].key === event.key) return data;
  if (!life) { life = { life: lifeNo, cityName: text(snapshot.cityName, 80) || ('Civilization ' + lifeNo), era: text(snapshot.era, 60), firstSeenAt: now, lastSeenAt: now, events: [] }; data.lives.push(life); }
  life.cityName = text(snapshot.cityName, 80) || life.cityName; life.era = text(snapshot.era, 60) || life.era; life.lastSeenAt = now;
  life.events.push(event);
  life.events = life.events.slice(-MAX_EVENTS); data.lives = data.lives.sort((a, b) => a.life - b.life).slice(-MAX_LIVES);
  return write(file, data);
}
function setEnabled(file, enabled) { const data = read(file); data.enabled = !!enabled; return write(file, data); }
function clear(file) { const data = fresh(); return write(file, data); }
function removeLife(file, lifeNo) { const data = read(file); data.lives = data.lives.filter((l) => l.life !== Number(lifeNo)); return write(file, data); }
function toText(data) {
  const d = sanitize(data), lines = ['CITYLIVE CHRONICLE', 'Recorded only while CityLive was running', ''];
  d.lives.slice().reverse().forEach((l) => { lines.push(`${l.cityName} · Life ${l.life}${l.era ? ' · ' + l.era : ''}`);
    l.events.forEach((e) => { lines.push(`  ${new Date(e.at).toLocaleString()} — ${e.title}${e.stage ? ' · ' + e.stage : ''}`); if (e.detail) lines.push('    ' + e.detail); }); lines.push(''); });
  return lines.join('\n').trim() + '\n';
}

module.exports = { MAX_LIVES, MAX_EVENTS, EMPTY, sanitize, read, write, record, setEnabled, clear, removeLife, toText };
