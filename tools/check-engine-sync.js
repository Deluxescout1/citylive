'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const root = path.resolve(__dirname, '..');
const canonical = 'org.citylive.wallpaper/contents/js/city.js';
const copies = ['desktop/renderer/city.js', 'web/city.js', 'phone/city.js'];
const digest = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
const expected = digest(canonical);
const stale = copies.filter((rel) => digest(rel) !== expected);

if (stale.length) {
  console.error('CityLive engine copies differ from the canonical KDE engine:');
  stale.forEach((rel) => console.error('  - ' + rel));
  console.error('Run: npm run sync:engine');
  process.exit(1);
}
console.log('Engine parity OK: canonical + ' + copies.length + ' platform copies');
