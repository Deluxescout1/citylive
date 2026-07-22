'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../chronicle-store');
function tmp() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-chronicle-')), 'chronicle.json'); }
function snap(life, key) { return { recordable:true, life, cityName:'Test City '+life, era:'Neon', at:1700000000000+life,
  eventKey:key, kind:'election', title:'Election witnessed', stage:'Campaign', detail:'A real observed event', people:[{name:'Mara Reyes',role:'Candidate',party:'Greens'}] }; }
test('records witnessed events and deduplicates consecutive snapshots', () => { const f=tmp(); store.record(f,snap(1,'a')); store.record(f,snap(1,'a')); store.record(f,snap(1,'b')); const d=store.read(f); assert.equal(d.lives[0].events.length,2); });
test('never records unrecordable/future-derived snapshots', () => { const f=tmp(), s=snap(1,'a'); s.recordable=false; store.record(f,s); assert.equal(store.read(f).lives.length,0); });
test('retains only the latest 25 civilizations', () => { const f=tmp(); for(let i=1;i<=30;i++) store.record(f,snap(i,'e'+i)); const d=store.read(f); assert.equal(d.lives.length,25); assert.equal(d.lives[0].life,6); });
test('recording can be disabled and individual lives can be removed', () => { const f=tmp(); store.record(f,snap(1,'a')); store.setEnabled(f,false); store.record(f,snap(2,'b')); assert.equal(store.read(f).lives.length,1); store.removeLife(f,1); assert.equal(store.read(f).lives.length,0); });
test('text export contains witnessed people and events', () => { const f=tmp(); store.record(f,snap(1,'a')); const out=store.toText(store.read(f)); assert.match(out,/Test City 1/); assert.match(out,/Election witnessed/); });
test('malformed life identifiers are dropped instead of becoming Life 1', () => {
  const dirty = { lives: [
    { life:'not-a-number', events:[] },
    { life:0, events:[] },
    { life:2, cityName:'Valid', events:[] }
  ] };
  assert.deepStrictEqual(store.sanitize(dirty).lives.map((l) => l.life), [2]);

  const f=tmp();
  store.record(f,snap('not-a-number','bad'));
  store.record(f,snap(0,'also-bad'));
  assert.strictEqual(store.read(f).lives.length, 0);
});
