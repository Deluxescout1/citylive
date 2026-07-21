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
