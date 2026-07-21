'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'org.citylive.wallpaper/contents/js/city.js');
const copies = ['desktop/renderer/city.js', 'web/city.js', 'phone/city.js'];
for (const rel of copies) {
  fs.copyFileSync(source, path.join(root, rel));
  console.log('Synced ' + rel);
}
// THE PEOPLE (v2.0): the shared Citizens overlay is authored in web/ and mirrored to phone/.
fs.copyFileSync(path.join(root, 'web/citizens-overlay.js'), path.join(root, 'phone/citizens-overlay.js'));
console.log('Synced phone/citizens-overlay.js');
