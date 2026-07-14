#!/usr/bin/env node
const fs=require("fs"),os=require("os"),vm=require("vm");
const c=fs.readFileSync(os.homedir()+"/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js","utf8");
const sb={console}; vm.createContext(sb); vm.runInContext(c,sb);
const life=parseInt(process.argv[2]||"0",10);
sb.NOWOVR=sb.GROW_EPOCH+life*sb.GROW_CYCLE+1000;
sb.setup("neon",{cw:480,ch:270,woff:0,ww:1702,pxk:4});
console.log(sb.cityName||"life");
