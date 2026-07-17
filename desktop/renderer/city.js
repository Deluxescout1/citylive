/* CityLive engine v2 — one continuous pixel city spread across every monitor.
 *
 * KEY IDEA: the city is a single "world" WW world-pixels wide (= whole desktop
 * width / PXK). Each screen renders only the slice [WOFF, WOFF+SW] it covers.
 * Everything that must line up across the bezel — the skyline, cars, the train,
 * emergency vehicles, the plane — is a PURE FUNCTION of the wall clock + world-X.
 * Because every screen shares the same clock, a car leaving one screen's edge
 * arrives at the neighbour's edge automatically, with no cross-process messaging.
 *
 * setup(scene, {cw,ch,woff,ww}) once per screen, then draw(ctx) each frame.
 * Sun times: Norwich CT. Weather: Open-Meteo (XHR). Holidays by date.
 */
var LAT = 41.5243, LON = -72.0759;

// ============================ EXTERNAL CONFIGURATION ============================
// One optional config object lets a build (or a person you send the app to) override
// personal details WITHOUT touching this engine file. Set a global `CITYLIVE_CFG`
// (or `window.CITYLIVE_CFG`) BEFORE this script loads — e.g. in the web/desktop build's
// config.js. The KDE Plasma wallpaper ships no config, so the defaults below stand.
// Recognised keys (all optional):
//   { lat, lon,                        // your location for sun/moon/weather
//     birthdays: [ {m,d,label,pink} ], // banner days — an EMPTY array [] means none
//     cycle: "1w"|"2w"|"3w"|"1mo"|"test" } // lifetime length: 1/2/3 weeks, 1 month, or "test"=1 hour
// `typeof` guards keep this safe in QML (no `window`, no global) — it silently no-ops.
var CFG = (function(){
  try { if (typeof CITYLIVE_CFG !== 'undefined' && CITYLIVE_CFG) return CITYLIVE_CFG; } catch(e){}
  try { if (typeof window !== 'undefined' && window && window.CITYLIVE_CFG) return window.CITYLIVE_CFG; } catch(e){}
  return {};
})();
if (CFG.lat != null && CFG.lon != null) { LAT = +CFG.lat; LON = +CFG.lon; }

// BIRTHDAYS: strung banner + fireworks + hearts on the given day. Each entry {m,d,label,pink?}.
// None are baked in here; a build supplies its own list via config (or [] for none, so the
// person you send it to sets their own without ever seeing yours). Labels must be FONT-safe
// (UPPERCASE / digits / space / hyphen only — the pixel font has no apostrophe, '&' or '.').
var DEFAULT_BIRTHDAYS = [];   // none baked into this shared engine — supply your own via config (see config.js / config.local.json)
var BIRTHDAYS = (CFG.birthdays != null) ? CFG.birthdays : DEFAULT_BIRTHDAYS;
function birthdayFor(m,d){ if(!BIRTHDAYS || !BIRTHDAYS.length) return null;
  for(var i=0;i<BIRTHDAYS.length;i++){ var b=BIRTHDAYS[i]; if(b && b.m===m && b.d===d) return b; } return null; }

// How long the city takes to live one full lifetime (village → metropolis → disaster → rebuild).
// Accepts a token or a raw millisecond number. Unknown/absent → 1 hour "test" (the bare-engine
// default; every shipped build supplies an explicit token via config, so real installs never hit it).
function cycleMs(v){
  switch(v){
    case "1w": case "weekly":  return 604800000;    // 1 week
    case "2w":                 return 1209600000;   // 2 weeks
    case "3w":                 return 1814400000;   // 3 weeks
    case "1mo": case "monthly":return 2592000000;   // 1 month (30 days)
    case "test":               return 3600000;      // 1 hour (fast preview)
    default: return (typeof v==="number" && isFinite(v) && v>0) ? v : 3600000;
  }
}

// A host may inject personal settings that are NOT part of this shared engine — e.g. the KDE wallpaper's
// main.qml reads a local, gitignored config.local.json and calls this. All keys optional. (GROW_CYCLE is
// declared later in the file but this runs at boot, long after, so the reference resolves fine.)
// Disaster frequency: a calm→chaos setting. Multiplies the per-slot firing chance only —
// the slot grid itself stays fixed, so timing determinism and cross-screen sync are untouched.
function disMul(v){ return v==="rare"?0.42 : v==="frequent"?2 : 1; }
function applyConfig(cfg){ if(!cfg) return;
  if(cfg.birthdays!=null) BIRTHDAYS=cfg.birthdays;
  if(cfg.lat!=null) LAT=+cfg.lat;  if(cfg.lon!=null) LON=+cfg.lon;
  if(cfg.lat!=null||cfg.lon!=null) REGION=regionOf(LAT,LON);   // re-derive the architectural region for the new place
  if(cfg.cycle!=null) GROW_CYCLE=cycleMs(cfg.cycle);
  if(cfg.disasters!=null) DIS_PROB=DIS_PROB_BASE*disMul(cfg.disasters);
  if(cfg.finale!==undefined) CFG_FINALE=(cfg.finale&&cfg.finale!=="auto"&&DEATHS.indexOf(cfg.finale)>=0)?cfg.finale:null;
  if(cfg.worldRestartAt!==undefined) WORLD_SHIFT=worldShiftFrom(+cfg.worldRestartAt||0, cfg.worldRestartMode);
  if(cfg.era!==undefined){ FORCEERA=null;
    if(cfg.era && cfg.era!=="auto"){ for(var ei=0;ei<ERAS.length;ei++){ if(ERAS[ei].name===cfg.era){ FORCEERA=ei; break; } } } }
}
// ================================================================================

// ---- REGIONAL ARCHITECTURE: the city wears the vernacular of wherever it's planted ----
// Derived ONCE from the real coordinates so it always feels like home. It's an always-on base
// (pitched roofs, colonial palette, a white church steeple, red barns at the outskirts); whatever
// the rotating ERA theme is (cyber/gothic/ancient/…) still TINTS this base, so you get e.g. a
// "neon New England" or "gothic New England". Add more regions to regionOf() to expand elsewhere.
function regionOf(lat,lon){
  if(lat>=39&&lat<=48&&lon>=-80&&lon<=-66) return "newengland";   // NE US: clapboard & brick, steep roofs, steeples, barns
  // (future: "southwest" adobe/pueblo · "pacificnw" timber+glass · "south" antebellum · … — keep current assets, add here)
  return "generic";
}
var REGION = regionOf(LAT,LON);
// New England colonial wall palette: barn-red, brick-red, weathered brown, clapboard white & cream,
// colonial blue-grey, sage green, weathered grey. (Light walls read as wood clapboard; dark/red as brick/board.)
var NE_WALLS = [[140,58,45],[120,48,40],[96,60,48],[216,210,194],[198,190,170],[92,104,110],[88,104,80],[150,146,132]];

// ---- per-screen geometry (world pixels), set in setup() ----
var SW = 480, SH = 270;      // this screen's canvas size (world px)
var WOFF = 0, WW = 480;      // this screen's world offset + total world width
var HORIZON = 244;           // y of the street baseline (buildings stand here)
var GROUND = 26;             // depth of road/foreground below the horizon
var SCENE = "neon", far, mid, near;

// ---- shared/global scene state ----
var stars = [], skyfill = [], clouds = [], drones = [], bats = [];
var drops = [], flakes = [], fwx = [], splashes = [];
var cables = [], searchlights = [];
var peds = [], crosswalks = [];
// 4-lane road: two lanes each way. o = y offset below HORIZON, d = travel direction.
// Lanes are spaced 4wp apart so a car (4wp tall) clearly out-scales a 3wp person → a
// pedestrian visibly "fits" in a car.
var LANE = [{o:5,d:1},{o:10,d:1},{o:16,d:-1},{o:21,d:-1}];
var PEDC = ["#d24a4a","#4a7fd2","#3fae6a","#d2a63f","#b060c0","#e6e6ea","#c05a8a","#5ac0c0","#e07a3a",
  "#3a5a8a","#7a9a3a","#8a3a3a","#d0b040","#6a4a9a","#2a8a7a","#c86a3a","#4a4a55","#d0d0d8","#b83a6a","#4f7f4a"];
var SKINC = ["#e8b088","#c68a5a","#8a5a3a","#f0c6a0","#5a3a24","#ffd8b4","#a06a44"];
var fog = { t: 0 }, snowpack = 0, lightning = 0, lightNext = 0, lboltX = 0;
var weather = { code: 0, cloud: 30, wind: 5, temp: 60, precip: 0, feels: 60, gust: 8 };   // temp/feels °F, wind/gust km/h, precip mm
var tPrev = 0;
// WEATHER SYNC — the three monitors each run their own copy of this engine, so weather (the one
// thing that is NOT a pure function of the clock — it's a live XHR) used to drift out of sync:
// each screen fetched on its own 10-min timer, so mid-change one monitor showed rain while another
// showed sun for up to 10 min. Fix: every screen fetches on the SAME wall-clock 10-min bucket
// (Math.floor(realNow/WX_BUCKET) is identical on all screens) → they request together and get the
// same data. A 30s retry covers a single screen whose XHR failed (which would strand it on stale
// weather). Uses REAL time (Date.now()), never the sim clock, so weather stays real regardless of CLOCK.
var WX_BUCKET = 120000;                          // 2-minute shared fetch window — picks up changes fast. The fetch is a
                                                 // small (~1KB) request so even every screen every 2 min is cheap (≈2160 reqs/day
                                                 // total, still well under Open-Meteo's 10k/day). The `current` block refreshes on
                                                 // the model cadence, but we ALSO pull `minutely_15` precipitation and read the
                                                 // bucket for right-now, so a shower starting/stopping shows within ~15 min instead
                                                 // of waiting on the hourly current — this is why "it's raining outside but not here".
var wxBucket = -1, wxReqAt = 0, wxOkBucket = -2; // current window · last request time · window that actually landed
// AIR QUALITY (wildfire smoke etc): same shared-wall-clock-bucket pattern as weather, so every
// screen fetches in the same 30-min window and converges on identical smoke. Data is hourly
// upstream (interval:3600), so 30 min is plenty fresh.
var airq = { pm25:null, aqi:null };
var AQ_BUCKET = 1800000;
var aqBucket = -1, aqReqAt = 0, aqOkBucket = -2;
var FORCEAQ = null;   // test hook: {pm25,aqi} — pins the live air-quality fetch
// notification lanes — stacked BELOW the 3-line sky-clock pill (which ends ~y41) so alerts never overlap it or each other
var NOTIF_LANE1 = 47;   // lane 1: disaster / weather alerts (world-anchored over the event)
var NOTIF_LANE2 = 59;   // lane 2: war, apocalypse, election & mayor-elect banners
// ---- alert-lane allocator: many banners (disaster, war, apocalypse, election, mayor-elect) can be
// live at once and used to overprint each other on two fixed rows. Each frame every active banner now
// CLAIMS a row: it takes its preferred row if free, else drops to the next free row below — so they
// stack tidily and never overlap. Reset once per frame at the top of draw().
var NOTIF_ROWS = [47, 59, 71, 83];
var _notifTaken = [false, false, false, false];
function notifLane(pref){
  for(var r=pref; r<NOTIF_ROWS.length; r++){ if(!_notifTaken[r]){ _notifTaken[r]=true; return NOTIF_ROWS[r]; } }
  _notifTaken[NOTIF_ROWS.length-1]=true; return NOTIF_ROWS[NOTIF_ROWS.length-1];   // all full (rare) → share the last row
}
function resetNotifLanes(){ for(var r=0;r<_notifTaken.length;r++) _notifTaken[r]=false; }
var CLOCK = null;   // test-harness override: ms timestamp for time-of-day (null = real wall clock)
var NOWOVR = null;  // test-harness override: ms value returned as Date.now() inside draw() (null = real)
function nowDate(){ return CLOCK ? new Date(CLOCK) : new Date(); }

function rng(seed){ var a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function lerp(a,b,t){ return a+(b-a)*t; }
function mixc(c1,c2,t){ return [lerp(c1[0],c2[0],t)|0, lerp(c1[1],c2[1],t)|0, lerp(c1[2],c2[2],t)|0]; }
function css(c){ return "rgb("+c[0]+","+c[1]+","+c[2]+")"; }
function rgba(c,a){ return "rgba("+c[0]+","+c[1]+","+c[2]+","+a+")"; }
function hex2rgb(h){ return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]; }
function wrapW(x){ x%=WW; return x<0?x+WW:x; }

// ---- DISTRICTS: distinct neighbourhoods, each with its own architecture + palette ----
// Every district changes building height/width/spacing, window systems, crowns, feature
// density, colours and ground-level character — so different parts of the city feel different.
var DISTRICTS = {
  // glassy financial core: tall ribbon/curtain-wall towers, spires & antennas, LED edges
  downtown: { name:"downtown",
    pal:[[[5,217,232],[42,245,184]],[[160,90,255],[5,217,232]],[[255,42,157],[5,217,232]]],
    win:["#05d9e8","#7affd7","#aee3ff","#ffffff"],
    hMul:1.16, wRange:[16,30], gap:[1,3],
    layouts:["ribbon","corp","ribbon","grid"], crowns:["spire","antenna","blade","helipad","flat","step","billboard","deco","glasstop","deco","mansard","pagoda"],
    neon:0.18, bill:0.24, ledge:0.62, sign:0.28, fesc:0, tank:0, dish:0.22, awn:0.12, park:0, laundry:0, brick:0 },
  // neon entertainment strip: signs & billboards everywhere, marquees, bright colour
  entertainment: { name:"neon",
    pal:[[[255,42,157],[255,209,122]],[[255,140,60],[255,42,157]],[[255,80,80],[5,217,232]]],
    win:["#ff7ad0","#ffd27a","#ff5a5a","#ffffff"],
    hMul:0.82, wRange:[14,24], gap:[1,2],
    layouts:["grid","band","punch","grid"], crowns:["flat","chevron","battlement","tank","billboard","deco","glasstop"],
    neon:0.85, bill:0.6, ledge:0.5, sign:0.9, fesc:0.1, tank:0.1, dish:0.05, awn:0.6, park:0, laundry:0, brick:0 },
  // residential uptown: apartment blocks, warm windows, laundry, parks, calm
  residential: { name:"residential",
    pal:[[[255,180,120],[120,200,160]],[[150,160,210],[200,180,140]],[[200,150,180],[150,190,210]]],
    win:["#ffd9a0","#ffe08a","#c7d0ff","#fff2cf"],
    hMul:0.72, wRange:[16,28], gap:[2,4],
    layouts:["grid","grid","band","punch"], crowns:["flat","tank","battlement","dome","watertower"],
    neon:0.08, bill:0.04, ledge:0.14, sign:0.08, fesc:0.4, tank:0.35, dish:0.16, awn:0.3, park:0.22, laundry:2, brick:0 },
  // old brick quarter: short punched-window midrise, fire escapes, water tanks, laundry
  oldtown: { name:"oldtown",
    pal:[[[210,140,90],[150,120,90]],[[190,120,110],[120,140,150]]],
    win:["#ffcf8a","#ffb060","#ffe0a0","#e0c090"],
    hMul:0.56, wRange:[13,22], gap:[1,2],
    layouts:["punch","grid","punch"], crowns:["flat","tank","battlement","peak","watertower"],
    neon:0.14, bill:0.05, ledge:0.1, sign:0.24, fesc:0.7, tank:0.5, dish:0.08, awn:0.5, park:0.08, laundry:3, brick:1 },
  // industrial / dockside edge: low wide flat sheds, smokestacks, few windows, sparse life
  industrial: { name:"industrial",
    pal:[[[130,140,150],[160,130,90]],[[110,120,130],[95,115,125]]],
    win:["#c9a86a","#b0b8c0","#a0a8b0","#d0b070"],
    hMul:0.42, wRange:[16,30], gap:[10,20],
    layouts:["punch","band","punch"], crowns:["stack","flat","tank","flat"],
    neon:0.05, bill:0.08, ledge:0.05, sign:0.1, fesc:0.2, tank:0.4, dish:0.05, awn:0.2, park:0.05, laundry:1, brick:1 }
};
// district layout across the world (fractions): industrial edges → old town → residential
// → entertainment strips flanking a downtown core in the centre.
function districtAt(x){
  var f=wrapW(x)/WW;
  if(f<0.11||f>=0.89) return DISTRICTS.industrial;
  if(f<0.27||f>=0.78) return DISTRICTS.oldtown;
  if(f<0.42||f>=0.65) return DISTRICTS.residential;
  if(f<0.47||f>=0.60) return DISTRICTS.entertainment;
  return DISTRICTS.downtown;
}
// primary accent/window palette at a world-x (used by the train's district colour stripe)
function zoneAt(wx){ var d=districtAt(wx); return { a:d.pal[0][0], a2:d.pal[0][1], win:d.win }; }
var NEON = ["#ff2a9d","#05d9e8","#2af5b8","#ffb347","#b98cff","#ff5a5a","#5affd7","#ff8cf0"];

// dark facade bases (kept moody; tinted toward the district accent per building)
var BLDBASE = ["#0f0a18","#141020","#1a1430","#0c0a16","#181228","#0a0712","#161022"];

var SKY = { night:[[8,8,26],[16,14,40]], dawn:[[70,40,90],[255,140,90]],
            day:[[92,160,235],[170,215,250]], dusk:[[40,30,80],[255,110,70]] };

// ---- sun (NOAA simplified) ----
function sunTimes(d){
  var rad=Math.PI/180, J1970=2440588, J2000=2451545;
  function toJulian(t){ return t.valueOf()/86400000-0.5+J1970; }
  function fromJulian(j){ return new Date((j+0.5-J1970)*86400000); }
  var n=Math.round(toJulian(d)-J2000-0.0009-(-LON/360));
  var Ja=J2000+0.0009+(-LON/360)+n;
  var M=rad*(357.5291+0.98560028*(Ja-J2000));
  var C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
  var Ls=M+C+rad*102.9372+Math.PI;
  var Jt=Ja+0.0053*Math.sin(M)-0.0069*Math.sin(2*Ls);
  var dec=Math.asin(Math.sin(Ls)*Math.sin(rad*23.4397));
  var cosH=(Math.sin(rad*-0.833)-Math.sin(rad*LAT)*Math.sin(dec))/(Math.cos(rad*LAT)*Math.cos(dec));
  if(cosH>1) return {rise:null,set:null,polar:"night"};
  if(cosH<-1) return {rise:null,set:null,polar:"day"};
  var H0=Math.acos(cosH)/(2*Math.PI);
  return { rise: fromJulian(Jt-H0), set: fromJulian(Jt+H0) };
}
function dayPhase(now){
  var st=sunTimes(now);
  if(st.polar==="night") return {a:"night",b:"night",t:0,light:0};
  if(st.polar==="day") return {a:"day",b:"day",t:0,light:1};
  var t=now.getTime(), r=st.rise.getTime(), s=st.set.getTime(), tw=40*60*1000, k;
  if(t<r-tw||t>s+tw) return {a:"night",b:"night",t:0,light:0};
  if(t<r+tw){ k=(t-(r-tw))/(2*tw); return k<0.5?{a:"night",b:"dawn",t:k*2,light:k}:{a:"dawn",b:"day",t:(k-0.5)*2,light:k}; }
  if(t>s-tw){ k=(t-(s-tw))/(2*tw); return k<0.5?{a:"day",b:"dusk",t:k*2,light:1-k}:{a:"dusk",b:"night",t:(k-0.5)*2,light:1-k}; }
  return {a:"day",b:"day",t:0,light:1};
}

// ---- moon phase (real lunation for the given date) ----
// returns 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
function moonPhase(d){
  var JD=d.valueOf()/86400000+2440587.5;             // Unix ms → Julian Date
  var p=(JD-2451550.1)/29.53058867;                  // lunations since a known new moon (2000-01-06)
  p-=Math.floor(p); if(p<0) p+=1;
  return p;
}

// draw the moon at (mx,my) with real illuminated phase mp (0=new,.25=first qtr,.5=full,.75=last qtr)
function drawMoon(g,mx,my,mp){
  var ca=Math.cos(2*Math.PI*mp), wax=mp<0.5, R=3, illum=(1-ca)/2, blood=eclipseMoon;
  g.globalCompositeOperation="lighter";                                   // soft halo, brighter near full (red on eclipse)
  g.fillStyle=(blood?"rgba(200,60,40,":"rgba(220,226,240,")+(0.05+0.13*illum)+")"; g.fillRect((mx-R-2)|0,(my-R-2)|0,2*R+5,2*R+5);
  g.globalCompositeOperation="source-over";
  for(var dy=-R;dy<=R;dy++){ var mw=Math.sqrt(R*R-dy*dy);
    for(var dx=-R;dx<=R;dx++){ if(dx*dx+dy*dy>R*R+0.6) continue;
      var xt=ca*mw, mlit=blood?true:(wax?(dx>=xt-0.001):(dx<=-xt+0.001));  // eclipse = whole disc glows red
      g.fillStyle=blood?(mlit?"#b83c28":"#7a2818"):(mlit?"#eef0e6":"rgba(150,158,178,0.16)");
      g.fillRect((mx+dx)|0,(my+dy)|0,1,1); } }
}

// ---- real night sky for Norwich CT (actual bright-star positions, rotating with the clock) ----
var DEG=Math.PI/180;
// bright stars: [RA hours, Dec deg, magnitude] (J2000). Covers the recognisable asterisms.
var STARS=[
  [2.530,89.264,1.98],   // 0  Polaris
  [11.062,61.751,1.79],  // 1  Dubhe        }
  [11.031,56.382,2.37],  // 2  Merak         }
  [11.897,53.695,2.44],  // 3  Phecda         } Big Dipper (Ursa Major)
  [12.257,57.033,3.31],  // 4  Megrez         }
  [12.900,55.960,1.77],  // 5  Alioth         }
  [13.399,54.925,2.23],  // 6  Mizar         }
  [13.792,49.313,1.86],  // 7  Alkaid        }
  [5.919,7.407,0.42],    // 8  Betelgeuse    }
  [5.242,-8.202,0.18],   // 9  Rigel          }
  [5.418,6.350,1.64],    // 10 Bellatrix       }
  [5.796,-9.670,2.07],   // 11 Saiph           } Orion
  [5.679,-1.943,1.77],   // 12 Alnitak         }
  [5.604,-1.202,1.69],   // 13 Alnilam         } (belt = 12,13,14)
  [5.533,-0.299,2.23],   // 14 Mintaka        }
  [0.675,56.537,2.24],   // 15 Schedar    }
  [0.153,59.150,2.28],   // 16 Caph        }
  [0.945,60.717,2.47],   // 17 Gamma Cas    } Cassiopeia (the "W")
  [1.430,60.235,2.68],   // 18 Ruchbah      }
  [1.906,63.670,3.38],   // 19 Segin       }
  [20.690,45.280,1.25],  // 20 Deneb    }
  [20.371,40.257,2.23],  // 21 Sadr      } Cygnus (Northern Cross)
  [20.770,33.970,2.48],  // 22 Gienah    }
  [19.512,27.960,3.08],  // 23 Albireo  }
  [18.615,38.784,0.03],  // 24 Vega     \
  [19.846,8.868,0.77],   // 25 Altair    > Summer Triangle (with Deneb)
  [14.261,19.182,-0.05], // 26 Arcturus
  [10.139,11.967,1.35],  // 27 Regulus   }
  [11.818,14.572,2.11],  // 28 Denebola   } Leo
  [10.333,19.842,2.28],  // 29 Algieba   }
  [4.599,16.509,0.85],   // 30 Aldebaran (Taurus)
  [5.438,28.608,1.65],   // 31 Elnath
  [5.278,45.998,0.08],   // 32 Capella (Auriga)
  [7.577,31.888,1.58],   // 33 Castor    } Gemini
  [7.755,28.026,1.14],   // 34 Pollux   }
  [6.752,-16.716,-1.46], // 35 Sirius (brightest star)
  [6.977,-28.972,1.50],  // 36 Adhara
  [7.655,5.225,0.34],    // 37 Procyon
  [16.490,-26.432,1.09], // 38 Antares (Scorpius)
  [13.420,-11.161,0.98], // 39 Spica (Virgo)
  [3.405,49.861,1.79],   // 40 Mirfak (Perseus)
  [0.140,29.090,2.06],   // 41 Alpheratz  } Andromeda / Pegasus
  [1.162,35.621,2.05],   // 42 Mirach     }
  [23.079,15.205,2.49],  // 43 Markab     } Great Square of Pegasus
  [23.063,28.083,2.42],  // 44 Scheat     }
  [0.221,15.184,2.83],   // 45 Algenib   }
  [22.961,-29.622,1.16]  // 46 Fomalhaut
];
// asterism links (pairs of star indices) — drawn faintly so the shapes read
var LINES=[
  [1,2],[2,3],[3,4],[4,1],[4,5],[5,6],[6,7],                          // Big Dipper
  [8,10],[10,14],[14,13],[13,12],[12,8],[14,9],[12,11],[9,11],        // Orion
  [16,15],[15,17],[17,18],[18,19],                                    // Cassiopeia W
  [20,21],[21,23],[22,21],                                            // Northern Cross
  [24,20],[20,25],[25,24],                                            // Summer Triangle
  [27,29],[29,28],                                                    // Leo
  [33,34],                                                            // Gemini
  [41,42],[43,44],[43,45],[44,41]                                     // Pegasus/Andromeda
];
// local sidereal time (hours) at Norwich for date d
function lstHours(d){
  var JD=d.valueOf()/86400000+2440587.5, T=(JD-2451545.0)/36525.0;
  var GMST=280.46061837+360.98564736629*(JD-2451545.0)+0.000387933*T*T-T*T*T/38710000.0;
  var lst=(GMST+LON)%360; if(lst<0) lst+=360; return lst/15;
}
// equatorial (RA hrs, Dec deg) → horizontal (altitude deg, azimuth deg from North) for Norwich
function altAz(ra,dec,lst){
  var H=(lst-ra)*15*DEG, sd=Math.sin(dec*DEG), cd=Math.cos(dec*DEG),
      sl=Math.sin(LAT*DEG), cl=Math.cos(LAT*DEG), sinAlt=sd*sl+cd*cl*Math.cos(H),
      alt=Math.asin(sinAlt), cosAlt=Math.cos(alt)||1e-6;
  var A=Math.atan2(-cd*Math.sin(H)/cosAlt, (sd-sinAlt*sl)/(cosAlt*cl)); if(A<0) A+=2*Math.PI;
  return { alt:alt/DEG, az:A/DEG };
}
// low-precision Moon RA/Dec (deg-based series) — good enough to place it in the real sky
function moonRaDec(d){
  var JD=d.valueOf()/86400000+2440587.5, T=(JD-2451545.0)/36525.0;
  var Lm=218.316+481267.881*T, M=134.963+477198.867*T, F=93.272+483202.017*T;
  var lon=(Lm+6.289*Math.sin(M*DEG))*DEG, lat=(5.128*Math.sin(F*DEG))*DEG, e=23.439*DEG;
  var ra=Math.atan2(Math.sin(lon)*Math.cos(e)-Math.tan(lat)*Math.sin(e), Math.cos(lon));
  var dec=Math.asin(Math.sin(lat)*Math.cos(e)+Math.cos(lat)*Math.sin(e)*Math.sin(lon));
  return { ra:((ra*12/Math.PI)+24)%24, dec:dec*180/Math.PI };
}
// project a star/moon (alt,az) onto this screen: azimuth wraps around the whole multi-monitor
// world (E rises one side, sets the other), altitude → height above the skyline.
function skyY(alt){ return (1-Math.min(90,alt)/90)*HORIZON*0.9; }
function skyWX(az){ return az/360*WW; }

// draw the real Norwich star field + moon (only when dark & clear)
// ---- real-ish celestial calendar ----
var LUNAR_ECLIPSES=["2026-3-3","2026-8-28","2027-2-20","2027-7-18","2028-1-12","2028-7-6"];     // blood-moon nights
var SOLAR_ECLIPSES=["2026-2-17","2026-8-12","2027-2-6","2027-8-2","2028-1-26","2028-7-22"];      // sun-occulted days
var COMET_SEASON=["2026-4","2027-10"];                                                            // a great comet visits (year-month)
function ymd(nd){ return nd.getFullYear()+"-"+(nd.getMonth()+1)+"-"+nd.getDate(); }
function ym(nd){ return nd.getFullYear()+"-"+(nd.getMonth()+1); }
var eclipseMoon=false, solarEclDim=0;                                                             // eclipse state (moon reddens / daytime dims)
function meteorShowerActive(nd){ var m=nd.getMonth()+1,d=nd.getDate();
  return (m===8&&d>=8&&d<=16)||(m===12&&d>=10&&d<=17)||(m===1&&d>=1&&d<=5); }                     // Perseids / Geminids / Quadrantids
function auroraActive(nd){ var t=(weather.temp==null?60:weather.temp); if(t>=36) return false;
  return (rng((Math.floor(nd.getTime()/86400000)*2654435761)>>>0)()<0.18); }                     // ~18% of cold clear nights
// ============ STREET LIFE 2 & RARE SPECTACLES (K/J/M batch) ============
var FORCEK=null;      // test hook (own line!): {gull:1,whale:f,ufo:f,mishap:f,sax:1,ice:1,prof:1,cats:1,prem:1,caps:1}
// a real little BIRD: 4-frame wingbeat (up / level / down / level) so the flap reads as a smooth
// stroke, not a blink; wings are 2px each side. big=1 draws the wider gull silhouette with
// crooked (M-shaped) wings on the glide. ph=1 with no flapping = a soaring glide pose.
function drawBird(g,x,y,ph,col,dir,big){
  var f=(((ph|0)%4)+4)%4; if(f===3) f=1;                       // up, level, down, level
  x=x|0; y=y|0; g.fillStyle=col;
  var hd=(dir===undefined||dir>0)?1:-1;
  if(big){
    g.fillRect(x-1,y,3,1); g.fillRect(x+(hd>0?2:-2),y,1,1);    // body + head forward
    if(f===0){      g.fillRect(x-2,y-1,1,1); g.fillRect(x+2,y-1,1,1);   // upstroke: wings raised high
                    g.fillRect(x-3,y-2,1,1); g.fillRect(x+3,y-2,1,1); }
    else if(f===1){ g.fillRect(x-2,y-1,1,1); g.fillRect(x+2,y-1,1,1);   // glide: the gull "M" —
                    g.fillRect(x-4,y,2,1);   g.fillRect(x+3,y,2,1); }   // raised shoulders, level tips
    else{           g.fillRect(x-2,y+1,1,1); g.fillRect(x+2,y+1,1,1);   // downstroke: wings swept low
                    g.fillRect(x-3,y+2,1,1); g.fillRect(x+3,y+2,1,1); }
  } else {
    g.fillRect(x,y,2,1);                                       // body
    g.fillRect(x+(hd>0?2:-1),y,1,1);                           // head forward
    if(f===0){      g.fillRect(x-1,y-1,1,1); g.fillRect(x+2,y-1,1,1);   // wings UP
                    g.fillRect(x-2,y-2,1,1); g.fillRect(x+3,y-2,1,1); }
    else if(f===1){ g.fillRect(x-2,y,1,1);   g.fillRect(x+3,y,1,1); }   // extended glide
    else{           g.fillRect(x-1,y+1,1,1); g.fillRect(x+2,y+1,1,1);   // wings DOWN
                    g.fillRect(x-2,y+2,1,1); g.fillRect(x+3,y+2,1,1); }
  }
}
// K1: seagulls over the coast by day — each soars a wheeling loop that slowly patrols along the
// shore: it FLAPS up the climbing side of the loop and locks into a glide down the far side,
// always facing the way it's actually travelling. One peels off to dive for a fish now and then.
function drawGulls(g,L,now){
  if(!hasOcean||seaW<=0||L<0.45) return;
  for(var i=0;i<9;i++){ var h=((i*2654435761+13)>>>0);
    var side=(i&1)?WW*(1-seaW*0.5):WW*seaW*0.5;                        // home shore
    var drift=Math.sin(now*0.000045+(h%7))*(seaW*WW*0.55);             // slow patrol along the coast
    var w1=0.00052+((h>>>5)%40)*0.000006;                              // personal loop tempo (~9-12s)
    var ang=now*w1+(h%628)/100;
    var R=(7+((h>>>3)%7))*KSP;                                         // soaring-loop radius
    var wx=wrapW(side+drift+Math.cos(ang)*R);
    var gy2=HORIZON-30-((h>>>7)%26)+Math.sin(ang)*R*0.45;              // flattened ellipse
    var dirg=(-Math.sin(ang))>=0?1:-1;                                 // face the travel direction
    var climbing=Math.cos(ang)<0;                                      // y shrinking = going up
    var dive=(((Math.floor(now/20000)+i)%9)===0)?Math.min(1,((now%20000)/2600)):0;   // one gull dives now and then
    var sx=wx-WOFF; if(sx>SW+5&&sx-WW>-5) sx-=WW; if(sx<-5&&sx+WW<SW+5) sx+=WW;
    if(sx<-4||sx>SW+4) continue;
    if(dive>0&&dive<1){ gy2=gy2+(HORIZON-16-gy2)*Math.sin(dive*Math.PI); climbing=dive>0.55;
      if(dive>0.45&&dive<0.6){ g.fillStyle="rgba(255,255,255,0.6)"; g.fillRect(sx|0,HORIZON-15,2,1); } }   // splash!
    var phG=climbing?(Math.floor(now/120)+i):1;                        // flap on the climb, glide down
    drawBird(g,sx,gy2,phG,L>0.5?"#eef2f6":"#9aa6b6",dirg,1);
  }
}
// ambient birds actually CROSSING the sky, all year round: loose flocks and the odd loner ride
// three independent schedules across the whole world (so they hand off between monitors), beating
// their wings in bursts and coasting between — the flap-flap-glide rhythm of real birds. Drawn
// BEHIND the skyline (called before the building layers).
function drawSkyBirds(g,L,now,fx){
  if(L<0.35||fx.thunder||fx.snow||fx.rain) return;                     // birds sit out storms & the night
  for(var s=0;s<3;s++){
    var P=[97000,151000,233000][s], SPD=[0.017,0.023,0.013][s];        // period*dwell covers the crossing
    var fl=crosser(now,P,SPD,30,0.85); if(!fl) continue;
    var h=((fl.idx*2654435761+s*97)>>>0);
    var n=1+(h%5), base=12+((h>>>4)%34);                               // 1-5 birds, high sky band
    var col=L>0.5?"rgba(46,52,64,0.92)":"rgba(150,160,185,0.7)";
    for(var b=0;b<n;b++){ var bh=((h+b*40503)>>>0);
      var bwx=fl.x-fl.dir*b*(4+(bh%4));                                // loose trailing line
      var cyc=((now+(bh%2600))%2600)/2600, flap=cyc<0.62;              // beat a while, then coast
      var byy=base+((bh>>>6)%5)+Math.sin(now*0.0007+(bh%9))*1.6+(flap?0:(cyc-0.62)*3);   // sink on the glide
      for(var off=-WW;off<=WW;off+=WW){ var X=bwx-WOFF+off; if(X<-4||X>SW+4) continue;
        drawBird(g,X,byy,flap?(Math.floor(now/110)+b):1,col,fl.dir); }
    }
  }
}
// SONGBIRDS hop the meadow and flit up into the canopies
function drawSongbirds(g,L,now){
  if(cityG>0.6||L<0.35) return;
  var cols=["#c05a2a","#4a6a9a","#c9a23a","#7a4a6a"];
  for(var i=0;i<4;i++){ var h=((i*2654435761+521)>>>0);
    var CYC=9000, ph=((now+h%4000)%CYC)/CYC;
    var bx=landRoute(WW*seaW+30+((h%1000)/1000)*(WW*(1-2*seaW)-60));
    var sx=bx-WOFF; if(sx>SW+4&&sx-WW>-4) sx-=WW; if(sx<-4&&sx+WW<SW+4) sx+=WW;
    if(sx<-3||sx>SW+3) continue;
    var col=cols[i];
    if(ph<0.5){ var hopx=sx+((Math.floor(ph*10)&1)?1:0);                          // hopping & pecking
      g.fillStyle=col; g.fillRect(hopx|0,HORIZON+1-((Math.floor(now/300)+i)&1?1:0),2,1);
      g.fillRect((hopx+2)|0,HORIZON,1,1); }
    else if(ph<0.68){ var ff=(ph-0.5)/0.18;                                       // flit UP to the tree
      drawBird(g,sx+ff*6,HORIZON-ff*14,(Math.floor(now/110)+i)%4,col,1); }
    else if(ph<0.85){ g.fillStyle=col; g.fillRect((sx+6)|0,(HORIZON-14)|0,2,1); } // perched, singing
    else{ var fd=(ph-0.85)/0.15; drawBird(g,sx+6-fd*6,HORIZON-14+fd*14,(Math.floor(now/110)+i)%4,col,-1); }
  }
}
// K5 helper + M1 fodder: cows graze the young meadow
function drawCows(g,L,now,nd){
  if(cityG>0.42||L<0.3) return;
  for(var i=0;i<3;i++){ var h=((i*40503+91)>>>0);
    var wx=WW*seaW+40+((h%1000)/1000)*(WW*(1-2*seaW)-80);
    var sx=wx-WOFF; if(sx>SW+6&&sx-WW>-6) sx-=WW; if(sx<-6&&sx+WW<SW+6) sx+=WW;
    if(sx<-5||sx>SW+5) continue;
    var up=((Math.floor(now/2600)+i)%5)===0, cy2=HORIZON+3+((h>>>4)%4);
    g.fillStyle=(i===1)?"#2a2622":"#8a6a4a"; g.fillRect(sx|0,cy2,4,2);             // body
    g.fillStyle="#eee"; if(i!==1) g.fillRect((sx+1)|0,cy2,1,1);                    // patch
    g.fillStyle=(i===1)?"#2a2622":"#7a5a3c"; g.fillRect((sx+4)|0,cy2+(up?0:1),1,1); // head up/grazing
    g.fillStyle="#1c1a16"; g.fillRect(sx|0,cy2+2,1,1); g.fillRect((sx+3)|0,cy2+2,1,1);
  }
}
// M1: a saucer takes a cow home (wilderness nights, rare)
function drawUFO(g,L,now,nd){
  if(cityG>0.35||L>0.4) return;
  var SLOT=480000, idx=Math.floor(now/SLOT), r=rng((idx*2654435761+331)>>>0);
  var f; if(FORCEK&&FORCEK.ufo!==undefined){ f=FORCEK.ufo; r=rng(777); }
  else { if(r()>0.28) return; var t0=r()*(SLOT-34000), tp=now-idx*SLOT-t0;
    if(tp<0||tp>30000) return; f=tp/30000; }
  var wx=(FORCEK&&FORCEK.ufox!==undefined)?WW*FORCEK.ufox:WW*seaW+60+r()*(WW*(1-2*seaW)-120), sx=wx-WOFF;
  if(sx>SW+30&&sx-WW>-30) sx-=WW; if(sx<-30&&sx+WW<SW+30) sx+=WW;
  if(sx<-24||sx>SW+24) return;
  var hovY=HORIZON-40;
  var uy=f<0.2? -8+(hovY+8)*(f/0.2) : (f<0.85? hovY+Math.sin(now*0.004)*1.5 : hovY-(f-0.85)/0.15*(hovY+12));
  var ux=sx+(f>0.85?(f-0.85)/0.15*36:0);
  g.globalCompositeOperation="lighter";                                            // night-bright craft
  g.fillStyle="rgba(150,190,230,0.35)"; g.fillRect((ux-5)|0,(uy-2)|0,11,5);        // soft aura
  g.globalCompositeOperation="source-over";
  g.fillStyle="#aab6cc"; g.fillRect((ux-4)|0,uy|0,9,2);                            // hull
  g.fillStyle="#e2ecfa"; g.fillRect((ux-2)|0,(uy-1)|0,5,1);                        // glowing dome
  g.fillStyle="#5a6478"; g.fillRect((ux-4)|0,(uy+1)|0,9,1);                        // keel shadow
  var bl=(Math.floor(now/160))%3;
  g.fillStyle=["#7af5ff","#ff7ad0","#b9ffcf"][bl]; g.fillRect((ux-4+((Math.floor(now/160))%9))|0,(uy+1)|0,1,1);
  if(f>=0.2&&f<0.75){ g.globalCompositeOperation="lighter";                        // the BEAM
    for(var by2=uy+2;by2<HORIZON+4;by2++){ var t2=(by2-uy)/(HORIZON+4-uy), bw2=1+t2*5;
      g.fillStyle="rgba(140,255,170,"+(0.30*(1-t2*0.45)).toFixed(3)+")";
      g.fillRect((ux-bw2/2)|0,by2,bw2|0,1); }
    g.globalCompositeOperation="source-over";
    var cf=(f-0.2)/0.55, cyw=HORIZON+3-(HORIZON+3-(uy+3))*cf;                      // the cow ascends, slowly spinning
    g.fillStyle="#8a6a4a"; g.fillRect((ux-2+Math.sin(cf*9)*1.5)|0,cyw|0,4,2);
    g.fillStyle="#eee"; g.fillRect((ux-1+Math.sin(cf*9)*1.5)|0,cyw|0,1,1);
  }
}
// M2: a whale breaches out in the open sea (daylight, rare)
function drawWhale(g,L,now){
  if(!hasOcean||seaW<=0||L<0.35) return;
  var SLOT=600000, idx=Math.floor(now/SLOT), r=rng((idx*40503+557)>>>0);
  var f; if(FORCEK&&FORCEK.whale!==undefined){ f=FORCEK.whale; r=rng(555); }
  else { if(r()>0.30) return; var t0=r()*(SLOT-6000), tp=now-idx*SLOT-t0;
    if(tp<0||tp>5200) return; f=tp/5200; }
  var side=r()<0.5?0:1, wx=side?WW*(1-seaW*0.5):WW*seaW*0.5;
  var sx=wx-WOFF; if(sx>SW+16&&sx-WW>-16) sx-=WW; if(sx<-16&&sx+WW<SW+16) sx+=WW;
  if(sx<-14||sx>SW+14) return;
  var wl=HORIZON-14, arc=Math.sin(f*Math.PI), wy=wl-arc*13;
  var lean=(f-0.5)*3;
  g.fillStyle=L>0.5?"#2c3a4c":"#182430";                                            // the body arcs over
  g.fillRect((sx-4)|0,wy|0,9,3); g.fillRect((sx-2)|0,(wy-1)|0,6,1);
  g.fillStyle="#dfe8ee"; g.fillRect((sx-3)|0,(wy+2)|0,7,1);                         // pale belly
  g.fillRect((sx+4+lean)|0,(wy-1)|0,2,1);                                           // fluke
  if(f<0.22||f>0.75){ g.fillStyle="rgba(255,255,255,0.75)";                         // spray on entry/exit
    for(var sp2=0;sp2<5;sp2++) g.fillRect((sx-5+sp2*3)|0,(wl+1-((sp2*7+Math.floor(now/90))%4))|0,1,1); }
  g.fillStyle="rgba(255,255,255,0.4)"; var rw=(2+f*10)|0;
  g.fillRect((sx-rw)|0,wl+2,rw*2,1);                                                // expanding ring
}
// K3: time-locked professions — dawn garbage run, midday mail, sunrise joggers
function stopgo(t,P,move,dist){ var k=Math.floor(t/P), ph=t-k*P;                    // move, pause, repeat
  return k*dist + Math.min(1,ph/move)*dist; }
function drawProfessions(g,L,now,nd){
  if(cityG<0.45) return;
  var h=nd.getHours()+nd.getMinutes()/60;
  if((h>=5&&h<7)||(FORCEK&&FORCEK.prof)){                                           // the dawn GARBAGE TRUCK
    var gp=wrapW(60+stopgo(now,13000,0.72,34)), gx=gp-WOFF;
    if(gx>SW+14&&gx-WW>-14) gx-=WW; if(gx<-14&&gx+WW<SW+14) gx+=WW;
    if(gx>=-12&&gx<=SW+12){ var gy3=HORIZON+LANE[0].o, paused=(now%13000)>13000*0.72;
      g.fillStyle="#3f6a46"; g.fillRect(gx|0,gy3-3,10,4);                           // hopper
      g.fillStyle="#2c4a32"; g.fillRect(gx|0,gy3-3,10,1);
      g.fillStyle="#cfd6de"; g.fillRect((gx+10)|0,gy3-2,3,3);                       // cab
      g.fillStyle="#0b0b10"; g.fillRect((gx+1)|0,gy3+1,2,1); g.fillRect((gx+10)|0,gy3+1,2,1);
      if(L<0.5){ g.fillStyle="#ffb02a"; if((Math.floor(now/300))&1) g.fillRect((gx+9)|0,gy3-4,1,1); }
      if(paused) drawPerson(g,(gx-3)|0,gy3-1,"#c8742a",SKINC[2],(Math.floor(now/240))&1); }   // loader hops off
  }
  if((h>=11&&h<14)||(FORCEK&&FORCEK.prof)){                                         // midday MAIL carriers
    for(var mc=0;mc<2;mc++){ var dirm=mc?1:-1;
      var mp=wrapW(200+mc*700+dirm*stopgo(now+mc*40000,9000,0.75,22)), mx2=mp-WOFF;
      if(mx2>SW+4&&mx2-WW>-4) mx2-=WW; if(mx2<-4&&mx2+WW<SW+4) mx2+=WW;
      if(mx2<-3||mx2>SW+3) continue;
      drawPerson(g,mx2|0,HORIZON-1,"#2f5f9f",SKINC[(mc*2+1)%SKINC.length],(Math.floor(now/280)+mc)&1);
      g.fillStyle="#e8e2d2"; g.fillRect((mx2+(dirm>0?2:-2))|0,HORIZON,1,1); }       // the satchel
  }
  if((h>=5.5&&h<8)||(FORCEK&&FORCEK.prof)){                                         // sunrise JOGGERS
    for(var jg=0;jg<3;jg++){ var dj=(jg&1)?1:-1;
      var jp=wrapW(((jg*2654435761)>>>0)%WW + dj*now*0.0058), jx=jp-WOFF;
      if(jx>SW+4&&jx-WW>-4) jx-=WW; if(jx<-4&&jx+WW<SW+4) jx+=WW;
      if(jx<-3||jx>SW+3) continue;
      drawPerson(g,jx|0,HORIZON-1,["#ff5a5a","#4affc0","#ffd23a"][jg],SKINC[jg%SKINC.length],(Math.floor(now/110)+jg)&1); }
  }
}
// K4: the summer ice-cream truck (kids give chase)
function drawIceCream(g,L,now,nd){
  var m2=nd.getMonth()+1, h2=nd.getHours();
  if(!(FORCEK&&FORCEK.ice) && (cityG<0.45||m2<6||m2>8||h2<12||h2>=18)) return;
  var ip=wrapW(300+stopgo(now,26000,0.62,52)), ix=ip-WOFF;
  if(ix>SW+16&&ix-WW>-16) ix-=WW; if(ix<-16&&ix+WW<SW+16) ix+=WW;
  if(ix<-14||ix>SW+14) return;
  var iy=HORIZON+LANE[1].o, paused=(now%26000)>26000*0.62;
  g.fillStyle="#f4f6fa"; g.fillRect(ix|0,iy-4,11,5);                                // the truck
  g.fillStyle="#ff7ad0"; g.fillRect(ix|0,iy-2,11,1);                                // pink stripe
  g.fillStyle="#8fd8ff"; g.fillRect((ix+7)|0,iy-3,3,2);                             // serving window
  g.fillStyle="#ffd23a"; g.fillRect((ix+4)|0,iy-6,1,2); g.fillStyle="#ff9a3c"; g.fillRect((ix+4)|0,iy-7,1,1);   // roof cone
  g.fillStyle="#0b0b10"; g.fillRect((ix+1)|0,iy+1,2,1); g.fillRect((ix+8)|0,iy+1,2,1);
  var kc=["#ff5a5a","#4aa8ff","#4affc0"];
  if(paused){ for(var kq=0;kq<3;kq++){                                              // kids queue at the window
      g.fillStyle=SKINC[kq%SKINC.length]; g.fillRect((ix+12+kq*3)|0,iy-2,2,1);
      g.fillStyle=kc[kq]; g.fillRect((ix+12+kq*3)|0,iy-1,2,2); } }
  else { for(var kx=0;kx<2;kx++){ var kb=(Math.floor(now/130)+kx)&1;                // kids chasing behind
      g.fillStyle=SKINC[(kx+1)%SKINC.length]; g.fillRect((ix-3-kx*4)|0,iy-2-kb,2,1);
      g.fillStyle=kc[kx]; g.fillRect((ix-3-kx*4)|0,iy-1-kb,2,2); }
    if((Math.floor(now/400))%2===0){ g.fillStyle="#ffe9a0"; g.fillRect((ix+5)|0,iy-9,1,1); g.fillRect((ix+7)|0,iy-10,1,1); } }  // jingle
}
// K5: stray cats on the fire escapes, eyes aglow at night
function drawCats(g,L,now,nd){
  var night2=1-L; if(night2<0.35&&!(FORCEK&&FORCEK.cats)) return;
  var drawn=0;
  for(var i=0;i<near.blds.length&&drawn<6;i++){ var b=near.blds[i];
    if(b.type==="park"||b.fesc===undefined||b.fesc<0||((b.seed>>>3)%7)!==0) continue;
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;
    var bx=b.x-WOFF; if(bx>SW+4&&bx-WW>-4) bx-=WW; if(bx<-4-b.w&&bx+WW<SW+4) bx+=WW;
    if(bx<-b.w||bx>SW+4) continue; drawn++;
    var top2=(HORIZON-b.h)|0, fX=(b.fesc===0?bx+1:bx+b.w-2);
    var fr=top2+7+(((b.seed>>>5)%3)*8); if(fr>HORIZON-6) fr=HORIZON-6;
    g.fillStyle="#16141a"; g.fillRect(fX|0,fr-1,2,1);                               // the cat, loafed
    var flick=((Math.floor(now/700)+i)&3)===0;
    g.fillRect((fX+(b.fesc===0?2:-1))|0,fr-1-(flick?1:0),1,1);                      // tail flick
    if(night2>0.55&&((Math.floor(now/1400)+i)%9)<8){ g.fillStyle="#b8ffc9";        // the eyes
      g.fillRect(fX|0,fr-1,1,1); }
  }
}
// K2: the lone saxophonist under a lamp, late at night
function drawSax(g,L,now,nd){
  var hh2=nd.getHours();
  if(!(FORCEK&&FORCEK.sax) && (cityG<0.5||L>0.3||(hh2<22&&hh2>=2))) return;
  var dayN=Math.floor((NOWOVR!=null?NOWOVR:Date.now())/86400000);
  if(!(FORCEK&&FORCEK.sax) && ((dayN*2654435761)>>>0)%100>=55) return;              // some nights he stays home
  var wx=hasOcean&&seaW>0?WW*seaW+9:Math.round(0.31*WW), sx=wx-WOFF;
  if(sx>SW+6&&sx-WW>-6) sx-=WW; if(sx<-6&&sx+WW<SW+6) sx+=WW;
  if(sx<-5||sx>SW+5) return;
  drawPerson(g,sx|0,HORIZON-1,"#3a3444",SKINC[2],0);
  var sway=(Math.floor(now/600))&1;
  g.fillStyle="#d9a72b"; g.fillRect((sx+2)|0,HORIZON-1+sway,1,2); g.fillRect((sx+3)|0,HORIZON+sway,1,1);   // the sax
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(255,214,120,0.20)"; g.fillRect((sx-3)|0,HORIZON-6,9,8);          // pool of lamplight & music
  for(var nt=0;nt<3;nt++){ var np2=((now*0.0011+nt*0.37)%1);
    g.fillStyle="rgba(255,240,200,"+(0.7*(1-np2)).toFixed(2)+")";
    g.fillRect((sx+3+np2*7+Math.sin(np2*9+nt)*1.5)|0,(HORIZON-3-np2*9)|0,1,1); }     // drifting notes
  g.globalCompositeOperation="source-over";
}
// J4: premiere night — crossing searchlights, red carpet, camera flashes
function drawPremiere(g,L,now,nd){
  var dw2=nd.getDay(), hh3=nd.getHours();
  if(!(FORCEK&&FORCEK.prem)){
    if(cityG<0.7||L>0.3||!((dw2===5||dw2===6)&&hh3>=20)) return;
    var dayN2=Math.floor((NOWOVR!=null?NOWOVR:Date.now())/86400000);
    if(((dayN2*40503+7)>>>0)%100>=45) return; }
  var vx=Math.round(WW*(((Math.floor((NOWOVR!=null?NOWOVR:Date.now())/86400000))&1)?0.30:0.70)), sx=vx-WOFF;
  if(sx>SW+40&&sx-WW>-40) sx-=WW; if(sx<-40&&sx+WW<SW+40) sx+=WW;
  if(sx<-36||sx>SW+36) return;
  g.globalCompositeOperation="lighter";
  for(var bm=0;bm<2;bm++){ var aa=(bm?2.05:1.09)+Math.sin(now*0.00055+bm*2.6)*0.42;  // the two beams cross
    for(var st2=2;st2<26;st2++){ var bxp=sx+Math.cos(aa)*st2*2.1, byp=HORIZON-4-Math.sin(aa)*st2*2.1;
      if(byp<0) break;
      g.fillStyle="rgba(220,235,255,"+(0.12*(1-st2/26)).toFixed(3)+")";
      g.fillRect(bxp|0,byp|0,1+(st2>>3),1); } }
  g.globalCompositeOperation="source-over";
  g.fillStyle="#b02030"; g.fillRect((sx-7)|0,HORIZON+1,15,2);                        // the red carpet
  g.fillStyle="#d9a72b"; g.fillRect((sx-7)|0,HORIZON-2,1,3); g.fillRect((sx+7)|0,HORIZON-2,1,3);   // rope posts
  for(var cr3=0;cr3<5;cr3++) drawPerson(g,(sx-11+cr3*2)|0,HORIZON-1,PEDC[cr3%PEDC.length],SKINC[cr3%SKINC.length],0);
  drawPerson(g,(sx+3)|0,HORIZON-1,"#e8e2d2",SKINC[1],((Math.floor(now/500))&1));     // the star arrives
  if(((Math.floor(now/130))%5)===0){ g.fillStyle="#ffffff";                          // camera flash
    g.fillRect((sx-9+((Math.floor(now/130)*7)%16))|0,HORIZON-4,1,1); }
}
// M4: the time-capsule ceremony at the half-built mark of every civilization
function drawCapsule(g,L,now){
  if(!(FORCEK&&FORCEK.caps) && Math.abs(cityG-0.5)>=0.0045) return;
  var wx=Math.round(0.365*WW), sx=wx-WOFF;
  if(sx>SW+20&&sx-WW>-20) sx-=WW; if(sx<-20&&sx+WW<SW+20) sx+=WW;
  if(sx<-16||sx>SW+16) return;
  g.fillStyle="#3a3026"; g.fillRect((sx-2)|0,HORIZON+1,5,2);                         // the dug pit
  var low=(Math.floor(now/900))%3;
  g.fillStyle="#c9ccd4"; g.fillRect(sx|0,HORIZON-2+low,2,2);                         // the capsule, lowered
  g.fillStyle="rgba(150,150,160,0.6)"; g.fillRect(sx|0,HORIZON-5,1,3+low);           // the rope
  var mc2=curMayor?curMayor.party.c:"#e0a83a";
  drawPerson(g,(sx-4)|0,HORIZON-1,mc2,SKINC[0],0);                                   // the mayor presides
  for(var cw2=0;cw2<4;cw2++) drawPerson(g,(sx+4+cw2*2)|0,HORIZON-1,PEDC[(cw2*2+1)%PEDC.length],SKINC[cw2%SKINC.length],0);
  g.fillStyle="#e8e2d2"; g.fillRect((sx-6)|0,HORIZON-8,1,7); g.fillStyle="#d23b3b"; g.fillRect((sx-5)|0,HORIZON-8,2,1);   // flag
  if(((Math.floor(now/160))%3)===0){ g.fillStyle=NEON[(Math.floor(now/160))%NEON.length];
    g.fillRect((sx-6+((Math.floor(now/70))%13))|0,(HORIZON-9+((Math.floor(now/110))%5))|0,1,1); }   // confetti
}
// M3: the blimp mishap — it deflates onto a rooftop, a crew comes to peel it off
var curMishap=null;
function blimpMishapNow(now){
  var SLOT=3600000, idx=Math.floor(now/SLOT), r=rng((idx*2654435761+911)>>>0);
  if(FORCEK&&FORCEK.mishap!==undefined) return {f:FORCEK.mishap, r:rng(999)};
  if(cityG<0.6) return null;
  if(r()>0.06) return null;                                                          // rare
  var t0=r()*(SLOT-200000), tp=now-idx*SLOT-t0;
  if(tp<0||tp>180000) return null;
  return {f:tp/180000, r:r};
}
function drawBlimpMishap(g,L,now){
  var M2=curMishap; if(!M2) return;
  var best=null;                                                                     // tallest near tower around 0.6 WW
  for(var i=0;i<near.blds.length;i++){ var b=near.blds[i];
    if(b.type==="park"||Math.abs(b.x-WW*0.6)>WW*0.12) continue;
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;
    if(!best||b.h>best.h) best=b; }
  if(!best) return;
  var bx=best.x-WOFF; if(bx>SW+20&&bx-WW>-20) bx-=WW; if(bx<-20-best.w&&bx+WW<SW+20) bx+=WW;
  if(bx<-best.w-16||bx>SW+16) return;
  var top2=(HORIZON-best.h)|0, cx2=bx+(best.w>>1), f=M2.f;
  if(f<0.25){ var df=f/0.25;                                                         // sagging descent
    var byy=14+(top2-6-14)*df, bxx=cx2-30+30*df;
    g.fillStyle="#c9ccd4"; g.fillRect(bxx|0,byy|0,13,3+(df*2)|0);
    g.fillStyle="#8a8f9a"; g.fillRect((bxx+2)|0,(byy+3)|0,9,1);
    g.fillStyle="#ffb02a"; if((Math.floor(now/250))&1) g.fillRect((bxx+6)|0,(byy-1)|0,1,1); }
  else if(f<0.85){                                                                   // draped on the roof, crew at work
    var flap=(Math.floor(now/600))&1;
    g.fillStyle="#c9ccd4"; g.fillRect((cx2-6)|0,top2-2,12,2); g.fillRect((cx2-4)|0,top2-3-flap,7,1);
    g.fillStyle="#8a8f9a"; g.fillRect((cx2-6)|0,top2-1,12,1);
    drawPerson(g,(cx2-8)|0,top2-1,"#ffd24a",SKINC[1],(Math.floor(now/300))&1);
    drawPerson(g,(cx2+7)|0,top2-1,"#ffd24a",SKINC[3],(Math.floor(now/300)+1)&1);
    if((Math.floor(now/280))&1){ g.fillStyle="#ffb02a"; g.fillRect(cx2|0,top2-5,1,1); } }
  else { var pf=(f-0.85)/0.15;                                                       // hauled away
    g.fillStyle="rgba(201,204,212,"+(1-pf).toFixed(2)+")"; g.fillRect((cx2-5+pf*8)|0,(top2-2-pf*10)|0,10,2); }
}
// ============ REALISTIC FIRE — one flame primitive every blaze in the world shares ============
// A flickering, layered pixel flame: deep-red tongues on the outside, an orange body, a yellow
// core and a white-hot heart at the base — it leans and gutters over time and throws sparks. Fully
// deterministic (now+seed) so it burns identically on every screen. cx = flame centre, baseY = the
// surface it sits on, fw/fh = width/height in world px, inten 0..1 scales height & brightness
// (a dying fire → thin, low & red). Drawn additively so overlapping tongues glow.
function drawFlame(g,cx,baseY,fw,fh,now,seed,inten,wind){
  if(inten==null) inten=1; if(inten<=0||fw<1) return;
  if(fw>24) fw=24;                                                                       // defensive bound (shared painter, many callers)
  inten*=0.85+0.15*Math.sin(now*0.006+seed*2.1);                                         // the whole fire BREATHES
  var half=fw/2, sway=Math.sin(now*0.0032+seed*1.7)*(1+fw*0.12)*inten+(wind||0)*2;
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(255,138,44,"+(0.16*inten).toFixed(3)+")";                          // warm pool of light at the base
  g.fillRect((cx-half-1)|0,(baseY-2)|0,Math.max(1,(fw+2)|0),3);
  for(var dx=Math.ceil(-half);dx<=half;dx++){
    var ee=dx/(half+0.001), e=1-ee*ee;                                                  // parabolic envelope (tallest centre)
    if(e<=0.02) continue;
    e*=0.72+0.38*Math.sin(dx*2.3+seed*0.7+Math.floor(now/450));                          // LICKING TONGUES: 2-4 peaks that reshape every ~450ms
    if(e<=0.03) continue;
    var fl=0.58+0.30*Math.sin(now*0.013+dx*0.9+seed)+0.14*Math.sin(now*0.029-dx*1.9+seed*1.3);  // 2-octave turbulence
    var colH=fh*e*Math.max(0.18,fl)*inten; if(colH<1) continue;
    var lean=sway*(1.1-e*0.6), x=(cx+dx+lean)|0, topY=(baseY-colH)|0, ch=Math.max(1,colH|0);
    g.fillStyle="#e42a08"; g.fillRect(x,topY,1,ch);                                     // full deep-red tongue
    if(colH>fh*0.72){ g.fillStyle="rgba(255,60,10,0.55)"; g.fillRect(x,topY-1,1,1); }   // deep-red tip licking upward off tall tongues
    var oH=(colH*0.72)|0; if(oH>0){ g.fillStyle="#ff7413"; g.fillRect(x,(baseY-oH)|0,1,oH); }    // orange body (lower ¾)
    if(e>0.28){ var yH=(colH*0.44)|0; if(yH>0){ g.fillStyle="#ffc233"; g.fillRect(x,(baseY-yH)|0,1,yH); } }  // yellow (centre, lower half)
    if(e>0.6){ var wH=Math.max(1,(colH*0.22)|0); g.fillStyle="#fff2c4"; g.fillRect(x,(baseY-wH)|0,1,wH); }   // white-hot heart
  }
  var nE=Math.max(2,Math.round(fw*0.6*inten));                                          // sparks spat up and swept sideways
  for(var ei=0;ei<nE;ei++){ var eh=((seed*131+ei*977)>>>0), per=900+(eh%900), lf=((now+eh)%per)/per;
    var ex=(cx+(((eh>>5)%Math.max(1,(fw|0)))-half)+Math.sin(now*0.004+ei+seed)*(1.5+fw*0.12)+(wind||0)*lf*8)|0;
    var ey=(baseY-2-lf*(fh*1.7+5))|0;
    g.globalAlpha=Math.max(0,(1-lf))*inten; g.fillStyle=lf<0.5?"#ffd257":"#ff6a1e"; g.fillRect(ex,ey,1,1); }
  g.globalAlpha=1; g.globalCompositeOperation="source-over";
}
// billowing smoke that rises, expands and greys out as it cools — sits above a flame's crown.
function drawFireSmoke(g,cx,topY,now,seed,inten,wind){
  if(inten<=0) return; var n=Math.round(4*inten)+2;
  for(var i=0;i<n;i++){ var sh=((seed*71+i*613)>>>0), per=1500+(sh%1300), lf=((now+sh)%per)/per;
    var rise=lf*(26+(sh%22)), sz=1+Math.round(lf*4*inten);
    var sx=(cx+Math.sin(now*0.0011+i+seed)*4+(wind||0)*rise*0.18)|0, sy=(topY-rise)|0;
    var g2=lf<0.28?66:104, a=0.5*(1-lf)*inten;                                          // dark near the fire, pale as it thins
    var r9=Math.round(g2+(140-g2)*lf), gg9=Math.round((g2-3)+(150-g2)*lf), b9=Math.round((g2-7)+(165-g2)*lf);   // dissolve toward the sky
    g.fillStyle="rgba("+r9+","+gg9+","+b9+","+a.toFixed(3)+")"; g.fillRect(sx,sy,sz,sz); }
}
// ---- FOREST FIRES: a dry-season spark takes the woods; charred snags stand a while,
// then the forest takes itself back, sapling by sapling. Rain douses an active burn.
var fireZones=[], fireBurning=false, fxRainNow=false;
var FIRE_SLOT=560000, FIRE_DUR=150000, CHAR_T=300000, REGROW_T=1080000;   // 2.5min burn, 5min char, 18min regrow — slow enough to feel, fast enough to WATCH the woods & grass come back
function computeFireZones(now,fx){
  fireZones.length=0; fireBurning=false; fxRainNow=!!(fx&&(fx.rain||fx.drizzle||fx.snow||fx.thunder));
  if(cityG>0.75) return;
  var back=Math.ceil((FIRE_DUR+CHAR_T+REGROW_T)/FIRE_SLOT)+1, idx0=Math.floor(now/FIRE_SLOT);
  for(var k=0;k<back;k++){ var idx=idx0-k, r=rng((idx*2654435761+139)>>>0);
    if(r()>0.18) continue;                                   // most slots burn nothing
    var t0=idx*FIRE_SLOT+r()*(FIRE_SLOT-FIRE_DUR);
    if(now<t0) continue;
    var cx=WW*seaW+50+r()*(WW*(1-2*seaW)-100);
    if(Math.abs(cx-WW*0.5)<70) continue;                     // spare the homestead hollow
    fireZones.push({x:cx, r:34+r()*55, t0:t0});
    if(now-t0<FIRE_DUR&&!fxRainNow) fireBurning=true;
  }
}
function fireStateAt(wx,now){
  for(var i=0;i<fireZones.length;i++){ var F=fireZones[i];
    var d=Math.abs(wx-F.x); if(d>WW/2) d=WW-d;
    if(d>F.r) continue;
    var age=now-F.t0, reach=(d/F.r)*FIRE_DUR*0.5;            // the front races outward
    if(age<reach) continue;                                  // flames haven't reached here yet
    var local=age-reach;
    if(local<FIRE_DUR*0.5) return fxRainNow?{ph:1,k:0}:{ph:0,k:local/(FIRE_DUR*0.5),F:F};   // burning (doused by rain)
    if(local<CHAR_T) return {ph:1,k:local/CHAR_T};           // charred snag
    if(local<CHAR_T+REGROW_T) return {ph:2,k:(local-CHAR_T)/REGROW_T};   // regrowing
    return null;
  }
  return null;
}
function drawBurningTree(g,X,gy,day,now,seed,k){
  var sc=treeSC(seed), th=Math.round(6*sc);
  g.fillStyle="#241a10"; g.fillRect(X,gy-th,Math.max(1,(sc>=1.7?2:1)),th);            // blackening trunk
  g.fillStyle="rgba(30,22,14,0.9)"; g.fillRect(Math.round(X-2*sc),gy-th-Math.round(3*sc),Math.round(5*sc),Math.round(3*sc));   // charring canopy silhouette
  var eng=Math.max(0.35,1-k*0.7);                                                       // fresh fire roars; it dies down as k→1
  drawFlame(g,X,gy-th-Math.round(1*sc),Math.max(3,4*sc),Math.round((5+3*sc)*sc),now,seed*13+1,eng);  // the crown ablaze
  drawFlame(g,X,gy-Math.round(1*sc),Math.max(2,3*sc),Math.round(4*sc),now,seed*7+9,eng*0.8);         // fire at the base of the trunk
  drawFireSmoke(g,X,gy-th-Math.round(6*sc),now,seed*5+3,eng,Math.sin(now*0.0004+seed)*1.4);
}
function drawSnag(g,X,gy,day,k,seed){
  var sc=treeSC(seed), th=Math.round(5*sc);
  g.fillStyle=day?"#2c2620":"#16120e"; g.fillRect(X,gy-th,1,th);                       // the blackened snag
  g.fillRect(X-1,gy-th+2,1,1); g.fillRect(X+1,gy-th+4,1,1);                            // stub branches
  if(k<0.12&&(Math.floor(Date.now()/300)&1)){ g.fillStyle="#ff6a20"; g.fillRect(X,gy-th+1,1,1); }   // last embers
}
// wildflowers dot the meadow (seasonal colours, paved over patch by patch as the city grows)
function drawFlora(g,L,now,nd){
  var season=curSeason||seasonInfo(nowDate());
  if(season.bare) return;                                      // nothing blooms midwinter
  var wild2=1-cityG; if(wild2<0.18) return;
  var day=L>0.5, gy=HORIZON;
  var cols=season.blossom?["#f2b9d8","#ffffff","#ffe27a","#c9a0e8"]
          :(season.name==="autumn"?["#c9b284","#b8a06a"]       // autumn seed heads
          :["#e05252","#ffd23a","#b06ad0","#ffffff","#ff9a3c"]);
  for(var i=0;i<Math.round(WW/15);i++){ var h=((i*2654435761+37)>>>0);
    if(((h>>>9)%1000)/1000>wild2) continue;                    // this patch is paved over
    var ffs=fireStateAt(WW*seaW+14+((h%1000)/1000)*(WW*(1-2*seaW)-28),now);
    if(ffs&&(ffs.ph<2||ffs.k<0.4)) continue;                   // nothing blooms on fresh ash
    var wx=WW*seaW+14+((h%1000)/1000)*(WW*(1-2*seaW)-28);
    var sx=wx-WOFF; if(sx>SW+6&&sx-WW>-6) sx-=WW; if(sx<-6&&sx+WW<SW+6) sx+=WW;
    if(sx<-5||sx>SW+5) continue;
    var n=3+((h>>>4)%4);
    var c0=(h>>>6)%cols.length, c1=(c0+1+((h>>>11)%(cols.length-1)))%cols.length;   // each field DRIFTS to 1-2 colours
    // ---- GRAZING: now and then a rabbit (or a deer, for the big patches) eats the blooms ----
    var GR_SLOT=420000, EAT=60000, REG=280000;
    var gi=Math.floor((now+(h%40000))/GR_SLOT), gr2=rng((gi*40503+(h&0xffff))>>>0);
    var eaten=0, muncher=0;                                     // 0 none, 1 nibbling, phase f
    if(gr2()<0.30){ var gt0=gi*GR_SLOT-(h%40000)+gr2()*(GR_SLOT-EAT-REG-9000), ga=now-gt0;
      if(ga>=0&&ga<EAT){ eaten=ga/EAT; muncher=1; }
      else if(ga>=EAT&&ga<EAT+REG) eaten=1-(ga-EAT)/REG; }
    var hideN=Math.round(n*Math.max(0,Math.min(1,eaten)));
    for(var f2=0;f2<n;f2++){ var fx2=sx+((h>>>(f2*3))%9)-4, fy2=gy+2+((h>>>(f2*2+1))%7);
      g.fillStyle=day?"#3a6a2e":"#2a4a28"; g.fillRect(fx2|0,fy2,1,1);           // stem
      if(((f2*7+(h>>>3))%n)<hideN) continue;                                    // ...nibbled away
      g.fillStyle=cols[(f2&1)?c1:c0]; g.fillRect(fx2|0,fy2-1,1,1); }            // bloom
    if(muncher){                                                 // the culprit, mid-meal
      var mf=Math.min(1,(now-(gi*GR_SLOT-(h%40000)))%GR_SLOT/EAT);
      var appr=eaten<0.13?(1-eaten/0.13)*10:0, leave=eaten>0.87?((eaten-0.87)/0.13)*10:0;
      var mx3=sx+3+appr-leave, my3=gy+3+((h>>>7)%4);
      var big=((h>>>5)%3)===0, nib=(Math.floor(now/650)+((h>>>2)&3))&1;
      if(big){ g.fillStyle=day?"#9a7248":"#4e3c28";              // a deer, head down in the blooms
        g.fillRect(mx3|0,(my3-2)|0,5,2); g.fillRect((mx3+5)|0,(my3-1-(nib?0:1))|0,1,1+(nib?1:0));
        g.fillStyle="#f2ede2"; g.fillRect((mx3-1)|0,(my3-2)|0,1,1);
        g.fillStyle=day?"#7a5836":"#3e2f1f"; g.fillRect(mx3|0,my3|0,1,1); g.fillRect((mx3+4)|0,my3|0,1,1); }
      else{ g.fillStyle=day?"#a8998a":"#4c453c";                 // a rabbit, cheeks full
        g.fillRect(mx3|0,(my3-1)|0,2,1); g.fillRect((mx3+2)|0,(my3-2+(nib?1:0))|0,1,1);
        g.fillStyle="#f2ede2"; g.fillRect((mx3-1)|0,(my3-1)|0,1,1); }
    }
  }
}
// the meadow's FAUNA: deer & rabbits (the classic herd), a dawn fox, butterflies, geese,
// plus the long-lost river fish and harbour sea-life, all rewired
function drawFauna(g,L,now,nd){
  var wild2=1-cityG, day=L>0.5, gy=HORIZON;
  var season=curSeason||seasonInfo(nowDate());
  drawWildlife(g,wild2,day,now,gy);                            // deer herd + rabbits (classic system)
  var rw2=Math.round(6*wild2);
  if(rw2>0) drawRiverFish(g,now,Math.round(0.62*WW),gy,rw2,day);   // fish arc from the river
  if(hasOcean&&seaW>0&&!nukeFull()) drawSeaLife(g,L,now,HORIZON-22);        // dolphins + surfacing whale
  // the FOX trots the treeline at dawn & dusk
  var hh4=nd.getHours();
  if(wild2>0.4&&((hh4>=5&&hh4<8)||(hh4>=18&&hh4<21))){
    var fp=landRoute(wrapW(now*0.004)), fx3=fp-WOFF, fdir=(Math.floor(now*0.004/WW)&1)?-1:1;
    if(fx3>SW+5&&fx3-WW>-5) fx3-=WW; if(fx3<-5&&fx3+WW<SW+5) fx3+=WW;
    if(fx3>=-4&&fx3<=SW+4){ var fy3=gy+2+((Math.floor(now/260))&1?0:1)*0;
      var trot=(Math.floor(now/200))&1;
      g.fillStyle=day?"#c86a2e":"#6a3a1c"; g.fillRect(fx3|0,(fy3-1)|0,4,1);              // body
      g.fillRect((fx3+(fdir>0?4:-1))|0,(fy3-2+trot*0)|0,1,1);                            // head
      g.fillRect((fx3+(fdir>0?-2:5))|0,(fy3-2)|0,2,1);                                   // brush tail
      g.fillStyle="#f2ede2"; g.fillRect((fx3+(fdir>0?-2:6))|0,(fy3-2)|0,1,1);            // white tip
      g.fillStyle="#2a2018"; g.fillRect((fx3+1)|0,fy3|0,1,1); g.fillRect((fx3+2+trot)|0,fy3|0,1,1); }  // legs
  }
  // BUTTERFLIES flutter over the flowers (warm bright days)
  if(wild2>0.25&&day&&!season.bare&&season.name!=="autumn"){
    var bcols=["#ffffff","#ffd23a","#ff9a3c","#8ac8ff","#f2b9d8"];
    for(var bt2=0;bt2<8;bt2++){ var h3=((bt2*40503+661)>>>0);
      var bx4=WW*seaW+20+((h3%1000)/1000)*(WW*(1-2*seaW)-40);
      var wxb=bx4+Math.sin(now*0.0011+bt2*2.2)*7+Math.sin(now*0.0037+bt2)*2;
      var sxb=wxb-WOFF; if(sxb>SW+3&&sxb-WW>-3) sxb-=WW; if(sxb<-3&&sxb+WW<SW+3) sxb+=WW;
      if(sxb<-2||sxb>SW+2) continue;
      var byb=gy-1-((Math.sin(now*0.0021+bt2*1.7)+1)*3)-((h3>>>4)%3);
      g.fillStyle=bcols[bt2%bcols.length];
      if((Math.floor(now/140)+bt2)&1) g.fillRect(sxb|0,byb|0,2,1); else g.fillRect(sxb|0,byb|0,1,1);   // wingbeat
    }
  }
  // GEESE fly the flyway in season (south in fall, north in spring)
  var mo2=nd.getMonth()+1;
  if(L>0.3&&((mo2>=9&&mo2<=11)||(mo2>=3&&mo2<=4))){
    var SLOT2=420000, idx2=Math.floor(now/SLOT2), rg=rng((idx2*2654435761+883)>>>0);
    if(rg()<0.35){ var t0g=rg()*(SLOT2-60000), tpg=now-idx2*SLOT2-t0g;
      if(tpg>=0&&tpg<=55000){ var gf=tpg/55000, gdir=(mo2<=4)?1:-1;
        var gx2=(gdir>0?-30+gf*(SW+60):SW+30-gf*(SW+60)), gy4=26+rg()*22;
        for(var gb=0;gb<7;gb++){ var row=Math.ceil(gb/2), sideg=(gb&1)?1:-1;
          var vx2=gx2-gdir*row*3, vy2=gy4+row*sideg*2;
          if(vx2<-3||vx2>SW+3) continue;
          drawBird(g,vx2,vy2,(Math.floor(now/170)+gb)%4,L>0.5?"#2c2620":"#12100c",gdir); }
      } }
  }
}
// ============ THE DOZEN (2026-07-06): hail, shimmer, fishing, night market, performers,
// festivals, snowmen & leaves, lighthouse, pets 2.0, aurora glass, museum wings, sports day ====
var auroraOn=false;
// 1a. HAIL: white stones fall and bounce during some thunderstorms
function drawHail(g,L,now,fx){
  if(!fx.thunder&&!fx.hail) return;
  var slot=Math.floor(now/240000);
  // plain thunderstorms (95) keep the occasional random hail treat; codes 96/99 REPORT hail,
  // so it always falls — and 99 (heavy hail) falls noticeably denser.
  if(!fx.hail && ((slot*40503+7)>>>0)%100>=35) return;
  var hn=Math.round(SW/(fx.hail?(weather.code===99?7:11):14));
  for(var i=0;i<hn;i++){ var h=((i*2654435761+slot)>>>0);
    var ph=((now*(0.9+((h>>>4)%40)/100)/900)+(h%97))%1.25;
    var x=(h%SW), y;
    if(ph<1) y=ph*(HORIZON+GROUND-4);
    else { var bp=(ph-1)/0.25; y=(HORIZON+GROUND-4)-Math.sin(bp*Math.PI)*7; }   // the bounce
    g.fillStyle="rgba(240,246,255,0.9)"; g.fillRect(x|0,y|0,1,1); }
}
// 1b. HEAT SHIMMER over summer asphalt
function drawShimmer(g,L,now){
  if(!(curLit!==undefined)&&false) return;
  g.globalCompositeOperation="lighter";
  for(var i=0;i<4;i++){ var y=HORIZON+5+i*5, off=Math.sin(now*0.006+i*1.9)*1.5;
    g.fillStyle="rgba(255,255,255,0.045)";
    g.fillRect((off+((i&1)?3:0))|0,y,SW,1); }
  g.globalCompositeOperation="source-over";
}
// 2. the FISHING FLEET works the dawn tide, gulls in tow
function drawFishingFleet(g,L,now,nd){
  if(!hasOcean||seaW<=0||cityG<0.3) return;
  var h6=nd.getHours(); if(h6<5||h6>=9) return;
  for(var i=0;i<2;i++){ var band=i?[WW*(1-seaW),WW]:[0,WW*seaW];
    var span=band[1]-band[0]-16, T=90000+i*17000;
    var ph=((now+i*31000)/T)%2, f=ph<1?ph:2-ph, dir=ph<1?1:-1;
    var wx=band[0]+8+f*span, sx=wx-WOFF;
    if(sx>SW+10&&sx-WW>-10) sx-=WW; if(sx<-10&&sx+WW<SW+10) sx+=WW;
    if(sx<-9||sx>SW+9) continue;
    var wl=HORIZON-11;
    g.fillStyle=L>0.5?"#4a6a8c":"#1c2a3c"; g.fillRect(sx|0,wl-2,7,2);           // trawler hull
    g.fillStyle=L>0.5?"#eef2f8":"#3a4450"; g.fillRect((sx+(dir>0?1:4))|0,wl-4,2,2);
    g.fillStyle="rgba(140,160,180,0.6)";                                         // the net line astern
    g.fillRect((sx+(dir>0?-4:7))|0,wl-1,4,1); g.fillRect((sx+(dir>0?-6:9))|0,wl,2,1);
    if(L>0.3){ g.fillStyle="#eef2f6";                                            // gulls working the wake
      for(var gl=0;gl<3;gl++){ var fl6=(Math.floor(now/160)+gl)&1;
        g.fillRect((sx+(dir>0?-3-gl*3:8+gl*3))|0,(wl-6-((gl*7)%5)+(fl6?1:0))|0,2,1); } }
  }
}
// 3. NIGHT MARKET: lantern stalls on summer weekend nights
function drawNightMarket(g,L,now,nd){
  var m7=nd.getMonth()+1, d7=nd.getDay(), h7=nd.getHours();
  if(cityG<0.5||L>0.35||m7<6||m7>9||!(d7===5||d7===6)||h7<19) return;
  var wx=Math.round(0.33*WW), sx=wx-WOFF;
  if(sx>SW+30&&sx-WW>-30) sx-=WW; if(sx<-30&&sx+WW<SW+30) sx+=WW;
  if(sx<-26||sx>SW+26) return;
  for(var st=0;st<4;st++){ var X=(sx+st*9-14)|0;
    g.fillStyle="#5a4028"; g.fillRect(X,HORIZON-5,1,5); g.fillRect(X+6,HORIZON-5,1,5);
    g.fillStyle=["#c0453a","#d9a72b"][st&1]; g.fillRect(X,HORIZON-6,7,1);        // canvas roof
    g.fillStyle="#3a2c1c"; g.fillRect(X,HORIZON-2,7,2);                          // counter
    var ln=(Math.floor(now/500)+st)&1;
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,180,80,"+(0.5+0.15*ln)+")"; g.fillRect(X+2,HORIZON-5,1,1); g.fillRect(X+4,HORIZON-5,1,1);   // lanterns
    g.fillStyle="rgba(255,160,60,0.16)"; g.fillRect(X-1,HORIZON-6,9,7);
    g.globalCompositeOperation="source-over";
    if(st===1){ g.fillStyle="rgba(200,200,205,0.5)"; g.fillRect(X+3,(HORIZON-8-((now/300|0)%3))|0,1,1); }   // grill smoke
    drawPerson(g,X+2,HORIZON-1,PEDC[(st*3+1)%PEDC.length],SKINC[st%SKINC.length],0);   // stallholder
    if(((st+Math.floor(now/4000))&1)===0) drawPerson(g,X+8,HORIZON-1,PEDC[(st*5+2)%PEDC.length],SKINC[(st+2)%SKINC.length],(Math.floor(now/400)+st)&1);
  }
}
// 4. STREET PERFORMERS: a juggler at the plaza; a chalk artist leaves real drawings
function drawPerformers(g,L,now,nd){
  if(cityG<0.55) return;
  var d8=nd.getDay(), h8=nd.getHours();
  var wx=Math.round(0.365*WW)+12, sx=wx-WOFF;
  if(sx>SW+16&&sx-WW>-16) sx-=WW; if(sx<-16&&sx+WW<SW+16) sx+=WW;
  if(sx>=-14&&sx<=SW+14){
    if((d8===0||d8===6)&&L>0.4&&h8>=11&&h8<18){                                  // the JUGGLER
      drawPerson(g,sx|0,HORIZON-1,"#b03a8a",SKINC[1],0);
      for(var jb=0;jb<3;jb++){ var jp=(now*0.003+jb*Math.PI*2/3)%(Math.PI*2);
        g.fillStyle=["#ffd23a","#4aa8ff","#ff5a5a"][jb];
        g.fillRect((sx+1+Math.cos(jp)*2.5)|0,(HORIZON-7-Math.abs(Math.sin(jp))*4)|0,1,1); }
      if(((Math.floor(now/6000))&1)===0) drawPerson(g,(sx-4)|0,HORIZON-1,PEDC[3],SKINC[2],0);   // an admirer
    }
    var cx4=sx+8;                                                                 // the CHALK ARTIST
    if(L>0.4&&h8>=9&&h8<19&&!fxRainNow){
      var prog=Math.min(1,(h8-9+nd.getMinutes()/60)/7), dn8=Math.floor((NOWOVR!=null?NOWOVR:Date.now())/86400000);
      var CC=["#ff8a8a","#8ab8ff","#ffe08a","#a8ffb8","#e0a8ff"];
      var n8=Math.round(prog*8);
      for(var c8=0;c8<n8;c8++){ var hh8=((dn8*2654435761+c8*7919)>>>0);          // today's drawing, stroke by stroke
        g.fillStyle=CC[(hh8>>>3)%CC.length];
        g.fillRect((cx4+(hh8%5))|0,(HORIZON+1+((hh8>>>6)%2))|0,1+((hh8>>>9)&1),1); }
      if(prog<1) drawPerson(g,(cx4+2)|0,HORIZON,"#3a6a8a",SKINC[3],0);           // crouched, mid-stroke
    }
  }
}
// 5. SEASONAL FESTIVALS: blossom viewing in spring, harvest fair in autumn
function drawFestivals(g,L,now,nd){
  var m9=nd.getMonth()+1, d9=nd.getDay(), h9=nd.getHours();
  if(cityG<0.4||L<0.35) return;
  if(m9===4&&(d9===0||d9===6)&&h9>=11&&h9<18){                                   // HANAMI in the parks
    for(var i=0;i<near.blds.length;i++){ var b=near.blds[i];
      if(b.type!=="park"||((b.seed||i)&1)) continue;
      var bx=b.x-WOFF; if(bx>SW+8||bx+b.w<-8) continue;
      drawSeated(g,(bx+3)|0,HORIZON-1,"#c05a8a",SKINC[0]); drawSeated(g,(bx+6)|0,HORIZON-1,"#5a7a4a",SKINC[2]);
      g.fillStyle="#f2b9d8";                                                     // drifting petals
      for(var pt9=0;pt9<4;pt9++){ var pp9=(now*0.012+pt9*31+i*7)%60;
        g.fillRect((bx+2+((pt9*13+i)%Math.max(4,b.w-4))+Math.sin(now*0.002+pt9)*2)|0,(HORIZON-9+pp9*0.14)|0,1,1); } }
  }
  if((m9===9||m9===10)&&(d9===0||d9===6)&&h9>=10&&h9<17){                        // HARVEST FAIR at the plaza
    var wx=Math.round(0.365*WW)-16, sx=wx-WOFF;
    if(sx>SW+20&&sx-WW>-20) sx-=WW; if(sx<-20&&sx+WW<SW+20) sx+=WW;
    if(sx>=-18&&sx<=SW+18){
      g.fillStyle="#c9a95a"; g.fillRect(sx|0,HORIZON-2,4,2); g.fillRect((sx+5)|0,HORIZON-2,4,2);   // hay bales
      g.fillStyle="#b8944a"; g.fillRect(sx|0,HORIZON-2,4,1);
      g.fillStyle="#e07028";                                                     // the pumpkin pile
      g.fillRect((sx+11)|0,HORIZON-1,2,1); g.fillRect((sx+13)|0,HORIZON-1,2,1); g.fillRect((sx+12)|0,HORIZON-2,2,1);
      g.fillStyle="#3a5a2a"; g.fillRect((sx+13)|0,HORIZON-3,1,1);
      drawPerson(g,(sx+7)|0,HORIZON-1,"#8a5a2a",SKINC[1],0);
      if(((Math.floor(now/5000))&1)===0) drawPerson(g,(sx+16)|0,HORIZON-1,PEDC[2],SKINC[3],(Math.floor(now/400))&1);
    }
  }
}
// 7. WEATHER AFTERMATH: snowmen while the snowpack lasts; autumn leaf piles + the raker
function drawAftermath(g,L,now,nd){
  var m10=nd.getMonth()+1;
  if(snowpack>0.3){                                                              // SNOWMEN (kids' work)
    for(var i=0;i<3;i++){ var h=((i*40503+301)>>>0);
      var wx=WW*seaW+40+((h%1000)/1000)*(WW*(1-2*seaW)-80), sx=wx-WOFF;
      if(sx>SW+5&&sx-WW>-5) sx-=WW; if(sx<-5&&sx+WW<SW+5) sx+=WW;
      if(sx<-4||sx>SW+4) continue;
      var mS=Math.min(1,snowpack*1.4);                                           // melts as the pack goes
      g.fillStyle="rgba(244,248,255,"+(0.6+0.35*mS).toFixed(2)+")";
      g.fillRect(sx|0,(HORIZON+2-3*mS)|0,3,Math.max(1,3*mS|0)); g.fillRect((sx)|0,(HORIZON+2-5*mS)|0,2,Math.max(1,2*mS|0));
      if(mS>0.5){ g.fillStyle="#e07028"; g.fillRect((sx+2)|0,(HORIZON+2-4.4*mS)|0,1,1);          // carrot
        g.fillStyle="#2a2c34"; g.fillRect(sx|0,(HORIZON+1-5*mS)|0,2,1); } }                       // hat
  }
  if((m10===10||m10===11)&&L>0.4&&cityG>0.4){                                    // LEAF PILES on the walks
    for(var lp=0;lp<Math.round(WW/90);lp++){ var h2=((lp*2654435761+911)>>>0);
      var wx2=(h2%WW), sx2=wx2-WOFF;
      if(sx2>SW+4&&sx2-WW>-4) sx2-=WW; if(sx2<-4&&sx2+WW<SW+4) sx2+=WW;
      if(sx2<-3||sx2>SW+3||inSea(wx2)) continue;
      g.fillStyle=["#b8862e","#c9662a"][lp&1]; g.fillRect(sx2|0,HORIZON+1,3,1); g.fillRect((sx2+1)|0,HORIZON,1,1); }
    var rk=(Math.floor(now/300))&1, rx3=wrapW(200+now*0.0012), rsx=rx3-WOFF;     // the tireless raker
    if(rsx>SW+4&&rsx-WW>-4) rsx-=WW; if(rsx<-4&&rsx+WW<SW+4) rsx+=WW;
    if(rsx>=-3&&rsx<=SW+3&&!inSea(rx3)){ drawPerson(g,rsx|0,HORIZON-1,"#6a5a3a",SKINC[2],rk);
      g.fillStyle="#8a6a3a"; g.fillRect((rsx+2)|0,HORIZON-2+rk,1,3); }
  }
}
// 8. the LIGHTHOUSE: a beam sweeps the bay; the horn sounds rings into the fog
function drawLighthouse(g,L,now,fx){
  if(!hasOcean||seaW<=0||cityG<0.3) return;
  var wx=WW*seaW-3, sx=wx-WOFF;
  if(sx>SW+12&&sx-WW>-12) sx-=WW; if(sx<-12&&sx+WW<SW+12) sx+=WW;
  if(sx<-10||sx>SW+10) return;
  var gy=HORIZON-2, day=L>0.5;
  g.fillStyle=day?"#eef1f6":"#8a8f9a"; g.fillRect(sx|0,gy-11,3,11);              // the white tower
  g.fillStyle=day?"#c0453a":"#5c2a24"; g.fillRect(sx|0,gy-7,3,2);                // red band
  g.fillStyle="#2a2c34"; g.fillRect((sx-1)|0,gy-12,5,1);
  g.fillStyle=day?"#c0453a":"#7a2e26"; g.fillRect(sx|0,gy-14,3,2);               // lamp house
  if(L<0.55){ var ba=(now*0.0012)%(Math.PI*2);                                   // the SWEEPING BEAM
    g.globalCompositeOperation="lighter";
    for(var bs=2;bs<26;bs+=2){ var bx6=sx+1+Math.cos(ba)*bs, by6=gy-13+Math.sin(ba)*bs*0.22;
      g.fillStyle="rgba(255,240,190,"+(0.30*(1-bs/26)).toFixed(3)+")";
      g.fillRect(bx6|0,by6|0,2,1+(bs>>3)); }
    g.fillStyle="rgba(255,240,190,0.85)"; g.fillRect(sx|0,gy-14,3,2);
    g.globalCompositeOperation="source-over"; }
  if(fx.fog){ var fp10=(now%3000)/3000;                                          // FOGHORN rings
    g.fillStyle="rgba(200,214,230,"+(0.4*(1-fp10)).toFixed(2)+")";
    var rr10=2+fp10*10; g.fillRect((sx+1-rr10)|0,(gy-12)|0,1,2); g.fillRect((sx+1+rr10)|0,(gy-12)|0,1,2); }
}
// 9. PETS 2.0: the mail-chasing dog, the pigeon-stalking cat, the lost balloon
function drawPets2(g,L,now,nd){
  var h11=nd.getHours();
  if(cityG>0.45&&((h11>=11&&h11<14))){                                           // the dog has found the mail carrier
    var mp=wrapW(200+stopgo(now,9000,0.75,22)), mx4=mp-WOFF;
    if(mx4>SW+6&&mx4-WW>-6) mx4-=WW; if(mx4<-6&&mx4+WW<SW+6) mx4+=WW;
    if(mx4>=-5&&mx4<=SW+5){ var db=(Math.floor(now/140))&1;
      g.fillStyle="#8a6a4a"; g.fillRect((mx4-4)|0,(HORIZON-db)|0,3,1); g.fillRect((mx4-1)|0,(HORIZON-1-db)|0,1,1);
      if((Math.floor(now/500)&3)===0){ g.fillStyle="#eef2f6"; g.fillRect((mx4-5)|0,(HORIZON-3)|0,1,1); } }  // bark!
  }
  if(cityG>0.4&&(h11<8||h11>=17)&&L>0.2){                                        // the cat stalks the pigeons
    var cwx=wrapW(500+Math.floor(now/40000)*137), csx=cwx-WOFF;
    if(csx>SW+4&&csx-WW>-4) csx-=WW; if(csx<-4&&csx+WW<SW+4) csx+=WW;
    if(csx>=-3&&csx<=SW+3&&!inSea(cwx)){ var crawl=(Math.floor(now/900))&1;
      g.fillStyle="#16141a"; g.fillRect(csx|0,HORIZON+1,3,1); g.fillRect((csx+3)|0,(HORIZON+1-crawl*0)|0,1,1); }
  }
  var BSLOT=540000, bidx=Math.floor(now/BSLOT), br7=rng((bidx*40503+421)>>>0);   // the LOST BALLOON
  if(br7()<0.3&&cityG>0.4){ var bt0=br7()*(BSLOT-40000), btp=now-bidx*BSLOT-bt0;
    if(btp>=0&&btp<=36000){ var bf7=btp/36000;
      var bwx=wrapW(br7()*WW), bsx=bwx-WOFF+Math.sin(bf7*6)*4;
      if(bsx>SW+4&&bsx-WW>-4) bsx-=WW; if(bsx<-4&&bsx+WW<SW+4) bsx+=WW;
      if(bsx>=-3&&bsx<=SW+3){ var by7=HORIZON-4-bf7*(HORIZON-14);
        g.fillStyle="#e8482a"; g.fillRect(bsx|0,by7|0,2,2);
        g.fillStyle="rgba(200,200,210,0.6)"; g.fillRect((bsx+1)|0,(by7+2)|0,1,2);
        if(bf7<0.2){ drawPerson(g,(bsx-1)|0,HORIZON-1,PEDC[4],SKINC[1],1);        // the heartbroken kid
          g.fillStyle=SKINC[1]; g.fillRect((bsx-2)|0,HORIZON-5,1,1); g.fillRect((bsx+2)|0,HORIZON-5,1,1); } } } }
}
// 12. SPORTS DAY: the stadium roars on game nights; the crowd streams home after
function drawSportsDay(g,L,now,nd){
  if(cityG<0.6) return;
  var d12=nd.getDay(), h12=nd.getHours(), gm=gameNight(nd);
  var wx=Math.round(LM_STADIUM*WW), sx=wx-WOFF;
  if(sx>SW+40&&sx-WW>-40) sx-=WW; if(sx<-40&&sx+WW<SW+40) sx+=WW;
  if(sx<-36||sx>SW+36) return;
  if(gm&&h12>=19&&h12<22&&L<0.55){                                               // the ROAR: light pulses
    var roar=((Math.floor(now/8000)*2654435761)>>>0)%100<40 && (now%8000)<1800;
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,240,200,"+(roar?0.22:0.10)+")";
    g.fillRect((sx-28)|0,HORIZON-26,57,22);                                      // light spill dome
    if(roar){ var rp12=(now%1800)/1800;
      g.fillStyle="rgba(255,240,200,"+(0.3*(1-rp12)).toFixed(2)+")";
      var rr12=6+rp12*16;
      g.fillRect((sx-rr12)|0,(HORIZON-26-rp12*6)|0,2,1); g.fillRect((sx+rr12)|0,(HORIZON-26-rp12*6)|0,2,1); }
    g.globalCompositeOperation="source-over";
  }
  if(gm&&h12>=22&&h12<23){                                                       // POSTGAME: everyone streams out
    var ef=(h12-22)+nd.getMinutes()/60;
    for(var cr12=0;cr12<10;cr12++){ var dd=(cr12&1)?1:-1;
      var cx12=sx+dd*(6+((cr12*13)%10)+(now*0.006+cr12*7)%40|0);
      if(cx12<-3||cx12>SW+3) continue;
      var fan=(cr12%3)===0;
      drawPerson(g,cx12|0,HORIZON-1,fan?teamCols[cr12&1]:PEDC[cr12%PEDC.length],SKINC[cr12%SKINC.length],(Math.floor(now/280)+cr12)&1); }
  }
}
// ============ THE FAMILY: generations you can watch grow ============
var FNAMES=["MARA","ELI","JUNE","THEO","IVY","SAM","NOA","REN"];
var JOBS=[["BAKER",0.31],["FISHER",-1],["OFFICER",-2],["TEACHER",-3],["ENGINEER",0.53],["DOCTOR",0.42],["ARTIST",0.35],["PILOT",0.8]];
function famInfo(now){
  var li=lifeIndexOf(now), fh=((li*2654435761+911)>>>0);
  var cg2=cityGrowth(now);
  return {
    sur:LNAMES[fh%LNAMES.length], cy:cg2.cy,
    pA:FNAMES[(fh>>>3)%8], pB:FNAMES[((fh>>>3)+3)%8],
    k1:{name:FNAMES[(fh>>>7)%8], born:0.38, job:(fh>>>12)%8},
    k2:((fh>>>9)%3<2)?{name:FNAMES[((fh>>>7)+5)%8], born:0.46, job:((fh>>>12)+3)%8}:null,
    g3:{born:0.70},                                              // the grandchild
    wed:0.62, elder:0.88
  };
}
function drawKidS(g,x,y,shirt,skin,bob,sc){                      // a child, scaled by age (sc 0.4..1)
  var yy=(y-bob)|0, X=x|0;
  if(sc>=0.95){ drawPerson(g,x,y,shirt,skin,bob); return; }
  g.fillStyle=skin; g.fillRect(X,yy,2,1);                        // little face
  g.fillStyle=shirt; g.fillRect(X,yy+1,2,1);
  g.fillStyle=pantsOf(shirt); g.fillRect(X+(bob?1:0),yy+2,1,1);  // little legs
}
// GENERATIONS v2: an inherited storefront that keeps the family name, the family home's
// ever-lit window, an heirloom that survives the ages, an inter-house marriage on the
// ticker — and when the world ends, the family FLEES: the wagon you see arrive at every
// new dawn is the one you watched escape the last night.
function drawFamilyLegacy(g,L,now,nd){
  var F=famInfo(now), cy=F.cy, night=1-L;
  if(cityG>0.35&&cy>0.70){                                        // THE FAMILY STOREFRONT ("VOSS & SON")
    var tx=Math.round(0.31*WW), best=null,bd=1e9;
    for(var i=0;i<near.blds.length;i++){ var b=near.blds[i];
      if(b.type==="park") continue;
      if(b.bAge!==undefined&&cityG-b.bAge<=bandOf(b)) continue;
      var d=Math.abs(b.x+(b.w>>1)-tx); if(d<bd){bd=d;best=b;} }
    if(best&&bd<60){ var bx=best.x-WOFF;
      if(bx>SW+20&&bx-WW>-20) bx-=WW; if(bx<-20-best.w&&bx+WW<SW+20) bx+=WW;
      if(bx>=-best.w&&bx<=SW+20){
        g.fillStyle="#8a2f3a"; g.fillRect((bx+1)|0,HORIZON-7,Math.max(4,best.w-2),2);   // the family awning
        g.fillStyle="#ffd76a";
        for(var lg=0;lg<Math.min(5,(best.w-4)>>1);lg++) g.fillRect((bx+2+lg*2)|0,HORIZON-6,1,1);   // name lights
        if(night>0.4){ g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,200,120,0.16)"; g.fillRect((bx)|0,HORIZON-8,best.w,8);
          g.globalCompositeOperation="source-over"; } } }
  }
  if(cityG>0.4){                                                  // THE FAMILY HOME: one warm window, always theirs
    var hh2=((lifeIndexOf(now)*2654435761+911)>>>0);
    var hi=(hh2>>>5)%Math.max(1,near.blds.length), hb=near.blds[hi];
    if(hb&&hb.type!=="park"&&!(hb.bAge!==undefined&&cityG-hb.bAge<=bandOf(hb))&&hb.win.length){
      var hx=hb.x-WOFF; if(hx>SW+8&&hx-WW>-8) hx-=WW; if(hx<-8-hb.w&&hx+WW<SW+8) hx+=WW;
      if(hx>=-hb.w&&hx<=SW+8){ var hw=hb.win[(hh2>>>9)%hb.win.length];
        if(night>0.35){ g.fillStyle="#ffd9a0"; g.fillRect((hx+hw.x)|0,(HORIZON-hb.h+hw.y)|0,hw.w,hw.h);
          g.fillStyle="#8a5a3a"; g.fillRect((hx+hw.x)|0,(HORIZON-hb.h+hw.y-1)|0,hw.w,1); }   // the heirloom shelf
      } }
  }
  if(cityPhase==="apoc"&&cityApoc>0.08&&cityApoc<0.7){            // THE ESCAPE: the line becomes a circle
    var ef=(cityApoc-0.08)/0.62, dirE=(lifeIndexOf(now)&1)?1:-1;
    var ex=landRoute(wrapW(WW*0.5+dirE*ef*(WW*0.42)));
    var sx=ex-WOFF; if(sx>SW+16&&sx-WW>-16) sx-=WW; if(sx<-16&&sx+WW<SW+16) sx+=WW;
    if(sx>=-14&&sx<=SW+14){
      drawHorse(g,ex,HORIZON+2,dirE,L,now,2);                     // the covered wagon, fleeing
      var EGARB=["#7a5a3a","#5a6a4a","#6a4a3a"];
      for(var fw=0;fw<3;fw++) drawPerson(g,(sx-dirE*(14+fw*3))|0,HORIZON+1,EGARB[fw],SKINC[fw%SKINC.length],(Math.floor(now/240)+fw)&1);
      g.fillStyle="#8a6a4a"; g.fillRect((sx-dirE*24)|0,HORIZON+2,2,1);   // even the dog makes it out
    }
  }
}
// the family promenade (17:30-18:30 daily) + weekend park picnic + the working generation
function drawFamily(g,L,now,nd){
  if(cityG<0.3) return;
  var F=famInfo(now), cy=F.cy, hh=nd.getHours()+nd.getMinutes()/60, dw=nd.getDay();
  var elder=cy>0.75, gone=cy>F.elder;
  function grey(x,y){ g.fillStyle="#c9ccd4"; g.fillRect(x|0,y|0,2,1); }   // silver hair for the elders
  // ---- the evening STROLL: the whole family walks the promenade together ----
  if(hh>=17.5&&hh<18.5&&L>0.15){
    var base=Math.round(0.365*WW)+30, drift=Math.sin(now*0.00013)*46;
    var wx=landRoute(wrapW(base+drift)), sx=wx-WOFF;
    if(sx>SW+14&&sx-WW>-14) sx-=WW; if(sx<-14&&sx+WW<SW+14) sx+=WW;
    if(sx>=-12&&sx<=SW+12){
      var bob1=(Math.floor(now/320))&1, bob2=(Math.floor(now/320)+1)&1;
      if(!gone){ drawPerson(g,sx|0,HORIZON-1,"#7a5a8a",SKINC[0],bob1); if(elder) grey(sx,HORIZON-1-bob1-4); }
      drawPerson(g,(sx+3)|0,HORIZON-1,"#5a7a8a",SKINC[2],bob2); if(elder&&!gone) grey(sx+3,HORIZON-1-bob2-4);
      var a1=Math.min(1,Math.max(0.35,(cy-F.k1.born)/0.3));                     // the kids GROW
      if(cy>F.k1.born) drawKidS(g,(sx+6)|0,HORIZON-1+(a1<0.95?1:0),"#ffd23a",SKINC[1],(Math.floor(now/240))&1,a1);
      if(F.k2&&cy>F.k2.born){ var a2=Math.min(1,Math.max(0.35,(cy-F.k2.born)/0.3));
        drawKidS(g,(sx+9)|0,HORIZON-1+(a2<0.95?1:0),"#4affc0",SKINC[3],(Math.floor(now/240)+1)&1,a2); }
      if(cy>F.g3.born){ var a3=Math.min(0.9,Math.max(0.35,(cy-F.g3.born)/0.3)); // the grandchild toddles behind
        drawKidS(g,(sx+12)|0,HORIZON,"#ff9a3c",SKINC[0],(Math.floor(now/200))&1,a3); }
    }
  }
  // ---- the WORKING generation: kid #1 grown up and on the job (9-17h) ----
  if(cy>F.wed&&hh>=9&&hh<17&&L>0.3){
    var J=JOBS[F.k1.job], jx=J[1];
    var wxj=jx>=0?Math.round(jx*WW):(jx===-1?WW*seaW+5:(jx===-2?wrapW(300+now*0.003):Math.round(LM_SCHOOL*WW)+14));
    if(jx===-1&&(!hasOcean||seaW<=0)) wxj=Math.round(0.2*WW);
    var sxj=landRoute(wrapW(wxj))-WOFF;
    if(sxj>SW+8&&sxj-WW>-8) sxj-=WW; if(sxj<-8&&sxj+WW<SW+8) sxj+=WW;
    if(sxj>=-6&&sxj<=SW+6){
      var JC={BAKER:"#e8e2d2",FISHER:"#4a6a8c",OFFICER:"#2a4a8a",TEACHER:"#7a5a8a",ENGINEER:"#ffd24a",DOCTOR:"#eef2f8",ARTIST:"#b03a8a",PILOT:"#3a3f5c"}[J[0]];
      drawPerson(g,sxj|0,HORIZON-1,JC,SKINC[1],(J[0]==="OFFICER")?((Math.floor(now/300))&1):0);
      if(J[0]==="BAKER"){ g.fillStyle="#c9a23a"; g.fillRect((sxj+3)|0,HORIZON-2,3,1);           // bread tray
        g.fillStyle="rgba(220,220,225,0.5)"; g.fillRect((sxj+4)|0,(HORIZON-5-((now/400|0)%2))|0,1,1); }
      else if(J[0]==="FISHER"){ g.fillStyle="#8a6a3a"; g.fillRect((sxj+2)|0,HORIZON-5,1,1);      // the rod
        g.fillRect((sxj+3)|0,HORIZON-4,1,1); g.fillStyle="rgba(200,214,230,0.5)"; g.fillRect((sxj+4)|0,HORIZON-3,1,4); }
      else if(J[0]==="DOCTOR"){ g.fillStyle="#d23b3b"; g.fillRect((sxj+1)|0,HORIZON-3,1,1); }    // red cross
      else if(J[0]==="ARTIST"){ g.fillStyle="#8a6a4a"; g.fillRect((sxj+3)|0,HORIZON-4,1,4);      // the easel
        g.fillStyle="#eef1f6"; g.fillRect((sxj+2)|0,HORIZON-5,3,2);
        g.fillStyle=NEON[(Math.floor(now/9000))%NEON.length]; g.fillRect((sxj+3)|0,HORIZON-5,1,1); }
      else if(J[0]==="ENGINEER"){ g.fillStyle="#e8e4da"; g.fillRect((sxj-1)|0,HORIZON-4,1,1); }  // hard-hat plans
    }
  }
  // ---- the WEDDING at the plaza (a short golden hour of the life) ----
  if(Math.abs(cy-F.wed)<0.004){
    var wxw=Math.round(0.365*WW)-6, sxw=wxw-WOFF;
    if(sxw>SW+12&&sxw-WW>-12) sxw-=WW; if(sxw<-12&&sxw+WW<SW+12) sxw+=WW;
    if(sxw>=-10&&sxw<=SW+10){
      drawPerson(g,sxw|0,HORIZON-1,"#eef2f8",SKINC[1],0);                        // the couple
      drawPerson(g,(sxw+3)|0,HORIZON-1,"#2a2c34",SKINC[2],0);
      for(var gst=0;gst<5;gst++) drawPerson(g,(sxw-4-gst*2)|0,HORIZON-1,PEDC[gst%PEDC.length],SKINC[gst%SKINC.length],0);
      if(((Math.floor(now/140))%3)===0){ g.fillStyle="#f2b9d8";                  // thrown petals
        g.fillRect((sxw-2+((Math.floor(now/60))%9))|0,(HORIZON-7+((Math.floor(now/90))%4))|0,1,1); }
    }
  }
  // ---- half-mast at city hall when the elder passes ----
  if(cy>F.elder&&cy<F.elder+0.01){
    var hxw=Math.round(LM_CITYHALL*WW), sxh=hxw-WOFF;
    if(sxh>=-14&&sxh<=SW+14){ g.fillStyle="#1a1c24"; g.fillRect(sxh|0,HORIZON-19,3,2); }   // black bunting on the dome
  }
}
// ---- little LIVES: chatting pairs, kids playing tag, a dog chasing its ball, a wave from a window
function drawVignettes(g,L,now,nd){
  if(cityG<0.45) return;
  var h13=nd.getHours(), day=L>0.5;
  for(var i=0;i<3;i++){ var h=((i*2654435761+1777)>>>0);                          // CHATTING PAIRS
    if(((h>>>7)+Math.floor(now/90000))%3===0) continue;                           // pairs come and go
    var wx=landRoute((h%WW)), sx=wx-WOFF;
    if(sx>SW+5&&sx-WW>-5) sx-=WW; if(sx<-5&&sx+WW<SW+5) sx+=WW;
    if(sx<-4||sx>SW+4||inSea(wx)) continue;
    drawPerson(g,sx|0,HORIZON-1,PEDC[h%PEDC.length],SKINC[h%SKINC.length],0);
    drawPerson(g,(sx+3)|0,HORIZON-1,PEDC[(h>>>4)%PEDC.length],SKINC[(h>>>6)%SKINC.length],0);
    var talk=(Math.floor(now/700)+i)%2;                                           // speech marks alternate
    g.fillStyle="rgba(255,255,255,0.75)"; g.fillRect((sx+(talk?0:3))|0,HORIZON-8,1,1);
  }
  if(day&&h13>=15&&h13<19){                                                       // KIDS PLAY TAG after school
    var base=Math.round(0.365*WW)-24, bx=base-WOFF;
    if(bx>SW+20&&bx-WW>-20) bx-=WW; if(bx<-20&&bx+WW<SW+20) bx+=WW;
    if(bx>=-18&&bx<=SW+18){
      for(var k2=0;k2<3;k2++){ var ph2=(now*0.004+k2*2.09);
        var kx=bx+8+Math.sin(ph2)*7+k2*2, ky=HORIZON-1;
        g.fillStyle=SKINC[k2%SKINC.length]; g.fillRect(kx|0,ky-1,2,1);
        g.fillStyle=["#ff5a5a","#4aa8ff","#ffd23a"][k2]; g.fillRect(kx|0,ky,2,2); } }
  }
  if(day){                                                                        // a DOG chases its ball
    var SLOT13=90000, id13=Math.floor(now/SLOT13), r13=rng((id13*40503+787)>>>0);
    if(r13()<0.5){ var t13=now-id13*SLOT13;
      if(t13<9000){ var f13=t13/9000, ox=landRoute(r13()*WW);
        var throwD=(r13()<0.5?1:-1)*26;
        var ballx=ox+throwD*Math.min(1,f13*2.2), bally=HORIZON+1-Math.abs(Math.sin(Math.min(1,f13*2.2)*Math.PI))*6;
        var dogx=ox+throwD*Math.max(0,(f13-0.18)/0.82)* (f13<0.6?1:1);
        if(f13>0.6){ dogx=ox+throwD-(f13-0.6)/0.4*throwD; ballx=dogx+ (throwD>0?2:-1); bally=HORIZON+1; }
        var osx=ox-WOFF; if(osx>SW+30&&osx-WW>-30) osx-=WW; if(osx<-30&&osx+WW<SW+30) osx+=WW;
        if(osx>=-28&&osx<=SW+28){ var off13=osx-ox;
          drawPerson(g,(ox+off13)|0,HORIZON-1,PEDC[id13%PEDC.length],SKINC[id13%SKINC.length],0);
          g.fillStyle="#e8482a"; g.fillRect((ballx+off13)|0,bally|0,1,1);
          var db13=(Math.floor(now/120))&1;
          g.fillStyle="#8a6a4a"; g.fillRect((dogx+off13)|0,(HORIZON+1-db13)|0,3,1);
          g.fillRect((dogx+off13+(throwD>0?3:-1))|0,(HORIZON-db13)|0,1,1); } } }
  }
  if(!day){                                                                       // a WAVE from a lit window
    var id14=Math.floor(now/45000), r14=rng((id14*2654435761+313)>>>0);
    if(r14()<0.4){ var t14=(now%45000);
      if(t14<5000){ var bi14=(r14()*near.blds.length)|0, b14=near.blds[bi14];
        if(b14&&b14.type!=="park"&&!(b14.bAge!==undefined&&cityG-b14.bAge<=bandOf(b14))){
          var bx14=b14.x-WOFF; if(bx14>SW+8&&bx14-WW>-8) bx14-=WW; if(bx14<-8&&bx14+WW<SW+8) bx14+=WW;
          if(bx14>=-6&&bx14<=SW+6&&b14.win.length){ var w14=b14.win[(r14()*b14.win.length)|0];
            var wx14=(bx14+w14.x)|0, wy14=(HORIZON-b14.h+w14.y)|0;
            g.fillStyle="#ffe9a0"; g.fillRect(wx14,wy14,w14.w,w14.h);
            g.fillStyle="#2a2018"; g.fillRect(wx14+(w14.w>>1),wy14,1,1);          // the silhouette
            if((Math.floor(now/260))&1){ g.fillStyle="#2a2018"; g.fillRect(wx14+(w14.w>>1)+1,wy14-1,1,1); } } } } }   // waving arm
  }
}
// deep-winter FREEZE: the bay ices over — skaters, fishing huts, boats locked in
var iceNow=false;
function computeIce(nd){
  var m=nd.getMonth()+1, t=(weather.temp==null?60:weather.temp);
  iceNow=(m===12||m<=2)&&t<30&&hasOcean&&seaW>0;
}
function drawIce(g,L,now){
  if(!iceNow) return;
  var day=L>0.5, wTop=HORIZON-22;
  eachWaterSpan(function(sa,sb){ if(sb-sa<10) return;
    g.fillStyle=day?"#cfe0ea":"#5a6a7c"; g.fillRect(sa,wTop,sb-sa,HORIZON-wTop);   // the ice sheet
    g.fillStyle=day?"rgba(255,255,255,0.5)":"rgba(190,205,220,0.3)"; g.fillRect(sa,wTop,sb-sa,1);
    g.fillStyle=day?"rgba(120,140,160,0.35)":"rgba(30,40,55,0.4)";
    for(var cr=sa+5;cr<sb-3;cr+=11){ g.fillRect(cr,wTop+3+((cr*7)%9),4,1); g.fillRect(cr+3,wTop+4+((cr*7)%9),3,1); }   // cracks
    g.fillStyle="rgba(240,246,255,0.55)";
    for(var dr=sa+3;dr<sb;dr+=8) g.fillRect(dr,wTop+((dr*5)%14)+2,3,1);            // snow drifts
    // SKATERS carve arcs
    for(var sk=0;sk<3;sk++){ var ph=now*0.00035+sk*2.1;
      var kx=(sa+sb)/2+Math.sin(ph)*(sb-sa)*0.32, ky=wTop+8+Math.sin(ph*2.3+sk)*5;
      if(kx<sa+2||kx>sb-2) continue;
      drawPerson(g,kx|0,ky|0,["#c0453a","#3a70b0","#3a9a5a"][sk],SKINC[sk%SKINC.length],(Math.floor(now/160)+sk)&1);
      g.fillStyle="rgba(255,255,255,0.4)"; g.fillRect((kx-Math.cos(ph)*3)|0,(ky+3)|0,2,1); }   // skate trail
    // ICE-FISHING huts
    for(var ht=0;ht<2;ht++){ var hx2=sa+(sb-sa)*(0.25+ht*0.5);
      g.fillStyle=day?["#8a4525","#3a5a7a"][ht]:"#2c2620"; g.fillRect((hx2-2)|0,wTop+3,5,4);
      g.fillStyle=day?"#5a3a20":"#1c1610"; g.fillRect((hx2-3)|0,wTop+2,7,1);
      g.fillStyle="#10141c"; g.fillRect((hx2+4)|0,wTop+8,2,1);                     // the hole
      drawSeated(g,(hx2+4)|0,wTop+7,"#4a3a2a",SKINC[ht+1]);
      if(!day){ g.fillStyle="#ffd9a0"; g.fillRect((hx2)|0,wTop+5,1,1); } }         // lantern
  });
}
// one summer night per life, the city releases SKY LANTERNS over the sea
function drawLanternFest(g,L,now){
  var cg2=cityGrowth(now), lf=0.58+((lifeIndexOf(now)*40503>>>4)%120)/1000;
  if(Math.abs(cg2.cy-lf)>=0.004||L>0.3||cityG<0.4) return;
  g.globalCompositeOperation="lighter";
  for(var i=0;i<44;i++){ var h=((i*2654435761+77)>>>0);
    var rise=((now*0.006+h%3000)%260);
    var lx=wrapW((h%WW)+Math.sin(now*0.0004+i)*6+rise*0.25), ly=HORIZON-6-rise*0.55;
    if(ly<4) continue;
    var sx=lx-WOFF; if(sx>SW+3&&sx-WW>-3) sx-=WW; if(sx<-3&&sx+WW<SW+3) sx+=WW;
    if(sx<-2||sx>SW+2) continue;
    var fl=0.6+0.4*Math.sin(now*0.006+i*1.7);
    g.fillStyle="rgba(255,170,70,"+(0.5*fl).toFixed(2)+")"; g.fillRect(sx|0,ly|0,2,2);
    g.fillStyle="rgba(255,220,150,"+(0.25*fl).toFixed(2)+")"; g.fillRect((sx-1)|0,(ly-1)|0,4,4); }
  g.globalCompositeOperation="source-over";
}
// REGATTA DAY: the bay fills with racing sails (3rd Saturday of August)
function drawRegatta(g,L,now,nd){
  if(!hasOcean||seaW<=0||cityG<0.5||L<0.4||iceNow) return;
  var m=nd.getMonth()+1, y=nd.getFullYear();
  if(m!==8) return;
  var aug1=new Date(y,7,1).getDay(), rd=1+((6-aug1+7)%7)+14;
  if(nd.getDate()!==rd) return;
  var h2=nd.getHours(); if(h2<13||h2>=17) return;
  var band=[6,WW*seaW-8], span=band[1]-band[0], wl=HORIZON-13;
  var sails=["#e8482a","#ffd23a","#3a9a5a","#4a7fd2","#c05ad0"];
  for(var i=0;i<5;i++){ var h=((i*40503+61)>>>0);
    var prog=((now*0.004+ (h%900))% (span*2)); if(prog>span) prog=span*2-prog;     // laps
    prog+=Math.sin(now*0.001+i*1.9)*4;                                             // lead changes
    var wx=band[0]+Math.max(0,Math.min(span,prog)), sx=wx-WOFF;
    if(sx>SW+8&&sx-WW>-8) sx-=WW; if(sx<-8&&sx+WW<SW+8) sx+=WW;
    if(sx<-6||sx>SW+6) continue;
    g.fillStyle=L>0.5?"#5a4632":"#241a12"; g.fillRect(sx|0,wl,5,1);
    g.fillStyle="#2a2a32"; g.fillRect((sx+2)|0,wl-6,1,6);
    g.fillStyle=sails[i]; for(var s2=1;s2<=4;s2++) g.fillRect((sx+3)|0,wl-1-s2,Math.min(s2,3),1);
    g.fillStyle="rgba(255,255,255,0.4)"; g.fillRect((sx-2)|0,wl+1,2,1); }
  g.fillStyle="#e8482a"; g.fillRect((band[0]+span*0.9-WOFF)|0,wl-8,1,8);           // the finish buoy
  var crx=(WW*seaW+6)-WOFF;                                                        // shore crowd
  if(crx>-20&&crx<SW+20) for(var c2=0;c2<6;c2++) drawPerson(g,(crx+c2*3)|0,HORIZON-1,PEDC[c2%PEDC.length],SKINC[c2%SKINC.length],0);
}
// dawn FOG BANKS roll off the sea and burn away by mid-morning
function drawSeaFog(g,L,now,nd,fx){
  if(!hasOcean||seaW<=0||fx.rain||fx.snow) return;
  var hf=nd.getHours()+nd.getMinutes()/60;
  var amt=Math.max(0,1-Math.abs(hf-6.1)/2.6); if(amt<=0.03) return;
  var reach=120*amt;
  for(var side=0;side<2;side++){ var edge=side?WW*(1-seaW):WW*seaW, dir=side?-1:1;
    for(var bnk=0;bnk<3;bnk++){
      var drift=Math.sin(now*0.00012+bnk*2.1+side*3)*14;
      var a0=edge-40*dir, len=(40+reach*(1-bnk*0.25))*dir;
      var xa=Math.min(a0,a0+len)+drift, xb=Math.max(a0,a0+len)+drift;
      var SA=(xa-WOFF)|0, SB=(xb-WOFF)|0;
      if(SB<0&&SA+WW<SW){ SA+=WW; SB+=WW; }
      if(SB<0||SA>SW) continue;
      var fy=HORIZON-7+bnk*5;
      g.fillStyle="rgba(216,224,234,"+(amt*(0.22-bnk*0.05)).toFixed(3)+")";
      g.fillRect(Math.max(-2,SA),fy,Math.min(SW+2,SB)-Math.max(-2,SA),6-bnk);
    }
  }
}
// ---- SIDE-STAGE SPECTACLES (the user's eyes live on the side monitors) ----
// left world [0..582]: the coast — TALL SHIP visits; right [1222..1702]: the airshow
function drawSideShows(g,L,now,nd){
  if(hasOcean&&seaW>0&&cityG>0.25){                                               // a TALL SHIP passes the left coast
    var SLOT15=700000, id15=Math.floor(now/SLOT15), r15=rng((id15*40503+901)>>>0);
    if(r15()<0.4){ var t15=now-id15*SLOT15;
      if(t15<120000){ var f15=t15/120000;
        var band=[6,WW*seaW-10], wx15=band[0]+(band[1]-band[0])*f15;
        var sx15=wx15-WOFF; if(sx15>SW+20&&sx15-WW>-20) sx15-=WW; if(sx15<-20&&sx15+WW<SW+20) sx15+=WW;
        if(sx15>=-18&&sx15<=SW+18){ var wl15=HORIZON-12, day15=L>0.5;
          g.fillStyle=day15?"#5a4632":"#241a12"; g.fillRect(sx15|0,wl15,12,2); g.fillRect((sx15+1)|0,wl15+2,10,1);
          g.fillStyle="#2a2a32"; g.fillRect((sx15+3)|0,wl15-9,1,9); g.fillRect((sx15+7)|0,wl15-7,1,7);
          g.fillStyle=day15?"#f2e8cc":"#8a857a";                                   // three square sails
          g.fillRect((sx15+1)|0,wl15-8,4,3); g.fillRect((sx15+1)|0,wl15-4,4,2); g.fillRect((sx15+6)|0,wl15-6,3,3);
          g.fillStyle="#c0453a"; g.fillRect((sx15+3)|0,wl15-10,2,1);              // pennant
          g.fillStyle="rgba(255,255,255,0.35)"; g.fillRect((sx15-2)|0,wl15+2,2,1); } } }
  }
  if(cityG>0.68){                                                                 // the AIRSHOW over the right side
    var SLOT16=560000, id16=Math.floor(now/SLOT16), r16=rng((id16*2654435761+443)>>>0);
    if(r16()<0.35&&L>0.4){ var t16=now-id16*SLOT16;
      if(t16<26000){ var f16=t16/26000;
        var wx16=WW*0.72+WW*0.27*f16;                                             // sweep the right monitor's range
        var sy16=30+Math.sin(f16*Math.PI*3)*14;
        for(var j16=0;j16<3;j16++){ var jx=wx16-j16*7-WOFF, jy=sy16+j16*(j16===1?3:-3)*0+ (j16===0?0:(j16===1?4:-4));
          if(jx<-8||jx>SW+8) continue;
          g.fillStyle=L>0.5?"#3a3f4a":"#181820"; g.fillRect(jx|0,jy|0,4,1); g.fillRect((jx+3)|0,(jy-1)|0,1,1);
          g.globalCompositeOperation="lighter";                                   // coloured smoke trails
          g.fillStyle=["rgba(255,90,90,0.4)","rgba(240,240,255,0.4)","rgba(90,150,255,0.4)"][j16];
          for(var tr16=1;tr16<9;tr16++) g.fillRect((jx-tr16*2)|0,(jy+Math.sin((f16*40-tr16)*0.7)*1.5)|0,2,1);
          g.globalCompositeOperation="source-over"; } } }
  }
}
// fireflies drifting low over the parks/wilderness on warm summer nights (all growth stages)
function drawFireflies(g,nd,L,now){
  var t=(weather.temp==null?60:weather.temp), m=nd.getMonth()+1;
  if(L>0.34||t<58||m<5||m>9) return;
  var n=Math.round(WW/(QUAL===0?48:24));
  for(var i=0;i<n;i++){ var r=((i*2654435761)>>>0)/4294967296,
      wx=wrapW(r*WW + Math.sin(now*0.0004+i)*8), wy=HORIZON-2-((i*13)%10) + Math.sin(now*0.0011+i*1.7)*3,
      blink=Math.sin(now*0.004+i*2.1);
    if(blink<0.3) continue;
    for(var w=-1;w<=1;w++){ var sx=wx-WOFF+w*WW; if(sx<-1||sx>SW+1) continue;
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,255,120,"+(0.7*blink)+")"; g.fillRect(sx|0,wy|0,1,1);
      g.globalCompositeOperation="source-over"; } }
}

function drawSky(g,now,nd,L,fx){
  if(L>=0.34||fx.rain||fx.snow||fx.fog||fx.thunder) return;
  var vis=1-Math.min(0.8,(weather.cloud||0)/100*(fx.cloudy?0.8:0.45));   // stars pierce a broken deck
  var lst=lstHours(nd), fade=Math.min(1,(0.34-L)*3.6)*vis, P=[];
  if(fade<0.05) return;
  // faint filler field first (fills the sky; rotates correctly with the real stars)
  for(var i=0;i<skyfill.length;i++){ var fa=altAz(skyfill[i][0],skyfill[i][1],lst); if(fa.alt<1.5) continue;
    // LIGHT POLLUTION: the city's glow washes the faint stars low over the skyline; the zenith stays dark & rich
    var fmag=skyfill[i][2], lp=Math.min(1,Math.max(0.10,(fa.alt-2)/22));
    if(fa.alt<11 && fmag>4.7 && (i&1)) continue;                          // thin the faintest stars out of the glow
    var fwx2=skyWX(fa.az), fwy=skyY(fa.alt);
    var falpha=Math.max(0.07,(5.8-fmag)/9)*(0.55+0.45*Math.sin(now*0.0016+i*2.3))*fade*lp;
    for(var fw=-1;fw<=1;fw++){ var fsx=fwx2-WOFF+fw*WW; if(fsx<-1||fsx>SW+1) continue;
      g.globalAlpha=falpha; g.fillStyle="#cfd8ec"; g.fillRect(fsx|0,fwy|0,1,1); g.globalAlpha=1; } }
  for(i=0;i<STARS.length;i++) P.push(altAz(STARS[i][0],STARS[i][1],lst));
  // asterism lines (very faint)
  g.strokeStyle="rgba(155,186,232,"+(0.44*fade)+")"; g.lineWidth=1;   // brighter so constellations pop from the denser field
  for(i=0;i<LINES.length;i++){ var a=P[LINES[i][0]], b=P[LINES[i][1]]; if(a.alt<2||b.alt<2) continue;
    var awx=skyWX(a.az), bwx=skyWX(b.az); if(Math.abs(awx-bwx)>WW*0.5) continue;    // skip seam-wrapping links
    var ay=skyY(a.alt), byy=skyY(b.alt);
    for(var w=-1;w<=1;w++){ var ax=awx-WOFF+w*WW, bx2=bwx-WOFF+w*WW;
      if((ax<-4&&bx2<-4)||(ax>SW+4&&bx2>SW+4)) continue;
      g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx2,byy); g.stroke(); }
  }
  // stars
  for(i=0;i<STARS.length;i++){ var aa=P[i]; if(aa.alt<1.5) continue; var mag=STARS[i][2];
    var wx=skyWX(aa.az), wy=skyY(aa.alt);
    var lpS=Math.min(1,Math.max(0.4,(aa.alt)/20));                    // bright named stars resist the city glow more than filler
    var base=Math.max(0.5,Math.min(1,(2.6-mag)/2.2)), tw=0.75+0.25*Math.sin(now*0.002+i*1.7);
    var alpha=base*tw*fade*lpS;
    if(mag<1.6){ g.globalCompositeOperation="lighter";                    // the bright named stars GLOW
      for(var w4=-1;w4<=1;w4++){ var hx5=wx-WOFF+w4*WW; if(hx5<-3||hx5>SW+3) continue;
        g.fillStyle="rgba(190,214,255,"+(0.16*alpha).toFixed(3)+")"; g.fillRect((hx5-1)|0,(wy-1)|0,3,3);
        g.fillStyle="rgba(235,242,255,"+(0.9*alpha).toFixed(3)+")"; g.fillRect(hx5|0,wy|0,2,1); }
      g.globalCompositeOperation="source-over"; }
    for(w=-1;w<=1;w++){ var sx=wx-WOFF+w*WW; if(sx<-1||sx>SW+1) continue;
      if(mag<0.8){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(190,214,255,"+(0.35*alpha)+")";
        g.fillRect((sx-1)|0,(wy-1)|0,3,3); g.globalCompositeOperation="source-over"; }
      g.globalAlpha=alpha; g.fillStyle=mag<1.2?"#f2f6ff":"#dfe6f6"; g.fillRect(sx|0,wy|0,1,1); g.globalAlpha=1;
    }
  }
  // ---- AURORA on cold clear nights (northern sky, shimmering green/violet curtains) ----
  if(auroraActive(nd)){ g.globalCompositeOperation="lighter";
    for(var band=0;band<3;band++){ var by=18+band*10, ba=(0.06+0.04*Math.sin(now*0.0011+band*2))*fade;
      for(var ax2=0;ax2<SW;ax2+=2){ var wxA=ax2+WOFF, wav=Math.sin(wxA*0.02+now*0.0006+band)*6+Math.sin(wxA*0.05+now*0.0013)*3,
          h=14+Math.sin(wxA*0.03+now*0.001+band)*8;
        g.fillStyle=(band<2?"rgba(80,235,150,":"rgba(170,110,255,")+(ba)+")"; g.fillRect(ax2,(by+wav)|0,2,h|0); } }
    g.globalCompositeOperation="source-over"; }

  // ---- METEORS (frequent during the real showers, occasional otherwise) — world-anchored so all screens agree ----
  var shower=meteorShowerActive(nd), MSLOT=shower?3200:20000;
  for(var mk=0;mk<(shower?3:1);mk++){ var midx=Math.floor(now/MSLOT)+mk*997, mr=rng((midx*40503+13)>>>0);
    if(mr()>(shower?0.85:0.5)) continue;
    var mt=now-((midx-mk*997)*MSLOT), MDUR=850; if(mt<0||mt>MDUR) continue;
    var prog=mt/MDUR, rad=mr()*WW, sY=8+mr()*46, travel=26+mr()*34, dirx=shower?1:(mr()<0.5?1:-1);
    g.globalCompositeOperation="lighter";
    for(var tl=0;tl<11;tl++){ var tp=prog-tl*0.028; if(tp<0) break;
      var twx=wrapW(rad+tp*travel*dirx), ty=sY+tp*travel*0.55;
      for(var w2=-1;w2<=1;w2++){ var tsx=twx-WOFF+w2*WW; if(tsx<-1||tsx>SW+1) continue;
        g.fillStyle="rgba(255,252,225,"+(0.9*(1-tl/11)*(1-Math.abs(prog-0.5)*0.6))+")"; g.fillRect(tsx|0,ty|0,tl<2?2:1,1); } }
    g.globalCompositeOperation="source-over";
  }

  // ---- a GREAT COMET visits for its season (bright head + long gradient tail, drifts night to night) ----
  if(COMET_SEASON.indexOf(ym(nd))>=0){ var cdr=rng((Math.floor(nd.getTime()/86400000)*2246822519)>>>0);
    var cwxw=0.2*WW+cdr()*0.6*WW, cyy=24+cdr()*40, cwob=Math.sin(now*0.0007)*2;
    for(var w3=-1;w3<=1;w3++){ var csx=cwxw-WOFF+w3*WW; if(csx<-40||csx>SW+40) continue;
      g.globalCompositeOperation="lighter";
      for(var tt=0;tt<28;tt++){ g.fillStyle="rgba(180,220,255,"+(0.5*(1-tt/28))+")"; g.fillRect((csx+tt*1.5)|0,(cyy+cwob+tt*0.4)|0,2,1); }  // tail
      g.fillStyle="rgba(235,245,255,0.95)"; g.fillRect(csx|0,(cyy+cwob)|0,2,2);                                                          // head
      g.globalCompositeOperation="source-over"; }
  }

  // the Moon in its real position + real phase (blood-red on eclipse nights)
  eclipseMoon = LUNAR_ECLIPSES.indexOf(ymd(nd))>=0;
  var mrd=moonRaDec(nd), maa=altAz(mrd.ra,mrd.dec,lst);
  if(maa.alt>1.5){ var mwx=skyWX(maa.az), mwy=skyY(maa.alt)*0.96;
    for(w=-1;w<=1;w++){ var mx=mwx-WOFF+w*WW; if(mx<-8||mx>SW+8) continue; drawMoon(g,mx,mwy,eclipseMoon?1:moonPhase(nd)); } }
}

// ---- weather ----
// fetch on a new shared 10-min window, or retry within a window if a screen's request never landed —
// all monitors compute the SAME window index, so they fetch together and converge on identical weather.
function maybeFetchAirq(){
  if(FORCEAQ){ airq=FORCEAQ; return; }
  var rn=Date.now(), ab=Math.floor(rn/AQ_BUCKET);
  if(ab!==aqBucket || (aqOkBucket!==ab && rn-aqReqAt>60000)){
    aqBucket=ab; aqReqAt=rn; fetchAirq(ab);
  }
}
function fetchAirq(bucket){
  if(typeof XMLHttpRequest==="undefined") return;
  try{
    var xhr=new XMLHttpRequest();
    xhr.onreadystatechange=function(){
      if(xhr.readyState===XMLHttpRequest.DONE && xhr.status===200){
        try{ var j=JSON.parse(xhr.responseText), cu=j.current;
          if(cu){ airq={ pm25:(cu.pm2_5!=null?cu.pm2_5:null), aqi:(cu.us_aqi!=null?cu.us_aqi:null) };
            if(bucket!==undefined) aqOkBucket=bucket; }
        }catch(e){}
      }
    };
    xhr.open("GET","https://air-quality-api.open-meteo.com/v1/air-quality?latitude="+LAT+"&longitude="+LON+"&current=pm2_5,us_aqi");
    xhr.send();
  }catch(e){}
}
var FORCEWX=null;   // test hook: a full weather object {code,cloud,wind,temp,precip,feels,gust} — pins the live fetch
function maybeFetchWeather(){
  if(FORCEWX){ weather=FORCEWX; return; }   // forced weather sticks (harness) — no live fetch can clobber it
  var rn=Date.now(), wb=Math.floor(rn/WX_BUCKET);
  if(wb!==wxBucket || (wxOkBucket!==wb && rn-wxReqAt>30000)){
    wxBucket=wb; wxReqAt=rn; fetchWeather(wb);
  }
}
function fetchWeather(bucket){
  if(typeof XMLHttpRequest==="undefined") return;   // node (chronicle tooling) has no XHR
  try{
    var xhr=new XMLHttpRequest();
    xhr.onreadystatechange=function(){
      if(xhr.readyState===XMLHttpRequest.DONE && xhr.status===200){
        try{ var j=JSON.parse(xhr.responseText), cu=j.current;
          weather={ code:cu.weather_code, cloud:cu.cloud_cover, wind:cu.wind_speed_10m, temp:cu.temperature_2m,
                    precip:cu.precipitation, feels:cu.apparent_temperature, gust:cu.wind_gusts_10m };   // + real precip / feels-like / gusts
          var rn2=Date.now();
          // --- NOWCAST: read the 15-min precipitation bucket for right-now so a shower that just
          //     started/stopped shows here without waiting on the slower `current` block ---
          var m15=j.minutely_15;
          if(m15&&m15.time&&m15.time.length){
            var t0=Date.parse(m15.time[0].length<=16?(m15.time[0]+":00"):m15.time[0]);
            var idx=Math.floor((rn2-t0)/900000);
            if(idx>=0&&idx<m15.time.length){
              if(m15.precipitation&&m15.precipitation[idx]!=null) weather.precip=m15.precipitation[idx];
              if(m15.weather_code&&m15.weather_code[idx]!=null)   weather.code=m15.weather_code[idx];
            }
          }
          // --- PROJECTED: scan the next ~12h of hourly forecast → high/low, peak rain chance,
          //     and the condition a few hours out, for the HUD's forecast line ---
          var hh=j.hourly;
          if(hh&&hh.time&&hh.time.length){
            var phi=-999,plo=999,ppp=0,pcode=weather.code,soonIdx=-1;
            for(var k=0;k<hh.time.length;k++){ var ht=Date.parse(hh.time[k]);
              var dh=(ht-rn2)/3600000; if(dh< -1) continue; if(dh>12) break;
              var tv=hh.temperature_2m?hh.temperature_2m[k]:null;
              if(tv!=null){ if(tv>phi)phi=tv; if(tv<plo)plo=tv; }
              var pp=hh.precipitation_probability?hh.precipitation_probability[k]:null;
              if(pp!=null&&pp>ppp)ppp=pp;
              if(dh>=2.5&&dh<3.5&&hh.weather_code) pcode=hh.weather_code[k];        // ~3h-out condition
            }
            weather.proj={ hi:(phi>-900?Math.round(phi):null), lo:(plo<900?Math.round(plo):null),
                           pp:ppp, code:pcode };
          }
          if(bucket!==undefined) wxOkBucket=bucket;   // this window's fetch succeeded → stop retrying it
        }catch(e){}
      }
    };
    xhr.open("GET","https://api.open-meteo.com/v1/forecast?latitude="+LAT+"&longitude="+LON+"&current=weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,temperature_2m,apparent_temperature,precipitation&minutely_15=precipitation,weather_code&hourly=weather_code,precipitation_probability,temperature_2m&forecast_days=2&temperature_unit=fahrenheit&timezone=auto");
    xhr.send();
  }catch(e){}
}
function wfx(){
  var c=weather.code;
  return { fog:c===45||c===48, drizzle:c>=51&&c<=57,
    rain:(c>=61&&c<=67)||(c>=80&&c<=82), snow:(c>=71&&c<=77)||c===85||c===86,
    thunder:c>=95, cloudy:weather.cloud>60,
    freezing:c===56||c===57||c===66||c===67,   // freezing drizzle/rain → ice glaze on everything
    hail:c===96||c===99,                       // thunderstorm WITH hail → pellets guaranteed (99 = heavy)
    grains:c===77,                             // snow grains → fine, slow, sparse
    violent:c===82 };                          // violent rain showers → reads harder than steady heavy rain
}
// a short weather word from a WMO code (+ cloud % for the clear/cloudy split)
function wxWord(c,cloud){
  if(c===96||c===99) return "HAIL";
  if(c>=95) return "STORMS";
  if(c===56||c===57||c===66||c===67) return "ICE";
  if((c>=71&&c<=77)||c===85||c===86) return "SNOW";
  if((c>=61&&c<=67)||(c>=80&&c<=82)) return "RAIN";
  if(c>=51&&c<=57) return "DRIZZLE";
  if(c===45||c===48) return "FOG";
  if(cloud>=85||c===3) return "OVERCAST";
  if(cloud>=45||c===2) return "CLOUDY";
  if(c===1) return "P.CLOUDY";
  return "CLEAR";
}
// the HUD forecast line: "68F CLEAR  HI 78 LO 61  RAIN 40%" (whatever data we have)
function wxHudLine(){
  var parts=[];
  if(weather.temp!=null) parts.push(Math.round(weather.temp)+"F");
  parts.push(wxWord(weather.code,weather.cloud||0));
  var p=weather.proj;
  if(p){
    if(p.hi!=null&&p.lo!=null) parts.push("HI "+p.hi+" LO "+p.lo);
    if(p.pp!=null&&p.pp>=25){                                   // only mention rain when it's actually likely
      var w=wxWord(p.code,60); parts.push((w==="RAIN"||w==="SNOW"||w==="STORMS"?w:"RAIN")+" "+p.pp+"%");
    }
  }
  return parts.join("  ");
}
// per-holiday building decorations: garland light colours, entrance prop, window tint.
// Every holiday dresses the city — the buildings "celebrate" whatever day it is.
var HOLIDECOR = {
  xmas:      { garland:["#ff4444","#44ff66","#ffe08a","#4488ff"], prop:"wreath",  tint:0    },
  halloween: { garland:["#ff8a1a","#a04ad0","#ffd27a"],           prop:"pumpkin", tint:0    },
  july4:     { garland:["#ff4444","#ffffff","#4466ff"],           prop:"flag",    tint:0.45 },
  nye:       { garland:["#ffe08a","#dfe6f6","#ff7ad0","#7affd7"], prop:"balloon", tint:0.45 },
  valentine: { garland:["#ff5aa0","#ff9ec4","#ff3b6b"],           prop:"heart",   tint:0.45 },
  stpatrick: { garland:["#2fbf5a","#8fe0a0","#ffe08a"],           prop:"clover",  tint:0.5  },
  thanks:    { garland:["#d9822b","#b5651d","#e0b040","#8a3b1e"], prop:"leaf",    tint:0.5  },
  easter:    { garland:["#ff9ec4","#a6e3ff","#c8f5a0","#ffe08a"], prop:"egg",     tint:0.5  }
};
// Easter Sunday (Anonymous Gregorian algorithm)
function easterDate(y){ var a=y%19,b=(y/100)|0,c=y%100,dd=(b/4)|0,e=b%4,f=((b+8)/25)|0,
  g2=((b-f+1)/3)|0,h=(19*a+b-dd-g2+15)%30,i2=(c/4)|0,k=c%4,l=(32+2*e+2*i2-h-k)%7,
  mth=((a+11*h+22*l)/451)|0, mo=((h+l-7*mth+114)/31)|0, day=((h+l-7*mth+114)%31)+1;
  return {m:mo,d:day}; }
function holidays(now){
  var m=now.getMonth()+1, d=now.getDate(), hr=now.getHours(), y=now.getFullYear();
  var nov1=new Date(y,10,1).getDay(), thanksDay=1+((4-nov1+7)%7)+21;   // 4th Thursday of Nov
  var est=easterDate(y);
  // birthdays: a strung banner + fireworks + hearts — now driven by the config list (see BIRTHDAYS at the top).
  var bdayE=birthdayFor(m,d), bday=bdayE?(bdayE.label||"HAPPY BIRTHDAY"):null;
  var hol={ xmas:(m===12&&d>=12&&d<=26), halloween:(m===10&&d>=24),   // tight windows: the Christmas season lights up mid-late Dec; Halloween is its final week — not the whole month
    july4:(m===7&&(d===3||d===4||d===5)),                             // the Independence Day weekend (the 4th ± a day)
    nye:(m===12&&d===31&&hr>=18)||(m===1&&d===1&&hr<2),
    valentine:(m===2&&d===14),
    stpatrick:(m===3&&d===17),
    thanks:(m===11&&d===thanksDay),
    easter:(m===est.m&&(d===est.d||d===est.d-1)),
    // more real days
    newyearday:(m===1&&d===1&&hr>=2), earthday:(m===4&&d===22), mayday:(m===5&&d===1),
    // invented CITY holidays (whimsical, unique to this world)
    lantern:(m===8&&d===15), kite:(m===4&&d>=18&&d<=20), founders:(m===6&&d===1), harvest:(m===9&&d>=20&&d<=22),
    bday:bday, bdayPink:(bdayE?!!bdayE.pink:false) };
  // pick which holiday's decorations the buildings wear (one at a time)
  var order=["xmas","halloween","july4","nye","valentine","stpatrick","thanks","easter"];
  hol.name=null; for(var i=0;i<order.length;i++) if(hol[order[i]]){ hol.name=order[i]; break; }
  hol.decor=hol.name?HOLIDECOR[hol.name]:null;
  return hol;
}

// ---- daily rhythm: the city breathes — packed at rush hour, dead at 3am ----
function bump(h,c,w){ var d=(h-c)/w; return Math.exp(-d*d); }
function dayRhythm(nd){
  var h=nd.getHours()+nd.getMinutes()/60, a;
  if(h<5) a=0.12;
  else if(h<7) a=0.12+(h-5)/2*0.55;
  else if(h<9.5) a=1.0;                 // morning rush
  else if(h<16) a=0.7;                  // midday
  else if(h<19) a=1.0;                  // evening rush
  else if(h<22) a=0.78;                 // evening
  else if(h<24) a=Math.max(0.14,0.78-(h-22)/2*0.64);
  else a=0.12;
  var rushI=Math.max(bump(h,8.2,1.1),bump(h,17.6,1.2));    // smooth gridlock intensity
  return { hour:h, act:a, carPresence:0.5+0.5*a, carSpeed:1-0.5*rushI, rush:rushI>0.5, deep:(h<5.2||h>=23.2) };
}
// how busy a given district is at hour h (nightlife vs office hours vs workday)
function districtBusy(name,h){
  if(name==="neon")       return (h>=19||h<1.5)?1.0:(h>=12?0.5:0.28);   // entertainment: nightlife
  if(name==="industrial") return (h>=6&&h<18)?0.7:0.12;                 // docks: workday only
  if(name==="downtown")   return (h>=8&&h<19)?0.9:0.28;                 // offices: business hours
  return (h>=7&&h<21.5)?0.85:0.32;                                      // residential/oldtown
}
// ---- season (Norwich CT): drives tree foliage colour ----
function seasonInfo(nd){
  var m=nd.getMonth()+1;
  if(m===12||m<=2)  return { name:"winter", canopy:[[86,94,86],[104,110,100],[74,84,78]], bare:true,  blossom:false };
  if(m<=5)          return { name:"spring", canopy:[[112,172,92],[150,200,120],[124,182,104]], bare:false, blossom:true };
  if(m<=8)          return { name:"summer", canopy:[[52,128,58],[70,148,74],[42,110,52]], bare:false, blossom:false };
  return              { name:"autumn", canopy:[[206,120,42],[212,86,44],[188,152,52]], bare:false, blossom:false };
}
var curSeason=null;   // set each frame in draw()

// ---- special event days (calendar-driven, like holidays) ----
function cityEvents(nd){
  var dow=nd.getDay(), m=nd.getMonth()+1, d=nd.getDate(), h=nd.getHours(), y=nd.getFullYear();
  var sep1=new Date(y,8,1).getDay(),  paradeD=1+((6-sep1+7)%7);        // 1st Saturday of Sept = parade
  var oct1=new Date(y,9,1).getDay(),  marD=1+((0-oct1+7)%7)+7;         // 2nd Sunday of Oct = marathon
  return {
    market:  ((dow===6||dow===0) && h>=8 && h<16),                     // weekend farmers' market
    parade:  ((m===9 && d===paradeD) ||                       // founders' parade (1st Sat of Sept)
              (m===7 && d===4) ||                              // Independence Day
              (m===3 && d===17) ||                             // St. Patrick's
              (m===11 && d>=22 && d<=28 && new Date(y,m-1,d).getDay()===4) ||  // Thanksgiving Thursday
              (m===12 && d===24)) && h>=10 && h<15,            // Christmas Eve day
    marathon:(m===10 && d===marD && h>=8 && h<13),
    movie:   ((dow===5||dow===6) && m>=6 && m<=9 && (h>=20||h<1)),     // summer weekend movie night
    balloonfest: (function(){ var jun1=new Date(y,5,1).getDay(), bd=1+((6-jun1+7)%7)+7;   // 2nd Sat of June
      return (m===6 && d===bd && h>=6 && h<11); })(),
    protest: (dow===3 && d>=8 && d<=14 && h>=12 && h<17),             // a 'day of action' march — 2nd Wednesday afternoon
    film:    (dow===2 && d>=1 && d<=7 && h>=9 && h<17)                // a film shoot comes to town — 1st Tuesday, daytime
  };
}
var curEvents=null;
var curDis=null, curRebuilt=[], curRuins=[];   // active disaster (or null) + completed-rebuild zones + permanently-ruined zones, set each frame
var cityG=1, cityPhase="peak", growPop=1, cityApoc=0, apocVeil=0;   // maturity, phase, pop factor, apocalypse progress + ash-out veil
var curSpace=0;   // SPACE AGE 0..1 — the mature metropolis' final evolution before the endtimes
function gstage(a,b){ return Math.max(0,Math.min(1,(cityG-a)/(b-a))); }   // 0..1 build progress between two growth marks
function roadFNow(){ return Math.max(0,Math.min(1,(cityG-0.1)/0.4)); }
var KSP=1;             // resolution scale (6/pxk): 1 at classic PXK 6, 1.5 in PXK-4 fine-pixel mode
var QUAL=2;            // quality tier: 0 performance · 1 balanced · 2 spectacle
var ZOOM=1;            // canvas px per world px (per-screen; >1 when a fractionally-scaled screen needs a denser canvas)
var mts=null;          // this life's mountain range ({far:[peaks],near:[peaks]}), null on flatland lives
var mtsCache=null;     // per-screen silhouette cache (the range never moves within a life)
function inSea(wx){ return hasOcean && seaW>0 && (wx < WW*seaW || wx > WW*(1-seaW)); }   // the open coast at the world's seam
// squeeze a whole-world crosser path onto DRY LAND — nothing rides over open water without a boat
function landRoute(x){ if(!hasOcean||seaW<=0) return x;
  var a=WW*seaW+8, b=WW*(1-seaW)-8; return a+(x/WW)*(b-a); }
var curLit=1;        // fraction of night windows actually on (ramps up through the evening, dims after midnight)
var curSunDf=0.5;    // where the sun is in its arc (0 sunrise .. 1 sunset) — drives light direction
// THE GOLDEN HOUR — one global light state, computed once per frame, consumed everywhere
// (sky, buildings, terrain, water, mountains, clouds) so low-sun light reads as ONE event.
var goldenK=0, goldC=[255,196,140];   // strength 0..1 near sunrise/sunset · rose-gold dawns, amber dusks
function cwInst(cw){ return cityG >= 0.38+((cw.seed%997)/997)*0.2; }      // crosswalks get painted one at a time

// ---- world generation ----
function pickType(r){ var v=r(); return v<0.46?"flat":v<0.62?"step":v<0.75?"peak":v<0.86?"water":v<0.94?"dome":"twin"; }
// ~1 near the world's left/right edges, ~0 in the dense centre — biases greenspaces outward
function edgeBias(x){ var d=Math.min(x,WW-x)/(WW*0.5+1), e=1-d; return e*e; }

function makeLayer(seed,y0,baseHMin,baseHMax,layerK){
  var r=rng(seed), blds=[], x=0;
  while(x<WW){
    if(inSea(x)||inSea(x+24)){ x+=8; continue; }             // nothing is built in the open sea
    var d=districtAt(x), pair=d.pal[(r()*d.pal.length)|0], acc=pair[0], acc2=pair[1], winPal=d.win;
    // greenspace / park — a low open plot; this district's parkChance, biased to the edges
    if(d.park>0 && r()<d.park*(0.2+0.8*edgeBias(x))){
      var pw=Math.round((20+((r()*20)|0))*KSP);
      var pk={ x:x, w:pw, h:6, y0:y0, type:"park", accent:acc, accent2:acc2,
               trees:[], lamps:[], pond:(pw>26&&r()<0.55), pondx:3+((r()*Math.max(1,pw-16))|0),
               fountain:r()<0.35, path:r()<0.6,
               bAge:0.04+0.14*(((Math.round(x)*2654435761)>>>0)/4294967296) };   // parks come early (green land)
      for(var ti=0,nt=3+((r()*(pw/3.5))|0);ti<nt;ti++)
        pk.trees.push({x:2+((r()*(pw-4))|0), s:3+((r()*4)|0), t:(r()*3)|0, big:r()<0.45});
      for(var li=0,nl=1+((r()*2)|0);li<nl;li++) pk.lamps.push({x:3+((r()*(pw-6))|0)});
      blds.push(pk); x+=pw+Math.round((2+((r()*3)|0))*KSP); continue;
    }
    var bw=Math.round((d.wRange[0]+((r()*(d.wRange[1]-d.wRange[0]))|0))*KSP);
    // buildings stand ≥ a few storeys tall so a person (7px) reads as ~one floor, not half a house
    var bh=Math.max(Math.round(15*KSP), Math.round((baseHMin+((r()*(baseHMax-baseHMin))|0))*d.hMul*layerK*KSP));
    var base=d.brick ? hex2rgb(["#2a1a14","#31201a","#241712","#2e1c14"][(r()*4)|0]) : hex2rgb(BLDBASE[(r()*BLDBASE.length)|0]);
    var bseed=(r()*1e9)>>>0, winHue=(r()*winPal.length)|0;
    // REGION: New England reskins the walls to a colonial palette (barely any neon accent), and
    // marks light-walled builds as wood clapboard. Pitched roofs are chosen below.
    var neClap=false, nePitch=false, accMix=(d.brick?0.06:0.10);
    if(REGION==="newengland"){
      var nw=NE_WALLS[(r()*NE_WALLS.length)|0]; base=[nw[0],nw[1],nw[2]];
      neClap=(nw[0]+nw[1]+nw[2])>430;                        // light walls → wood clapboard siding
      accMix=0.03;                                           // colonial colours are muted
    }
    // ---- MASSING: a stack of setback segments (bottom→top), each narrower → a unique silhouette ----
    var segN=1;
    if(bh>=28*KSP&&r()<0.55) segN++;
    if(bh>=48*KSP&&r()<0.60) segN++;
    if(bh>=70*KSP&&r()<0.45) segN++;
    var centered=r()<0.62, podium=(segN>=2&&r()<0.34);
    var segs=[], hleft=bh, pw2=bw, pdx=0;
    for(var sc=0;sc<segN;sc++){
      var last=(sc===segN-1),
          sh=last?hleft:Math.max(4,Math.round(hleft*((podium&&sc===0)?0.30:(0.34+r()*0.30))));
      if(sh>=hleft){ sh=hleft; last=true; }
      var sw=(sc===0)?bw:Math.max(6,pw2-(2+((r()*4)|0))),
          dx=(sc===0)?0:(centered?pdx+((pw2-sw)>>1):(r()<0.5?pdx:pdx+(pw2-sw)));
      segs.push({w:sw,h:sh,dx:dx});
      hleft-=sh; pw2=sw; pdx=dx;
      if(hleft<=0) break;
    }
    // y-offset of each segment measured from the building's overall top (top seg = 0)
    var yoff=0;
    for(var s2=segs.length-1;s2>=0;s2--){ segs[s2].top=yoff; segs[s2].bot=yoff+segs[s2].h; yoff+=segs[s2].h; }
    var tSeg=segs[segs.length-1], topW=tSeg.w, topDx=tSeg.dx;
    // ---- CROWN from this district's palette (no spindly tops on short buildings) ----
    var crown=d.crowns[(r()*d.crowns.length)|0];
    if(bh<30 && (crown==="spire"||crown==="antenna"||crown==="blade")) crown=(r()<0.5?"flat":"tank");
    if(REGION==="newengland" && bh < 54*KSP && crown!=="watertower"){  // low & mid-rise wear NE pitched roofs; tall
      var pr=(bseed>>>4)%3; crown=(pr===0?"gable":(pr===1?"gambrel":"hip")); nePitch=true;  // towers stay modern; brick
    }                                                                                       // midrises keep a wooden water tank
    // ---- WINDOW SYSTEM from this district's palette ----
    var winLayout=d.layouts[(r()*d.layouts.length)|0];
    var b={ x:x, w:bw, h:bh, y0:y0, type:"tower", seed:bseed, district:d.name, brick:d.brick||0,
            segs:segs, crown:crown, winLayout:winLayout, topW:topW, topDx:topDx,
            c: mixc(base, acc, accMix), accent:acc, accent2:acc2, winP:winPal, winHue:winHue,
            nePitch:nePitch, clap:neClap,
            win:[], st:[], gl:[], roof:[],
            ledge:r()<d.ledge, ledC:(r()*NEON.length)|0,
            sign:r()<d.sign, signC:(r()*NEON.length)|0, signY:2+((r()*6)|0),
            bill:(topW>=20&&r()<d.bill), billC:(r()*NEON.length)|0,
            dish:r()<d.dish, bands:(winLayout==="band"),
            fesc:((bw>=13&&r()<d.fesc)?(r()<0.5?0:1):-1),
            entr:r()<0.66, entrWarm:r()<0.7, greenRoof:(crown==="flat"&&r()<0.14),
            roofL:r()<0.28, awning:(r()<d.awn?(r()*NEON.length)|0:-1) };
    if(nePitch){ b.roofL=false; b.greenRoof=false; b.dish=false; }   // no mechanicals/dishes on a pitched roof
    // ---- windows generated PER SEGMENT in the chosen layout (stay within the silhouette) ----
    for(var s3=0;s3<segs.length;s3++){ var sg=segs[s3], x0=sg.dx+1, x1=sg.dx+sg.w-1,
        y0w=sg.top+3, y1w=Math.min(sg.bot, bh)-2;
      if(winLayout==="grid"){
        for(var wy=y0w;wy<y1w-2;wy+=6) for(var wx=x0;wx<x1-1;wx+=5)
          if(r()<0.86) b.win.push({x:wx,y:wy,w:2,h:3,on:r(),fl:r()<0.04?r()*2+1:0,h2:(r()<0.16?(r()*winPal.length)|0:winHue)});
      } else if(winLayout==="ribbon"){                 // vertical glass ribbons
        for(var wx=x0;wx<x1;wx+=3) for(var wy=y0w;wy<y1w-1;wy+=4)
          b.win.push({x:wx,y:wy,w:1,h:2,on:r(),fl:0,h2:(r()<0.10?(r()*winPal.length)|0:winHue)});
      } else if(winLayout==="band"){                   // horizontal window bands
        for(var wy=y0w;wy<y1w-1;wy+=4) for(var wx=x0;wx<x1-2;wx+=4)
          b.win.push({x:wx,y:wy,w:3,h:1,on:r(),fl:0,h2:(r()<0.12?(r()*winPal.length)|0:winHue)});
      } else if(winLayout==="punch"){                  // sparse punched openings (older midrise)
        for(var wy=y0w;wy<y1w-2;wy+=5) for(var wx=x0;wx<x1-1;wx+=4)
          if(r()<0.7) b.win.push({x:wx,y:wy,w:2,h:2,on:r(),fl:r()<0.03?r()*2+1:0,h2:(r()<0.2?(r()*winPal.length)|0:winHue)});
      } else {                                          // corp — big corporate glass panes
        for(var wy=y0w;wy<y1w-4;wy+=7) for(var wx=x0;wx<x1-2;wx+=6)
          if(r()<0.9) b.win.push({x:wx,y:wy,w:3,h:4,on:r(),fl:0,h2:(r()<0.14?(r()*winPal.length)|0:winHue)});
      }
    }
    if(b.win.length===0){                                    // EVERY building gets windows, however small
      b.win.push({x:2,y:4,w:2,h:2,on:0.3,fl:0,h2:winHue});
      if(bw>7) b.win.push({x:bw-4,y:4,w:2,h:2,on:0.7,fl:0,h2:winHue});
    }
    // precompute each window's day/night lit state (w.on is fixed → hoist the per-frame Math.sin out of draw)
    for(var wpi=0;wpi<b.win.length;wpi++){ var wp=b.win[wpi];
      wp.no = wp.on < (0.58+0.3*Math.sin(wp.on*9));    // lit at night?
      wp.do = wp.on < 0.08;                            // lit in daylight? (rare)
      wp.tv = ((wp.x*13+wp.y*7+bseed)%23)===0;         // a flickering TV lives here
      wp.hx = (wp.x*7+wp.y);                            // stable per-window hash (holiday tints/xmas)
    }
    var ns=1+((r()*3)|0);
    for(var si=0;si<ns;si++) b.st.push({x:1+((r()*(bw-4))|0), y:3+((r()*Math.max(1,bh-10))|0), w:1+((r()*2)|0), h:3+((r()*9)|0)});
    var glLen=Math.min(((bh-8)/4)|0, 5+((r()*3)|0));
    for(var gi=0;gi<glLen;gi++) b.gl.push((r()*511)|0);
    // rooftop mechanicals on flat/step/deco/glass tops — a richer, more lived-in cluster
    if((crown==="flat"||crown==="step"||crown==="deco"||crown==="glasstop")&&topW>=11){
      for(var rk=0,nrf=(r()<0.85?1+((r()*4)|0):0);rk<nrf;rk++)
        b.roof.push({x:1+((r()*(topW-5))|0), w:2+((r()*4)|0), h:2+((r()*4)|0), k:(r()*6)|0, blink:r()<0.26});
    }
    // rooftop life: a bar/lounge or a pool on some flat-topped buildings (not industrial)
    var rr2=r();
    b.rtop = ((crown==="flat"||crown==="step") && topW>=11 && d.name!=="industrial")
             ? (rr2<0.14?"bar":(rr2<0.22?"pool":"none")) : "none";
    // GROWTH: when in the city's life does this building appear? Small/outlying structures
    // are born early (a village), tall & central towers rise last (the metropolis core).
    // Uses a hash of bseed (NOT r()) so the existing city layout is byte-for-byte unchanged.
    var cen=1-Math.abs(x/WW-0.5)*2, hN=Math.min(1,bh/(112*KSP)), jit=((bseed*2654435761)>>>0)/4294967296;
    // NATURAL GROWTH: a plot is first settled with a small HOUSE (houseAge — the town spreads by
    // position), then redeveloped into this plot's DESIGNED building (bAge) only once the city has
    // grown enough to NEED that density — gated by how TALL the building is: a cottage formalises
    // almost at once, a downtown high-rise waits until the metropolis demands it.
    b.houseAge=Math.max(0.006, Math.min(0.42, 0.008+0.4*(0.6*cen+0.4*jit)));
    b.bAge=Math.max(b.houseAge, Math.min(0.95, b.houseAge+0.02+0.88*Math.pow(hN,1.3)));
    // G1: when in the SPACE AGE does this building transform? Tall/central towers convert
    // first, the sprawl follows — the future radiates outward from the core.
    var jit2=((bseed*40503+29)>>>0)%1000/1000;
    b.spAge=Math.max(0.04, Math.min(0.96, 0.06+0.8*(1-(0.5*cen+0.5*hN))+0.16*jit2-0.08));
    // C1: the size of the construction crew decides how fast this one goes up
    b.crew=1+(((bseed*40503+11)>>>0)%3);                       // 1-3 builders on site
    b.band=GROWBAND*(1.55-0.35*b.crew);                        // 3 builders finish in ~40% the time of 1
    blds.push(b); x+=bw+Math.round((d.gap[0]+((r()*d.gap[1])|0))*KSP);
  }
  return {y0:y0, blds:blds};
}
// New England: reskin the near-row building nearest each town-green anchor into a white steepled
// meeting-house (clapboard, no shopfront clutter, warm sanctuary windows). Deterministic per world.
function neChurches(){
  if(!near||!near.blds) return;
  var anchors=[0.4*WW, 0.6*WW];
  for(var a=0;a<anchors.length;a++){ var best=null, bd=1e9;
    for(var i=0;i<near.blds.length;i++){ var b=near.blds[i];
      if(b.type!=="tower"||b.h>Math.round(44*KSP)) continue;                     // a church is low & broad, not a tower
      var c=b.x+b.w/2, dd=Math.abs(c-anchors[a]); if(dd<bd){ bd=dd; best=b; } }
    if(best){ best.crown="steeple"; best.church=true; best.clap=true; best.nePitch=false;
      best.c=[222,218,206]; best.brick=0;                                        // white clapboard sanctuary
      best.sign=false; best.bill=false; best.ledge=false; best.awning=-1; best.dish=false;
      best.greenRoof=false; best.roofL=false; best.entrWarm=true; }
  }
}

function setup(scene,opts){
  SCENE = scene||"neon";
  opts = opts||{};
  ZOOM=opts.zoom||1;                          // draw at ZOOM canvas px per world px (still crisp: integer scaling)
  SW=Math.round((opts.cw||480)/ZOOM); SH=Math.round((opts.ch||270)/ZOOM);
  WOFF=opts.woff||0; WW=Math.max(opts.ww||SW, SW);
  // resolution scale: at PXK 4 ("64-bit" fine-pixel mode) the same desktop is 1.5× more
  // world-px wide, so world speeds & building masses scale by KSP to keep real-world
  // timing and screen composition identical. KSP=1 at the classic PXK 6 → exact no-op.
  // kspAuto (single-window hosts: desktop app / web / phone): the 6/pxk law assumes a
  // 2560-class monitor, so on a small screen the HUD/text stays physically huge. When the
  // canvas IS the whole world, scale features by the ACTUAL logical width against the
  // tuned 427px baseline instead — every resolution then gets the same composition.
  // (KDE multi-monitor slices keep the pxk law: per-screen widths differ and features
  // must stay world-consistent across bezels.)
  // kspw: reference width for feature scale — on a multi-monitor union canvas the HOST passes
  // one screen's logical width here so features scale to a MONITOR, not the whole desktop.
  KSP=opts.kspAuto ? Math.max(0.55,Math.min(2.2,((opts.kspw||opts.cw)||480)/427)) : 6/(opts.pxk||6);
  QUAL=opts.quality==="performance"?0:(opts.quality==="balanced"?1:2);
  // Foreground depth (world-px from the bottom). Default 26wp (≈156px) — room for a
  // sidewalk + 4 lanes and clears a standard ~44px taskbar. But if THIS screen reports
  // a taller bottom panel (taskbarWp), grow it so the lowest lane still sits above the
  // taskbar — the road auto-adjusts to any monitor/panel. Stays constant (=aligned across
  // bezels) whenever panels are the normal size, since 26 already covers them.
  GROUND=Math.max(26, (opts.taskbarWp||0)+18);
  SMALLW=WW<1000;                             // H1: one laptop screen carries the whole city
  HORIZON=SH-GROUND;                          // street baseline (back edge of sidewalk)
  buildWorld(lifeIndexOf(NOWOVR!=null?NOWOVR:Date.now()));
  maybeFetchWeather();          // seed the shared 10-min window on boot (draw() keeps it fresh thereafter)
  maybeFetchAirq();             // seed the shared 30-min air-quality window too
  tPrev=Date.now();
}
// Which of the city's LIVES is this? Every rebirth rolls a brand-new seed, so each life
// grows a one-of-a-kind city — new skyline, windows, crowns, parks, street furniture,
// birth order, everything — on top of its per-life architectural ERA. Life 0 keeps the
// original seed (1337), so the current city is unchanged.
function lifeIndexOf(now){ return Math.floor((now-GROW_EPOCH+GROW_OFFSET_DAYS*86400000+WORLD_SHIFT)/GROW_CYCLE); }
var curLife=null;
function buildWorld(li){
  curLife=li;
  var seed=1337+li*7919;                      // ► fresh DNA for every life of the city
  // GEOGRAPHY ROLL: is this city on a coast? (~60% are). No ocean → no harbour, no docks,
  // no boats, no sea life — the industrial edges become inland rail-yard districts instead.
  var geo=rng((seed+61)>>>0);
  hasOcean = (li===0) ? true : (geo()<0.6);   // life 0 keeps its ocean (the city you know)
  seaW = hasOcean ? (0.045+geo()*0.035) : 0;  // and how much OPEN water laps at the coast
  milFund = 0.25+geo()*0.7;                   // how well this civilization funds its defenders
  // MOUNTAIN roll: most lives grow up under a distant range (two ridges for depth);
  // the tallest peaks wear snow. Life 0 gets mountains (the city being watched).
  schoolAt=0.38+(((seed*40503+53)>>>0)%1000)/1000*0.16;       // when this life builds its school
  EDUB=schoolAt<0.46?0.012:0;                                  // early schooling → tech (space age) sooner (N8)
  POPK=(((li*2654435761+4441)>>>0)%1000)/1000;                 // relative bigness of this city (rush-jam factor)
  var mg=rng((seed+71)>>>0);
  mtsCache=null;                              // new life → new silhouette
  mts = (li===0||mg()<0.72) ? {far:[],near:[]} : null;
  if(mts){
    var MSC=KSP*Math.max(0.45,Math.min(1,WW/1300));               // small worlds get proportionate peaks
    var nF=6+((mg()*4)|0), nN=4+((mg()*4)|0), mi;
    for(mi=0;mi<nF;mi++){ var fh=(40+mg()*56)*MSC;                 // the pale back ridge — TALL
      mts.far.push({x:mg()*WW, w:(100+mg()*150)*MSC, h:fh, sn:(fh>66*MSC)||mg()<0.25, ph:mg()*9}); }
    for(mi=0;mi<nN;mi++){ var nh=(58+mg()*86)*MSC;                 // the bolder front ridge — the peaks
      mts.near.push({x:mg()*WW, w:(80+mg()*130)*MSC, h:nh, sn:(nh>92*MSC)||mg()<0.35, ph:mg()*9}); }   // clear the skyline
  }
  var eraNm=ERAS[eraPickOf(li)].name;
  cityName = nameOf(li, eraNm);                      // every civilization names itself
  teamName = teamOf(li, eraNm);                      // …and fields a team
  var tch=((li*2654435761+4441)>>>0);
  teamCols = [NEON[tch%NEON.length], NEON[(((tch>>>8)%NEON.length)+1)%NEON.length]];
  // three depth layers, generated across the WHOLE world so the skyline is continuous
  far  = makeLayer(seed+1, HORIZON-Math.round(14*KSP), 42, 96, 1.0);           // taller than before so buildings tower over the fixed-size people/trees (min floor keeps the near row ≥~3 storeys)
  mid  = makeLayer(seed+2, HORIZON-Math.round(6*KSP),  34, 80, 0.9);
  near = makeLayer(seed+3, HORIZON,    30, 64, 0.8);           // width/height/character per district
  if(REGION==="newengland") neChurches();                     // white steepled meeting-houses on the town greens
  // stars are the REAL Norwich night sky now — actual bright-star positions computed live
  // in drawSky() from the wall clock (they rise, transit & set correctly). Plus a field of
  // fainter "filler" stars scattered uniformly on the celestial sphere (random RA/Dec), which
  // are projected the SAME way, so the whole sky is full yet still rotates correctly for CT.
  var r=rng(seed+9), i; skyfill=[];
  for(i=0;i<640;i++){ var ra=r()*24, dec=Math.asin(2*r()-1)/DEG, mag=3.2+r()*2.6;   // a much richer field (was 220)
    skyfill.push([ra,dec,mag]); }
  // clouds, world-wide, drift deterministically — wisp/cumulus/high-streak mix (t: 0/1/2)
  r=rng(seed+5); clouds=[]; var nc=Math.round(WW/(QUAL===0?95:70))+3;
  for(i=0;i<nc;i++){ var ct=(i%7<3?0:(i%7<6?1:2));
    clouds.push({x0:r()*WW, y:ct===2?5+r()*(HORIZON*0.15):5+r()*(HORIZON*0.45), w:26+r()*46, h:5+r()*7, sp:0.004+r()*0.006, d:0.3+r()*0.4, t:ct}); }
  // cross-screen traffic: deterministic vehicles in 4 lanes over the whole world.
  // Mix of ordinary cars + yellow taxis + delivery vans → a real city fleet.
  r=rng(seed+7); cars=[]; var perLane=Math.round(WW/34);
  // a real mixed fleet: sedans, taxis, delivery vans, pickups, SUVs, compacts, sports cars, convertibles
  var carCols=["#ff5a5a","#4aa8ff","#ffe05a","#eef2ff","#ff7ad0","#6affc0","#c58cff","#ff9a3c","#3a4658","#8a939f",
    "#2ea6a6","#8a3b3b","#5566aa","#a7d84a","#d94b4b","#dfe6ef","#b0752f","#5a5f6a","#e08bbf","#3f7f5a"];
  for(i=0;i<perLane;i++) for(var ln=0;ln<LANE.length;ln++){
    var kk=r(), kind=kk<0.10?"taxi":kk<0.17?"van":kk<0.27?"pickup":kk<0.37?"suv":kk<0.47?"hatch":kk<0.54?"sport":kk<0.59?"convert":"car",
        col=kind==="taxi"?"#ffcf1f":(kind==="van"?["#e9edf2","#c9975a","#7a9bd0","#d06a5a","#6a8f5a","#b84a4a"][(r()*6)|0]:carCols[(r()*carCols.length)|0]);
    cars.push({lane:ln, x0:r()*WW, sp:0.005+r()*0.006, c:col, kind:kind});
  }
  // sidewalk pedestrians strolling along (deterministic → cross bezels in sync)
  r=rng(seed+23); peds=[]; var np=Math.round(WW/16);
  for(i=0;i<np;i++) peds.push({x0:r()*WW, dir:r()<0.5?1:-1, sp:0.0016+r()*0.0016,
    c:PEDC[(r()*PEDC.length)|0], sk:SKINC[(r()*SKINC.length)|0], row:(r()*2)|0});
  // crosswalks + pedestrian signals, spaced along the city
  r=rng(seed+29); crosswalks=[];
  for(var cwx=40; cwx<WW-20; cwx+=54+((r()*24)|0)){ if(inSea(cwx)) continue; crosswalks.push({x:cwx, ph:(r()*12000)|0, seed:(r()*1e6)|0}); }
  // drones weave over the city, world coordinates so they cross bezels in sync
  r=rng(seed+17); drones=[]; var dn=Math.round(WW/300)+3;   // uniform across screens (one city)
  for(i=0;i<dn;i++) drones.push({x0:r()*WW, vx:(r()<0.5?-1:1)*(0.0006+r()*0.0008), y:34+r()*90, ay:8+r()*14, wy:0.0009+r()*0.0009, ph:r()*6, led:r()<0.5});
  // bats (halloween), world-wide
  r=rng(seed+11); bats=[]; for(i=0;i<Math.round(WW/90)+2;i++) bats.push({x0:r()*WW, y:20+r()*80, sp:0.002+r()*0.003, ph:r()*6});
  // sagging cables between adjacent near rooftops
  r=rng(seed+13); cables=[];
  for(i=0;i<near.blds.length-1;i++){ var a=near.blds[i], nb=near.blds[i+1];
    if(a.type!=="park"&&nb.type!=="park"&&nb.x-(a.x+a.w)<8 && r()<0.5) cables.push({x1:a.x+a.w-2, y1:near.y0-a.h+2+((r()*6)|0), x2:nb.x+2, y2:near.y0-nb.h+2+((r()*6)|0), sag:3+((r()*4)|0)}); }
  // searchlights on a few of the tallest near towers
  r=rng(seed+19); searchlights=[];
  for(i=0;i<near.blds.length;i++){ var bb=near.blds[i];
    if(bb.h>40 && r()<0.25) searchlights.push({x:bb.x+(bb.w>>1), y:near.y0-bb.h, ph:r()*6, sp:0.0002+r()*0.0002}); }
  // G1: pair up adjacent tall towers for future sky-bridges (lit when both have transformed)
  skybridges=[]; var sbr=rng((seed+83)>>>0);
  for(var sbi=0;sbi<near.blds.length-1&&skybridges.length<Math.round(WW/90);sbi++){
    var b1=near.blds[sbi], b2=near.blds[sbi+1];
    if(b1.type==="park"||b2.type==="park"||b1.spAge===undefined||b2.spAge===undefined) continue;
    var gap=b2.x-(b1.x+b1.w);
    if(gap<3||gap>15||b1.h<34*KSP||b2.h<34*KSP||sbr()<0.55) continue;
    skybridges.push({i:sbi, j:sbi+1, f:0.45+sbr()*0.35});
  }
  // ---- street-level life: lamps + furniture that make the city feel lived-in ----
  r=rng(seed+31); sprops=[]; busstops=[];
  for(var lx=10; lx<WW; lx+=17+((r()*7)|0)){ if(inSea(lx)) continue; sprops.push({x:lx, k:"lamp", s:(r()*1e6)|0}); }   // street lamps (none in the sea)
  var furn=["hydrant","trash","bench","mailbox","newsstand","busstop","planter","foodcart","hydrant","trash","bench","planter"];
  for(var fpx=6; fpx<WW; fpx+=9+((r()*15)|0)){
    if(inSea(fpx)) continue;
    var kd=furn[(r()*furn.length)|0]; sprops.push({x:fpx, k:kd, s:(r()*1e6)|0});
    if(kd==="busstop") busstops.push(fpx);
  }
  // steam vents / manholes — a wisp of steam drifts up (classic lived-in city detail)
  r=rng(seed+37); vents=[];
  for(var vx=20; vx<WW; vx+=40+((r()*30)|0)){ if(inSea(vx)) continue; vents.push({x:vx, ph:r()*6}); }
  // pigeons: some perch on the wires, some peck along the sidewalk
  r=rng(seed+41); pigeons=[];
  for(i=0;i<Math.round(WW/40)+2;i++) pigeons.push({x:r()*WW, ground:r()<0.55, y:20+r()*70, ph:r()*6, sp:0.02+r()*0.03});
  // district street life: dockside cargo cranes + container stacks (industrial only)
  r=rng(seed+43); docks=[];
  for(var dkx=8; dkx<WW; dkx+=13+((r()*10)|0)){ if(districtAt(dkx).name!=="industrial"||inSea(dkx)) continue;
    docks.push({x:dkx, k:(r()<0.34?"crane":"containers"), s:(r()*1e6)|0, h:16+((r()*16)|0), ph:r()*6}); }
  // buskers on the neon strip (a musician + a small gathered crowd), entertainment only
  r=rng(seed+47); buskers=[];
  for(var bkx=12; bkx<WW; bkx+=40+((r()*36)|0)){ if(districtAt(bkx).name!=="neon") continue;
    buskers.push({x:bkx, s:(r()*1e6)|0}); }
  // subway entrances: stairway kiosks on the sidewalk (kept out of the industrial edges)
  r=rng(seed+67); subways=[];
  var sfr=[0.12,0.36,0.58,0.84];
  for(i=0;i<sfr.length;i++){ var swx=Math.round((sfr[i]+(r()-0.5)*0.05)*WW);
    if(districtAt(swx).name==="industrial"||inSea(swx)) swx=Math.round(WW*(0.35+0.3*r()));
    subways.push({x:swx, s:(r()*1e6)|0, k:i}); }
  // construction sites: a tower crane + a tower that grows a floor a day over real weeks
  r=rng(seed+59); sites=[];
  sites.push({x:Math.round(0.53*WW), w:20, floors:17, fh:4, seed:(r()*1e6)|0, offset:r()*24, dpf:1.3});
  sites.push({x:Math.round(0.33*WW), w:15, floors:11, fh:4, seed:(r()*1e6)|0, offset:r()*24, dpf:1.7});
  // waterfront: boats patrolling the two industrial harbours (world edges = the coast)
  r=rng(seed+53); boats=[];
  if(hasOcean){ var iw=Math.round(0.11*WW);   // industrial water span each edge
    var zones=[[4, iw-3],[WW-iw+3, WW-4]];
    for(i=0;i<8;i++){ var zn=zones[i%2];
      boats.push({za:zn[0], zb:zn[1], sp:1.4+r()*2.2, ph:r()*2, y:2+((r()*10)|0),
        kind:["ferry","sail","cargo","sail","tug"][(r()*5)|0], s:(r()*1e6)|0}); } }
  // helipads (from buildings crowned with one) — choppers land here
  helipads=[];
  for(var hlL=0;hlL<2;hlL++){ var ly=hlL?mid:near;
    for(i=0;i<ly.blds.length;i++){ var hb=ly.blds[i];
      if(hb.crown==="helipad") helipads.push({x:hb.x+hb.topDx+(hb.topW>>1), y:(hb.y0-hb.h)-1}); } }
  // airport on the city's edge (a control tower + beacon; planes depart/arrive from here)
  airportX=Math.round(WW*0.8);
}
var cars=[], sprops=[], busstops=[], vents=[], pigeons=[], docks=[], buskers=[], boats=[], helipads=[], sites=[];
var hasOcean=true;   // set per life in buildWorld — landlocked cities have no waterfront at all
var subways=[];      // street-level subway entrances (generated per life)
var skybridges=[];   // G1: lit tube bridges between adjacent transformed towers
var seaW=0;          // open-sea width (world fraction per side of the seam) — 0 on landlocked lives
var milFund=0.5;     // this life's military funding level 0..1 (the election announces it)
var cityName="NEO NORWICH";   // this life's name (theme-flavoured, set in buildWorld)
var curWar=null;     // active/finished war state for this life (null = peaceful life)
var teamName="VOLTS", teamCols=["#05d9e8","#ff2a9d"];   // this life's sports franchise
var curEcon=0.5;     // 0 bust … 1 boom (1-2 slow swings per life)
var wetness=0;       // how rain-soaked the streets are (drives puddles, dries out after)

// ---- deterministic scheduled crossers (identical on every screen) ----
// A vehicle enters at one end of the world and crosses; visible only during its
// timetable window, so it "runs on a schedule" and lines up across every screen.
function crosser(now, period, speed, len, dwellFrac){
  speed*=KSP;                                                 // world speeds scale with resolution
  var span=WW+len*2, dur=Math.min(span/speed, period*(dwellFrac||0.5));
  var idx=Math.floor(now/period), ph=now-idx*period;
  if(ph>dur) return null;
  var dir=(idx%2===0)?1:-1;
  var x=dir>0 ? (-len+speed*ph) : (WW+len-speed*ph);
  return { x:x, dir:dir, len:len, idx:idx };
}
var TRSTOPS=[0.18,0.5,0.78];                                   // elevated-station positions (world fractions)
var TRLINE=["#e0483a","#3a70d0","#3ac86a","#eec83a","#b05ad0","#ff8a3c"];   // the LINES: red/blue/green/yellow/purple/orange
function trainNow(now){
  // each run is ONE line (consistent colour end to end) and calls at every station:
  // constant speed between platforms, a ~2.6s dwell at each. Pure function of the clock.
  var hr=nowDate().getHours();
  var rush=(hr>=7&&hr<9)||(hr>=16&&hr<19);
  var period=rush?34000:40000, len=72, v=(rush?0.05:0.04)*KSP, DW=2600, span=WW+len*2;
  var idx=Math.floor(now/period), e=now-idx*period, dir=(idx%2===0)?1:-1;
  var stops=[], k;
  for(k=0;k<TRSTOPS.length;k++){ var sx=Math.round(TRSTOPS[k]*WW);
    stops.push(dir>0 ? sx-36+len : (WW+len)-(sx+36)); }        // path distance where the train pauses, centred on the platform
  stops.sort(function(a,b){return a-b;});
  var s=0, rem=e;
  for(k=0;k<=stops.length;k++){
    var target=(k<stops.length)?stops[k]:span, tt=(target-s)/v;
    if(rem<tt){ s+=rem*v; return {x:(dir>0?-len+s:WW+len-s), dir:dir, len:len, idx:idx, stopped:false}; }
    rem-=tt; s=target;
    if(k<stops.length){ if(rem<DW) return {x:(dir>0?-len+s:WW+len-s), dir:dir, len:len, idx:idx, stopped:true}; rem-=DW; }
  }
  return null;                                                  // run complete — next departure per the timetable
}
var EMV_TYPES=[
  { k:"police",    w:11, body:"#eef1f7", trim:"#1b2a55", lights:["#ff2233","#2a63ff"] },
  { k:"ambulance", w:12, body:"#f6f8fc", trim:"#d42a2a", lights:["#ff2233","#f2f6ff"] },
  { k:"fire",      w:14, body:"#d81f1f", trim:"#6f0e0e", lights:["#ff2233","#ff8a1a"] }
];

// an emergency vehicle drawn at a WORLD x (handles bezel wrap + strobes/glow)
function drawEmv(g, worldX, ev, dir, lane, L, now){
  var ew=ev.w, ey=HORIZON+LANE[lane].o, ex=worldX-WOFF;
  var vis=[ex]; if(ex-WW>-ew-8) vis.push(ex-WW); if(ex+WW<SW+ew+8) vis.push(ex+WW);
  for(var di=0;di<vis.length;di++){ var X=vis[di]|0; if(X+ew<-8||X>SW+8) continue;
    var eph=(Math.floor(now/100))%2, cNow=ev.lights[eph], cAlt=ev.lights[eph^1];
    g.globalAlpha=0.2+0.10*Math.sin(now*0.03); g.fillStyle=cNow; g.fillRect(X-4,ey-3,ew+8,9); g.globalAlpha=1;
    g.fillStyle=ev.body; g.fillRect(X,ey,ew,3);
    g.fillStyle="rgba(255,255,255,0.3)"; g.fillRect(X,ey,ew,1);                // roof sheen
    g.fillStyle=ev.trim; g.fillRect(X,ey+2,ew,1);
    g.fillStyle="#9fb8d8"; g.fillRect(X+(dir>0?1:ew-3),ey,2,1);
    for(var eg=3;eg<ew-3;eg+=3) g.fillRect(X+eg,ey,1,1);                       // side glass
    g.fillStyle="#0b0b10"; g.fillRect(X+1,ey+3,2,1); g.fillRect(X+ew-3,ey+3,2,1);   // wheels
    g.fillStyle=cNow; g.fillRect(X+1,ey-1,2,1);
    g.fillStyle=cAlt; g.fillRect(X+ew-3,ey-1,2,1);
    if(L<0.6){ g.fillStyle="rgba(255,240,170,0.95)"; g.fillRect(X+(dir>0?ew:-2),ey+1,2,1);
      g.fillStyle="rgba(255,60,60,0.9)"; g.fillRect(X+(dir>0?-1:ew),ey+1,1,1); }
  }
}

// A rare, deterministic traffic incident: two cars collide, a jam builds behind them,
// EMS arrives after a random-but-predetermined delay, works the scene, then it clears.
// Derived purely from the clock so every screen renders the identical incident.
function crashNow(now){
  var SLOT=7*60000;                        // one potential incident window per ~7 min
  var idx=Math.floor(now/SLOT);
  var r=rng((idx*9301+49297)>>>0);
  if(r()>0.42) return null;                // most windows have NO crash — keeps it occasional
  var lane=(r()*LANE.length)|0, dir=LANE[lane].d;
  var cx=60+r()*(WW-120);                  // world x of the wreck (kept off the far ends)
  var t0=r()*(SLOT*0.30);                  // when in the window it happens
  var arrive=16000+r()*42000;              // 16–58s until EMS reaches the scene (organic)
  var work=10000+r()*12000;                // on-scene time before it clears
  var life=arrive+work+5000;
  var tp=now-idx*SLOT-t0;                   // ms since the collision
  if(tp<0||tp>life) return null;
  return { lane:lane, dir:dir, x:cx, tp:tp, arrive:arrive, work:work, life:life,
           et:EMV_TYPES[(r()*EMV_TYPES.length)|0], col:["#d0453e","#c8853f","#3f74c8"][(r()*3)|0], idx:idx };
}

// a tiny pixel pedestrian (2 wide, 3 tall) with a subtle walking bob — sized to match the cars
var HAIRC=["#2a2018","#171717","#7a5a2a","#5a4030","#8a8a8a","#3a2c1e","#d8b048","#9a4a2a","#b0b0b8"];   // hair tones (+ blonde, auburn, silver)
var PANTC={};                                     // memo: shirt colour -> trouser shade
function pantsOf(c){ var v=PANTC[c]; if(v) return v;
  if(c.charCodeAt(0)!==35||c.length<7){ PANTC[c]=c; return c; }
  v="rgb("+((parseInt(c.substr(1,2),16)*0.5)|0)+","+((parseInt(c.substr(3,2),16)*0.5)|0)+","+((parseInt(c.substr(5,2),16)*0.55)|0)+")";
  PANTC[c]=v; return v; }
// a PROPER pixel person: hair, face with an eye, shoulders, swinging arms, two-tone
// clothes, striding legs and shoes (4x7 — feet still land at y+2, so every call site
// keeps working; heads just reach higher)
function drawPerson(g,x,y,cloth,skin,bob){
  var yy=(y-bob)|0, X=x|0;
  var hseed=(cloth.charCodeAt(1)+cloth.charCodeAt(3)+skin.charCodeAt(2));
  var pants=pantsOf(cloth);
  g.fillStyle=HAIRC[hseed%HAIRC.length];
  g.fillRect(X,yy-4,2,1); g.fillRect(X+((hseed&1)?1:-0),yy-3,1,1);      // hair + a little sweep
  g.fillStyle=skin; g.fillRect(X,yy-3,2,1);                             // face…
  g.fillStyle="rgba(20,16,14,0.85)"; g.fillRect(X+((hseed>>2)&1),yy-3,1,1);   // …with an eye
  g.fillStyle=cloth; g.fillRect(X-1,yy-2,4,1);                          // shoulders
  g.fillRect(X,yy-1,2,2);                                               // jacket
  if(bob){ g.fillStyle=cloth; g.fillRect(X-1,yy-1,1,1); g.fillRect(X+2,yy,1,1);      // arms swing
           g.fillStyle=skin;  g.fillRect(X-1,yy,1,1);   g.fillRect(X+2,yy+1,1,1); }  // hands
  else   { g.fillStyle=cloth; g.fillRect(X-1,yy-1,1,2); g.fillRect(X+2,yy-1,1,2);
           g.fillStyle=skin;  g.fillRect(X-1,yy+1,1,1); g.fillRect(X+2,yy+1,1,1); }
  g.fillStyle=pants;
  if(bob){ g.fillRect(X-1,yy+1,1,1); g.fillRect(X+1,yy+1,1,1);          // legs mid-stride
           g.fillStyle="#1c1a18"; g.fillRect(X-1,yy+2,1,1); g.fillRect(X+1,yy+2,1,1); }   // shoes
  else   { g.fillRect(X,yy+1,2,1);
           g.fillStyle="#1c1a18"; g.fillRect(X,yy+2,2,1); }
  // deterministic accessories — a hat or a carried bag — add crowd variety with no new call args
  var acc=hseed%9;
  if(acc<2){ g.fillStyle=PEDC[(hseed*7)%PEDC.length]; g.fillRect(X-1,yy-4,3,1); g.fillRect(X,yy-5,2,1); }   // a hat (brim + crown) over the hair
  else if(acc<4){ g.fillStyle=pantsOf(cloth); g.fillRect(X+((hseed&1)?-2:2),yy-1,1,2); }                    // a shoulder bag at the side
}
// a small realistic vehicle (8 wide × 4 tall so it out-scales a 3wp pedestrian).
// kind: "car" (default) | "taxi" (yellow cab + roof light) | "van" (boxy delivery)
// two-wheelers: a motorcycle, a kick-scooter, or a bicycle, ridden along an inner lane. worldX in world px
// (handles bezel wrap like the other cross-city vehicles). Small — they read as nimble traffic between cars.
function drawBike(g,worldX,dir,L,now,kind){
  var night=L<0.55;
  for(var wp=-1;wp<=1;wp++){ var x=(worldX-WOFF+wp*WW)|0; if(x<-8||x>SW+8) continue;
    var y=HORIZON+LANE[dir>0?1:2].o;
    var rc=PEDC[((worldX|0)*7+kind.length)%PEDC.length], sk=SKINC[(((worldX|0)>>3)+kind.length)%SKINC.length], lift=(Math.floor(now/160)+x)&1;
    g.fillStyle="#0b0b10";
    if(kind==="bicycle"){
      g.fillRect(x,y+1,1,1); g.fillRect(x+5,y+1,1,1);                                   // two thin wheels
      g.fillStyle=L>0.5?"#6a7080":"#30343e"; g.fillRect(x+1,y,4,1); g.fillRect(x+2,y-1,1,1);   // frame + seatpost
      g.fillStyle=rc; g.fillRect(x+2,y-3,2,2); g.fillStyle=sk; g.fillRect(x+2,y-4,2,1);        // upright rider + head
      g.fillStyle=rc; g.fillRect(x+(dir>0?4:1),y-2,1,1);                                 // arm reaching to the bars
      g.fillStyle=night?"#1c1a18":"#20242c"; g.fillRect(x+2,y+2-lift,1,1);               // pedalling leg
    } else if(kind==="scooter"){
      g.fillRect(x,y+1,1,1); g.fillRect(x+4,y+1,1,1);                                    // small wheels
      g.fillStyle=L>0.5?"#8a909c":"#3a3e48"; g.fillRect(x,y,5,1); g.fillRect(x+(dir>0?4:0),y-2,1,2);  // deck + steering stem
      g.fillStyle=rc; g.fillRect(x+2,y-3,2,2); g.fillStyle=sk; g.fillRect(x+2,y-4,2,1);        // standing rider
    } else {                                                                            // motorcycle
      g.fillRect(x,y+1,2,1); g.fillRect(x+5,y+1,2,1);                                    // fat tyres
      g.fillStyle=rc; g.fillRect(x+1,y-1,5,2); g.fillStyle=L>0.5?"#20242c":"#12151c"; g.fillRect(x+1,y,5,1);  // tank/body
      g.fillStyle=sk; g.fillRect(x+(dir>0?2:3),y-3,2,1); g.fillStyle=rc; g.fillRect(x+(dir>0?2:3),y-2,2,1);   // hunched rider
      if(night){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,240,170,0.9)"; g.fillRect(x+(dir>0?7:-1),y,1,1); g.globalCompositeOperation="source-over"; }  // headlight
    }
  }
}
// NIGHT WINDOW VIGNETTES: a few windows show life after dark — a flickering blue TV, a warm kitchen glow, a plant on the sill.
function drawWindowVignettes(g,L,now){
  if(L>0.52||!near||!near.blds) return; var night=1-L;
  for(var i=0;i<near.blds.length;i++){ var b=near.blds[i];
    if(b.type==="park"||b.nePitch||b.h<10) continue;
    var h=((b.seed*2654435761)>>>0); if((h%3)!==0) continue;                 // ~1/3 of blocks show a vignette
    var top=near.y0-b.h, wx=b.x+2+(h%Math.max(1,b.w-4)), wy=top+3+((h>>8)%Math.max(1,b.h-6));
    var sx=wx-WOFF; if(sx>SW+4&&sx-WW>-4)sx-=WW; if(sx<-4&&sx+WW<SW+4)sx+=WW; if(sx<-2||sx>SW+2) continue;
    var kind=(h>>4)%3;
    if(kind===0){ var fl=(Math.floor(now/140)+i)%5, br=fl<2?0.55:(fl<4?0.28:0.72);              // TV: blue flicker
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(90,150,255,"+(br*night).toFixed(2)+")"; g.fillRect(sx|0,wy|0,2,2); g.globalCompositeOperation="source-over"; }
    else if(kind===1){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,168,70,"+(0.5*night).toFixed(2)+")"; g.fillRect(sx|0,wy|0,2,2); g.globalCompositeOperation="source-over"; }  // kitchen glow
    else { g.fillStyle="#3fae6a"; g.fillRect(sx|0,(wy+1)|0,1,1); g.fillStyle="#8a5a3a"; g.fillRect(sx|0,(wy+2)|0,1,1); }   // a sill plant
  }
}
// a cat prowling a near rooftop at night (glowing eyes), patrolling one roof then the next
function drawRoofCat(g,L,now){
  if(L>0.45||!near||!near.blds||near.blds.length<3) return;
  var bi=Math.floor(now/23000)%near.blds.length, b=near.blds[bi]; if(b.type==="park"||b.h<8) return;
  var top=near.y0-b.h, ph=(now%23000)/23000, wx=b.x+2+ph*(b.w-4), sx=wx-WOFF;
  if(sx>SW+4&&sx-WW>-4)sx-=WW; if(sx<-4&&sx+WW<SW+4)sx+=WW; if(sx<-2||sx>SW+2) return;
  var step=(Math.floor(now/220))&1;
  g.fillStyle="#15151b"; g.fillRect(sx|0,(top-2)|0,3,1); g.fillRect((sx+2)|0,(top-3)|0,1,1);   // body + head
  g.fillRect(sx|0,(top-3)|0,1,1);                                                                // tail up
  g.fillRect(sx|0,(top-1+step)|0,1,1); g.fillRect((sx+2)|0,(top-1+(1-step))|0,1,1);              // padding legs
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,235,120,0.85)"; g.fillRect((sx+2)|0,(top-3)|0,1,1); g.globalCompositeOperation="source-over";  // eye-shine
}
// a little snowman the neighbourhood builds while the snow lies (coal eye, carrot nose, twig arms, top hat)
function drawSnowman(g,x,y){ x=x|0; y=y|0;
  g.fillStyle="#eef4ff"; g.fillRect(x,y-2,3,2); g.fillRect(x,y-4,3,2); g.fillRect(x,y-6,2,2);   // three stacked balls
  g.fillStyle="rgba(180,200,225,0.6)"; g.fillRect(x+2,y-4,1,2);                                  // shaded side
  g.fillStyle="#5a4028"; g.fillRect(x-1,y-4,1,1); g.fillRect(x+3,y-4,1,1);                        // twig arms
  g.fillStyle="#1c1a18"; g.fillRect(x,y-6,1,1);                                                   // coal eye
  g.fillStyle="#e0883a"; g.fillRect(x+2,y-5,1,1);                                                 // carrot nose
  g.fillStyle="#d23a3a"; g.fillRect(x,y-4,2,1);                                                   // red scarf
  g.fillStyle="#2a2c34"; g.fillRect(x,y-7,2,1);                                                   // top hat
}
function drawCar(g,x,y,col,dir,L,kind){
  x=x|0; y=y|0;
  var hover=curSpace>0.55;                                         // G1: the fleet converts to hovercraft
  if(hover) y-=1;
  var shd=pantsOf(col);                                            // darker lower-body shade
  var night=L<0.55, glass="#bfe3ff";
  // shared running gear for the passenger bodies: wheels (or hover underglow) + head/tail lamps at the body ends
  function gear(len){
    if(hover){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(122,245,255,0.5)"; g.fillRect(x+1,y+2,len-2,1); g.globalCompositeOperation="source-over"; }
    else{ g.fillStyle="#0b0b10"; g.fillRect(x+2,y+2,2,1); g.fillRect(x+len-4,y+2,2,1); g.fillStyle="rgba(0,0,0,0.25)"; g.fillRect(x+4,y+2,len-8,1); }
    if(night){ g.fillStyle="rgba(255,240,170,0.95)"; g.fillRect(x+(dir>0?len:-1),y,1,1); g.fillStyle="rgba(255,60,60,0.9)"; g.fillRect(x+(dir>0?-1:len),y,1,1); }
  }
  if(kind==="van"){
    g.fillStyle=col; g.fillRect(x,y-3,10,5);                       // tall box body
    g.fillStyle=shd; g.fillRect(x,y+1,10,1);                       // rocker shade
    g.fillStyle="rgba(255,255,255,0.18)"; g.fillRect(x,y-3,10,1);  // roof sheen
    g.fillStyle=glass; g.fillRect(x+(dir>0?8:1),y-2,2,1);          // cab window
    if(hover){ g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(122,245,255,0.5)"; g.fillRect(x+1,y+2,8,1);
      g.globalCompositeOperation="source-over"; }
    else{ g.fillStyle="#0b0b10"; g.fillRect(x+1,y+2,2,1); g.fillRect(x+7,y+2,2,1); }
    if(night){ g.fillStyle="rgba(255,240,170,0.95)"; g.fillRect(x+(dir>0?10:-1),y,1,1);
      g.fillStyle="rgba(255,60,60,0.9)"; g.fillRect(x+(dir>0?-1:10),y,1,1); }
    return;
  }
  if(kind==="pickup"){                                             // cab at the leading half, open bed behind
    g.fillStyle=col; g.fillRect(x,y,11,1); g.fillStyle=shd; g.fillRect(x,y+1,11,1);
    var cabF=dir>0?6:1, bedF=dir>0?1:7;
    g.fillStyle=col; g.fillRect(x+cabF,y-2,4,1);                   // cab roof
    g.fillStyle=glass; g.fillRect(x+cabF,y-1,4,1);                 // cab window
    g.fillStyle=shd; g.fillRect(x+bedF,y-1,4,1);                   // low bed wall (rear)
    g.fillStyle="rgba(255,255,255,0.2)"; g.fillRect(x+cabF,y-2,4,1);
    gear(11); return;
  }
  if(kind==="suv"){                                                // taller, boxy, full-length roof
    g.fillStyle=col; g.fillRect(x,y-1,11,2); g.fillStyle=shd; g.fillRect(x,y+1,11,1);
    g.fillStyle=col; g.fillRect(x+2,y-3,7,1);                      // high roof
    g.fillStyle=glass; g.fillRect(x+2,y-2,7,1);
    g.fillStyle=col; g.fillRect(x+5,y-2,1,1);                      // B-pillar
    g.fillStyle="rgba(255,255,255,0.2)"; g.fillRect(x+2,y-3,7,1);
    gear(11); return;
  }
  if(kind==="hatch"){                                              // short compact, cabin runs to the tail
    g.fillStyle=col; g.fillRect(x,y,9,1); g.fillStyle=shd; g.fillRect(x,y+1,9,1);
    g.fillStyle=col; g.fillRect(x+(dir>0?1:2),y-2,6,1);
    g.fillStyle=glass; g.fillRect(x+(dir>0?1:2),y-1,6,1);
    g.fillStyle="rgba(255,255,255,0.2)"; g.fillRect(x+(dir>0?1:2),y-2,6,1);
    gear(9); return;
  }
  if(kind==="sport"){                                              // low & long, small canopy, tail spoiler
    g.fillStyle=col; g.fillRect(x,y,11,1); g.fillStyle=shd; g.fillRect(x,y+1,11,1);
    g.fillStyle=glass; g.fillRect(x+(dir>0?3:4),y-1,4,1);          // low canopy (no tall roof)
    g.fillStyle=col; g.fillRect(x+(dir>0?9:1),y-1,1,1);            // spoiler nub
    g.fillStyle="rgba(255,255,255,0.24)"; g.fillRect(x,y,11,1);
    gear(11); return;
  }
  if(kind==="convert"){                                           // open-top: dark interior + tiny windshield
    g.fillStyle=col; g.fillRect(x,y,11,1); g.fillStyle=shd; g.fillRect(x,y+1,11,1);
    g.fillStyle="#20242c"; g.fillRect(x+(dir>0?2:4),y-1,5,1);      // open cockpit
    g.fillStyle=glass; g.fillRect(x+(dir>0?7:3),y-2,1,1);          // windshield
    g.fillStyle="rgba(255,255,255,0.2)"; g.fillRect(x,y,11,1);
    gear(11); return;
  }
  // sedan (default) + taxi variant: hood + glasshouse + trunk, front biased by direction
  g.fillStyle=col; g.fillRect(x,y,11,1);                           // beltline
  g.fillStyle=shd; g.fillRect(x,y+1,11,1);                         // lower body / rockers
  g.fillStyle=col; g.fillRect(x+(dir>0?2:3),y-2,6,1);              // cabin roof
  g.fillStyle=glass; g.fillRect(x+(dir>0?2:3),y-1,6,1);            // glasshouse band
  g.fillStyle=col; g.fillRect(x+(dir>0?4:5),y-1,1,1);              // B-pillar
  g.fillStyle="rgba(255,255,255,0.2)"; g.fillRect(x+(dir>0?2:3),y-2,6,1);   // roof sheen
  g.fillStyle="rgba(255,255,255,0.14)"; g.fillRect(x,y,11,1);      // belt sheen
  if(kind==="taxi"){
    g.fillStyle="#1b1b22"; for(var ck=1;ck<10;ck+=2) g.fillRect(x+ck,y+1,1,1);   // checker band
    g.fillStyle="#ffe9a0"; g.fillRect(x+(dir>0?4:6),y-3,2,1);      // rooftop TAXI light
  }
  gear(11);
}
// pedestrian-crossing signal phase: 0 green (cars go), 1 yellow, 2 red (walk). Mostly green.
function sig(now,ph){ var t=(now+ph)%12000; return t<8500?0:(t<9000?1:2); }

// ---- fireworks ----
// THE GRAND FIREWORKS SHOW — deterministic shells on a timetable (identical on every
// monitor, always running through celebration nights, with periodic finale waves).
var FWCOLS=[[255,214,90],[255,80,70],[90,220,255],[255,110,220],[120,255,150],[240,244,255]];
function fireworksLevel(nd,L){
  if(L>0.32) return 0;
  var m=nd.getMonth()+1,d=nd.getDate(),h=nd.getHours();
  var lvl=0;
  if(m===7&&(d>=3&&d<=5)) lvl=(d===4)?2:1;                      // the 4th gets the grand show; 3rd & 5th still celebrate
  if((m===12&&d===31&&h>=18)||(m===1&&d===1&&h<3)) lvl=2;        // New Year's Eve into the small hours
  if(lvl>0&&((Math.floor(nd.getMinutes()/2))%4===0)) lvl++;      // FINALE waves every few minutes
  return lvl;
}
function drawFireworksShow(g,now,nd,L){
  var lvl=fireworksLevel(nd,L); if(lvl<=0||cityPhase==="apoc") return;
  var nSh=4+lvl*3, SLOT=2600;
  g.globalCompositeOperation="lighter";
  for(var k=0;k<nSh;k++){
    var t5=now+k*523, idx=Math.floor(t5/SLOT), age=t5-idx*SLOT;
    var h5=((idx*2654435761+k*7919)>>>0);
    if((h5%10)>=8) continue;                                     // a few lanes rest each volley
    var wx5=(h5%WW), sx5=wx5-WOFF;
    if(sx5>SW+30&&sx5-WW>-30) sx5-=WW; if(sx5<-30&&sx5+WW<SW+30) sx5+=WW;
    if(sx5<-26||sx5>SW+26) continue;
    var apex=26+((h5>>>6)%44), col=FWCOLS[(h5>>>3)%FWCOLS.length];
    if(age<650){ var u5=age/650, ry=HORIZON-8-(HORIZON-8-apex)*u5;                 // the shell climbs
      g.fillStyle=rgba([255,240,200],0.9); g.fillRect(sx5|0,ry|0,1,2);
      g.fillStyle=rgba([255,200,120],0.4); g.fillRect(sx5|0,(ry+3)|0,1,2);
    } else {                                                                       // BURST — many shell types
      var b5=(age-650)/1900; if(b5>1) continue;
      var R=b5*(11+lvl*4+((h5>>>9)%8)), fade=1-b5, typ=(h5>>>13)%11;
      var col2=FWCOLS[((h5>>>3)+3)%FWCOLS.length];
      if(typ===1){                                                                 // WILLOW: long golden tails
        var wcol=[255,208,110];
        for(var i5=0;i5<14;i5++){ var a5=i5*Math.PI*2/14+(h5%7)*0.13;
          for(var tr5=0;tr5<4;tr5++){ var rr5=R*(1-tr5*0.16), dr5=b5*b5*(22+tr5*7);
            g.fillStyle=rgba(wcol,(0.75-tr5*0.16)*fade);
            g.fillRect((sx5+Math.cos(a5)*rr5)|0,(apex+Math.sin(a5)*rr5*0.7+dr5)|0,1,1); } } }
      else if(typ===2){                                                            // RING: a perfect hoop
        for(var i5=0;i5<26;i5++){ var a5=i5*Math.PI*2/26;
          g.fillStyle=rgba(col,0.9*fade);
          g.fillRect((sx5+Math.cos(a5)*R)|0,(apex+Math.sin(a5)*R*0.9+b5*b5*8)|0,1,1); } }
      else if(typ===3){                                                            // CROSSETTE: rays that split
        for(var i5=0;i5<6;i5++){ var a5=i5*Math.PI*2/6+(h5%5)*0.2;
          var bx5=sx5+Math.cos(a5)*R*0.6, by5=apex+Math.sin(a5)*R*0.5+b5*b5*12;
          g.fillStyle=rgba(col,0.85*fade); g.fillRect(bx5|0,by5|0,1,1);
          if(b5>0.42){ var sb5=(b5-0.42)/0.58;
            for(var q5=0;q5<4;q5++){ var qa5=a5+q5*Math.PI/2+0.4;
              g.fillStyle=rgba(col2,0.8*fade);
              g.fillRect((bx5+Math.cos(qa5)*sb5*7)|0,(by5+Math.sin(qa5)*sb5*6+sb5*sb5*5)|0,1,1); } } } }
      else if(typ===4){                                                            // DOUBLE-BREAK: two colours
        for(var i5=0;i5<16;i5++){ var a5=i5*Math.PI*2/16+(h5%7)*0.13;
          g.fillStyle=rgba(col,0.85*fade);
          g.fillRect((sx5+Math.cos(a5)*R)|0,(apex+Math.sin(a5)*R*0.85+b5*b5*14)|0,1,1);
          g.fillStyle=rgba(col2,0.8*fade);
          g.fillRect((sx5+Math.cos(a5+0.2)*R*0.5)|0,(apex+Math.sin(a5+0.2)*R*0.42+b5*b5*9)|0,1,1); } }
      else if(typ===5){                                                            // STROBE: blinding random pops
        for(var i5=0;i5<10;i5++){ var sh5=((h5+i5*7919)>>>0);
          if(((Math.floor(now/70)+i5)%4)!==0) continue;
          g.fillStyle=rgba([255,255,255],0.95*fade);
          g.fillRect((sx5+((sh5%19)-9)*b5)|0,(apex+(((sh5>>>5)%17)-8)*b5*0.9)|0,2,2); } }
      else if(typ===6){                                                            // PALM: thick rising arms
        for(var i5=0;i5<5;i5++){ var a5=-Math.PI*0.15-i5*Math.PI*0.175;
          for(var seg5=0;seg5<5;seg5++){ var rr6=R*(0.3+seg5*0.175);
            g.fillStyle=rgba([255,190,90],(0.9-seg5*0.13)*fade);
            g.fillRect((sx5+Math.cos(a5)*rr6)|0,(apex+Math.sin(a5)*rr6*0.9+b5*b5*(6+seg5*3))|0,2,1); } } }
      else if(typ===7){                                                            // HORSETAIL: hang then pour down
        for(var i5=0;i5<8;i5++){ var hx7=sx5+((((h5>>>i5)&7))-3.5)*R*0.28;
          var hy7=apex+b5*b5*30+((i5*13)%5);
          g.fillStyle=rgba(col,0.8*fade); g.fillRect(hx7|0,hy7|0,1,2+((b5*4)|0));
          g.fillStyle=rgba([255,240,200],0.45*fade); g.fillRect(hx7|0,(hy7-2)|0,1,2); } }
      else if(typ===8){                                                            // SATURN: ring + bright core
        for(var i5=0;i5<20;i5++){ var a5=i5*Math.PI*2/20;
          g.fillStyle=rgba(col,0.9*fade);
          g.fillRect((sx5+Math.cos(a5)*R)|0,(apex+Math.sin(a5)*R*0.35+b5*b5*10)|0,1,1); }
        g.fillStyle=rgba(col2,0.9*fade); g.fillRect((sx5-1)|0,(apex-1+b5*b5*10)|0,3,3); }
      else if(typ===9){                                                            // KAMURO: dense golden crown that clings
        for(var i5=0;i5<24;i5++){ var a5=i5*Math.PI*2/24+(h5%9)*0.1;
          var rr7=R*0.8*(0.85+((i5*7)%4)*0.05);
          g.fillStyle=rgba([252,214,120],(0.75+((i5&1)?0.2:0))*Math.pow(fade,0.6));
          g.fillRect((sx5+Math.cos(a5)*rr7)|0,(apex+Math.sin(a5)*rr7*0.9+b5*b5*20)|0,1,1);
          if(b5>0.4&&(i5%3)===0){ g.fillStyle=rgba([255,244,200],0.5*fade);
            g.fillRect((sx5+Math.cos(a5)*rr7*0.8)|0,(apex+Math.sin(a5)*rr7*0.72+b5*b5*16)|0,1,1); } } }
      else if(typ===10){                                                           // FISH: wriggling swimmers
        for(var i5=0;i5<7;i5++){ var fh8=((h5+i5*40503)>>>0);
          var fa8=(fh8%628)/100, wig=Math.sin(now*0.02+i5*2.1)*2;
          g.fillStyle=rgba(col,0.85*fade);
          g.fillRect((sx5+Math.cos(fa8)*R*0.8+wig)|0,(apex+Math.sin(fa8)*R*0.7+b5*10)|0,2,1); } }
      else{ var n5=18;                                                             // classic PEONY
        for(var i5=0;i5<n5;i5++){ var a5=i5*Math.PI*2/n5+(h5%7)*0.13;
          var px5=sx5+Math.cos(a5)*R, py5=apex+Math.sin(a5)*R*0.85+b5*b5*15;       // gravity droop
          g.fillStyle=rgba(col,0.85*fade); g.fillRect(px5|0,py5|0,1,1);
          g.fillStyle=rgba(col,0.4*fade);  g.fillRect((sx5+Math.cos(a5)*R*0.72)|0,(apex+Math.sin(a5)*R*0.62+b5*b5*10)|0,1,1);
          if((h5%3)===0&&b5>0.5&&(((i5*13+Math.floor(now/90))%5)===0)){            // crackle shells twinkle out
            g.fillStyle=rgba([255,255,240],0.9*fade); g.fillRect((px5+((i5&1)?1:-1))|0,(py5+1)|0,1,1); }
        } }
      if(b5<0.16){ g.fillStyle=rgba(col,0.5*(1-b5/0.16)); g.fillRect((sx5-2)|0,(apex-2)|0,5,5); }   // the flash
      if(b5<0.5&&hasOcean){ g.fillStyle=rgba(col,0.10*(1-b5*2)); g.fillRect((sx5-4)|0,HORIZON-20,9,18); }  // glow over the bay
    }
  }
  g.globalCompositeOperation="source-over";
}
function spawnFirework(){
  var x=Math.random()*WW, y=30+Math.random()*70;
  var cols=["#ff5a5a","#ffd75e","#5affd7","#5a9dff","#ff5af0","#ffffff"];
  var c=cols[(Math.random()*cols.length)|0], parts=[];
  for(var i=0;i<26;i++){ var an=i/26*Math.PI*2, v=0.4+Math.random()*0.5;
    parts.push({x:x,y:y,vx:Math.cos(an)*v,vy:Math.sin(an)*v,c:c,life:900+Math.random()*500}); }
  fwx.push({parts:parts});
}
function stepFireworks(g,dt){
  for(var fi=0;fi<fwx.length;fi++){ var f=fwx[fi];
    for(var pi=0;pi<f.parts.length;pi++){ var p=f.parts[pi];
      p.x+=p.vx*dt*0.06; p.y+=p.vy*dt*0.06; if(!p.heart)p.vy+=0.0008*dt; p.life-=dt;
      if(p.life>0){ var sx=p.x-WOFF; g.globalAlpha=Math.min(1,p.life/600);
        g.fillStyle=p.c; g.fillRect(sx|0,p.y|0,p.heart?2:1,p.heart?2:1);
        if(p.heart){g.fillRect((sx-1)|0,(p.y-1)|0,1,1);g.fillRect((sx+2)|0,(p.y-1)|0,1,1);}
        g.globalAlpha=1; }
    } }
  fwx=fwx.filter(function(f){ return f.parts.some(function(p){return p.life>0;}); });
}

// ---- tiny 3x5 pixel font (uppercase letters we need for the birthday banners) ----
// each glyph is 5 rows; each row's low 3 bits are the on-pixels (msb = left column).
var FONT={
  'H':[5,5,7,5,5], 'A':[2,5,7,5,5], 'P':[6,5,6,4,4], 'Y':[5,5,2,2,2],
  'B':[6,5,6,5,6], 'I':[7,2,2,2,7], 'R':[6,5,6,5,5], 'T':[7,2,2,2,2],
  'D':[6,5,5,5,6], 'K':[5,5,6,5,5], ' ':[0,0,0,0,0],
  'C':[7,4,4,4,7], 'E':[7,4,6,4,7], 'F':[7,4,6,4,4], 'G':[7,4,5,5,7],
  'J':[1,1,1,5,2], 'L':[4,4,4,4,7], 'M':[5,7,7,5,5], 'N':[5,7,7,7,5],
  'O':[7,5,5,5,7], 'Q':[7,5,5,7,3], 'S':[7,4,7,1,7], 'U':[5,5,5,5,7],
  'V':[5,5,5,5,2], 'W':[5,5,7,7,5], 'X':[5,5,2,5,5], 'Z':[7,1,2,4,7],
  '0':[7,5,5,5,7], '1':[2,6,2,2,7], '2':[7,1,7,4,7], '3':[7,1,7,1,7],
  '4':[5,5,7,1,1], '5':[7,4,7,1,7], '6':[7,4,7,5,7], '7':[7,1,2,4,4],
  '8':[7,5,7,5,7], '9':[7,5,7,1,7], '-':[0,0,7,0,0], '!':[2,2,2,0,2], '.':[0,0,0,0,2], ':':[0,2,0,2,0], ',':[0,0,0,2,4],
  '%':[5,1,2,4,5], '/':[1,1,2,4,4], '+':[0,2,7,2,0]
};
function textW(str){ return str.length*4-1; }                          // 3px glyph + 1px space
function drawPixText(g,str,wx,y,col,alpha){                            // wx = WORLD x of the top-left
  for(var ci=0;ci<str.length;ci++){ var gl=FONT[str[ci]]||FONT[' ']; var gx=wx+ci*4;
    for(var w=-1;w<=1;w++){ var sx=gx-WOFF+w*WW; if(sx<-3||sx>SW+1) continue;
      g.globalAlpha=alpha; g.fillStyle=col;
      for(var ry=0;ry<5;ry++){ var bits=gl[ry];
        for(var rx=0;rx<3;rx++) if(bits&(1<<(2-rx))) g.fillRect((sx+rx)|0,(y+ry)|0,1,1); }
      g.globalAlpha=1;
    }
  }
}
var DAYS3=["SUN","MON","TUE","WED","THU","FRI","SAT"], MONS3=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function drawUiText(g,str,x,y,col,sc){                        // SCREEN-space pixel text at integer scale
  g.fillStyle=col;
  for(var ci=0;ci<str.length;ci++){ var gl=FONT[str[ci]]||FONT[' '];
    for(var ry=0;ry<5;ry++){ var bits=gl[ry];
      for(var rx=0;rx<3;rx++) if(bits&(1<<(2-rx))) g.fillRect(x+ci*4*sc+rx*sc, y+ry*sc, sc, sc); } }
}
// CIVIC HUD: an always-on glance panel, top-right, mirroring the sky-clock chrome. Shows who runs the city, their
// approval, the standing mandates, and the countdown to the next vote. Renders EVERY frame → cheap/static, and it
// draws nothing when there is no government (hamlet or apocalypse: curMayor===null) — which is also null-safe.
var HUD_MANDATE={ monorail:["M","#c05ad0"], seawall:["S","#4aa0e0"], stadium:["T","#e0a83a"], park:["P","#3ac86a"],
  casino:["C","#ff4bd0"], heightcap:["H","#ffb060"], carfree:["F","#6ad06a"], surveil:["V","#6ab0ff"] };
function drawCivicHud(g,now,night){
  var M=curMayor; if(!M) return;
  var pad=5, W=94, mr=6, bx=(SW-W-mr)|0, by=6, ix=bx+pad, iw=W-2*pad;
  var y0=by+5, y1=y0+7, y2=y1+7, y3=y2+8, y4=y3+9, bh=(y4+11)-by;
  var pulse=0.7+0.3*Math.sin(now*0.0022), pc=M.party.c;
  // glassy dark pill
  g.fillStyle="rgba(6,9,18,"+(night>0.5?0.46:0.34)+")"; g.fillRect(bx,by+1,W,bh-2); g.fillRect(bx+2,by,W-4,bh);
  // neon frame — cyan rails top/bottom, party-colour rails on the sides
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(40,200,235,"+(0.5*pulse)+")"; g.fillRect(bx+2,by,W-4,1); g.fillRect(bx+2,by+bh-1,W-4,1);
  g.globalAlpha=0.55*pulse; g.fillStyle=pc; g.fillRect(bx,by+2,1,bh-4); g.fillRect(bx+W-1,by+2,1,bh-4); g.globalAlpha=1;
  g.fillStyle="rgba(122,240,255,"+(0.9*pulse)+")"; g.fillRect(bx,by,4,1); g.fillRect(bx+W-4,by,4,1);   // corner ticks
  g.globalCompositeOperation="source-over";
  // Row 0 — party swatch + party name (+ scandal/recall flag on the right)
  g.fillStyle=pc; g.fillRect(ix,y0,4,4);
  drawUiText(g,M.party.k,ix+7,y0,pc,1);
  if(M.ousted) drawUiText(g,"RECALLED",bx+W-pad-textW("RECALLED"),y0,"#ff5a5a",1);
  else if(M.scandal) drawUiText(g,"SCANDAL",bx+W-pad-textW("SCANDAL"),y0,"#ff8a4a",1);
  // Row 1 — the mayor's name
  var nm="MAYOR "+M.winName; if(textW(nm)>iw) nm=M.winName;
  drawUiText(g,nm,ix,y1,"rgba(230,245,255,0.95)",1);
  // Row 2 — approval bar
  var ap=approvalNow(now), apc=ap>=60?"#3ad86a":ap>=40?"#e0c040":"#e05a4a";
  drawUiText(g,"APPR",ix,y2,"rgba(150,200,230,0.9)",1);
  var barX=ix+18, barW=iw-18-14;
  g.fillStyle="rgba(255,255,255,0.13)"; g.fillRect(barX,y2,barW,4);
  g.fillStyle=apc; g.fillRect(barX,y2,Math.round(barW*ap/100),4);
  drawUiText(g,ap+"",bx+W-pad-textW(ap+""),y2,apc,1);
  // Row 3 — standing mandates (active builds + policies as colour-coded letters); "-" if none yet
  var cx=ix, any=false;
  for(var bi=0;bi<curBuilds.length;bi++){ var mb=HUD_MANDATE[curBuilds[bi].t]; if(!mb)continue;
    g.globalAlpha=0.22; g.fillStyle=mb[1]; g.fillRect(cx-1,y3-1,5,7); g.globalAlpha=1;
    drawUiText(g,mb[0],cx,y3,mb[1],1); cx+=6; any=true; }
  for(var pk2 in curPolicies){ if(!curPolicies[pk2])continue; var mp=HUD_MANDATE[pk2]; if(!mp)continue;
    g.globalAlpha=0.22; g.fillStyle=mp[1]; g.fillRect(cx-1,y3-1,5,7); g.globalAlpha=1;
    drawUiText(g,mp[0],cx,y3,mp[1],1); cx+=6; any=true; }
  if(!any) drawUiText(g,"-",ix,y3,"rgba(150,180,205,0.7)",1);
  // Row 4 — countdown to the next vote (or the live phase)
  var lbl=M.electionDay?"ELECTION DAY":M.recallVote?"RECALL VOTE":M.campaign?"CAMPAIGN":M.debate?"DEBATE NIGHT":M.justElected?"NEW TERM":"NEXT VOTE";
  var lcol=M.electionDay?"#ffe14a":M.recallVote?"#ff6a6a":M.campaign?"#ff9a4a":M.debate?"#c0a0ff":"rgba(150,200,230,0.9)";
  drawUiText(g,lbl,ix,y4,lcol,1);
  var bY=y4+6; g.fillStyle="rgba(255,255,255,0.12)"; g.fillRect(ix,bY,iw,3);
  g.fillStyle="rgba(90,210,255,0.85)"; g.fillRect(ix,bY,Math.round(iw*Math.min(1,Math.max(0,M.tf))),3);
}
// the sky clock: local time + date, floating top-centre of every monitor
function drawSkyClock(g,nd,L){
  var h=nd.getHours(), mi=nd.getMinutes(), h12=(h%12)||12, ap=h<12?"AM":"PM";
  var str=h12+":"+(mi<10?"0":"")+mi+" "+ap+"  "+DAYS3[nd.getDay()]+" "+MONS3[nd.getMonth()]+" "+nd.getDate();
  var sc=2, tw=(str.length*4-1)*sc, x=((SW-tw)/2)|0, y=6;
  var l2=cityName+"  POP "+popFmt(cityPop());
  var tw2=(l2.length*4-1), x2=((SW-tw2)/2)|0, y2=y+5*sc+4;
  var l3=wxHudLine();                                          // current + projected weather
  var tw3=(l3.length*4-1), x3=((SW-tw3)/2)|0, y3=y2+5+3;
  var pw=Math.max(tw,tw2,tw3);
  var ph=5*sc+4 + 5+ (l3?(5+3):0) +6;                          // pill tall enough for however many lines show
  var bx=((SW-pw)/2-7)|0, by=y-4, bw=pw+14, bh=ph+4;           // HUD frame bounds
  var pulse=0.68+0.32*Math.sin(nd.getTime()*0.0022);           // gentle breathing neon
  // --- glassy dark pill (rounded feel via inset rows) ---
  g.fillStyle="rgba(6,9,18,"+(L>0.5?0.32:0.46)+")";
  g.fillRect(bx,by+1,bw,bh-2); g.fillRect(bx+2,by,bw-4,bh);
  // --- neon frame: cyan top/bottom rails, magenta side accents (additive) ---
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(40,200,235,"+(0.55*pulse)+")"; g.fillRect(bx+2,by,bw-4,1); g.fillRect(bx+2,by+bh-1,bw-4,1);
  g.fillStyle="rgba(232,72,192,"+(0.42*pulse)+")"; g.fillRect(bx,by+2,1,bh-4); g.fillRect(bx+bw-1,by+2,1,bh-4);
  g.fillStyle="rgba(122,240,255,"+(0.92*pulse)+")"; var kk=4;   // cyan corner brackets
  g.fillRect(bx,by,kk,1); g.fillRect(bx,by,1,kk);
  g.fillRect(bx+bw-kk,by,kk,1); g.fillRect(bx+bw-1,by,1,kk);
  g.fillRect(bx,by+bh-1,kk,1); g.fillRect(bx,by+bh-kk,1,kk);
  g.fillRect(bx+bw-kk,by+bh-1,kk,1); g.fillRect(bx+bw-1,by+bh-kk,1,kk);
  g.globalCompositeOperation="source-over";
  // --- legibility shadow, then tinted text ---
  drawUiText(g,str,x+1,y+1,"rgba(0,0,0,0.5)",sc);
  drawUiText(g,str,x,y,"rgba(228,250,255,0.97)",sc);           // time — bright cyan-white
  drawUiText(g,l2,x2,y2,"rgba(255,150,220,0.92)",1);           // city + pop — neon magenta
  if(l3) drawUiText(g,l3,x3,y3,"rgba(152,226,242,0.9)",1);     // weather — neon cyan
  // --- additive neon bloom ---
  g.globalCompositeOperation="lighter";
  drawUiText(g,str,x,y,"rgba(60,190,255,"+(0.24*pulse)+")",sc);
  drawUiText(g,str,x,y-1,"rgba(70,200,255,0.09)",sc);
  drawUiText(g,l2,x2,y2,"rgba(255,80,200,"+(0.16*pulse)+")",1);
  if(l3) drawUiText(g,l3,x3,y3,"rgba(70,210,235,"+(0.16*pulse)+")",1);
  g.globalCompositeOperation="source-over";
}
// a birthday banner strung across the sky over the middle of the city + a little cake
function drawBanner(g,msg,now,night,pink){
  var tw=textW(msg), tx=Math.round(WW*0.5 - tw/2), ty=Math.round(HORIZON*0.30);
  var bx0=tx-4, bx1=tx+tw+3, by=ty-3, bh=11;
  var edge=pink?[255,120,190]:[120,220,255], cloth=pink?[60,20,45]:[20,40,64];
  var flick=0.75+0.25*Math.sin(now*0.006);
  // sag rope to two anchor points
  g.strokeStyle="rgba(180,160,120,0.7)"; g.lineWidth=1; g.beginPath();
  for(var w=-1;w<=1;w++){ var ax=bx0-10-WOFF+w*WW, bx=bx1+10-WOFF+w*WW;
    if(bx<-4||ax>SW+4) continue; g.moveTo(ax,by-2); g.lineTo(bx0-WOFF+w*WW,by); g.lineTo(bx1-WOFF+w*WW,by); g.lineTo(bx,by-2); }
  g.stroke();
  // cloth panel + glowing border
  for(w=-1;w<=1;w++){ var px=bx0-WOFF+w*WW; if(px+ (bx1-bx0)<-2||px>SW+2) continue;
    g.fillStyle=rgba(cloth,0.92); g.fillRect(px|0,by|0,(bx1-bx0)|0,bh);
    g.globalCompositeOperation="lighter";
    g.fillStyle=rgba(edge,0.5*flick); g.fillRect(px|0,by|0,(bx1-bx0)|0,1); g.fillRect(px|0,(by+bh-1)|0,(bx1-bx0)|0,1);
    g.globalCompositeOperation="source-over";
    // little pennant flags strung along the top rope
    for(var fp=0;fp<(bx1-bx0);fp+=4){
      g.fillStyle=rgba(hex2rgb(NEON[(((fp/4)|0)+(Math.floor(now/700)))%NEON.length]),0.9*flick);
      g.fillRect((px+fp)|0,(by-2)|0,1,2); }
  }
  drawPixText(g,msg,tx,ty,"rgba(255,255,255,0.95)",flick);
  // a little cake with flickering candles on the sidewalk centre
  var cwx=Math.round(WW*0.5)-3;
  for(w=-1;w<=1;w++){ var cx=cwx-WOFF+w*WW; if(cx<-8||cx>SW+8) continue;
    g.fillStyle=pink?"#ffb3d9":"#ffe0b0"; g.fillRect(cx|0,(HORIZON-4)|0,7,3);        // cake body
    g.fillStyle=pink?"#ff5aa0":"#ff8ac0"; g.fillRect(cx|0,(HORIZON-4)|0,7,1);        // frosting
    for(var cd=1;cd<7;cd+=2){ g.fillStyle="#fff2b0"; g.fillRect((cx+cd)|0,(HORIZON-6)|0,1,2);   // candle
      if((((Math.floor(now/200))+cd)%2)===0){ g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,180,60,0.9)"; g.fillRect((cx+cd)|0,(HORIZON-7)|0,1,1); g.globalCompositeOperation="source-over"; } }
  }
}

// ---- building crowns (a distinct top for every building) ----
// bx = top-segment screen x, top = its roof y, bw = top-segment width.
function drawCrown(g,crown,bx,top,bw,col,accent,L,now,night){
  // themed lives lean into their signature roofline citywide (Paris = mansards, China = pagoda eaves), except a
  // few landmark tops (steeple/spire/antenna/helipad/water-tower/billboard) which keep their identity.
  var _en=cityEra.name, _keep=(crown==="steeple"||crown==="spire"||crown==="antenna"||crown==="helipad"||crown==="watertower"||crown==="billboard");
  if(!_keep){
    if(_en==="paris") crown=(((bx>>4)&7)===0)?"dome":"mansard";              // mostly mansards, the odd civic dome
    else if(_en==="china") crown=(((bx>>3)&3)===0)?"glasstop":"pagoda";      // traditional pagodas + modern glass towers
  }
  g.fillStyle=css(col); var mid=bx+(bw>>1), blink=(Math.floor(now/700))%2===0;
  // ---- NEW ENGLAND pitched roofs: slate/charcoal, drawn as a solid mass above the top edge ----
  if(crown==="gable"||crown==="gambrel"||crown==="hip"||crown==="steeple"){
    var slate=css(mixc(col,[46,50,60],0.74)), sllit=css(mixc(col,[92,98,112],0.7));   // roof slate (still faintly era-tinted) + sunlit slope
    if(crown==="gable"){                                             // steep triangular roof
      var ph=Math.min(Math.round(bw*0.62),12);
      for(var r=0;r<ph;r++){ var rw=Math.max(1,Math.round(bw*(1-r/ph)));
        g.fillStyle=slate; g.fillRect(bx+((bw-rw)>>1),top-1-r,rw,1);
        g.fillStyle=sllit; g.fillRect(bx+((bw-rw)>>1),top-1-r,1,1); }              // lit left slope
      g.fillStyle=slate; g.fillRect(bx-1,top-1,bw+2,1);                            // eave overhang
      var ch=bx+bw-Math.max(2,bw>>2); g.fillStyle=css(mixc(col,[60,44,40],0.6)); g.fillRect(ch,top-Math.min(ph+2,10),2,4);   // brick chimney
    } else if(crown==="gambrel"){                                    // barn / Dutch colonial double-pitch
      var gh=Math.min(Math.round(bw*0.7),13), knee=Math.round(gh*0.45), kw=Math.round(bw*0.64);
      for(var r=0;r<gh;r++){ var rw2=(r<knee)?Math.round(bw-(bw-kw)*(r/Math.max(1,knee))):Math.round(kw*(1-(r-knee)/Math.max(1,gh-knee)));
        rw2=Math.max(1,rw2); g.fillStyle=slate; g.fillRect(bx+((bw-rw2)>>1),top-1-r,rw2,1);
        g.fillStyle=sllit; g.fillRect(bx+((bw-rw2)>>1),top-1-r,1,1); }
      g.fillStyle=slate; g.fillRect(bx-1,top-1,bw+2,1);
    } else if(crown==="hip"){                                        // four-slope hip roof (flat ridge)
      var hh=Math.min(Math.round(bw*0.5),9), ridge=Math.max(2,Math.round(bw*0.42));
      for(var r=0;r<hh;r++){ var rw3=Math.max(ridge,Math.round(bw-(bw-ridge)*(r/Math.max(1,hh-1))));
        g.fillStyle=slate; g.fillRect(bx+((bw-rw3)>>1),top-1-r,rw3,1);
        g.fillStyle=sllit; g.fillRect(bx+((bw-rw3)>>1),top-1-r,1,1); }
      g.fillStyle=slate; g.fillRect(bx-1,top-1,bw+2,1);
    } else {                                                         // STEEPLE: white meeting-house tower + spire
      var white=css(mixc(col,[238,238,232],0.62)), tw=Math.max(3,Math.min(6,bw>>2)), txx=mid-(tw>>1);
      g.fillStyle=white; g.fillRect(bx-1,top-2,bw+2,2);                             // pedimented roof band
      g.fillStyle=white; g.fillRect(txx-1,top-9,tw+2,7);                            // belfry tower
      g.fillStyle=css(mixc(col,[40,44,54],0.6)); g.fillRect(txx,top-6,tw,2);        // louvred bell opening
      for(var r=0;r<11;r++){ var sw2=Math.max(1,tw-Math.round((tw+1)*r/11));         // tapering spire
        g.fillStyle=white; g.fillRect(mid-(sw2>>1),top-9-r,Math.max(1,sw2),1); }
      g.fillStyle="#d8c250"; g.fillRect(mid,top-22,1,3);                            // gilded weathervane
      g.fillRect(mid-1,top-21,3,1);
      if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba([255,240,190],0.5*night);   // steeple uplight at night
        g.fillRect(txx-1,top-9,tw+2,4); g.globalCompositeOperation="source-over"; }
    }
    return;
  }
  if(crown==="step"){
    var w2=Math.max(4,bw-4), w3=Math.max(2,bw-9);
    g.fillRect(bx+((bw-w2)>>1), top-3, w2, 3);
    g.fillRect(bx+((bw-w3)>>1), top-6, w3, 3);
  } else if(crown==="peak"){
    for(var i=0;i<Math.min(8,bw>>1);i++) g.fillRect(bx+i, top-i-1, bw-i*2, 1);
  } else if(crown==="dome"){
    g.fillRect(bx+2, top-1, bw-4, 1); g.fillRect(bx+3, top-2, bw-6, 1); g.fillRect(mid-1, top-3, 2, 1);
    if(L<0.55){ g.fillStyle=rgba(accent,0.5*night); g.fillRect(mid,top-4,1,1); }        // finial glint
  } else if(crown==="tank"){
    var wx=bx+bw-7; if(wx<bx+1) wx=bx+1;
    g.fillRect(wx, top-6, 5, 4); g.fillStyle=rgba(col,0.9); g.fillRect(wx, top-2, 5, 2);
  } else if(crown==="chevron"){                                   // chamfered / angled top
    for(var i=0;i<Math.min(6,bw>>1);i++){ g.fillRect(bx+i, top-i-1, 1, 1); g.fillRect(bx+bw-1-i, top-i-1, 1, 1); }
    g.fillRect(bx+2, top-1, bw-4, 1);
  } else if(crown==="battlement"){                                // crenellations
    for(var i=0;i<bw;i+=2) g.fillRect(bx+i, top-2, 1, 2);
  } else if(crown==="blade"){                                     // a tall thin roof fin
    var fx=mid-1; g.fillRect(fx, top-9, 2, 9);
    if(L<0.6&&blink){ g.fillStyle="#ff5050"; g.fillRect(fx, top-9, 1, 1); }
  } else if(crown==="spire"){                                     // tapered needle + beacon
    g.fillRect(mid-1, top-5, 3, 5); g.fillRect(mid, top-11, 1, 6);
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=blink?"rgba(255,90,90,0.95)":"rgba(255,90,90,0.3)";
      g.fillRect(mid, top-12, 1, 1); g.globalCompositeOperation="source-over"; }
  } else if(crown==="antenna"){                                   // lattice mast + red aviation light
    g.fillRect(mid, top-10, 1, 10); g.fillRect(mid-1, top-6, 3, 1); g.fillRect(mid-1, top-3, 3, 1);
    if(L<0.6&&blink){ g.fillStyle="#ff4040"; g.fillRect(mid, top-11, 1, 1); }
  } else if(crown==="helipad"){                                   // rooftop helipad 'H'
    g.fillStyle=L>0.5?"#3a3644":"#0e0c16"; g.fillRect(bx+2, top-2, bw-4, 2);
    g.fillStyle=L>0.5?"#c9cdd8":"rgba(160,170,190,0.7)";
    g.fillRect(bx+3, top-2, 1, 2); g.fillRect(bx+bw-4, top-2, 1, 2); g.fillRect(bx+4, top-2, bw-8, 1);
  } else if(crown==="stack"){                                     // industrial smokestack + smoke
    var sxk=bx+bw-4; if(sxk<bx+1) sxk=bx+1;
    g.fillStyle=L>0.5?"#3a3a42":"#14141c"; g.fillRect(sxk,top-10,2,10);
    g.fillStyle=L>0.5?"#7a4a2a":"#2a1a10"; g.fillRect(sxk,top-10,2,1);                   // rim band
    for(var sk2=0;sk2<3;sk2++){ var t=(now*0.010+sk2*90+bx*7)%60;
      g.fillStyle="rgba(92,94,102,"+(0.34*(1-t/60))+")"; g.fillRect((sxk+Math.sin(now*0.002+sk2)*2)|0,(top-10-t*0.4)|0,2,2); }
  } else if(crown==="watertower"){                                // classic wooden water tower on stilts
    var wtw=Math.max(4,Math.min(6,bw>>1)), wtx=mid-(wtw>>1);
    g.fillStyle=css(mixc(col,[96,68,44],0.72)); g.fillRect(wtx,top-6,wtw,4);            // weathered-wood tank body
    g.fillStyle=css(mixc(col,[62,44,30],0.7)); g.fillRect(wtx,top-6,wtw,1);             // top hoop band
    g.fillStyle=css(mixc(col,[74,54,36],0.7)); g.fillRect(wtx+1,top-7,wtw-2,1); g.fillRect(mid,top-8,1,1);   // conical cap
    g.fillStyle=css(mixc(col,[48,38,28],0.6)); g.fillRect(wtx,top-2,1,2); g.fillRect(wtx+wtw-1,top-2,1,2);   // stilt legs
  } else if(crown==="mansard"){                                   // PARIS Haussmann: steep grey mansard roof, zinc eave, dormers
    var mh=Math.min(7,Math.max(4,bw>>1)), slate=css(mixc(col,[70,74,84],0.72));
    for(var mr=0;mr<mh;mr++){ var mw=(mr<2)?bw:Math.max(3,bw-2-(mr-1)*2); g.fillStyle=slate; g.fillRect(bx+((bw-mw)>>1),top-1-mr,mw,1); }
    g.fillStyle=css(mixc(col,[120,126,138],0.6)); g.fillRect(bx-1,top-1,bw+2,1);                        // zinc eave
    g.fillStyle=slate; g.fillRect(bx+2,top-mh+1,2,2); g.fillRect(bx+bw-4,top-mh+1,2,2);                 // dormers
    g.fillStyle=(L<0.6)?"rgba(255,224,170,0.9)":"#bcd0e0"; g.fillRect(bx+2,top-mh+2,2,1); g.fillRect(bx+bw-4,top-mh+2,2,1);
  } else if(crown==="pagoda"){                                     // CHINA: tiered roof, upturned curved eaves, gilded finial + lantern
    var tiers=Math.min(3,1+(bw>>4));
    for(var pt=0;pt<tiers;pt++){ var pw=Math.max(4,bw-pt*4), pxx=bx+((bw-pw)>>1), py=top-1-pt*4;
      g.fillStyle=css(mixc(col,[120,40,40],0.6)); g.fillRect(pxx,py-1,pw,2);                            // green/red tile band
      g.fillStyle=css(mixc(col,[70,24,24],0.6)); g.fillRect(pxx-1,py,1,1); g.fillRect(pxx+pw,py,1,1);   // upturned eave tips
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,196,90,0.5)"; g.fillRect(pxx-1,py-1,1,1); g.fillRect(pxx+pw,py-1,1,1); g.globalCompositeOperation="source-over"; }
    g.fillStyle="#e0b040"; g.fillRect(mid,top-1-tiers*4-2,1,3);                                         // gilded finial
    if(L<0.62){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,60,0.75)"; g.fillRect(bx+1,top+1,1,2); g.fillRect(bx+bw-2,top+1,1,2); g.globalCompositeOperation="source-over"; }  // red lanterns
  } else if(crown==="deco"){                                      // ART DECO (NYC/Chicago): stepped ziggurat setbacks + a spire
    var s1=Math.max(4,bw-3), s2=Math.max(3,bw-7), s3=Math.max(2,bw-11);
    g.fillRect(bx+((bw-s1)>>1),top-2,s1,2); g.fillRect(bx+((bw-s2)>>1),top-4,s2,2); g.fillRect(bx+((bw-s3)>>1),top-6,s3,2);
    g.fillStyle=css(mixc(col,[210,196,150],0.5)); g.fillRect(bx+((bw-s3)>>1),top-6,s3,1);   // limestone highlight on the top step
    g.fillStyle=css(col); g.fillRect(mid,top-12,1,6);                                       // needle spire
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(accent,0.7); g.fillRect(mid,top-13,1,1);   // lit finial
      g.fillStyle=rgba(accent,0.3); g.fillRect(mid-1,top-6,3,1); g.globalCompositeOperation="source-over"; }
  } else if(crown==="glasstop"){                                  // HOUSTON/modern: a sloped, faceted glazed cap
    var gh3=Math.min(8,Math.max(3,bw>>1)), dirp=((bx>>2)&1)?1:-1;
    for(var gt=0;gt<gh3;gt++){ var gw=bw-gt; if(gw<1) break; g.fillStyle=css(mixc(col,[150,190,210],0.35+0.05*gt));
      g.fillRect(dirp>0?bx:(bx+gt),top-1-gt,gw,1); }                                        // asymmetric sloped wedge
    g.globalCompositeOperation="lighter"; g.fillStyle=rgba(accent&&accent.length?accent:[150,200,235],0.2); g.fillRect(bx,top-gh3,bw,1); g.globalCompositeOperation="source-over";
  } else if(crown==="billboard"){                                 // lit rooftop advertising hoarding
    var bbw=Math.max(6,bw-1), bbx=bx+((bw-bbw)>>1), bbh=5;
    g.fillStyle=L>0.5?"#2a2d36":"#0e0f16"; g.fillRect(bbx,top-2,1,2); g.fillRect(bbx+bbw-1,top-2,1,2);      // support legs
    g.fillStyle=L>0.5?"#3a3f4a":"#161922"; g.fillRect(bbx,top-2-bbh,bbw,bbh);                               // panel backing
    g.globalCompositeOperation="lighter"; var ba=0.45+0.4*night;
    if(night>0.4){ g.fillStyle=rgba(accent,ba*0.22); g.fillRect(bbx,top-2-bbh,bbw,bbh+1); }                  // soft halo bleeding past the frame
    g.fillStyle=rgba(accent,ba); g.fillRect(bbx+1,top-1-bbh,bbw-2,bbh-2);                                    // glowing lit face
    g.fillStyle="rgba(255,255,255,"+(0.4*night+0.15)+")"; g.fillRect(bbx+2,top-bbh,Math.max(1,bbw-4),1);     // a bright copy line
    g.globalCompositeOperation="source-over";
  }
}

// ---- greenspace / park (a low open plot in the near row) ----
function drawPark(g,p,bx,L,now,dayLit,night){
  var grassTop=HORIZON-5;
  // grass plot + darker front edge
  g.fillStyle=css(mixc([20,46,28],[74,152,78],dayLit)); g.fillRect(bx,grassTop,p.w,5);
  g.fillStyle=css(mixc([15,36,21],[58,128,62],dayLit)); g.fillRect(bx,HORIZON-1,p.w,1);
  // winding path
  if(p.path){ g.fillStyle=css(mixc([40,36,30],[172,150,120],dayLit));
    for(var wpx=0;wpx<p.w;wpx+=2) g.fillRect(bx+wpx, grassTop+2+((Math.sin(wpx*0.5)*1.4)|0), 2, 1); }
  // pond (reflects the sky by day, city neon by night)
  if(p.pond){ var px0=bx+p.pondx, pw2=Math.min(12,p.w-p.pondx-2);
    if(pw2>3){ g.fillStyle=css(mixc([16,32,58],[92,150,190],dayLit));
      g.fillRect(px0+1,grassTop+1,pw2-2,3); g.fillRect(px0,grassTop+2,pw2,1);
      if(night>0.4){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(p.accent2,0.18*night);
        g.fillRect(px0+1,grassTop+2,pw2-2,1); g.globalCompositeOperation="source-over"; }
      if(p.fountain){ g.fillStyle="rgba(200,230,255,0.75)"; g.fillRect(px0+(pw2>>1),grassTop-2,1,3);
        g.fillRect(px0+(pw2>>1)-1,grassTop-1,3,1); } } }
  // trees — foliage colour follows the season (green summer, gold autumn, bare winter, blossoms spring)
  var se=curSeason||seasonInfo(nowDate());
  for(var ti=0;ti<p.trees.length;ti++){ var t=p.trees[ti];
    var cx=bx+t.x, base=grassTop+1, s=t.s+(t.big?2:0), trunkH=s+2, cy=base-trunkH;
    g.fillStyle=css(mixc([34,24,16],[96,68,40],dayLit)); g.fillRect(cx,cy,1,trunkH);
    if(se.bare){                                        // winter: bare branches (+ snow if any)
      g.fillStyle=css(mixc([30,24,18],[80,70,58],dayLit));
      g.fillRect(cx-1,cy+1,1,1); g.fillRect(cx+1,cy,1,1); g.fillRect(cx,cy-1,1,1); g.fillRect(cx-2,cy+2,1,1); g.fillRect(cx+2,cy+2,1,1);
      if(snowpack>0){ g.fillStyle="rgba(240,244,255,0.85)"; g.fillRect(cx-1,cy-1,3,1); }
    } else {
      var lit=se.canopy[t.t%se.canopy.length];
      var can=mixc([14,22,18],lit,dayLit), shad=mixc([10,15,12],[(lit[0]*0.5)|0,(lit[1]*0.5)|0,(lit[2]*0.5)|0],dayLit);
      for(var dy=-s;dy<=s;dy++){ var wd=s-Math.abs(dy);
        g.fillStyle=css(dy>1?shad:can); g.fillRect(cx-wd,cy+dy,wd*2+1,1); }
      if(se.blossom){ g.fillStyle="rgba(255,190,220,0.9)"; g.fillRect(cx-1,cy-s+1,1,1); g.fillRect(cx+1,cy-1,1,1); g.fillRect(cx-2,cy+1,1,1); }
      else if(dayLit>0.2){ g.fillStyle=rgba([230,240,180],dayLit*0.4); g.fillRect(cx-1,cy-s+1,2,1); }
    }
  }
  // park lamps — warm, glowing at night (part of the city's radiance)
  for(var li=0;li<p.lamps.length;li++){ var lx=bx+p.lamps[li].x, lty=grassTop-6;
    g.fillStyle=L>0.5?"#2c2836":"#0c0a14"; g.fillRect(lx,lty,1,6);
    g.fillStyle=L<0.6?"#ffe096":"#8f8a9c"; g.fillRect(lx,lty-1,1,1);           // bulb off (glass) by day, warm at night
    if(L<0.6){ g.globalCompositeOperation="lighter";
      g.fillStyle=rgba([255,224,150],0.5*night+0.15); g.fillRect(lx-1,lty-2,3,3);
      g.fillStyle=rgba([255,224,150],0.14*night);     g.fillRect(lx-2,grassTop-1,5,3);
      g.globalCompositeOperation="source-over"; } }
  // low front hedge
  g.fillStyle=css(mixc([14,34,20],[48,110,54],dayLit));
  for(var hx=bx;hx<bx+p.w;hx+=2) g.fillRect(hx,grassTop,1,1);
}

// a small holiday prop hung at a building entrance (cx = door-centre screen x, gy = HORIZON)
function drawProp(g,prop,cx,gy,L,now,night){
  cx=cx|0; var flick=(Math.floor(now/300))%2===0;
  if(prop==="wreath"){ g.fillStyle="#2f9a4a"; g.fillRect(cx-1,gy-6,3,1); g.fillRect(cx-2,gy-5,1,2); g.fillRect(cx+2,gy-5,1,2); g.fillRect(cx-1,gy-3,3,1);
    g.fillStyle="#ff4444"; g.fillRect(cx,gy-5,1,1); }
  else if(prop==="pumpkin"){ g.fillStyle="#ff8a1a"; g.fillRect(cx-1,gy-5,3,3); g.fillStyle="#2a5a1a"; g.fillRect(cx,gy-6,1,1);
    g.fillStyle="#3a1a06"; g.fillRect(cx-1,gy-4,1,1); g.fillRect(cx+1,gy-4,1,1); g.fillRect(cx,gy-3,1,1);
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,150,40,"+(flick?0.5:0.3)+")"; g.fillRect(cx-2,gy-6,5,4); g.globalCompositeOperation="source-over"; } }
  else if(prop==="flag"){ g.fillStyle="#7a6a4a"; g.fillRect(cx-2,gy-7,1,7);          // pole
    g.fillStyle="#ff4444"; g.fillRect(cx-1,gy-7,4,3); g.fillStyle="#ffffff"; g.fillRect(cx-1,gy-6,4,1);
    g.fillStyle="#2244aa"; g.fillRect(cx-1,gy-7,2,2); }
  else if(prop==="heart"){ g.fillStyle="#ff4d88"; g.fillRect(cx-1,gy-5,1,1); g.fillRect(cx+1,gy-5,1,1); g.fillRect(cx-1,gy-4,3,1); g.fillRect(cx,gy-3,1,1);
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,150,0.4)"; g.fillRect(cx-2,gy-6,5,4); g.globalCompositeOperation="source-over"; } }
  else if(prop==="clover"){ g.fillStyle="#2fbf5a"; g.fillRect(cx-1,gy-5,1,1); g.fillRect(cx+1,gy-5,1,1); g.fillRect(cx,gy-4,1,1); g.fillStyle="#1c7a38"; g.fillRect(cx,gy-3,1,1); }
  else if(prop==="leaf"){ g.fillStyle=["#d9822b","#b5651d","#e0b040"][((cx>>1)+(Math.floor(now/900)))%3]; g.fillRect(cx-1,gy-5,3,2); g.fillStyle="#8a3b1e"; g.fillRect(cx,gy-3,1,1); }
  else if(prop==="egg"){ g.fillStyle=["#ff9ec4","#a6e3ff","#c8f5a0"][((cx>>1))%3]; g.fillRect(cx-1,gy-5,3,3); g.fillStyle="#ffffff"; g.fillRect(cx,gy-4,1,1); }
  else if(prop==="balloon"){ var bc=["#ffe08a","#ff7ad0","#7affd7"][((cx>>1)+(Math.floor(now/700)))%3];
    g.fillStyle="#6a6a7a"; g.fillRect(cx,gy-4,1,4); g.fillStyle=bc; g.fillRect(cx-1,gy-7,3,3);
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=bc; g.globalAlpha=0.3; g.fillRect(cx-2,gy-8,5,5); g.globalAlpha=1; g.globalCompositeOperation="source-over"; } }
}

// rooftop life on flat-topped buildings: a lounge/bar or a pool
function drawRooftop(g,b,tX,top,tW,L,now,night){
  if(!b.rtop||b.rtop==="none") return;
  var roofY=top;
  if(b.rtop==="bar"){
    for(var lx=tX+1; lx<tX+tW-1; lx+=2){ var bulb=["#ffee66","#ff8866","#66ccff","#ffccaa"][(lx>>1)%4];
      g.fillStyle=(night>0.3)?bulb:"rgba(180,180,190,0.6)"; g.fillRect(lx,roofY-4-((lx>>1)&1),1,1); }   // string lights
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,140,0.12)"; g.fillRect(tX,roofY-5,tW,5); g.globalCompositeOperation="source-over"; }
    g.fillStyle=L>0.5?"#6a5238":"#241a12"; g.fillRect(tX+1,roofY-1,Math.min(tW-2,5),1);                 // bar counter
    var np=1+(b.seed%2);
    for(var p=0;p<np;p++) drawPerson(g,tX+2+p*3,roofY-3,["#c05a8a","#5ac0c0","#e6e6ea"][(b.seed+p)%3],SKINC[(b.seed+p)%SKINC.length],0);
    if(tW>=14){ g.fillStyle="#d23b3b"; g.fillRect(tX+tW-5,roofY-4,4,1); g.fillStyle="#6a6a76"; g.fillRect(tX+tW-3,roofY-4,1,3); }  // umbrella
  } else if(b.rtop==="pool"){
    var pw=Math.max(3,tW-5); g.fillStyle=css(mixc([26,70,110],[92,170,210],L)); g.fillRect(tX+2,roofY-2,pw,2);
    if((Math.floor(now/500))%2===0){ g.fillStyle="rgba(255,255,255,0.25)"; g.fillRect(tX+3,roofY-2,1,1); }
    g.fillStyle=SKINC[b.seed%SKINC.length]; g.fillRect((tX+3+(((now*0.006+b.seed)|0)%Math.max(1,pw-2)))|0,roofY-2,1,1);  // swimmer
    g.fillStyle="#d8d8e0"; g.fillRect(tX+tW-3,roofY-1,2,1);
    if(L>0.5) drawSeated(g,tX+tW-3,roofY-3,"#e0b0c0",SKINC[(b.seed+1)%SKINC.length]);
  }
}

// NATURAL GROWTH: before a plot is redeveloped into its designed building, it holds a modest little
// HOUSE — a 1½–2 storey cottage with a pitched roof, a chimney, a person-sized door and a couple of
// warm windows, in the plot's own colour (era-tinted like everything else).
// WEALTH: every plot has a class — poor · middle · rich — from its district, a wealthy enclave & a poor
// quarter (by world position), a per-plot roll, and the current economy (booms lift everyone, busts sink them).
var RICH_F=0.70, POOR_F=0.20;                 // world-fraction centres of the rich hillside & the poor quarter
function wealthOf(b){
  var base=b.district==="residential"?0.56:b.district==="oldtown"?0.40:b.district==="downtown"?0.68:b.district==="entertainment"?0.58:0.30;
  var f=(b.x/WW), rich=Math.exp(-Math.pow((f-RICH_F)/0.07,2)), poor=Math.exp(-Math.pow((f-POOR_F)/0.07,2));
  var w=base + 0.32*rich - 0.34*poor + ((((b.seed>>>3)%100)/100)-0.5)*0.26 + (curEcon-0.5)*0.28;
  return Math.max(0,Math.min(1,w));
}
// BROWNSTONE (Boston/NYC): flat masonry facade, heavy cornice, tall paired windows, a raised stoop to the parlor door.
function drawBrownstone(g,bx,b,L,now,dayLit){
  var w2=wealthOf(b), tier=w2<0.4?0:(w2>0.66?2:1);
  var hw=Math.min(b.w,tier===2?14:12), hx=bx+((b.w-hw)>>1), hh=(tier===0?10:tier===2?15:12)+((b.seed>>5)%3), top=HORIZON-hh;
  var col=mixc([160,88,64],[214,150,120],dayLit*0.7);
  if(cityEra.tint) col=mixc(col,cityEra.tint,cityEra.blend*(0.6+0.4*dayLit));
  g.fillStyle=css(col); g.fillRect(hx,top,hw,hh);
  g.fillStyle="rgba(0,0,0,0.12)"; for(var my=top+3;my<HORIZON-1;my+=3) g.fillRect(hx,my,hw,1);        // ashlar courses
  g.fillStyle=css(mixc(col,[50,36,30],0.5)); g.fillRect(hx-1,top-2,hw+2,2);                            // heavy cornice (flat roof)
  g.fillStyle=css(mixc(col,[120,90,74],0.4)); g.fillRect(hx-1,top-2,hw+2,1);
  var wc=(L<0.6&&(((Math.floor(now/9000)+b.seed)%3)!==0))?"rgba(255,214,150,0.95)":(dayLit>0.4?"#b4c8dc":"#1c2029");
  g.fillStyle=wc; for(var fy=top+3;fy<HORIZON-6;fy+=4){ g.fillRect(hx+2,fy,2,3); g.fillRect(hx+hw-4,fy,2,3); }  // tall paired windows
  var stx=hx+2;
  g.fillStyle=css(mixc(col,[70,55,48],0.45)); for(var s=0;s<3;s++) g.fillRect(hx-2+s,HORIZON-1-s,3,1+s);       // raised stoop
  g.fillStyle=L>0.5?"#3a2418":"#180f08"; g.fillRect(stx+1,HORIZON-6,4,5);                               // parlor door
  g.fillStyle="rgba(236,236,244,0.2)"; g.fillRect(stx,HORIZON-7,6,1);
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,208,138,0.4)"; g.fillRect(stx+1,HORIZON-5,4,3); g.globalCompositeOperation="source-over"; }
  g.fillStyle=L>0.5?"#2a2c34":"#14161a"; g.fillRect(hx+hw-1,HORIZON-3,1,3);                             // iron railing
}
// LONDON TERRACE (Georgian/Victorian): uniform brick or cream stucco, flat parapet, chimney pots, sash & bay windows, painted door.
function drawTerrace(g,bx,b,L,now,dayLit){
  var hw=Math.min(b.w,13), hx=bx+((b.w-hw)>>1), hh=10+((b.seed>>5)%3), top=HORIZON-hh, cream=((b.seed>>6)&1)===0;
  var col=mixc(cream?[206,196,176]:[150,110,100],[230,222,205],dayLit*0.6);
  if(cityEra.tint) col=mixc(col,cityEra.tint,cityEra.blend*(0.6+0.4*dayLit));
  g.fillStyle=css(col); g.fillRect(hx,top,hw,hh);
  if(!cream){ g.fillStyle="rgba(0,0,0,0.12)"; for(var my=top+2;my<HORIZON-1;my+=3) g.fillRect(hx,my,hw,1); }    // brick courses
  g.fillStyle=css(mixc(col,[60,54,50],0.55)); g.fillRect(hx-1,top-1,hw+2,1);                            // flat parapet
  g.fillStyle=css(mixc(col,[70,54,48],0.5)); g.fillRect(hx+hw-4,top-4,3,3);                             // chimney stack
  g.fillStyle="#9a4a3a"; g.fillRect(hx+hw-4,top-5,1,1); g.fillRect(hx+hw-2,top-5,1,1);                  // chimney pots
  var wc=(L<0.6&&(((Math.floor(now/8000)+b.seed)%3)!==0))?"rgba(255,224,176,0.95)":(dayLit>0.4?"#c7d6e6":"#20242e");
  g.fillStyle=wc; for(var fy=top+2;fy<HORIZON-6;fy+=4){ g.fillRect(hx+2,fy,2,2); g.fillRect(hx+hw-4,fy,2,2); } // sash windows
  g.fillStyle=css(mixc(col,[20,20,24],0.2)); g.fillRect(hx+1,HORIZON-5,4,4); g.fillStyle=wc; g.fillRect(hx+1,HORIZON-4,4,2);  // ground bay window
  g.fillStyle=["#2a5a3a","#2a3a6a","#7a2a2a","#1a1a22"][b.seed%4]; g.fillRect(hx+hw-4,HORIZON-5,3,5);   // painted door
  g.fillStyle=L>0.5?"#2a2c34":"#14161a"; g.fillRect(hx-1,HORIZON-3,1,3); g.fillRect(hx+hw,HORIZON-3,1,3);  // black railings
}
// CREOLE TOWNHOUSE (New Orleans French Quarter): pastel stucco, tall French doors, a 2-storey wrought-iron gallery, a gas lamp.
function drawCreole(g,bx,b,L,now,dayLit){
  var hw=Math.min(b.w,14), hx=bx+((b.w-hw)>>1), hh=13+((b.seed>>5)%3), top=HORIZON-hh;
  var pastels=[[236,180,180],[236,224,170],[186,220,190],[186,206,230],[224,190,220]], pc=pastels[(b.seed>>4)%pastels.length];
  var col=mixc(pc,[Math.min(255,pc[0]+22),Math.min(255,pc[1]+22),Math.min(255,pc[2]+22)],dayLit*0.5);
  if(cityEra.tint) col=mixc(col,cityEra.tint,cityEra.blend*(0.5+0.4*dayLit));
  g.fillStyle=css(col); g.fillRect(hx,top,hw,hh);
  g.fillStyle=css(mixc(col,[60,50,44],0.4)); g.fillRect(hx-1,top-1,hw+2,1);                              // parapet
  var wc=(L<0.6&&(((Math.floor(now/9000)+b.seed)%3)!==0))?"rgba(255,214,150,0.95)":(dayLit>0.4?"#bcd0e0":"#20242c");
  g.fillStyle=wc; for(var fx3=hx+2;fx3<hx+hw-2;fx3+=4){ g.fillRect(fx3,top+2,2,4); g.fillRect(fx3,HORIZON-5,2,4); }  // tall French doors
  var gy2=top+((hh/2)|0);                                                                                // the iconic iron GALLERY
  g.fillStyle=L>0.5?"#2a2c30":"#14161a"; g.fillRect(hx-1,gy2,hw+2,1); g.fillRect(hx-1,gy2-3,hw+2,1);     // floor + rail top
  for(var rp=hx-1;rp<hx+hw+1;rp++){ if(rp&1) g.fillRect(rp,gy2-2,1,2); }                                 // lacy railing
  g.fillStyle=L>0.5?"#3a2418":"#180f08"; g.fillRect(hx+((hw-3)>>1),HORIZON-5,3,5);                       // tall door
  if(L<0.62){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,190,90,0.75)"; g.fillRect(hx,HORIZON-6,1,1); g.globalCompositeOperation="source-over"; }  // gas lamp
}
function drawHouse(g,bx,b,L,now,dayLit,night){
  var era=cityEra.name, style="colonial";                                              // pick an architectural style for this house
  if(era==="boston") style="brownstone"; else if(era==="london"||era==="paris"||era==="china"||era==="tokyo") style="terrace";   // themed lives → whole-city look
  else if(era==="neworleans") style="creole";
  else if(b.district==="oldtown"){ var hs=(b.seed>>>9)%6; style=(hs===0)?"brownstone":(hs===1)?"terrace":(hs===2)?"creole":"colonial"; }  // mixed old quarter
  else if(b.district==="residential"&&((b.seed>>>9)%6)===0) style="brownstone";
  if(style==="brownstone"){ drawBrownstone(g,bx,b,L,now,dayLit); return; }
  if(style==="terrace"){ drawTerrace(g,bx,b,L,now,dayLit); return; }
  if(style==="creole"){ drawCreole(g,bx,b,L,now,dayLit); return; }
  var w=wealthOf(b), tier=w<0.40?0:(w>0.66?2:1);                                       // 0 poor · 1 middle · 2 rich
  var hw=Math.min(b.w,tier===2?16:14), hx=bx+((b.w-hw)>>1), hh=(tier===0?7:tier===2?12:9)+((b.seed>>5)%(tier===2?4:3)), top=HORIZON-hh;
  var lift=tier===2?1.7:tier===0?1.15:1.5, add=tier===2?34:tier===0?10:22;
  var col=mixc(b.c,[Math.min(255,b.c[0]*lift+add),Math.min(255,b.c[1]*lift+add+4),Math.min(255,b.c[2]*lift+add+8)],dayLit);
  if(tier===0) col=mixc(col,[110,110,116],0.28);                                        // weather the poor houses grey
  if(cityEra.tint) col=mixc(col,cityEra.tint,cityEra.blend*(0.6+0.4*dayLit));
  g.fillStyle=css(col); g.fillRect(hx,top,hw,hh);                                       // walls
  if(b.brick){ g.fillStyle="rgba(0,0,0,0.14)"; for(var my=top+2;my<HORIZON-1;my+=3) g.fillRect(hx,my,hw,1); }
  else if(b.clap||tier===2){ g.fillStyle="rgba(0,0,0,0.06)"; for(var cly=top+3;cly<HORIZON-1;cly+=2) g.fillRect(hx,cly,hw,1); }
  if(dayLit>0.12){ g.fillStyle=(goldenK>0.25)?("rgba(255,214,160,"+(dayLit*0.32)+")"):("rgba(255,248,225,"+(dayLit*0.28)+")"); g.fillRect(hx,top,1,hh);
    g.fillStyle="rgba(6,8,24,"+(dayLit*0.3)+")"; g.fillRect(hx+hw-1,top,1,hh); }
  if(snowpack>0.15){ g.fillStyle="rgba(240,246,255,"+Math.min(0.85,snowpack*0.9).toFixed(2)+")"; g.fillRect(hx,top,hw,1); }
  // ROOF — richer roofs are steeper & fancier; poor roofs are patched
  var slate=css(mixc(col,[46,50,60],0.72)), ph=Math.min(Math.round(hw*(tier===2?0.6:0.5)),tier===2?8:6);
  for(var rr=0;rr<ph;rr++){ var rw=Math.max(1,Math.round(hw*(1-rr/ph))); g.fillStyle=slate; g.fillRect(hx+((hw-rw)>>1),top-1-rr,rw,1); }
  g.fillStyle=slate; g.fillRect(hx-1,top-1,hw+2,1);                                     // eave
  if(tier===0){ g.fillStyle="rgba(20,18,22,0.5)"; g.fillRect(hx+2,top-2,2,1); g.fillRect(hx+hw-5,top-3,2,1); }   // tar patches
  if(tier===2){ g.fillStyle=css(col); g.fillRect(hx+((hw-3)>>1),top-ph+1,3,2); g.fillStyle=slate; g.fillRect(hx+((hw-3)>>1),top-ph,3,1);  // dormer
    g.fillStyle="#d8c250"; g.fillRect(hx+(hw>>1),top-ph-2,1,2); }                       // gilded weathervane
  g.fillStyle=css(mixc(col,[60,44,40],0.6)); g.fillRect(hx+hw-3,top-ph,2,3);            // chimney
  if(tier===2) g.fillRect(hx+1,top-ph,2,3);                                             // a second chimney for the manor
  // DOOR (+ a columned porch for the rich)
  var dw=Math.min(hw-4,tier===2?5:4), dx=hx+((hw-dw)>>1), dh=Math.min(tier===2?7:6,hh-2);
  if(tier===2){ g.fillStyle=L>0.5?"#d8d2c4":"#5a564c"; g.fillRect(hx+1,HORIZON-1,hw-2,1);
    g.fillStyle=L>0.5?"#e8e2d4":"#6a655a"; g.fillRect(hx+2,HORIZON-dh,1,dh); g.fillRect(hx+hw-3,HORIZON-dh,1,dh); }   // porch columns
  g.fillStyle=L>0.5?"#3a2418":"#180f08"; g.fillRect(dx,HORIZON-dh,dw,dh);
  g.fillStyle=L>0.5?"rgba(236,236,244,0.18)":"rgba(150,155,175,0.14)";
  g.fillRect(dx-1,HORIZON-dh-1,dw+2,1); g.fillRect(dx-1,HORIZON-dh,1,dh); g.fillRect(dx+dw,HORIZON-dh,1,dh);
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,208,138,"+(0.4*night+0.1)+")"; g.fillRect(dx,HORIZON-dh+1,dw,dh-1); g.globalCompositeOperation="source-over"; }
  // WINDOWS — more floors the wealthier; one boarded on the poorest
  var winOn=(L<0.6 && (((Math.floor(now/9000)+b.seed)%3)!==0));
  var wc=winOn?"rgba(255,214,150,0.95)":(dayLit>0.4?"#b4c8dc":"#1c2029");
  g.fillStyle=wc; if(hw>=8){ g.fillRect(hx+1,top+2,2,2); g.fillRect(hx+hw-3,top+2,2,2); }
  if(tier===2 && hh>=12){ g.fillStyle=wc; g.fillRect(hx+1,top+5,2,2); g.fillRect(hx+hw-3,top+5,2,2); }             // second storey
  if(tier===0){ g.fillStyle="#5a4a38"; g.fillRect(hx+1,top+2,2,2); g.fillStyle="#3a2e20"; g.fillRect(hx+1,top+2,2,1); g.fillRect(hx+1,top+3,2,1); }   // boarded window
  else if(dx-hx>=3){ g.fillStyle=wc; g.fillRect(hx+1,HORIZON-4,2,2); }
  // YARD — hedges/tree for the rich, a picket fence & mailbox for the middle, a laundry line & junk for the poor
  if(tier===2){ g.fillStyle=L>0.5?"#3f7f4a":"#1c3a24"; g.fillRect(hx-2,HORIZON-2,2,2); g.fillRect(hx+hw,HORIZON-2,2,2);
    g.fillStyle=L>0.5?"#2f6f3a":"#16301c"; g.fillRect(hx+hw+1,HORIZON-4,2,2); }
  else if(tier===1){ g.fillStyle=L>0.5?"#c9cdd6":"#4a4e58"; for(var fp=hx-1;fp<hx+hw+1;fp+=2) g.fillRect(fp,HORIZON-2,1,2);
    g.fillStyle="#c05a3a"; g.fillRect(hx-2,HORIZON-3,1,2); }
  else { if((b.seed&1)){ g.strokeStyle="rgba(150,150,160,0.5)"; g.lineWidth=1; g.beginPath(); g.moveTo(hx,top+1); g.lineTo(hx-3,top+3); g.stroke();
    g.fillStyle="#d24a4a"; g.fillRect(hx-2,top+2,1,1); g.fillStyle="#4a7fd2"; g.fillRect(hx-1,top+2,1,1); }
    g.fillStyle=L>0.5?"rgba(150,140,120,0.5)":"rgba(70,66,56,0.5)"; g.fillRect(hx-2,HORIZON-1,2,1); }              // dirt/junk at the curb
}

function drawLayer(g,layer,L,now,fx,hol,haze){
  // does THIS layer wear holiday decorations? (near + mid; props only on the near row)
  var decor=hol.decor && (layer===near||layer===mid), doProps=hol.decor && layer===near;
  var dim=(fx.cloudy||fx.rain||fx.snow)?0.8:1, dayLit=L*dim;
  var night=1-L;                               // 0 day .. 1 night
  var isNight=L<0.45;                           // windows use their night-lit pattern below this
  // atmospheric haze target: pulled toward this life's THEME colour so the whole
  // skyline (the big far/mid towers especially) reads as the theme, not washed-out blue
  var skyTint=cityEra.tint?mixc([150,178,220],cityEra.tint,0.55*cityEra.blend):[150,178,220];
  for(var bi=0;bi<layer.blds.length;bi++){ var b=layer.blds[bi];
    var bx=(b.x-WOFF)|0;
    if(bx+b.w<-2 || bx>SW+2) continue;         // cull to this screen's slice
    if(hasOcean && b.district==="industrial" && layer!==near) continue;   // harbour: only the near shoreline in the docks (inland cities keep the full industrial skyline)
    if(layer===near && overSite(b.x,b.w)) continue;           // a construction site stands here instead
    if(overLandmark(b.x,b.w)) continue;   // a civic landmark stands in this cleared plaza (all depths — open land)
    if(b.bAge!==undefined){                                    // ---- GROWTH: has this plot been redeveloped yet? ----
      var born=cityG-b.bAge;
      if(born<=0){                                             // its DESIGNED building isn't demanded yet…
        if(b.type!=="park" && cityG>=b.houseAge && (layer===near||layer===mid))
          drawHouse(g,bx,b,L,now,dayLit,night);                // …so a small house settles the plot first (open land before that)
        continue;
      }
      var bnd=bandOf(b);
      if(born<bnd && b.type!=="park"){ drawGrowSite(g,bx,b.w,b.h,Math.max(0.12,born/bnd),b.seed,L,now,b.crew||1); continue; }  // redeveloping (house → the taller building)
    }
    if(cityPhase==="apoc" && b.type!=="park"){
      if(curDeath==="nuke"){                                    // NUKE: the blast wave hurls buildings down in order as its front reaches them
        var gzB=nukeGZX(now), frB=nukeFrontR(), sdxB=((b.x-gzB)%WW+WW*1.5)%WW-WW*0.5, distB=Math.abs(sdxB);
        if(frB>distB){ drawApocBuilding(g,b,bx,Math.min(1,(frB-distB)/(WW*0.075)),L,now,sdxB>=0?1:-1); continue; }
        // else: the wave hasn't reached this block yet — it still stands (fall through to normal draw)
      } else if(curDeath==="meteors"){                          // METEORS: a small strike or the massive impact's fiery front smashes & ignites each building
        var mc=meteorCollapse(b.x,now);
        if(mc.cl>=0){ drawApocBuilding(g,b,bx,mc.cl,L,now,mc.bd); continue; }
        // else: nothing has reached this block yet — it still stands (the planet-killer is still falling)
      } else if(curDeath==="sunburst"){                          // SUNBURST: the sun's glare ignites the whole skyline at once (staggered), each charring & collapsing in place
        var sc=sunCl(b.seed!=null?b.seed:bi);
        if(sc>=0){ drawApocBuilding(g,b,bx,sc,L,now); continue; }
        // else: not ignited yet — it still stands, baking under the swelling sun (fall through to normal draw)
      } else if(curDeath==="ai"){                                // AI: the assimilation front converts each building into a machine-factory, then strip-mines it to a dead husk
        var acl=frontCollapse(b.x,aiFrontR());
        if(acl>=0){ drawApocBuilding(g,b,bx,acl,L,now); continue; }
        // else: the front hasn't reached this block — it still stands (the takeover is spreading toward it)
      } else if(curDeath==="bh"){                                // BLACK HOLE: the pull reaches each building in turn, tearing it from its base and streaming it into the singularity
        var bcl=frontCollapse(b.x,bhFrontR());
        if(bcl>=0){ drawApocBuilding(g,b,bx,bcl,L,now,0); continue; }
        // else: outside the pull radius (for now) — it still stands, shuddering toward the hole
      } else if(curDeath==="alienwar"){                          // ALIEN WAR: stray crossfire beam/wreckage strikes rake the city, vaporizing buildings into burning wreckage
        var wcl=alienCl(b.seed!=null?b.seed:bi);
        if(wcl>=0){ drawApocBuilding(g,b,bx,wcl,L,now); continue; }
        // else: this block hasn't been hit yet — it still stands as the battle rages overhead
      } else if(curDeath==="frost"){                             // DEEP FREEZE: the killing cold reaches each block, frosting it over, encasing it in ice & burying it
        var frc=frostCl(b.seed!=null?b.seed:bi);
        if(frc>=0){ drawApocBuilding(g,b,bx,frc,L,now); continue; }
        // else: not frozen yet — it still stands as the blizzard closes in
      } else if(curDeath==="kaiju"){                             // KAIJU: the monster's rampage reaches each building in turn and smashes it flat
        var kcl=frontCollapse(b.x,kaijuFrontR());
        if(kcl>=0){ drawApocBuilding(g,b,bx,kcl,L,now); continue; }
        // else: the beast hasn't reached this block — it still stands as the rampage advances
      } else if(curDeath==="flood"){                             // THE FLOOD: the rising sea covers each block; tall towers hold out, then topple & wash away
        if(floodLevel() >= b.h+6) continue;                      // fully drowned — the water covers it (drawn by the flood overlay); skip
        var flc=floodCl(b.h);
        if(flc>=0){ drawApocBuilding(g,b,bx,flc,L,now); continue; }   // undermined → tilting & breaking into the water
        // else: still standing, its base swallowed by the rising water (fall through to normal draw)
      } else if(curDeath==="kaijuwar"){                          // KAIJU WAR: trampled on the approach, wrecked in the melee — collateral of the titans' battle
        var kwc=kwCl(b.x,now);
        if(kwc>=0){ drawApocBuilding(g,b,bx,kwc,L,now); continue; }
        // else: the battle hasn't touched this block yet — it stands (and watches)
      } else if(curDeath==="pollution"){                         // POLLUTION: NOTHING is demolished — the city stands and suffocates.
        // fall through to the normal draw; polDark() kills the lights and the pall greys it out
      } else {                                                  // other cataclysms: the whole skyline dies row by row
        var dT=((((b.seed||bi)*2654435761)>>>0)/4294967296)*0.7;
        if(cityApoc>dT){ drawApocBuilding(g,b,bx,Math.min(1,(cityApoc-dT)/0.22),L,now); continue; }
      }
    }
    if(layer===near||layer===mid){                              // ---- disaster override (near AND mid rows burn) ----
      if(curDis && disDestroys(curDis.type) && inZone(b.x,b.w,curDis)){ drawDisasterBuilding(g,b,bx,curDis,L,now); continue; } }
    if(layer===near||layer===mid){                              // ---- permanently-ruined district (a rare lost CAT-5, dead for the rest of this life) ----
      if(curRuins.length){ var ruz=null;
        for(var rz2=0;rz2<curRuins.length;rz2++) if(inZone(b.x,b.w,curRuins[rz2])){ ruz=curRuins[rz2]; break; }
        if(ruz){ drawRuinBuilding(g,b,bx,ruz,L,now); continue; } } }
    if(layer===near||layer===mid){                              // ---- voted zone-build (stadium/park/casino) occupies this district: clear the ground; drawBuilds paints the structure ----
      if(curBuilds.length){ var onBuild=false;
        for(var qb=0;qb<curBuilds.length;qb++){ var cbz=curBuilds[qb]; if(isZoneBuild(cbz.t)&&inZone(b.x,b.w,cbz)){ onBuild=true; break; } }
        if(onBuild) continue; } }
    if(layer===near){                                            // rebuilt towers only replace the near row
      if(curRebuilt.length){ var rbz=null;
        for(var rz=0;rz<curRebuilt.length;rz++) if(inZone(b.x,b.w,curRebuilt[rz])){ rbz=curRebuilt[rz]; break; }  // nearest-first
        if(rbz){ var rbd=newTowerDNA(b.x,b.h,rbz.seed); drawNewTower(g,bx,b.w,rbd.nh,rbd,L,now,0); drawRebuiltScars(g,bx,b.w,rbz,L,now); continue; } }
    }
    if(b.type==="park"){
      if(cityPhase==="apoc" && apocStruck() && apocHit(b.x) && curDeath!=="flood"){   // the blast/impacts/heat/cold scorch/kill the park to blackened ground & stumps (flood just submerges it under the water overlay)
        var frostP=(curDeath==="frost");
        g.fillStyle=frostP?"#8aa2be":"#221812"; g.fillRect(bx-1,HORIZON-1,b.w+2,3);      // frozen-pale vs charred ground
        for(var st5=bx+1; st5<bx+b.w-1; st5+=4){ g.fillStyle=frostP?"#c8dcf0":"#140d0a"; g.fillRect(st5,HORIZON-2,1,2); }   // frosted / charred stumps
        continue; }
      drawPark(g,b,bx,L,now,dayLit,night); continue; }
    if(curSpace>0&&b.spAge!==undefined&&curSpace>=b.spAge){       // G1: the future has reached this block
      drawFutureBuilding(g,b,bx,layer,L,now,night,dayLit,Math.min(1,(curSpace-b.spAge)/0.045));
      continue; }
    var top=(layer.y0-b.h)|0, bh=HORIZON-top;
    // matte colonial walls brighten GENTLY in sun (glass/neon towers keep the strong 2.3× lift) —
    // otherwise the barn-reds & brick wash out to pink at noon.
    var neMatte=(b.nePitch||b.clap||b.church), bMul=neMatte?1.5:2.3, bA0=neMatte?18:30,bA1=neMatte?22:40,bA2=neMatte?30:56;
    var col=mixc(b.c,[Math.min(255,b.c[0]*bMul+bA0),Math.min(255,b.c[1]*bMul+bA1),Math.min(255,b.c[2]*bMul+bA2)],dayLit);
    if(cityEra.tint) col=mixc(col,cityEra.tint,cityEra.blend*(0.6+0.4*dayLit));   // this life's architectural material
    if(haze) col=mixc(col,skyTint,haze*dayLit);
    if(goldenK>0.03) col=mixc(col,goldC,goldenK*0.22*dayLit);   // the golden hour warms every facade
    var colc=css(col);
    // ---- draw the segmented silhouette (each setback narrower; ground seg meets the street) ----
    for(var sgi=0;sgi<b.segs.length;sgi++){ var sg=b.segs[sgi];
      var sX=bx+sg.dx, sTop=top+sg.top, sBot=(sgi===0)?HORIZON:(top+sg.bot), sHt=sBot-sTop;
      g.fillStyle=colc; g.fillRect(sX,sTop,sg.w,sHt);
      if(b.brick){                                            // brick coursing (old-town / industrial)
        g.fillStyle="rgba(0,0,0,0.14)";
        for(var mby=sTop+2; mby<sBot-1; mby+=3) g.fillRect(sX,mby,sg.w,1);
      } else if(b.clap){                                       // New England wood clapboard: fine horizontal lap-siding lines
        g.fillStyle="rgba(0,0,0,0.06)";
        for(var cby=sTop+3; cby<sBot-1; cby+=2) g.fillRect(sX,cby,sg.w,1);
      }
      if(dayLit>0.12){                                       // the lit face tracks the REAL sun (east mornings, west evenings)
        var sunL=curSunDf<0.5, hiX=sunL?sX:sX+sg.w-1, shX=sunL?sX+sg.w-1:sX;
        g.fillStyle=(goldenK>0.25)?("rgba(255,214,160,"+(dayLit*0.34)+")"):("rgba(255,248,225,"+(dayLit*0.30)+")"); g.fillRect(hiX,sTop,1,sHt);   // golden-hour rim
        g.fillStyle="rgba(214,232,255,"+(dayLit*0.45)+")"; g.fillRect(sX,sTop,sg.w,1);
        g.fillStyle="rgba(6,8,24,"+(dayLit*0.34)+")";      g.fillRect(shX,sTop,1,sHt);
      }
      if(snowpack>0.15&&(layer===near||layer===mid)){        // fresh snow settles on every tier
        g.fillStyle="rgba(240,246,255,"+Math.min(0.85,snowpack*0.9).toFixed(2)+")"; g.fillRect(sX,sTop,sg.w,1); }
      if((layer===near||layer===mid)&&sg.w>=7){              // D6: cornice line caps every setback tier
        g.fillStyle="rgba(255,255,255,0.10)"; g.fillRect(sX,sTop+1,sg.w,1);
        g.fillStyle="rgba(0,0,0,0.15)";       g.fillRect(sX,sTop+2,sg.w,1);
        if(sgi>0){ g.fillStyle="rgba(0,0,0,0.20)"; g.fillRect(sX-1,sBot,sg.w+2,1); }   // shadow on the terrace below
      }
      if(b.brick&&layer===near&&sg.w>=8){                    // D6: stone quoins up the corners of brick builds
        g.fillStyle="rgba(255,255,255,0.10)";
        for(var qy=sTop+((sTop&2)>>1);qy<sBot-1;qy+=4){ g.fillRect(sX,qy,1,2); g.fillRect(sX+sg.w-1,qy+2<sBot?qy+2:qy,1,2); }
      }
    }
    if(layer===near && !b.church){   // WEATHERING: faint grime streaks bleed down from ledges — organic aging, deterministic
      var wn7=(b.seed>>>11)%4;
      for(var ws7=0;ws7<wn7;ws7++){ var wgx=bx+2+((b.seed>>(ws7*3+2))%Math.max(1,b.w-3)), wgl=5+((b.seed>>(ws7*2+1))%9);
        g.fillStyle="rgba(18,16,14,0.09)"; g.fillRect(wgx|0,(top+3+((b.seed>>ws7)%6))|0,1,Math.min(wgl,bh-5)); }
      if((b.seed&7)===0){ g.fillStyle="rgba(30,34,30,0.10)"; g.fillRect(bx+1,top+2,Math.max(2,b.w-4),1); }        // water stain under the eave
      if((b.seed&7)===3){ g.fillStyle="rgba(90,120,80,0.12)"; g.fillRect(bx,HORIZON-3,1,3); g.fillRect(bx+b.w-1,HORIZON-3,1,3); }  // moss creeping up the corners
    }
    if(layer===near && dayLit>0.2){                          // long morning/evening shadows thrown on the ground
      var sunL2=curSunDf<0.5, shL=Math.round(2+(1-Math.sin(Math.max(0.05,Math.min(0.95,curSunDf))*Math.PI))*26);
      g.fillStyle="rgba(8,10,25,"+(0.15*dayLit)+")";
      g.fillRect(sunL2?bx+b.w:bx-Math.round(shL*0.6), HORIZON, Math.round(shL*0.6), 2);         // dense core
      g.fillStyle="rgba(8,10,25,"+(0.07*dayLit)+")";
      g.fillRect(sunL2?bx+b.w:bx-shL, HORIZON, shL, 2);                                          // soft long tail
    }
    var tX=bx+b.topDx, tW=b.topW;                            // top-segment (roof features attach here)
    drawCrown(g,b.crown,tX,top,tW,col,b.accent,L,now,night);
    // rooftop mechanicals (flat/step tops)
    for(var ri=0;ri<b.roof.length;ri++){ var rs=b.roof[ri], rX=tX+rs.x, rY=top-rs.h;
      g.fillStyle=L>0.5?"#2a2733":"#0b0912"; g.fillRect(rX,rY,rs.w,rs.h);
      if(rs.k===1){ g.fillStyle=L>0.5?"#3a3646":"#141120"; g.fillRect(rX,rY,rs.w,1); }                 // vent cap
      else if(rs.k===2){ g.fillStyle=rgba(b.accent2,0.5*night); g.fillRect(rX,rY,rs.w,1); }             // water-tank glint
      else if(rs.k===3){ g.fillStyle=L>0.5?"#2a2733":"#0b0912"; g.fillRect(rX+(rs.w>>1),rY-2,1,2); }    // mast
      else if(rs.k===4){ g.fillStyle=L>0.5?"#3a3646":"#141120"; g.fillRect(rX,rY,rs.w,1);               // stair-bulkhead / penthouse
        if(L<0.6){ g.fillStyle="rgba(255,214,150,0.75)"; g.fillRect(rX+1,rY+1,1,Math.max(1,rs.h-1)); } } // its lit door
      else if(rs.k===5){ for(var fn=0;fn<rs.w;fn++){ g.fillStyle=(fn&1)?(L>0.5?"#3a3e46":"#161a22"):(L>0.5?"#2a2d34":"#0e1016"); g.fillRect(rX+fn,rY,1,rs.h); }  // finned AC condenser bank
        g.fillStyle=L>0.5?"#4a4e56":"#1a1e26"; g.fillRect(rX,rY,rs.w,1); }
      if(rs.k<4 && L>0.5){ g.fillStyle="rgba(255,255,255,0.09)"; g.fillRect(rX,rY,rs.w,1); }            // subtle sunlit top on plain units
      if(rs.blink && L<0.6 && (Math.floor(now/700))%2===0){ g.fillStyle="#ff5050"; g.fillRect(rX+(rs.w>>1),rY-1,1,1); }
    }
    // rooftop garden (on the top segment)
    if(b.greenRoof){ g.fillStyle=css(mixc([26,54,32],[64,138,68],dayLit)); g.fillRect(tX+1,top,tW-2,1);
      for(var gx=tX+1;gx<tX+tW-1;gx+=3) g.fillRect(gx,top-1,1,1); }
    // rooftop bar/pool life
    drawRooftop(g,b,tX,top,tW,L,now,night);
    // windows
    var litCount=0;
    var winAlpha=0.9*dim*(isNight?1:0.5);
    var d6=(layer===near)&&(b.winLayout==="grid"||b.winLayout==="punch");
    var blk6=curBlk&&isNight&&inBlk(b.x+(b.w>>1));                        // L1: this block lost power
    for(var wi=0;wi<b.win.length;wi++){ var w=b.win[wi];
      if(d6){ var wh6=w.x*13+w.y*11+b.seed;
        if(wh6%29===0){ g.fillStyle=L>0.5?"#9aa0ab":"#3c414c"; g.globalAlpha=1;
          g.fillRect(bx+w.x+w.w-1,top+w.y+w.h-1,1,1); }                            // window AC unit
        else if(b.district==="residential"&&wh6%17===0){ g.globalAlpha=1; g.fillStyle="rgba(20,22,30,0.8)";
          g.fillRect(bx+w.x-1,top+w.y+w.h,w.w+2,1); } }                            // balcony rail
      var lit=isNight?(w.no&&((w.hx%97)/97<curLit)):w.do;   // evening ramp: more windows light as it gets later
      if(blk6) lit=curBlk.fix&&(((now/130)|0)&1)&&lit;      // dark block; flickers back as the crew works
      if(lit&&polDark(b)) lit=false;                        // POLLUTION finale: this district's lights have died (never flicker back)
      if(w.fl) lit=lit && (((now*0.001*w.fl)|0)%3!==0);
      if(!lit){
        if(!isNight&&layer===near){ g.globalAlpha=0.13;      // day: unlit panes still show sky-glass
          g.fillStyle="#cfe2f4"; g.fillRect(bx+w.x,top+w.y,w.w,w.h); g.globalAlpha=1; }
        continue; }
      litCount++;
      var wc=cityEra.neon?b.winP[w.h2%b.winP.length]                 // neon eras: district-coloured windows
            :(cityEra.win instanceof Array?cityEra.win[w.h2%cityEra.win.length]:cityEra.win);   // themes may carry a whole window palette (stained glass etc.)
      if(hol.halloween) wc=w.on<0.75?"#ff8c1a":"#ffd27a";
      else if(hol.xmas) wc=["#ff4444","#44ff66","#ffd27a","#4488ff"][w.hx%4];
      else if(decor && ((w.x*5+w.y*3)%10) < hol.decor.tint*10) wc=hol.decor.garland[w.hx%hol.decor.garland.length];
      else if(L<0.42 && w.tv){                           // a flickering TV glows blue inside
        var tvp=((Math.floor(now/210))+w.x*3+w.y)%5; wc=tvp<2?"#5f86d8":(tvp<3?"#a8c8ff":"#39508f"); }
      g.fillStyle=wc; g.globalAlpha=winAlpha;
      g.fillRect(bx+w.x,top+w.y,w.w,w.h);
    }
    g.globalAlpha=1;
    if(auroraOn&&layer===near&&night>0.5&&b.h>30*KSP){                          // the aurora in the glass
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(80,255,160,"+(0.05+0.03*Math.sin(now*0.0008+bx)).toFixed(3)+")";
      g.fillRect(bx+1,(HORIZON-b.h)|0,Math.max(1,b.w-2),Math.round(b.h*0.5));
      g.globalCompositeOperation="source-over"; }
    // NIGHT RADIANCE: bathe the tower in its own light (additive halo over the facade)
    if(night>0.55 && litCount>0 && QUAL>0){
      var glow=Math.min(0.14, 0.03+litCount*0.006)*night;
      g.globalCompositeOperation="lighter";
      var hc=cityEra.neon?b.accent:cityEra.glow, hc2=cityEra.neon?b.accent2:cityEra.glow;
      g.fillStyle=rgba(hc,glow); g.fillRect(bx-1,top,b.w+2,bh);
      g.fillStyle=rgba(hc2,glow*0.5); g.fillRect(bx,top-1,b.w,Math.min(bh,10));
      g.fillStyle=rgba(hc,glow*0.35); g.fillRect(bx-2,top-4,b.w+4,4);   // bloom crown rising above the roofline
      g.globalCompositeOperation="source-over";
    }
    if(layer===near&&b.type!=="park"){
      // a stone base course grounds every building at the sidewalk (drawn first; storefronts paint over it)
      g.fillStyle="rgba(0,0,0,0.16)"; g.fillRect(bx,HORIZON-2,b.w,2);
      if(dayLit>0.25){ g.fillStyle="rgba(255,255,255,0.07)"; g.fillRect(bx,HORIZON-2,b.w,1); }
      if((b.winLayout==="corp"||b.winLayout==="ribbon")&&b.w>=10){   // D6: structural slab lines
        g.fillStyle="rgba(0,0,0,0.10)";
        for(var fy6=top+4;fy6<top+bh-3;fy6+=5) g.fillRect(bx+1,fy6,b.w-2,1);
      }
      var dst6=b.district;
      if(b.w>=11&&(dst6==="downtown"||dst6==="entertainment"||dst6==="oldtown")&&((b.seed>>>4)%5)<3){
        var sfY=HORIZON-5;                                          // D6: ground-floor storefront (now on more blocks)
        g.fillStyle="rgba(10,12,18,0.9)"; g.fillRect(bx+1,sfY-1,b.w-2,1);            // transom
        g.fillStyle=L>0.5?"#7d96b2":"#28324a"; g.fillRect(bx+1,sfY,b.w-2,3);         // display glass
        g.fillStyle=css(colc); for(var sp6=bx+4;sp6<bx+b.w-2;sp6+=5) g.fillRect(sp6,sfY,1,3);   // mullion posts
        if(L<0.5){ g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,214,140,0.14)"; g.fillRect(bx+1,sfY,b.w-2,4);
          g.globalCompositeOperation="source-over"; }
      }
    }
    // grime streaks
    g.fillStyle="rgba(0,0,0,0.30)";
    for(var sti=0;sti<b.st.length;sti++){ var s=b.st[sti];
      if(s.y<b.h-2) g.fillRect(bx+s.x, top+s.y, s.w, Math.min(s.h,b.h-s.y-1)); }
    // coloured LED edge strip along the top-segment roofline (neon-age only)
    if(b.ledge && L<0.62 && cityEra.neon){
      var lc=hex2rgb(NEON[b.ledC]);
      g.globalCompositeOperation="lighter";
      g.fillStyle=rgba(lc,0.7*night+0.15); g.fillRect(tX,top,tW,1);
      g.fillStyle=rgba(lc,0.5*night+0.1);  g.fillRect(tX,top,1,Math.min(bh,20));
      g.fillStyle=rgba(b.accent2,0.4*night); g.fillRect(tX+tW-1,top,1,Math.min(bh,20));
      g.globalCompositeOperation="source-over";
    }
    // vertical neon sign glyphs (down the top-segment facade) — neon-age only
    if(b.sign && b.h>22 && tW>=12 && L<0.62 && cityEra.neon){
      var dead=((Math.floor(now/97))+bi*7)%31===0;
      if(!dead){ var sc=NEON[b.signC], sgx=tX+tW-5,
        buzz=((Math.floor(now/53))+bi)%17===0?0.45:0.95;
        for(var k=0;k<b.gl.length;k++){ var yy=top+b.signY+k*4; if(yy>HORIZON-8) break;
          var pat=b.gl[k];
          g.fillStyle=sc; g.globalAlpha=0.10*buzz; g.fillRect(sgx-2,yy-2,7,6);   // outer bloom
          g.globalAlpha=0.20*buzz; g.fillRect(sgx-1,yy-1,5,4);
          g.globalAlpha=buzz;
          for(var px=0;px<3;px++) for(var py=0;py<3;py++) if(pat&(1<<(py*3+px))) g.fillRect(sgx+px,yy+py,1,1);
          g.globalAlpha=1; }
      }
    }
    // rooftop billboard (on the top segment) — neon-age only
    if(b.bill && L<0.72 && cityEra.neon){
      var bbx=tX+3, bby=top+3, bw2=tW-6, bh2=8;
      var bc=NEON[(b.billC+((Math.floor(now/5000))))%NEON.length];
      var bflick=((Math.floor(now/71))+bi*3)%29===0?0.25:0.8;
      g.fillStyle=bc; g.globalAlpha=0.12*bflick; g.fillRect(bbx-1,bby-1,bw2+2,bh2+2);
      g.globalAlpha=0.55*bflick; g.fillRect(bbx,bby,bw2,bh2);
      g.fillStyle="rgba(255,255,255,0.35)"; g.fillRect(bbx,bby+((Math.floor(now/300))%bh2),bw2,1);
      g.globalAlpha=1;
    }
    // little rooftop satellite dish (on the top segment)
    if(b.dish){ g.fillStyle=L>0.5?"#2a2733":"#0b0912"; g.fillRect(tX+tW-4,top-3,3,1); g.fillRect(tX+tW-3,top-2,1,2); }
    // fire escape (zigzag rail + landings down one side)
    if(b.fesc>=0){ var fX=b.fesc===0?bx+1:bx+b.w-2;
      g.fillStyle=L>0.5?"rgba(18,16,24,0.85)":"rgba(6,5,10,0.9)"; g.fillRect(fX,top+3,1,bh-4);
      for(var fr=top+7; fr<HORIZON-2; fr+=4) g.fillRect(fX-(b.fesc===0?0:1),fr,2,1); }
    // ground-floor entrance: a real person-sized DOORWAY (~6px tall so a 7px pedestrian fits) with a
    // pale frame/lintel and warm light spilling onto the sidewalk
    if(b.entr && b.w>=8){ var edw=Math.min(b.w-2,4+((b.w/9)|0)), eX=bx+((b.w-edw)>>1), edh=Math.min(6,b.h-2);
      g.fillStyle=L>0.5?"#15121d":"#0a0812"; g.fillRect(eX,HORIZON-edh,edw,edh);       // the open doorway
      g.fillStyle=L>0.5?"rgba(236,236,244,0.20)":"rgba(150,155,175,0.16)";             // door frame + lintel (trim)
      g.fillRect(eX-1,HORIZON-edh-1,edw+2,1); g.fillRect(eX-1,HORIZON-edh,1,edh); g.fillRect(eX+edw,HORIZON-edh,1,edh);
      g.fillStyle=L>0.5?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.4)"; g.fillRect(eX+((edw-1)>>1),HORIZON-edh+1,1,edh-1);  // the door split
      if(L<0.62){ var ec=b.entrWarm?[255,214,140]:hex2rgb(NEON[b.ledC]);
        g.globalCompositeOperation="lighter";
        g.fillStyle=rgba(ec,0.42*night+0.12); g.fillRect(eX,HORIZON-edh+1,edw,edh-1);   // warm interior glow
        g.fillStyle=rgba(ec,0.24*night);      g.fillRect(eX-1,HORIZON-1,edw+2,1);       // light pooling on the pavement
        g.fillStyle=rgba(ec,0.10*night);      g.fillRect(eX-2,HORIZON-2,edw+4,2);        // softer wider spill
        g.globalCompositeOperation="source-over"; }
      if(b.awning>=0){ var awc=hex2rgb(NEON[b.awning]), aw=Math.min(b.w-2,edw+4), aX=bx+((b.w-aw)>>1);
        g.fillStyle=rgba(awc,0.85); g.fillRect(aX,HORIZON-edh-1,aw,1);        // marquee band above the door
        for(var av=0;av<aw;av+=2) g.fillRect(aX+av,HORIZON-edh,1,1);          // scalloped fringe
        if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(awc,0.3*night); g.fillRect(aX-1,HORIZON-edh-2,aw+2,2); g.globalCompositeOperation="source-over"; } }
      // a holiday prop hung over the doorway (the building "celebrates" the day)
      if(doProps && (((b.x|0)%3)===0)) drawProp(g,hol.decor.prop, eX+(edw>>1), HORIZON, L, now, night);
    }
    // holiday garland lights strung along the top-segment roofline (every holiday)
    if(decor){ var gc=hol.decor.garland;
      for(var i2=1;i2<tW-1;i2+=2){ var cc=gc[(((i2/2)|0)+bi)%gc.length];
        if(((Math.floor(now/500))+i2)%4!==0){ g.fillStyle=cc; g.fillRect(tX+i2,top-1,1,1);
          if(L<0.55){ g.globalCompositeOperation="lighter"; g.globalAlpha=0.25; g.fillStyle=cc;
            g.fillRect(tX+i2-1,top-2,3,2); g.globalAlpha=1; g.globalCompositeOperation="source-over"; } } } }
    if(b.roofL&&L<0.6&&((Math.floor(now/900))%2===0)){ g.fillStyle="#ff4040"; g.fillRect(tX+(tW>>1),top-2,1,1); }
  }
}

// ---- elevated train line (always present) + train (on schedule) ----
function drawTrainLine(g,L,now,fx){
  var twf=gstage(0.42,0.58); if(twf<=0) return;               // the viaduct is BUILT west→east across the world
  var built=WW*twf, bEnd=Math.min(SW,built-WOFF);             // how much of the line reaches this screen
  var ty=(HORIZON-Math.round(GROUND*1.1))|0;
  var night=1-L;
  var p0=Math.floor(WOFF/40)*40, blasted=nukeStruck();       // the nuke blows the viaduct apart span by span
  g.fillStyle=L>0.5?"#3a3346":"#12101c";
  for(var wx=p0; wx<WOFF+SW+40; wx+=40){ if(wx>built||(blasted&&nukeHit(wx))) continue; var sx=wx-WOFF;
    g.fillRect(sx-1, ty+3, 3, HORIZON-ty-3);
    g.fillStyle=L>0.5?"#4c4458":"#191624"; g.fillRect(sx-2, ty+3, 5, 1);      // pillar cap
    g.fillStyle=L>0.5?"#3a3346":"#12101c"; }
  if(bEnd>0){
    if(blasted){                                                             // BLASTED DECK — only the spans the wave hasn't reached survive
      for(var dsx=((-WOFF%4)+4)%4; dsx<bEnd; dsx+=4){ if(nukeHit(dsx+WOFF)) continue;
        g.fillStyle=L>0.5?"#4a4356":"#171522"; g.fillRect(dsx|0,ty,4,3);
        g.fillStyle=L>0.5?"rgba(255,255,255,0.14)":"rgba(160,175,205,0.10)"; g.fillRect(dsx|0,ty,4,1);
        g.fillStyle=L>0.5?"#2a2636":"#0d0b16"; g.fillRect(dsx|0,ty+3,4,1); }
    } else {
      g.fillStyle=L>0.5?"#4a4356":"#171522"; g.fillRect(0,ty,bEnd|0,3);
      g.fillStyle=L>0.5?"rgba(255,255,255,0.14)":"rgba(160,175,205,0.10)"; g.fillRect(0,ty,bEnd|0,1);   // deck edge light
      g.fillStyle=L>0.5?"#2a2636":"#0d0b16"; g.fillRect(0,ty+3,bEnd|0,1);
    }
  }
  if(night>0.5 && bEnd>0){ g.fillStyle=rgba([120,200,255],0.5*night);
    for(var lx=(-WOFF%8+8)%8; lx<bEnd; lx+=8){ if(blasted&&nukeHit(lx+WOFF)) continue; g.fillRect(lx|0,ty-1,1,1); } }
  // overhead catenary: a contact wire the train's pantograph rides, on registration arms
  var cwY=ty-12;
  if(bEnd>0){
    g.fillStyle=L>0.5?"#5a5560":"#20202c";
    for(var cwm=p0; cwm<WOFF+SW+40; cwm+=40){ if(cwm>built||(blasted&&nukeHit(cwm))) continue; var cmx=cwm-WOFF;
      g.fillRect(cmx-1,cwY-3,1,4);                                       // registration arm above the wire
      g.fillRect(cmx-2,cwY-3,3,1); }
    g.fillStyle=L>0.5?"rgba(180,190,210,0.6)":"rgba(150,165,195,0.42)";
    if(blasted){ for(var wsx=((-WOFF%4)+4)%4; wsx<bEnd; wsx+=4){ if(nukeHit(wsx+WOFF)) continue; g.fillRect(wsx|0,cwY,4,1); } }
    else g.fillRect(0,cwY,bEnd|0,1);                                     // the contact wire
  }
  // the railhead: a crane crew extends the line until it spans the whole world
  if(twf<1){ var hx=built-WOFF;
    if(hx>-10&&hx<SW+10){ g.fillStyle=L>0.5?"#e0a83a":"#5a4418";
      g.fillRect(hx|0,ty-10,1,10); g.fillRect((hx-7)|0,ty-10,14,1);
      if((Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect(hx|0,ty-11,1,1); }
      drawPerson(g,(hx-3)|0,ty-1,"#c8742a",SKINC[1],(Math.floor(now/400))&1);   // hi-vis crew on the deck
    } }
  // the train itself — service begins once the line is complete
  var tr=(twf>=1 && (apocPositional() ? !apocFull() : apocKill<0.3))?trainNow(now):null;   // service runs until the wave/barrage takes the whole line (positional deaths break it per-span too)
  var trC=(tr&&tr.stopped)?(tr.x+tr.dir*36):null;               // a train is AT a platform (riders board)
  // ELEVATED STATIONS: platform + canopy + stair shaft + line signs + waiting riders
  for(var st2=0; st2<TRSTOPS.length; st2++){ var wxs=Math.round(TRSTOPS[st2]*WW);
    if(wxs>built || (blasted&&nukeHit(wxs))) continue;          // a station opens when the line reaches it — and is blasted away with the viaduct
    for(var sw2=-1;sw2<=1;sw2++){ var SXs=(wxs-WOFF+sw2*WW)|0; if(SXs<-14||SXs>SW+14) continue;
      g.fillStyle=L>0.5?"#5a5266":"#1d1a2a"; g.fillRect(SXs-8,ty-1,17,1);          // platform slab
      g.fillStyle=L>0.5?"#6a6276":"#242032"; g.fillRect(SXs-7,ty-6,15,1);          // canopy
      g.fillStyle=L>0.5?"#4a4356":"#171522"; g.fillRect(SXs-7,ty-5,1,4); g.fillRect(SXs+7,ty-5,1,4);   // canopy posts
      g.fillStyle=L>0.5?"#3a3346":"#12101c"; g.fillRect(SXs+9,ty,2,HORIZON-ty);    // stair shaft down to the street
      g.fillStyle=L>0.5?"#8a8296":"#3a3648"; for(var stp=ty+2; stp<HORIZON-1; stp+=3) g.fillRect(SXs+9,stp,2,1);   // steps
      for(var lc2=0;lc2<3;lc2++){ g.fillStyle=TRLINE[(st2+lc2)%TRLINE.length]; g.fillRect(SXs-6+lc2*2,ty-8,1,1); } // lines-served signs
      if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,235,180,0.16)";
        g.fillRect(SXs-8,ty-5,17,4); g.globalCompositeOperation="source-over"; }   // platform lighting
      if(trC===null || Math.abs((trC-WOFF+sw2*WW)-SXs)>12){                        // riders wait — unless they're boarding
        var nw=1+((Math.floor(now/8000)+st2)%3);
        for(var rw=0;rw<nw;rw++){ var rxp=SXs-5+rw*4+((st2*7+rw*13)%3);
          drawPerson(g,rxp,ty-4,PEDC[(st2*5+rw)%PEDC.length],SKINC[(st2+rw)%SKINC.length],0); } }
    } }
  if(tr){ var carLen=15, gap=2, unit=carLen+gap, ncar=Math.max(2,Math.floor(tr.len/unit));
    var lc=TRLINE[((tr.idx%TRLINE.length)+TRLINE.length)%TRLINE.length];
    var cy=ty-9, d=tr.dir, pantCar=1;                          // roof at cy; body 8px sits on the deck at ty
    // headlight glow thrown forward along the track at night
    if(night>0.5){ var hwx=(tr.x+d*(ncar-0.5)*unit)-WOFF, hX=(d>0?hwx+carLen:hwx)|0;
      if(hX>-30&&hX<SW+30){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba([255,244,200],0.10*night);
        g.fillRect(hX+(d>0?0:-24),ty-3,24,3); g.globalCompositeOperation="source-over"; } }
    for(var ci=0;ci<ncar;ci++){
      var wxc=tr.x + d*ci*unit;
      var cx=(wxc-WOFF)|0; if(cx+carLen<-6||cx>SW+6) continue;
      var isHead=(ci===ncar-1), isTail=(ci===0);              // lead car is the one furthest along the direction of travel
      var frontX=d>0?cx+carLen-1:cx;                          // the leading edge of this car
      // inter-car gangway to the next car (dark bellows) so the set reads as one train
      if(ci<ncar-1){ var gx=d>0?cx+carLen:cx-gap; g.fillStyle=L>0.5?"#2a2e3a":"#14161f"; g.fillRect(gx,cy+2,gap,5); }
      // body shell
      g.fillStyle=L>0.5?"#cdd6e6":"#8a94a8"; g.fillRect(cx,cy,carLen,8);
      g.fillStyle="rgba(255,255,255,0.32)"; g.fillRect(cx,cy,carLen,1);            // roof sheen
      g.fillStyle=lc; g.fillRect(cx,cy+1,carLen,1);                                // this LINE's colour band (whole run)
      g.fillStyle="rgba(20,24,34,0.4)"; g.fillRect(cx,cy+6,carLen,1);             // belt line
      // rounded/tapered cab on the lead car
      if(isHead){ var nx=d>0?cx+carLen-1:cx;
        g.fillStyle=L>0.5?"#b9c2d2":"#767f92"; g.fillRect(nx,cy+1,1,1); g.fillRect(nx,cy+6,1,1);   // raked nose corners
        g.fillStyle="#0b0e16"; g.fillRect(d>0?cx+carLen-2:cx+1,cy+2,1,2);          // windshield
        g.fillStyle="#fff4c0"; g.fillRect(nx,cy+4,1,1); g.fillRect(nx,cy+5,1,1);   // twin headlights
        if(night>0.5){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba([255,244,190],0.4); g.fillRect(nx,cy+4,1,2); g.globalCompositeOperation="source-over"; }
        var sgn=d>0?cx+carLen-4:cx+2; g.fillStyle=lc; g.fillRect(sgn,cy+2,2,1); }  // destination sign in the line colour
      // rear tail lights
      if(isTail){ var tx=d>0?cx:cx+carLen-1; g.fillStyle="#ff2a2a"; g.fillRect(tx,cy+4,1,2); }
      // lit windows with passenger silhouettes
      var stopped=(tr.stopped && Math.abs(wxc-trC)<carLen);            // this car is at the platform → doors open
      for(var wxi=2;wxi<carLen-2;wxi+=3){
        var isDoor=((wxi-2)%6===0);
        if(isDoor && stopped){ g.fillStyle=L>0.5?"#2a2e3a":"#12141d"; g.fillRect(cx+wxi,cy+2,2,4); continue; }  // open doorway
        g.fillStyle="#fff6cf"; g.fillRect(cx+wxi,cy+3,2,3);
        if(((wxc|0)*7+wxi*13+tr.idx)%3===0){ g.fillStyle="rgba(30,34,44,0.8)"; g.fillRect(cx+wxi+((wxi>>1)&1),cy+3,1,2); }  // seated rider
        g.fillStyle="rgba(20,24,34,0.5)"; g.fillRect(cx+wxi-1,cy+3,1,3);            // window pillar
      }
      // underframe, bogies + wheels on the rail
      g.fillStyle="#1a1d26"; g.fillRect(cx,cy+8,carLen,1);
      g.fillStyle=L>0.5?"#0f1118":"#0a0c12"; g.fillRect(cx+2,cy+9,3,1); g.fillRect(cx+carLen-5,cy+9,3,1);   // bogies
      // pantograph reaching the contact wire
      if(ci===pantCar){ var px2=cx+(carLen>>1);
        g.fillStyle=L>0.5?"#3a3e48":"#20232c"; g.fillRect(px2-1,cwY+1,1,cy-cwY); g.fillRect(px2,cwY+1,1,cy-cwY); // arms up to the wire
        g.fillStyle=L>0.5?"#4a4e58":"#2a2e38"; g.fillRect(px2-2,cwY,4,1);            // contact strip
        if((Math.floor(now/220)+ci)%9===0){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba([200,235,255],0.85); g.fillRect(px2,cwY-1,1,1); g.globalCompositeOperation="source-over"; } }
      // interior glow at night
      if(night>0.5){ g.globalCompositeOperation="lighter";
        g.fillStyle=rgba([255,240,190],0.12*night); g.fillRect(cx-1,cy+1,carLen+2,7);
        g.globalCompositeOperation="source-over"; }
    }
  }
}

// ---- helicopter: on a schedule it flies in, lands on a rooftop helipad, sits, departs ----
function chopperNow(now){
  if(!helipads||helipads.length===0) return null;
  var SLOT=44000, idx=Math.floor(now/SLOT), r=rng((idx*2654435761)>>>0);
  if(r()>0.72) return null;                                 // ~72% of slots have a chopper somewhere
  var pad=helipads[(r()*helipads.length)|0], adir=(r()<0.5?1:-1);
  var t=(now-idx*SLOT)/(SLOT*0.92); if(t>1) return null;
  var px=pad.x, py=pad.y, sX=px-adir*130, sY=py-64, x,y,rotor,landed;
  if(t<0.32){ var u=t/0.32, e=u*u*(3-2*u); x=lerp(sX,px,e); y=lerp(sY,py,e); rotor=1; landed=false; }
  else if(t<0.68){ x=px; y=py; var st=(t-0.32)/0.36; rotor=(st<0.22||st>0.78)?1:0.25; landed=true; }
  else { var u2=(t-0.68)/0.32, e2=u2*u2*(3-2*u2); x=lerp(px,px+adir*130,e2); y=lerp(py,py-64,e2); rotor=1; landed=false; }
  return { x:x, y:y, dir:adir, rotor:rotor, landed:landed };
}
function drawChopper(g,wx,y,dir,rotor,L,now){
  y=y|0;
  for(var off=-WW;off<=WW;off+=WW){ var X=(wx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    if(L<0.42){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,245,200,0.12)";   // searchlight
      g.beginPath(); g.moveTo(X,y+2); g.lineTo(X-3,y+15); g.lineTo(X+3,y+15); g.closePath(); g.fill(); g.globalCompositeOperation="source-over"; }
    g.fillStyle=L>0.5?"#3a4048":"#1e222a"; g.fillRect(X-2,y,5,2);                    // body
    g.fillRect(X+(dir>0?-5:3),y,2,1);                                                // tail boom
    g.fillRect(X+(dir>0?-5:4),y-1,1,2);                                              // tail fin
    g.fillStyle="#9fd0ff"; g.fillRect(X+(dir>0?1:-1),y,1,1);                         // cockpit glass
    g.fillStyle="#2a2e36"; g.fillRect(X-2,y+2,5,1); g.fillRect(X-1,y+2,1,1); g.fillRect(X+2,y+2,1,1);  // skids
    g.fillStyle=L>0.5?"#2a2e36":"#161922"; g.fillRect(X,y-2,1,2);                    // mast
    if(rotor>0.5){ g.fillStyle="rgba(200,210,230,0.5)"; g.fillRect(X-5,y-2,11,1); }  // spinning-blur rotor
    else { g.fillStyle="#6a707c"; g.fillRect(X-3+((Math.floor(now/120))%2),y-2,7,1); }       // slow, blades visible
    if((Math.floor(now/280))%2===0){ g.fillStyle="#ff3344"; g.fillRect(X-2,y+1,1,1); g.fillStyle="#33ff66"; g.fillRect(X+2,y+1,1,1); }  // nav lights
  }
}

// ---- airport: a control tower with a rotating beacon, + scheduled departures/arrivals ----
var airportX=0;
// a flight every ~40s, alternating a takeoff (climbs away) and a landing (descends in).
function flightNow(now){
  var PERIOD=40000, idx=Math.floor(now/PERIOD), ph=now-idx*PERIOD, dur=28000;
  if(ph>dur) return null;
  var t=ph/dur, depart=(idx%2===0), span=WW*0.62, climb=HORIZON*0.72, k=depart?t:(1-t);
  var x=airportX+k*span, y=(HORIZON-6)-k*climb;                     // anchored at the airport
  return { x:x, y:y, dir:depart?1:-1, low:k<0.28, idx:idx, k:k };
}
function drawPlane(g,fl,L,now){
  var vis=[fl.x-WOFF]; if(fl.x-WOFF-WW>-16) vis.push(fl.x-WOFF-WW); if(fl.x-WOFF+WW<SW+16) vis.push(fl.x-WOFF+WW);
  for(var vi=0;vi<vis.length;vi++){ var X=vis[vi]|0, Y=fl.y|0; if(X<-16||X>SW+16) continue;
    var d=fl.dir;
    g.fillStyle=L>0.5?"#c9d2de":"#41485a";
    g.fillRect(X-3,Y,7,2);                                          // fuselage
    g.fillRect(X+(d>0?-1:2),Y-1,2,1);                               // tail fin
    g.fillStyle=L>0.5?"#aeb7c6":"#333a48"; g.fillRect(X-1,Y+1,4,1); // wing shadow
    // nav lights: red (port) / green (starboard) + white tail
    g.fillStyle="#ff3344"; g.fillRect((X+(d>0?-3:3))|0,Y,1,1);
    g.fillStyle="#33ff66"; g.fillRect((X+(d>0?4:-4))|0,Y,1,1);
    if((Math.floor(now/500))%2===0){ g.globalCompositeOperation="lighter";                 // anti-collision strobe
      g.fillStyle="rgba(255,255,255,0.9)"; g.fillRect(X,Y-1,1,1); g.globalCompositeOperation="source-over"; }
    if(fl.low){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,244,190,0.85)";  // landing lights when low
      g.fillRect((X+d*4)|0,Y+1,2,1); g.globalCompositeOperation="source-over"; }
  }
}
function drawAirport(g,L,now,night){
  var ap2=gstage(0.55,0.68); if(ap2<=0) return;                     // the airport is built, not conjured
  var tx=airportX-WOFF, twr=Math.round(HORIZON*0.42*(0.25+0.75*ap2));   // tower climbs as construction rises
  for(var w=-1;w<=1;w++){ var X=tx+w*WW; if(X<-14||X>SW+14) continue;
    var top=HORIZON-twr;
    g.fillStyle=L>0.5?"#5a6172":"#191d28"; g.fillRect(X|0,top,3,twr);          // tower shaft
    if(ap2<1){ g.fillStyle=L>0.5?"#e0a83a":"#5a4418";                          // build crane alongside
      g.fillRect((X+5)|0,top-8,1,twr+8); g.fillRect((X-6)|0,top-8,12,1);
      if((Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect((X+5)|0,top-9,1,1); } }
    else { g.fillStyle=L>0.5?"#6b7688":"#20242f"; g.fillRect((X-2)|0,top-3,7,4); }   // glass cab tops it out
    if(ap2>=1&&L<0.62){ g.fillStyle="rgba(190,230,255,0.85)"; g.fillRect((X-1)|0,top-2,5,2); }  // lit cab
    var white=(Math.floor(now/1000))%2===0;
    if(ap2>=1){
    g.globalCompositeOperation="lighter";
    g.fillStyle=white?"#f6ffff":"#2fff7a"; g.fillRect((X+1)|0,top-5,1,1);           // beacon
    g.fillStyle=white?"rgba(246,255,255,0.4)":"rgba(47,255,122,0.4)"; g.fillRect(X|0,top-6,3,3);  // beacon halo
    g.globalCompositeOperation="source-over";
    if((Math.floor(now/900))%2===0){ g.fillStyle="#ff4040"; g.fillRect((X+1)|0,top-4,1,1); }
    }
    // low terminal apron to one side with a row of gate lights
    g.fillStyle=L>0.5?"#3f4655":"#12151d"; g.fillRect((X+4)|0,HORIZON-4,10,4);
    if(L<0.62){ for(var gt=0;gt<10;gt+=2){ g.fillStyle="rgba(255,220,150,0.8)"; g.fillRect((X+5+gt)|0,HORIZON-3,1,1); } }
    // blue taxiway edge lights along the ground in front
    if(L<0.6){ for(var bl=-2;bl<14;bl+=3){ g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(90,150,255,0.8)"; g.fillRect((X+bl)|0,HORIZON+2,1,1); g.globalCompositeOperation="source-over"; } }
  }
  // sequenced approach strobes ("the rabbit") leading in along the arrival path, at night
  if(ap2>=1&&night>0.4){ var seq=(Math.floor(now/120))%6;
    for(var a=0;a<6;a++){ if(a!==seq) continue;
      var kk=0.30+a*0.05, ax=airportX+kk*(WW*0.62), ay=(HORIZON-6)-kk*(HORIZON*0.72);
      for(w=-1;w<=1;w++){ var SX=ax-WOFF+w*WW; if(SX<-2||SX>SW+2) continue;
        g.globalCompositeOperation="lighter"; g.fillStyle="rgba(230,244,255,0.9)";
        g.fillRect(SX|0,ay|0,1,1); g.globalCompositeOperation="source-over"; } }
  }
}

// early OFFROAD vehicles: the founders' jeeps, log trucks and a dozer roam the dirt before roads exist
function drawOffroad(g,wx,y,dir,L,now,kind){
  for(var off=-WW;off<=WW;off+=WW){ var X=(wx-WOFF+off)|0; if(X<-14||X>SW+14) continue;
    var Y=y-((Math.floor(now/160)+X)&1);                      // bouncing over rough ground
    if(kind===2){                                             // bulldozer
      g.fillStyle=L>0.5?"#c8a23a":"#6a5518"; g.fillRect(X,Y-2,7,2);
      g.fillStyle=L>0.5?"#8a7326":"#4a3d12"; g.fillRect(X+(dir>0?6:-1),Y-3,2,3);   // blade
      g.fillStyle="#22242c"; g.fillRect(X,Y,7,1);             // tracks
    } else if(kind===1){                                      // flatbed truck hauling logs
      g.fillStyle=L>0.5?"#7a5230":"#4a3420"; g.fillRect(X,Y-2,6,1);
      g.fillStyle=L>0.5?"#5a80a8":"#2c4258"; g.fillRect(X,Y-1,9,2);
      g.fillStyle=L>0.5?"#9ab8d8":"#48607a"; g.fillRect(X+(dir>0?6:1),Y-2,2,1);    // cab
      g.fillStyle="#16181f"; g.fillRect(X+1,Y+1,2,1); g.fillRect(X+6,Y+1,2,1);
    } else {                                                  // jeep
      g.fillStyle=L>0.5?"#4a6a3a":"#2a3d22"; g.fillRect(X,Y-2,6,2);
      g.fillStyle=L>0.5?"#3a552e":"#20301a"; g.fillRect(X+(dir>0?1:3),Y-3,2,1);    // roll bar
      g.fillStyle="#16181f"; g.fillRect(X,Y,1,1); g.fillRect(X+5,Y,1,1);
    }
    if(L<0.5){ g.fillStyle="rgba(255,240,180,0.85)"; g.fillRect(X+(dir>0?(kind===1?9:7):-1),Y-1,1,1); }
    g.fillStyle=L>0.5?"rgba(150,130,90,0.4)":"rgba(80,70,50,0.35)"; g.fillRect(X+(dir>0?-2:(kind===1?10:8)),Y,2,1);   // kicked-up dust
  }
}

// HORSE-era travel: before the roads are paved, everyone rides or hauls behind a horse
// kinds: 0 = lone rider · 1 = horse + log cart · 2 = covered settler wagon
var HORSEC=["#6a4a2a","#3a2e22","#8a6a48","#54432e"];   // bay/black/palomino/dun coats
function drawHorse(g,wx,y,dir,L,now,kind){
  for(var off=-WW;off<=WW;off+=WW){ var X=(wx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    var step=(Math.floor(now/170)+X)&1, day=L>0.5;                 // trotting gait
    var coat=HORSEC[(kind+((wx|0)>>3))%HORSEC.length];
    var hx=X+(dir>0?0:(kind===0?0:8));                             // horse leads the cart
    g.fillStyle=day?coat:"#221a12";
    g.fillRect(hx,y-3,4,2);                                        // body
    g.fillRect(hx+(dir>0?3:0),y-4,1,1);                            // neck
    g.fillRect(hx+(dir>0?4:-1),y-5,1,2);                           // head
    g.fillRect(hx+(step?0:1),y-1,1,1); g.fillRect(hx+(step?3:2),y-1,1,1);   // legs mid-stride
    g.fillStyle=day?"#2a2018":"#181008"; g.fillRect(hx+(dir>0?-1:4),y-4,1,2);   // tail
    if(kind===0){                                                  // rider up top
      g.fillStyle=day?"#7a5a3a":"#3e3020"; g.fillRect(hx+1,y-5,2,2);
      g.fillStyle=SKINC[((wx|0)>>2)%SKINC.length]; g.fillRect(hx+1,y-6,2,1);   // head
      g.fillStyle=day?"#5a4028":"#2c2014"; g.fillRect(hx+1,y-7,2,1); }         // hat
    else{
      var cx2=X+(dir>0?5:0);                                       // the cart, hitched behind
      g.fillStyle="rgba(90,70,50,0.8)";
      if(dir>0) g.fillRect(hx+4,y-2,2,1); else g.fillRect(cx2+6,y-2,2,1);      // hitch pole
      if(kind===1){ g.fillStyle=day?"#7a5a34":"#4a3826";           // bucked logs on a flat cart
        g.fillRect(cx2,y-2,6,1); g.fillRect(cx2+1,y-3,4,1); }
      else{ g.fillStyle=day?"#6a4a30":"#3a2c1c"; g.fillRect(cx2,y-2,7,1);      // wagon bed
        g.fillStyle=day?"#e8e2d2":"#8a857a"; g.fillRect(cx2+1,y-5,5,3);        // canvas bonnet
        g.fillStyle=day?"#d2ccb8":"#767064"; g.fillRect(cx2+1,y-5,5,1); }
      g.fillStyle="#16181f"; g.fillRect(cx2+1,y-1,1,1); g.fillRect(cx2+5,y-1,1,1);   // cart wheels
      g.fillStyle=day?"#7a5a3a":"#3e3020"; g.fillRect(cx2+(dir>0?1:5),y-3-(kind===2?3:1),1,1);   // driver hunched at the front
    }
    g.fillStyle=day?"rgba(150,130,90,0.35)":"rgba(80,70,50,0.3)";
    g.fillRect(X+(dir>0?-2:(kind===0?5:13)),y,2,1);                // dust kicked off the trail
  }
}

// a seated person (head + torso, legs tucked) — used on benches
function drawSeated(g,x,y,cloth,skin){ x=x|0; y=y|0;
  g.fillStyle=skin; g.fillRect(x,y,2,1); g.fillStyle=cloth; g.fillRect(x,y+1,2,1); }
var UMB=["#d23b3b","#2f6bb0","#2b2b33","#d9a72b","#3a9a5f","#c8ccd6","#b0508a"];   // umbrella colours
// an umbrella held over a walker's head (y = their head row)
function drawUmbrella(g,x,y,col){ x=x|0; y=y|0;
  g.fillStyle="rgba(0,0,0,0.28)"; g.fillRect(x,y-2,1,2);              // shaft
  g.fillStyle=col; g.fillRect(x-2,y-4,6,1); g.fillRect(x-1,y-3,4,1); // canopy
}
// a newspaper/hand held up to shield from the sun (y = their head row)
function drawSunShade(g,x,y){ x=x|0; y=y|0;
  g.fillStyle="rgba(238,232,214,0.92)"; g.fillRect(x-1,y-2,4,1); g.fillStyle="rgba(0,0,0,0.15)"; g.fillRect(x-1,y-1,4,1); }

// ---- street furniture + the people using it (the city feels lived-in at the sidewalk) ----
// ORGANIC GREENERY: a base layer of street trees (organically spaced, denser in leafy districts), ivy
// climbing old brick, and weeds sprouting at the curb — nature softening the grid in every era.
function drawGreenery(g,L,now){
  if(cityG<0.34||!near||!near.blds) return; var day=L>0.5;
  for(var t=0;t<36;t++){ var h=((t*2654435761+321)>>>0), twx=h%WW, dn=districtAt(twx).name;
    var dens=dn==="residential"?0.9:dn==="oldtown"?0.62:dn==="downtown"?0.3:dn==="neon"?0.34:0.22;
    if(((h>>16)%100)/100 > dens*Math.min(1,(cityG-0.3)/0.2)) continue;
    var tx=twx-WOFF; if(tx>SW+6&&tx-WW>-6)tx-=WW; if(tx<-6&&tx+WW<SW+6)tx+=WW; if(tx<-5||tx>SW+5||inSea(twx)) continue;
    if(overLandmark(twx-4,8)) continue;                                                            // keep landmark plazas (stadium, amusement park…) clear of trees
    drawTree(g,tx|0,HORIZON+1,day,now,t,0.68+((h>>8)%42)/100);                                    // organic size variation
  }
  for(var i=0;i<near.blds.length;i++){ var b=near.blds[i]; if(b.type==="park") continue;
    var bx=(b.x-WOFF); if(bx>SW+4||bx+b.w<-4) continue; var h2=((b.seed*40503)>>>0);
    if(b.brick && (h2%3)===0){ var top=near.y0-b.h, side=(h2&1)?0:b.w-1;                           // ivy up a brick edge
      g.fillStyle=day?"#3a6a3a":"#1c3320";
      for(var vy=HORIZON-1; vy>top+2; vy--){ if(((vy*7+h2)%3)!==0) continue; g.fillRect((bx+side+((vy&1)?0:(h2&1?1:-1)))|0,vy,1,1); } }
    if((h2%2)===0){ g.fillStyle=day?"#3f7f3a":"#1e3a1e"; g.fillRect((bx-1)|0,HORIZON-1,1,1); g.fillRect((bx+b.w)|0,HORIZON-1,1,1); }   // weed tufts at the base
  }
}
// STREET SIGNAGE: green street-name signs & red stop signs on the corners, plus projecting hanging shop
// signs on the commercial blocks (neon-lit in a neon age, hand-painted otherwise). Works in every era.
function drawStreetSigns(g,L,now){
  if(cityG<0.42||!near||!near.blds) return; var day=L>0.5;
  for(var i=0;i<crosswalks.length;i++){ var cw=crosswalks[i]; if(!cwInst(cw)) continue;
    var sx=cw.x-WOFF, h=(cw.seed>>>0);
    for(var wrp=-1;wrp<=1;wrp++){ var CX=(sx+wrp*WW)|0; if(CX<-8||CX>SW+8) continue;
      var pole=CX-7; g.fillStyle=day?"#2a2d36":"#12141a"; g.fillRect(pole,HORIZON-9,1,9);            // sign pole
      if((h%4)<3){ g.fillStyle="#2a7a48"; g.fillRect(pole-3,HORIZON-10,7,2);                          // green street-name blade
        g.fillStyle="#eef4ee"; g.fillRect(pole-2,HORIZON-10,1,1); g.fillRect(pole,HORIZON-10,1,1); g.fillRect(pole+2,HORIZON-10,1,1); }
      else { g.fillStyle="#c0342a"; g.fillRect(pole-2,HORIZON-10,4,3); g.fillStyle="#eef4ee"; g.fillRect(pole-1,HORIZON-9,2,1); }   // red STOP sign
    }
  }
  for(var bi=0;bi<near.blds.length;bi++){ var b=near.blds[bi]; if(b.type==="park") continue;
    var d2=b.district; if(d2!=="downtown"&&d2!=="entertainment"&&d2!=="oldtown") continue;
    if(((b.seed>>>7)%3)!==0) continue;
    var bx=(b.x-WOFF); if(bx<-6||bx>SW+6) continue;
    var hx=bx+2, hy=HORIZON-7, col=NEON[(b.seed>>2)%NEON.length];
    g.fillStyle=day?"#3a3e46":"#1a1c22"; g.fillRect(hx,hy-1,1,1);                                     // wall bracket
    g.fillStyle=(cityEra.neon&&L<0.6)?col:(day?"#c9a04a":"#5a4a2a"); g.fillRect(hx-2,hy,4,3);         // hanging shingle sign
    if(cityEra.neon&&L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(hex2rgb(col),0.45); g.fillRect(hx-2,hy,4,3); g.globalCompositeOperation="source-over"; }
  }
}
function drawStreetProps(g,L,now,night){
  var gy=HORIZON+1;                                    // furniture stands on the sidewalk
  for(var i=0;i<sprops.length;i++){ var sp=sprops[i];
    if(cityG < 0.28+((sp.s%997)/997)*0.34) continue;                 // furniture arrives piece by piece as the town grows
    for(var wp=-1;wp<=1;wp++){ var X=(sp.x-WOFF+wp*WW)|0; if(X<-8||X>SW+9) continue;
      var pr=rng(sp.s), k=sp.k;
      if(k==="lamp"){
        g.fillStyle=L>0.5?"#3a3d47":"#0e0f16"; g.fillRect(X,gy-9,1,9);          // pole
        g.fillRect(X+1,gy-10,1,1);                                              // curved arm
        g.fillStyle=L>0.5?"#4a4e5a":"#14151d"; g.fillRect(X,gy-11,3,1);         // head fixture
        g.fillStyle=curSpace>0.6?"#aef4ff":(L<0.62?"#ffe6a0":"#9a9dab"); g.fillRect(X,gy-9,1,1);   // bulb (cyan orb in the space age)
        if(L<0.62){ g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,224,150,"+(0.5*night+0.15)+")"; g.fillRect(X-1,gy-10,3,3);
          g.fillStyle="rgba(255,224,150,"+(0.13*night)+")"; g.fillRect(X-3,gy-1,7,3);   // pool on the ground
          g.globalCompositeOperation="source-over"; }
      } else if(k==="hydrant"){ g.fillStyle="#c23b2b"; g.fillRect(X,gy-2,1,2); g.fillRect(X-1,gy-1,3,1); g.fillStyle="#e0e0e0"; g.fillRect(X,gy-2,1,1);
      } else if(k==="trash"){ g.fillStyle=L>0.5?"#39463c":"#12181a"; g.fillRect(X,gy-2,2,2); g.fillStyle=L>0.5?"#4a5a4c":"#1a2220"; g.fillRect(X,gy-2,2,1);
      } else if(k==="mailbox"){ g.fillStyle="#2f5aa0"; g.fillRect(X,gy-2,2,2); g.fillStyle="#6a9fe0"; g.fillRect(X,gy-2,2,1);
      } else if(k==="planter"){ g.fillStyle="#5a3a2a"; g.fillRect(X,gy-1,2,1); var pse=curSeason||seasonInfo(nowDate());
        if(pse.bare){ g.fillStyle=css(mixc([40,32,24],[92,80,64],L)); g.fillRect(X,gy-2,2,1); }
        else { g.fillStyle=css(mixc([20,30,24],pse.canopy[0],L)); g.fillRect(X,gy-3,2,2);
          if(pse.blossom){ g.fillStyle="rgba(255,190,220,0.85)"; g.fillRect(X,gy-3,1,1); } }
      } else if(k==="bench"){ g.fillStyle=L>0.5?"#6a5238":"#1a1510"; g.fillRect(X-1,gy-2,4,1); g.fillRect(X-1,gy-1,1,1); g.fillRect(X+2,gy-1,1,1);
        var nS=(pr()*3)|0; for(var q=0;q<nS;q++) drawSeated(g,X-1+q*2,gy-4,PEDC[(pr()*PEDC.length)|0],SKINC[(pr()*SKINC.length)|0]);
      } else if(k==="newsstand"){ g.fillStyle=L>0.5?"#4a4030":"#15120c"; g.fillRect(X-2,gy-5,6,5);
        g.fillStyle=NEON[(sp.s)%NEON.length]; g.fillRect(X-2,gy-5,6,1);                 // awning
        if(L<0.66){ g.fillStyle="#ffcf6a"; g.fillRect(X-1,gy-4,4,2); }                  // lit magazines
        drawPerson(g,X+3,gy-4,PEDC[(pr()*PEDC.length)|0],SKINC[(pr()*SKINC.length)|0],0);   // a browsing customer
      } else if(k==="busstop"){ g.fillStyle=L>0.5?"#40454f":"#12141a";
        g.fillRect(X-3,gy-7,8,1); g.fillRect(X-3,gy-7,1,7); g.fillRect(X+4,gy-7,1,7);   // roof + posts
        g.fillStyle=L>0.5?"#6a5238":"#1a1510"; g.fillRect(X-2,gy-2,5,1);                // bench
        if(L<0.66){ g.fillStyle="#7ab8ff"; g.fillRect(X+4,gy-6,1,2); }                  // lit sign
        var nW=(pr()*3)|0; for(var q2=0;q2<nW;q2++) drawPerson(g,X-2+q2*2,gy-4,PEDC[(pr()*PEDC.length)|0],SKINC[(pr()*SKINC.length)|0],0);
      } else if(k==="foodcart"){ var uc=NEON[(sp.s)%NEON.length];
        g.fillStyle="#c8ccd6"; g.fillRect(X-2,gy-3,6,3);                                // cart
        g.fillStyle="#8a929e"; g.fillRect(X-2,gy-1,6,1);
        g.fillStyle=uc; g.fillRect(X-3,gy-8,8,1); g.fillStyle="#6a6a76"; g.fillRect(X,gy-8,1,5);   // umbrella + pole
        if(L<0.62){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,180,90,0.55)"; g.fillRect(X-1,gy-4,4,2); g.globalCompositeOperation="source-over"; }  // grill glow
        for(var sk=0;sk<2;sk++){ var stt=(now*0.02+sk*90)%40; g.fillStyle="rgba(210,214,222,"+(0.3*(1-stt/40))+")"; g.fillRect((X+1)|0,(gy-4-stt*0.4)|0,1,1); }   // steam
        drawPerson(g,X-3,gy-4,"#e8e8ee",SKINC[(pr()*SKINC.length)|0],0);                // vendor
        if(pr()<0.7) drawPerson(g,X+4,gy-4,PEDC[(pr()*PEDC.length)|0],SKINC[(pr()*SKINC.length)|0],0);  // customer
      }
    }
  }
}

// ---- steam drifting up from manholes / vents ----
function drawSteam(g,now,night,L){
  for(var i=0;i<vents.length;i++){ var v=vents[i];
    for(var wp=-1;wp<=1;wp++){ var X=(v.x-WOFF+wp*WW)|0; if(X<-3||X>SW+3) continue;
      for(var k=0;k<4;k++){ var t=(now*0.016+k*70+v.ph*80)%80, py=HORIZON+1-t*0.55,
          a=(0.16+0.10*night)*(1-t/80); if(a<=0) continue;
        g.fillStyle="rgba(205,210,220,"+a+")";
        g.fillRect((X+Math.sin(now*0.002+k+v.ph)*2)|0,py|0,2,2); }
    }
  }
}

// ---- pigeons: some peck along the sidewalk, some perch on the wires ----
function drawPigeons(g,now,L){
  var col=L>0.5?"#6b6f78":"#3a3d45";
  for(var i=0;i<pigeons.length;i++){ var p=pigeons[i];
    for(var wp=-1;wp<=1;wp++){ var X=(p.x-WOFF+wp*WW)|0; if(X<-2||X>SW+2) continue;
      if(p.ground){ var peck=Math.sin(now*p.sp*0.3+p.ph)>0.6?1:0, hop=((now*0.0004+p.ph)|0)%5;
        var scat=(((Math.floor(now/14000)+i)%6)===0)?((now%14000)/1800):9;         // startled flutter
        if(scat<1){ drawBird(g,X+hop+scat*5,HORIZON-1-Math.sin(scat*Math.PI)*7,(Math.floor(now/100)+i)%4,col,1);
          if(scat<0.2){ g.fillStyle="rgba(160,164,172,0.6)"; g.fillRect(X+hop,HORIZON-1,1,1); } }   // a puff of feathers
        else{ g.fillStyle=col; g.fillRect(X+hop,HORIZON-peck,1,1); g.fillRect(X+hop,HORIZON,1,1);
          g.fillStyle="#3a3d45"; g.fillRect(X+hop+(peck?1:0),HORIZON-1+peck,1,1); }  // head bobs as it pecks
      } else { var fl=Math.sin(now*0.004+p.ph)>0.8?1:0;
        g.fillStyle=col; g.fillRect(X,(p.y)|0,1,1); if(fl){ g.fillRect(X-1,(p.y-1)|0,1,1); g.fillRect(X+1,(p.y-1)|0,1,1); } }
    }
  }
}

// ---- a city bus on a schedule (long, lit windows, route sign) ----
function drawBus(g,worldX,dir,L,now,col,colD){ col=col||"#3f7fbf"; colD=colD||"#2b5f95";
  var len=20, lane=dir>0?1:2, ey=HORIZON+LANE[lane].o, night=1-L;
  var vis=[worldX-WOFF]; if(worldX-WOFF-WW>-len-4) vis.push(worldX-WOFF-WW); if(worldX-WOFF+WW<SW+len+4) vis.push(worldX-WOFF+WW);
  for(var vi=0;vi<vis.length;vi++){ var X=vis[vi]|0; if(X+len<-4||X>SW+4) continue;
    g.fillStyle=col; g.fillRect(X,ey-3,len,5);                                // body (route livery)
    g.fillStyle="rgba(255,255,255,0.25)"; g.fillRect(X,ey-3,len,1);            // roof sheen
    g.fillStyle=colD; g.fillRect(X,ey+1,len,1);
    g.fillStyle="#dff0ff"; for(var wx=2;wx<len-2;wx+=3) g.fillRect(X+wx,ey-2,2,2);   // window row
    g.fillStyle="#b9d8f2"; g.fillRect(X+(dir>0?len-2:1),ey-2,1,2);             // windshield
    g.fillStyle=colD; g.fillRect(X+(dir>0?len-7:5),ey-2,1,3);                  // door seam
    g.fillStyle="#8a939f"; g.fillRect(X+(len>>1)-1,ey-4,3,1);                  // roof AC pod
    g.fillStyle="rgba(10,10,14,0.5)"; g.fillRect(X+2,ey+2,4,1); g.fillRect(X+len-6,ey+2,4,1);   // wheel wells
    g.fillStyle="#0b0b10"; g.fillRect(X+3,ey+3,2,1); g.fillRect(X+len-5,ey+3,2,1);   // wheels
    g.fillStyle="#ffd76a"; g.fillRect(X+(dir>0?2:len-4),ey-3,2,1);             // route sign
    if(night>0.45){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(210,232,255,0.25)"; g.fillRect(X-1,ey-3,len+2,6); g.globalCompositeOperation="source-over"; }
    if(L<0.55){ g.fillStyle="rgba(255,240,170,0.95)"; g.fillRect(X+(dir>0?len:-1),ey,1,1);
      g.fillStyle="rgba(255,60,60,0.9)"; g.fillRect(X+(dir>0?-1:len),ey,1,1); }
  }
}

// ---- window washers on a suspended platform (daytime; descend the facade cleaning) ----
function drawWashers(g,layer,L,now){
  if(L<0.35) return;                                    // washers work in daylight
  for(var bi=0;bi<layer.blds.length;bi++){ var b=layer.blds[bi];
    if(b.type==="park"||b.h<40||b.topW<8) continue;      // only real high-rises get a rig
    if(b.nePitch||b.clap) continue;                      // don't rappel-wash pitched colonial roofs — flat glass towers only
    if(hasOcean && b.district==="industrial" && layer!==near) continue;   // that building is culled behind the harbour → don't hang a ghost washer in the sky
    if(overLandmark(b.x,b.w)) continue;                                   // that building yielded to a landmark plaza
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;   // never wash a building that isn't built yet
    var bx=(b.x-WOFF)|0, tX=bx+b.topDx;
    if(tX+b.topW<-2||tX>SW+2) continue;
    var PER=64000, cyc=Math.floor(now/PER), wr=rng(((bi*2246822519)^cyc)>>>0);
    if(wr()<0.82) continue;                              // only a few buildings, only some cycles
    var wt=now-cyc*PER, WORK=34000; if(wt>WORK) continue;
    // anchor the rig to THIS building's roofline (layer.y0-b.h = the drawn eaves) and never let the
    // platform drop below its own base, so the cables always read as attached to the facade.
    var top=(layer.y0-b.h)|0, floorY=Math.min(HORIZON-12, layer.y0-4);
    var prog=wt/WORK, py=(lerp(top+2,floorY,prog))|0; if(py<top+2) py=top+2;
    var colx=tX+2+((wr()*Math.max(1,b.topW-5))|0);       // which column they're on (kept within the top segment ⊂ facade)
    g.fillStyle="rgba(20,18,26,0.8)"; g.fillRect(colx-1,top,1,py-top); g.fillRect(colx+3,top,1,py-top);   // rig cables
    g.fillStyle=L>0.5?"#6a6e78":"#2a2d36"; g.fillRect(colx-1,py+3,6,1);        // platform
    var swing=(Math.sin(now*0.006)>0)?0:1;
    drawPerson(g,colx,py,"#ffd24a",SKINC[bi%SKINC.length],0);                  // washer (hi-vis)
    if(b.topW>=12) drawPerson(g,colx+3,py,"#4aa8ff",SKINC[(bi+1)%SKINC.length],0);
    g.fillStyle="rgba(200,230,255,0.6)"; g.fillRect(colx+1+swing,py+1,1,1);    // squeegee glint
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(220,240,255,0.10)"; g.fillRect(tX,py+2,b.topW,Math.min(HORIZON-py,20));  // freshly-cleaned sheen below
    g.globalCompositeOperation="source-over";
  }
}

// ---- dockside cargo cranes + shipping-container stacks (industrial district) ----
function drawDocks(g,L,now,night){
  var gy=HORIZON+1, ccols=["#c0503a","#3a70b0","#3a9a5a","#c9a23a","#a04a8a","#4aa0a0"];
  for(var i=0;i<docks.length;i++){ var dk=docks[i];
    if(cityG < 0.32+((dk.s%997)/997)*0.3) continue;
    for(var wp=-1;wp<=1;wp++){ var X=(dk.x-WOFF+wp*WW)|0; if(X<-16||X>SW+18) continue;
      if(dk.k==="crane"){
        var ch=dk.h, jib=10+((dk.s%8)|0), sway=Math.sin(now*0.0006+dk.ph)*jib*0.4, jy=gy-ch;
        g.fillStyle=L>0.5?"#c8a23a":"#4a3d18";
        g.fillRect(X,gy-ch,2,ch); g.fillRect(X-2,jy,jib+4,1); g.fillRect(X-3,jy,2,3);   // mast+jib+counterweight
        var hx=(X+jib*0.5+sway)|0;
        g.fillStyle="rgba(40,40,46,0.8)"; g.fillRect(hx,jy,1,(gy-6)-jy);                // hoist cable
        g.fillStyle=ccols[dk.s%ccols.length]; g.fillRect(hx-1,gy-6,4,3);                // hanging container
        if(L<0.6 && (Math.floor(now/700))%2===0){ g.fillStyle="#ff5050"; g.fillRect(X,jy-1,1,1); }  // beacon
      } else {
        var stack=2+((dk.s%2)), cw=7+((dk.s%3));
        for(var s=0;s<stack;s++){ var cx=X-(cw>>1), cy=gy-3-s*3;
          g.fillStyle=ccols[(dk.s+s*3)%ccols.length]; g.fillRect(cx,cy,cw,3);
          g.fillStyle="rgba(0,0,0,0.22)"; g.fillRect(cx,cy+2,cw,1);
          for(var rib=cx+1;rib<cx+cw-1;rib+=2){ g.fillStyle="rgba(255,255,255,0.07)"; g.fillRect(rib,cy,1,2); } }
      }
    }
  }
}
// ---- buskers on the neon strip: a musician, floating notes, a small crowd ----
function drawBuskers(g,L,now,busyN){
  if(busyN<0.42) return;                                     // only when the strip is lively
  var gy=HORIZON-1;
  for(var i=0;i<buskers.length;i++){ var bk=buskers[i];
    for(var wp=-1;wp<=1;wp++){ var X=(bk.x-WOFF+wp*WW)|0; if(X<-8||X>SW+8) continue;
      var pr=rng(bk.s);
      drawPerson(g,X,gy,"#8a3ab0",SKINC[bk.s%SKINC.length],0);                 // musician
      g.fillStyle="#a0642a"; g.fillRect(X+2,gy,1,2); g.fillStyle="#5a3a1a"; g.fillRect(X+2,gy-1,1,1);  // guitar
      for(var n=0;n<2;n++){ var t=(now*0.02+n*60+bk.s)%50;
        g.fillStyle="rgba(255,220,120,"+(0.85*(1-t/50))+")"; g.fillRect((X+3+Math.sin(now*0.004+n)*2)|0,(gy-2-t*0.3)|0,1,1); }
      var crowd=2+((pr()*2)|0);
      for(var c2=0;c2<crowd;c2++) drawPerson(g,X-2-c2*2,gy,PEDC[(pr()*PEDC.length)|0],SKINC[(pr()*SKINC.length)|0],0);
    }
  }
}

// ---- waterfront harbour (in the industrial edge districts) ----
function eachWaterSpan(cb){                                  // industrial zones = f<0.11 or f>=0.89
  if(!hasOcean) return;                                      // a landlocked life has no water at all
  var iw=0.11*WW, zs=[[0,iw],[WW-iw,WW]];
  for(var z=0;z<zs.length;z++) for(var off=-WW;off<=WW;off+=WW){
    var sa=Math.max(0, zs[z][0]-WOFF+off), sb=Math.min(SW, zs[z][1]-WOFF+off);
    if(sb>sa+0.5) cb(sa|0,sb|0);
  }
}
function drawBoat(g,sx,wl,kind,dir,L,now){
  sx=sx|0; wl=wl|0; var night=1-L;
  if(kind==="sail"){
    var sh2=((sx*7)>>2)&3;                                                     // per-boat variety
    var hulls=[["#5a4632","#241a12"],["#7a3a2e","#301812"],["#3a4a5c","#161e28"],["#6a5a3a","#282012"]][sh2];
    var sails=[["#eef1f6","#c7cdd8"],["#f2e8cc","#c9bd9e"],["#e8d8d8","#bfa8a8"],["#d8e4f0","#a8b8cc"]][(sx>>3)&3];
    g.fillStyle=L>0.5?hulls[0]:hulls[1]; g.fillRect(sx,wl,6,1); g.fillRect(sx+1,wl+1,4,1);   // shaped hull
    g.fillStyle="#2a2a32"; g.fillRect(sx+2,wl-7,1,7);                          // mast
    g.fillStyle=L>0.5?sails[0]:sails[1];
    for(var s=1;s<=5;s++) g.fillRect(sx+(dir>0?3:2-Math.min(s-1,2)),wl-1-s,Math.min(s,3),1);  // bellied sail
    if(((sx>>4)&3)===0){ g.fillStyle="#c0453a"; g.fillRect(sx+(dir>0?3:1),wl-3,2,1); }        // red-striped sail
    g.fillStyle="rgba(255,255,255,0.3)"; g.fillRect(sx+(dir>0?-1:6),wl+1,2,1);               // wake
  } else if(kind==="ferry"){
    g.fillStyle=L>0.5?"#dfe4ec":"#3a4250"; g.fillRect(sx,wl-3,11,3);           // hull
    g.fillStyle=L>0.5?"#c33":"#7a2530"; g.fillRect(sx,wl,11,1);                // waterline stripe
    g.fillStyle=L>0.5?"#eef2f8":"#4a5360"; g.fillRect(sx+2,wl-5,7,2);          // cabin
    g.fillStyle="#ffe9a0"; for(var w=3;w<9;w+=2) g.fillRect(sx+w,wl-4,1,1);    // lit windows
    g.fillStyle="#c0453a"; g.fillRect(sx+8,wl-7,1,2);                          // funnel
  } else if(kind==="cargo"){
    g.fillStyle=L>0.5?"#4a5568":"#1a2230"; g.fillRect(sx,wl-2,15,2);          // long hull
    g.fillStyle=L>0.5?"#c0453a":"#5a2622"; g.fillRect(sx,wl,15,1);
    var cc=["#c0503a","#3a70b0","#3a9a5a","#c9a23a"];
    for(var b=0;b<5;b++){ g.fillStyle=cc[(b+ (sx>>2))%4]; g.fillRect(sx+1+b*2,wl-4,2,2); }  // deck containers
    g.fillStyle=L>0.5?"#dfe4ec":"#39424e"; g.fillRect(sx+(dir>0?12:1),wl-6,2,4);            // bridge tower
    if(L<0.6){ g.fillStyle="#ffe9a0"; g.fillRect(sx+(dir>0?12:2),wl-5,1,1); }
  } else {   // tug
    g.fillStyle=L>0.5?"#3a9a5a":"#183a26"; g.fillRect(sx,wl-2,6,2);
    g.fillStyle="#16181f"; g.fillRect(sx,wl-1,1,1); g.fillRect(sx+5,wl-1,1,1);  // tire fenders
    g.fillStyle=L>0.5?"#eef2f8":"#3a4450"; g.fillRect(sx+1,wl-4,3,2);
    g.fillStyle=L>0.5?"#c9552e":"#5c2616"; g.fillRect(sx+4,wl-5,1,3);           // stack
    g.fillStyle="rgba(180,180,188,0.5)"; g.fillRect(sx+4+((now/500|0)%2),wl-7,1,1);   // puff
    if(L<0.6){ g.fillStyle="#ffe9a0"; g.fillRect(sx+2,wl-3,1,1); }
  }
  // reflection glow on the water
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,240,190,"+(0.10+0.12*night)+")"; g.fillRect(sx,wl+1,kind==="cargo"?15:(kind==="ferry"?11:5),1); g.globalCompositeOperation="source-over";
}
function drawHarborBridge(g,L,now,night,wTop){
  var iw=0.11*WW, cx=iw*0.5, half=iw*0.34, deckY=wTop+6, towerH=12;
  for(var off=-WW;off<=WW;off+=WW){ var c=cx-WOFF+off, xa=c-half, xb=c+half;
    if(xb<-4||xa>SW+4) continue;
    var tA=c-half*0.5, tB=c+half*0.5;
    g.fillStyle=L>0.5?"#4a5060":"#161a26"; g.fillRect(xa|0,deckY,(xb-xa)|0,1);                       // deck
    g.fillStyle=L>0.5?"#5a6074":"#20242f"; g.fillRect(tA|0,deckY-towerH,1,towerH+1); g.fillRect(tB|0,deckY-towerH,1,towerH+1); // towers
    g.strokeStyle=L>0.5?"rgba(70,76,92,0.85)":"rgba(34,38,50,0.9)"; g.lineWidth=1; g.beginPath();     // suspension cables
    g.moveTo(xa,deckY); g.quadraticCurveTo((xa+tA)/2,deckY-towerH*0.35,tA,deckY-towerH);
    g.quadraticCurveTo(c,deckY-towerH*0.4,tB,deckY-towerH);
    g.quadraticCurveTo((tB+xb)/2,deckY-towerH*0.35,xb,deckY); g.stroke();
    g.fillStyle=L>0.5?"rgba(70,76,92,0.55)":"rgba(34,38,50,0.6)";
    for(var sp3=xa+3;sp3<xb-2;sp3+=4){                                        // vertical suspenders
      var dt3=Math.min(Math.abs(sp3-tA),Math.abs(sp3-tB)), sag=Math.max(1,towerH*0.4*(1-dt3/(half*0.5+1)));
      g.fillRect(sp3|0,(deckY-sag)|0,1,sag|0); }
    if(night>0.4){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,220,150,0.7)";
      for(var lx=xa+2;lx<xb;lx+=4) g.fillRect(lx|0,deckY-1,1,1); g.globalCompositeOperation="source-over"; }
  }
}
function drawHarbor(g,L,now,night,nd){
  var wTop=HORIZON-22, dayW=mixc([26,58,84],[92,152,188],L), wc=css(dayW);
  eachWaterSpan(function(sa,sb){ var ww=sb-sa; if(ww<=0) return;
    var shoreA=gstage(0.3,0.6);                                                   // the far shore builds up with the city
    if(shoreA>0){ g.globalAlpha=shoreA;
    for(var fx=sa;fx<sb;fx++){ if(((fx*13+7)%5)===0){ var fh=2+((fx*7)%3);        // far-shore skyline
      g.fillStyle=L>0.5?"#818893":"#0b0b14"; g.fillRect(fx,wTop-fh,1,fh);
      if(L<0.5&&((fx*7)%3)===0){ g.fillStyle="rgba(255,220,150,0.5)"; g.fillRect(fx,wTop-fh,1,1); } } }
    g.globalAlpha=1; }
    waterTex(g,sa,sb,wTop,HORIZON,L,now);                                           // water body w/ rolling swell
    drawMtsReflection(g,sa,sb,wTop,HORIZON-wTop-2,L);                               // the range mirrored in the bay
    var dockA=gstage(0.32,0.62);                                                    // before the quays pave in,
    if(dockA<1){                                                                    // the bay wears a natural sand ring
      var ga3=g.globalAlpha; g.globalAlpha=(1-dockA);
      var sd2=L>0.5?[216,196,150]:[86,80,64];
      for(var by2=wTop;by2<HORIZON;by2++){                                          // wandering side shores
        var crvL=2+Math.round(Math.sin(by2*0.28+sa)*1.2+1.2), crvR=2+Math.round(Math.sin(by2*0.31+sb)*1.2+1.2);
        g.fillStyle=css(sd2); g.fillRect(sa,by2,crvL,1); g.fillRect(sb-crvR,by2,crvR,1);
        var lap2=Math.sin(now*0.0016+by2*0.6);
        if(lap2>0){ g.fillStyle="rgba(255,255,255,"+(0.18+0.2*lap2).toFixed(2)+")";
          g.fillRect(sa+crvL,by2,1,1); g.fillRect(sb-crvR-1,by2,1,1); } }
      g.fillStyle=css(sd2); g.fillRect(sa,HORIZON-1,sb-sa,2);                       // the sandy near shore
      g.fillStyle=rgba(sd2,0.5); g.fillRect(sa,HORIZON+1,sb-sa,1);
      for(var fx2=sa;fx2<sb;fx2+=3){ var lap3=Math.sin(now*0.0018+fx2*0.7);        // foam lapping the near shore
        if(lap3>0.1){ g.fillStyle="rgba(255,255,255,"+(0.16+0.22*lap3).toFixed(2)+")";
          g.fillRect(fx2,HORIZON-2,2,1); } }
      g.globalAlpha=ga3;
    }
    if(night>0.4&&cityG>0.5){ g.globalCompositeOperation="lighter";                 // neon reflections (need a lit city)
      var rc=["rgba(255,60,160,0.11)","rgba(60,200,255,0.11)","rgba(120,255,190,0.09)"];
      for(var rx=sa+2; rx<sb; rx+=7){ g.fillStyle=rc[((rx>>2)%3+3)%3];
        g.fillRect((rx+((Math.sin(now*0.003+rx))|0))|0, wTop+2, 1, HORIZON-wTop-2); }
      g.globalCompositeOperation="source-over"; }
  });
  var brA=gstage(0.52,0.66);                                                      // the bridge takes shape over time
  if(brA>0){ g.globalAlpha=brA; drawHarborBridge(g,L,now,night,wTop); g.globalAlpha=1; }
  if(!iceNow && !nukeFull())
  for(var i=0;i<boats.length;i++){ var bt=boats[i], span=bt.zb-bt.za;             // boats patrol their harbour
    if(bt.kind!=="sail" && cityG < 0.5+((bt.s%997)/997)*0.2) continue;             // settlers sail; powered ships come with industry
    var trav=bt.sp*KSP*now*0.001+bt.ph*span, m=trav%(2*span); if(m<0)m+=2*span;
    var pp=m<span?m:2*span-m, dir=m<span?1:-1, bwx=bt.za+pp, wl=HORIZON-2-bt.y;
    for(var off=-WW;off<=WW;off+=WW){ var sx=bwx-WOFF+off; if(sx<-16||sx>SW+16) continue; drawBoat(g,sx,wl,bt.kind,dir,L,now); }
  }
}

// CRIME: a purse-snatcher sprints down the sidewalk, two officers in pursuit, unit on scene
function crimeNow(now){
  var SLOT=390000, idx=Math.floor(now/SLOT), r=rng((idx*40503+9973)>>>0);
  var rate=0.40+0.30*(1-curEcon)-((curMayor&&curMayor.party.k==="SAFETY")?0.15:0)-(curPolicies.surveil?0.30:0)+(cityHasBuild("casino")?0.12:0);   // hard times breed crime; safety mayors curb it; a SURVEILLANCE ACT nearly stamps it out; a CASINO ZONE brings it back
  if(r()>rate) return null;
  var t0=r()*(SLOT-52000), tp=now-idx*SLOT-t0;
  if(tp<0||tp>48000) return null;
  return {x:Math.round(60+r()*(WW-120)), f:tp/48000, dir:r()<0.5?1:-1, seed:(r()*1e6)|0};
}
function drawCrime(g,cd2,L,now){
  var f=cd2.f, wx=cd2.x+cd2.dir*Math.min(f,0.6)*40;
  for(var w=-1;w<=1;w++){ var X=(wx-WOFF+w*WW)|0; if(X<-30||X>SW+30) continue;
    if(f<0.6){                                                       // the chase
      drawPerson(g,X,HORIZON-1,"#1a1c24","#c9a184",(Math.floor(now/80))&1);
      g.fillStyle="#ffd24a"; g.fillRect(X+(cd2.dir>0?-2:3),HORIZON-2,1,1);          // the snatched bag
      for(var c5=0;c5<2;c5++) drawPerson(g,X-cd2.dir*(4+c5*4),HORIZON-1,"#2a4a8a","#c9a184",(Math.floor(now/90)+c5)&1);
    } else {                                                         // collar made
      drawPerson(g,X,HORIZON-1,"#1a1c24","#c9a184",0);
      drawPerson(g,X-cd2.dir*3,HORIZON-1,"#2a4a8a","#c9a184",0);
      if(((Math.floor(now/300))&1)===0){ g.fillStyle="#aaddff"; g.fillRect((X-cd2.dir)|0,HORIZON-2,1,1); }
    }
  }
  drawEmv(g, cd2.x-cd2.dir*10, EMV_TYPES[0], cd2.dir, cd2.dir>0?1:2, L, now);       // police unit, lights going
}
// FIRE: a building catches; the department arrives, runs a hose and knocks it down
function fireNow(now){
  var SLOT=510000, idx=Math.floor(now/SLOT), r=rng((idx*2246822519+77)>>>0);
  if(r()>0.45) return null;
  var t0=r()*(SLOT-95000), tp=now-idx*SLOT-t0;
  if(tp<0||tp>90000) return null;
  return {x:Math.round(60+r()*(WW-120)), f:tp/90000, seed:(r()*1e6)|0};
}
function drawFireIncident(g,fi,L,now){
  var b=null;
  for(var i=0;i<near.blds.length;i++){ var nb=near.blds[i];
    if(nb.type!=="park"&&fi.x>=nb.x&&fi.x<nb.x+nb.w&&(nb.bAge===undefined||cityG-nb.bAge>bandOf(nb))){ b=nb; break; } }
  if(!b) return;
  var burn=fi.f<0.55?1:Math.max(0,1-(fi.f-0.55)/0.45);               // the FD wins this one
  var bx=(b.x-WOFF)|0, top=HORIZON-b.h, fy=top+Math.max(3,(b.h*0.3)|0);
  var flameH=Math.min(b.h*0.55,3+b.h*0.35);                          // how high the fire climbs the facade
  for(var w=-1;w<=1;w++){ var X=bx+w*WW; if(X+b.w<-8||X>SW+8) continue;
    if(burn>0.12){
      // the fire seen THROUGH the glass: the burning floors glow orange from within, the smoke-
      // choked floors above go dark and dead (windows are drawn cyan already — recolour them)
      for(var wr=0;wr<b.win.length;wr++){ var ww2=b.win[wr];
        var wgy=top+ww2.y, rel=wgy-fy;                              // >0 = below the fire line (untouched)
        if(rel>5) continue;
        if(rel>-flameH-9){ var fk=0.55+0.45*Math.sin(now*0.02+ww2.x*0.7+ww2.y);   // in the blaze → molten orange
          g.fillStyle="rgba("+((205+50*fk)|0)+","+((70+55*fk)|0)+",22,"+(0.92*burn).toFixed(3)+")";
          g.fillRect(X+ww2.x,wgy,ww2.w,ww2.h);
        } else if(burn>0.45){ g.fillStyle="rgba(18,14,14,0.72)";    // high above → smoke-blackened & dead
          g.fillRect(X+ww2.x,wgy,ww2.w,ww2.h); }
      }
      // the blaze bursting out — a row of tongues erupting up the facade
      for(var fx3=1;fx3<b.w-1;fx3+=3){
        drawFlame(g,X+fx3+1,fy,4,flameH*burn,now,(b.seed+fx3*31)>>>0,burn); }
      // and licking out of the roofline once it's really going
      if(burn>0.6) drawFlame(g,X+(b.w>>1),top+2,Math.max(4,b.w*0.5),flameH*0.7,now,(b.seed+7)>>>0,(burn-0.6)/0.4);
      drawFireSmoke(g,X+(b.w>>1),fy-flameH*burn-2,now,b.seed,burn,1.2);
      if(b.w>10) drawFireSmoke(g,X+(b.w>>2),fy-flameH*burn,now,b.seed+51,burn*0.7,1.2);
    }
    if(fi.f>0.28){ for(var hq=0;hq<11;hq++){ var hu=hq/11;                           // the hose arc
        var hxp=X-6+hu*(6+(b.w>>1)), hyp=HORIZON-2-Math.sin(hu*Math.PI*0.55)*(HORIZON-2-fy);
        if(((hq+Math.floor(now/70))%3)!==0){ g.fillStyle="rgba(170,215,255,0.85)"; g.fillRect(hxp|0,hyp|0,1,1); } }
      if(burn>0.15){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,230,255,0.5)";  // steam where water hits fire
        for(var stm=0;stm<3;stm++){ var stp=((now*0.04+stm*90)%100); g.fillRect((X+(b.w>>1)-2+stm*2)|0,(fy-stp*0.3)|0,1,1); }
        g.globalCompositeOperation="source-over"; } }
  }
  if(fi.f>0.28) drawEmv(g, fi.x-10, EMV_TYPES[2], 1, 1, L, now);                     // engine on scene
}
// ROOFTOP PARTIES: weekend & holiday-eve nights, string lights and dancing on the flat roofs
function drawRoofParties(g,L,now,nd,hol){
  if(L>0.45) return;
  var dow=nd.getDay(), h=nd.getHours();
  var partyNight=(dow===5||dow===6||!!hol.decor||hol.july4||hol.nye);
  if(!partyNight||!(h>=20||h<2)) return;
  var dayN=Math.floor(now/86400000), drawn=0;
  for(var i=0;i<near.blds.length&&drawn<6;i++){ var b=near.blds[i];
    if(b.type==="park"||b.topW<9||(b.crown!=="flat"&&b.crown!=="step")) continue;
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;
    if((((b.seed^dayN)*2654435761)>>>0)%7!==0) continue;         // tonight, THIS roof parties
    var bx=(b.x-WOFF)|0; if(bx>SW+4||bx+b.w<-4) continue; drawn++;
    var tX=bx+b.topDx, top=HORIZON-b.h, tW=b.topW;
    for(var sl2=1;sl2<tW-1;sl2+=2){                              // string lights swaying
      g.fillStyle=["#ffd24a","#ff5aa0","#5ac8ff","#7dff8a"][(sl2+(Math.floor(now/600)))%4];
      g.fillRect(tX+sl2,top-2+((sl2+Math.floor(now/900))&1),1,1); }
    var nD=2+((b.seed>>>4)%3);
    for(var d3=0;d3<nD;d3++){ var dx3=tX+2+((d3*5+(b.seed>>>6))% Math.max(1,tW-4));
      drawPerson(g,dx3,top-2,PEDC[(b.seed+d3)%PEDC.length],SKINC[(b.seed+d3)%SKINC.length],(Math.floor(now/140)+d3)&1); }  // dancing fast
    if(((Math.floor(now/350))+i)%3===0){ g.fillStyle="#eef2ff";  // music drifting up
      g.fillRect(tX+tW-1,top-5-((Math.floor(now/350))%4),1,1); g.fillRect(tX+tW,top-6-((Math.floor(now/350))%4),1,2); }
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,120,0.10)";   // warm party glow
    g.fillRect(tX-1,top-4,tW+2,5); g.globalCompositeOperation="source-over";
  }
}
// street-level SUBWAY entrances — stair kiosks that swallow & release riders
function drawSubways(g,L,now,night){
  for(var i=0;i<subways.length;i++){ var sb=subways[i];
    if(cityG < 0.42+sb.k*0.05) continue;                        // stations open one at a time
    for(var wp=-1;wp<=1;wp++){ var X=(sb.x-WOFF+wp*WW)|0; if(X<-9||X>SW+9) continue;
      var gy=HORIZON+1;
      g.fillStyle=L>0.5?"#2f6b4a":"#1c4030"; g.fillRect(X-3,gy-3,1,3); g.fillRect(X+3,gy-3,1,3);   // railings
      g.fillRect(X-3,gy-3,7,1);                                                                     // top rail
      g.fillStyle=L>0.5?"#20242e":"#0e1016"; g.fillRect(X-2,gy-2,5,1);                              // stair throat
      g.fillStyle="#0a0c12"; g.fillRect(X-2,gy-1,5,2);                                              // the descent
      g.fillStyle="#3a70d0"; g.fillRect(X-1,gy-7,3,3); g.fillStyle="#eef2ff"; g.fillRect(X,gy-6,1,1);   // "M" totem
      g.fillStyle=L>0.5?"#4a5568":"#242c3a"; g.fillRect(X,gy-4,1,1);                                // totem post
      if(night>0.4){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,220,140,0.30)";
        g.fillRect(X-2,gy-2,5,3); g.globalCompositeOperation="source-over"; }                       // warm light up the stairs
      // riders: every few seconds someone descends or climbs out (sinking into / rising from the steps)
      var PER=6500, cyc=Math.floor((now+sb.s)/PER), rr=rng((sb.s^(cyc*2654435761))>>>0);
      if(rr()<0.7){ var goingDown=rr()<0.5, tph=((now+sb.s)%PER)/PER;
        if(tph<0.5){ var pg=tph/0.5, side=rr()<0.5?1:-1;
          var q=goingDown?pg:1-pg;                              // 0 = out on the sidewalk … 1 = down the stairs
          var px=X+side*Math.round(8*(1-q));
          var sink=q>0.75?Math.round((q-0.75)*10):0;            // legs disappear down the steps
          if(q<0.98){ var pc=PEDC[(sb.s+cyc)%PEDC.length], sk=SKINC[(sb.s+cyc)%SKINC.length];
            drawPerson(g,px|0,gy-3+sink,pc,sk,(Math.floor(now/300))&1); }
        } }
    } }
}

// AURORA: on rare, frigid, clear nights the sky ribbons green and violet
// LANTERN NIGHT (invented city holiday, Aug 15): paper lanterns rise from the streets and drift up into the dark.
function drawLanterns(g,L,now){
  if(L>0.44) return; var n=44;
  for(var i=0;i<n;i++){ var h=((i*2654435761+88)>>>0), period=52000, ph=((now+(h%period))%period)/period;
    var wx=(h%WW), x=wx-WOFF+Math.sin(now*0.0006+i)*4; if(x>SW+4&&x-WW>-4)x-=WW; if(x<-4&&x+WW<SW+4)x+=WW; if(x<-3||x>SW+3) continue;
    var y=HORIZON-2-ph*(HORIZON-4), c=[[255,150,60],[255,90,60],[255,205,95],[255,120,150]][i%4], a=0.85*(1-ph*0.5);
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba("+c[0]+","+c[1]+","+c[2]+","+(0.22*a).toFixed(2)+")"; g.fillRect((x-1)|0,(y-1)|0,3,4);   // halo
    g.fillStyle="rgba("+c[0]+","+c[1]+","+c[2]+","+a.toFixed(2)+")"; g.fillRect(x|0,y|0,1,2);                  // lantern
    g.globalCompositeOperation="source-over"; }
}
// KITE FESTIVAL (invented city holiday, ~Apr 18–20): colourful kites on strings bob over the daytime city.
function drawKites(g,L,now){
  if(L<0.4) return; var n=12;
  for(var i=0;i<n;i++){ var h=((i*2654435761+123)>>>0), wx=(h%WW), gx=wx-WOFF;
    if(gx>SW+8&&gx-WW>-8)gx-=WW; if(gx<-8&&gx+WW<SW+8)gx+=WW; if(gx<-6||gx>SW+6) continue;
    var kx=gx+Math.sin(now*0.001+i*1.7)*10, ky=18+((h>>8)%50)+Math.sin(now*0.0016+i)*4, c=NEON[(h>>3)%NEON.length];
    g.strokeStyle="rgba(120,120,130,0.35)"; g.lineWidth=1; g.beginPath(); g.moveTo(gx,HORIZON-2); g.lineTo(kx,ky); g.stroke();
    g.fillStyle=c; g.fillRect((kx-1)|0,ky|0,3,1); g.fillRect(kx|0,(ky-1)|0,1,3);
    g.fillStyle="rgba(255,255,255,0.6)"; g.fillRect(kx|0,ky|0,1,1);
    g.fillStyle=c; g.fillRect(kx|0,(ky+2)|0,1,1); g.fillRect((kx-1)|0,(ky+3)|0,1,1); }   // tail
}
// a satellite / the ISS: a steady (non-twinkling) point gliding across the dark sky, world-anchored so
// every monitor agrees on where it is. Slow, faint, with an occasional blink — unlike a fast meteor.
function drawSatellite(g,L,now){
  if(L>0.30) return;
  var period=150000, ph=(now%period)/period; if(ph>0.5) return;      // one slow pass per ~2.5 min, visible half that
  var p=ph/0.5, wx=p*WW, x=wx-WOFF; if(x<-2||x>SW+2) return;
  var y=16+((Math.floor(now/period)%3)*9)+p*7;                       // gentle diagonal, altitude varies per pass
  var blink=((Math.floor(now/1100))%9===0)?0.35:0.9;
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(220,236,255,"+blink+")"; g.fillRect(x|0,y|0,1,1); g.globalCompositeOperation="source-over";
}
// an occasional lone shooting star (distinct from the dated showers) — and someone below makes a wish (a rising heart)
function drawShootingStar(g,L,now){
  if(L>0.28) return;
  var period=88000, idx=Math.floor(now/period), ph=now-idx*period, dur=1500; if(ph>dur) return;
  var r=((idx*2654435761)>>>0), p=ph/dur, x=(r%WW)-WOFF+p*44, y=13+((r>>8)%40)+p*24;
  g.globalCompositeOperation="lighter";
  for(var t=0;t<8;t++){ var a=(1-t/8)*(1-p*0.4); g.fillStyle="rgba(255,250,222,"+(0.9*a).toFixed(2)+")"; g.fillRect((x-t*3)|0,(y-t*1.7)|0,1,1); }
  if(p>0.3){ var hx=(r%WW)-WOFF, hy=HORIZON-6-(p-0.3)*10;                                          // a wish rises from the street
    if(hx>=-2&&hx<=SW+2){ g.fillStyle="rgba(255,120,170,"+(0.7*(1-p)).toFixed(2)+")"; g.fillRect(hx|0,hy|0,2,1); g.fillRect((hx)|0,(hy+1)|0,1,1); } }
  g.globalCompositeOperation="source-over";
}
// a rainbow arc when a shower has just cleared under a low sun (wet ground, clearing sky, morning/evening light)
function drawRainbow(g,L,fx){
  if(fx.rain||fx.thunder||fx.snow||fx.cloudy||fx.fog) return;
  if(wetness<0.28) return; if(L<0.34||L>0.74) return;
  var cx=Math.round(WW*0.5)-WOFF, R=Math.round(HORIZON*0.92);
  var bands=[[255,80,80],[255,160,60],[255,232,90],[90,210,120],[90,160,255],[150,110,230]];
  g.globalCompositeOperation="lighter"; g.lineWidth=1;
  for(var b=0;b<bands.length;b++){ var c=bands[b];
    g.strokeStyle="rgba("+c[0]+","+c[1]+","+c[2]+","+(0.22*Math.min(1,(wetness-0.2)*3)).toFixed(3)+")";
    g.beginPath(); g.arc(cx,HORIZON,R-b*2,Math.PI,2*Math.PI); g.stroke(); }
  g.globalCompositeOperation="source-over";
}
function drawAurora(g,nd,L,now,fx){
  auroraOn=false;
  if(L>0.22||fx.cloudy||fx.rain||fx.snow||fx.thunder||fx.fog) return;
  if((weather.temp==null?60:weather.temp)>30) return;
  var dn=Math.floor(now/86400000);
  if((((dn*2654435761)>>>0)%100)>=38) return;                  // most cold nights stay dark
  auroraOn=true;
  g.globalCompositeOperation="lighter";
  for(var b3=0;b3<3;b3++){ var col=["rgba(80,255,160,","rgba(90,220,255,","rgba(190,120,255,"][b3];
    for(var x4=0;x4<SW;x4+=3){
      var ph2=now*0.00022+b3*2.1+(x4+WOFF)*0.018;
      var yb=24+b3*12+Math.sin(ph2)*10+Math.sin(ph2*0.37)*6, hh2=10+6*Math.sin(ph2*1.7);
      var a2=0.05+0.045*Math.sin(ph2*0.8+b3); if(a2<=0.012) continue;
      g.fillStyle=col+a2+")"; g.fillRect(x4,yb|0,3,Math.max(2,hh2|0));
    } }
  g.globalCompositeOperation="source-over";
}
// METEOR SHOWERS on their real dates: Lyrids (Apr), Perseids (Aug), Geminids (Dec)
function meteorShowerActive(nd){ var m=nd.getMonth()+1,d=nd.getDate();
  return (m===8&&d>=11&&d<=13)||(m===12&&d>=12&&d<=14)||(m===4&&d>=21&&d<=22); }
function drawShower(g,nd,L,now,fx){
  if(L>0.3||fx.cloudy||fx.rain||fx.snow||fx.thunder||fx.fog||!meteorShowerActive(nd)) return;
  var SL=2600;
  for(var k=0;k<3;k++){ var idx=Math.floor((now+k*867)/SL), ph3=((now+k*867)%SL)/SL;
    var h4=((idx*2654435761+k*97)>>>0);
    if((h4%10)>=6||ph3>0.32) continue;
    var sx0=(h4%WW)-WOFF, sy0=8+((h4>>>8)%60);
    if(sx0<-30||sx0>SW+30) continue;
    var t3=ph3/0.32;
    g.globalCompositeOperation="lighter";
    for(var q2=0;q2<6;q2++){ var qq=t3*26-q2*2;
      g.fillStyle="rgba(220,240,255,"+(0.8*(1-q2/6)*(1-t3))+")";
      g.fillRect((sx0+qq)|0,(sy0+qq*0.55)|0,1,1); }
    g.globalCompositeOperation="source-over";
  }
}
// THE RIVAL CITY across the bay: it grows on its own schedule, out on the seam of the world
function drawRival(g,L,now){
  if(!hasOcean||seaW<=0) return;
  var cg2=cityGrowth(now), rG=Math.max(0,Math.min(1,(cg2.cy-0.08)/0.55));
  if(rG<=0.03) return;
  var wTop=HORIZON-22, night=1-L;
  for(var w=-1;w<=1;w++){ var cx3=(0-WOFF+w*WW)|0;
    if(cx3<-70||cx3>SW+70) continue;
    for(var t4=-9;t4<=9;t4++){ var th=((t4*2654435761+13)>>>0);
      var bx4=cx3+t4*4+((th>>>4)%3)-1, bh4=Math.round((3+(th%11))*rG*(1-Math.abs(t4)/12));
      if(bh4<2) continue;
      g.fillStyle=L>0.5?"rgba(130,142,158,0.8)":"rgba(24,26,40,0.95)";
      g.fillRect(bx4,wTop-bh4,3,bh4);
      if(night>0.5&&rG>0.3){ g.fillStyle="rgba(255,220,150,0.6)";
        for(var wy4=wTop-bh4+1;wy4<wTop-1;wy4+=2) if(((wy4*7+t4*13)&3)===0) g.fillRect(bx4+1,wy4,1,1); }
    }
    if(night>0.5&&rG>0.5){ g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,170,90,0.06)"; g.fillRect(cx3-40,wTop-14,80,14); g.globalCompositeOperation="source-over"; }
    if(rG>0.4&&(Math.floor(now/800)%2===0)){ g.fillStyle="#ff4040"; g.fillRect(cx3,(wTop-Math.round(14*rG)-1)|0,1,1); }
  }
}
// L1: STORM BLACKOUTS — thunder knocks a block dark; a bucket-truck crew brings it back
var curBlk=null;
function blackoutNow(now,fx){
  if(!fx.thunder&&!fx.rain) return null;
  if(cityG<0.5) return null;
  var SLOT=340000, idx=Math.floor(now/SLOT), r=rng((idx*2654435761+491)>>>0);
  if(r()>(fx.thunder?0.55:0.18)) return null;
  var a=r()*WW, w2=46+r()*70, tp=now-idx*SLOT, f=tp/SLOT;
  return {a:a, b:a+w2, f:f, fix:f>0.72};
}
function inBlk(wx){ var B=curBlk; if(!B) return false;
  var x=wrapW(wx); if(B.b<=WW) return x>=B.a&&x<=B.b; return x>=B.a||x<=B.b-WW; }
function drawBlkCrew(g,L,now){
  var B=curBlk; if(!B||!B.fix) return;
  var wx=wrapW(B.a+4), sx=wx-WOFF;
  if(sx>SW+14&&sx-WW>-14) sx-=WW; if(sx<-14&&sx+WW<SW+14) sx+=WW;
  if(sx<-12||sx>SW+12) return;
  var gy2=HORIZON+LANE[0].o;
  g.fillStyle="#e0a83a"; g.fillRect(sx|0,gy2-3,9,4);                                 // utility truck
  g.fillStyle="#c9d4e6"; g.fillRect((sx+9)|0,gy2-2,3,3);
  g.fillStyle="#0b0b10"; g.fillRect((sx+1)|0,gy2+1,2,1); g.fillRect((sx+8)|0,gy2+1,2,1);
  g.fillStyle="#8a939f"; g.fillRect((sx+3)|0,gy2-7,1,4); g.fillRect((sx+3)|0,gy2-8,4,1);   // boom
  g.fillStyle="#e0a83a"; g.fillRect((sx+6)|0,gy2-9,3,2);                             // bucket
  drawPerson(g,(sx+7)|0,gy2-10,"#ffd24a",SKINC[2],(Math.floor(now/400))&1);          // lineworker aloft
  if((Math.floor(now/300))&1){ g.fillStyle="#ffb02a"; g.fillRect((sx+4)|0,gy2-4,1,1); }
  if((Math.floor(now/170))%5===0){ g.fillStyle="#dff0ff"; g.fillRect((sx+7)|0,gy2-11,1,1); }   // welding spark
}
// N5: DISEASE OUTBREAK — masks on, sirens up, then recovery
var curOutbreak=null;
function outbreakNow(now){
  var li=lifeIndexOf(now), h=((li*2654435761+617)>>>0);
  if(h%100>=30) return null;
  var cg2=cityGrowth(now), c0=0.55+((h>>>8)%150)/1000;
  if(cg2.cy<c0||cg2.cy>c0+0.035) return null;
  return {f:(cg2.cy-c0)/0.035};
}
// N6: a CRUISE SHIP calls at the port; tour groups follow the guide's flag
function cruiseNow(now){
  if(!hasOcean||seaW<=0||cityG<0.7) return null;
  var SLOT=480000, idx=Math.floor(now/SLOT), r=rng((idx*40503+733)>>>0);
  if(r()>0.45) return null;
  var tp=now-idx*SLOT, f=tp/SLOT;
  return {f:f, side:r()<0.5?0:1};
}
function drawCruise(g,L,now,night){
  var C=curCruise; if(!C) return;
  var dockX=C.side?WW*(1-seaW)-14:WW*seaW+2;                                          // just off the causeway
  var f=C.f, sx0=C.side?WW-10:10;
  var wx=f<0.22? sx0+(dockX-sx0)*(f/0.22) : (f<0.82? dockX : dockX+(sx0-dockX)*((f-0.82)/0.18));
  var sx=wx-WOFF; if(sx>SW+26&&sx-WW>-26) sx-=WW; if(sx<-26&&sx+WW<SW+26) sx+=WW;
  if(sx>=-24&&sx<=SW+24){ var wl=HORIZON-13;
    g.fillStyle=L>0.5?"#f2f5fa":"#4a5260"; g.fillRect(sx|0,wl-6,22,6);                // hull+decks
    g.fillStyle=L>0.5?"#3a4a5c":"#121a24"; g.fillRect(sx|0,wl,22,1);
    g.fillStyle="#c0453a"; g.fillRect((sx+15)|0,wl-9,2,3);                            // funnel
    g.fillStyle="#ffe9a0"; for(var cw3=2;cw3<20;cw3+=2){ g.fillRect((sx+cw3)|0,wl-5,1,1); g.fillRect((sx+cw3)|0,wl-3,1,1); }
    if(f>=0.22&&f<0.82){ g.fillStyle=L>0.5?"#8a8474":"#2c2a26"; g.fillRect((sx+(C.side?-3:21))|0,wl-1,4,1); }   // gangway
  }
  if(f>=0.26&&f<0.8){                                                                 // the TOUR wanders downtown
    var reach=(f-0.26)/0.54, tw2=Math.sin(reach*Math.PI)*140;
    var gx3=wrapW((C.side?WW*(1-seaW)-20-tw2:WW*seaW+20+tw2));
    var gsx=gx3-WOFF; if(gsx>SW+6&&gsx-WW>-6) gsx-=WW; if(gsx<-6&&gsx+WW<SW+6) gsx+=WW;
    if(gsx>=-5&&gsx<=SW+24){
      drawPerson(g,gsx|0,HORIZON-1,"#e0a83a",SKINC[0],(Math.floor(now/300))&1);       // the guide
      g.fillStyle="#e8482a"; g.fillRect((gsx+1)|0,HORIZON-8,1,3); g.fillRect((gsx+2)|0,HORIZON-8,2,1);   // the little flag
      for(var tg=0;tg<6;tg++) drawPerson(g,(gsx-3-tg*3)|0,HORIZON-1,PEDC[(tg*2+3)%PEDC.length],SKINC[tg%SKINC.length],(Math.floor(now/300)+tg)&1);
    }
  }
}
var curCruise=null;
// N7: the POWER PLANT hums at the industrial edge
function drawPowerPlant(g,L,now,night){
  if(cityG<0.5) return;
  var wx=hasOcean&&seaW>0?WW*seaW+26:Math.round(0.055*WW), day=L>0.5, gy=HORIZON;
  for(var off=-WW;off<=WW;off+=WW){ var X=(wx-WOFF+off)|0; if(X<-20||X>SW+20) continue;
    for(var tw3=0;tw3<2;tw3++){ var tx2=X+tw3*9;                                      // cooling towers
      g.fillStyle=day?"#9aa0ab":"#2c303a";
      g.fillRect(tx2,gy-10,5,10); g.fillRect(tx2-1,gy-4,7,4); g.fillRect(tx2+1,gy-11,3,1);
      g.fillStyle="rgba(200,204,212,"+(day?0.5:0.25)+")";                             // rising steam
      g.fillRect(tx2+1+((Math.floor(now/400)+tw3)&1),gy-13-((Math.floor(now/260)+tw3)%3),2,2); }
    g.fillStyle=day?"#4a5568":"#161c26"; g.fillRect(X+18,gy-6,6,6);                   // turbine hall
    g.fillStyle="#8a939f"; g.fillRect(X+19,gy-8,1,2); g.fillRect(X+22,gy-8,1,2);      // transformer masts
    if((Math.floor(now/700))&1){ g.fillStyle="#ff5050"; g.fillRect(X+2,gy-12,1,1); }
  }
}
// a deterministic astronomical designation for this life's planet-killer (e.g. "2031 KX")
function meteorDesig(now){ var li=lifeIndexOf(NOWOVR!=null?NOWOVR:now), h=((li*2654435761+91)>>>0); h=(h^(h>>>13))>>>0;
  return "20"+(26+(h%12))+" "+String.fromCharCode(65+((h>>>4)%26))+String.fromCharCode(65+((h>>>9)%26)); }
// escalating NEWS about the incoming planet-killer — begins ~2 days out (late in the city's life) & builds to panic.
// Only for a meteor-fated life; returns null otherwise so the normal ticker runs.
function meteorNews(now){
  if(curDeath!=="meteors") return null;
  if(cityPhase==="apoc"){
    if(apocMs>=METEOR_IMPACT_MS) return apocMs<METEOR_IMPACT_MS+9000 ? "☄ IMPACT - "+cityName+" DECIMATED" : cityName+" IS GONE";
    if(apocMs>METEOR_IMPACT_MS-7000) return "☄ BRACE FOR IMPACT - SECONDS TO STRIKE ☄";
    return "IMPACT IMMINENT - EVACUATE "+cityName+" NOW";
  }
  var cy=cityGrowth(now).cy;                                    // ~2 days = the last cy∈[0.714,0.955] of the week-long life
  if(cy>=0.90)  return "GLOBAL ALERT - "+meteorDesig(now)+" ON COLLISION COURSE WITH "+cityName;
  if(cy>=0.83)  return "ASTRONOMERS WARN OBJECT "+meteorDesig(now)+" MAY STRIKE "+cityName;
  if(cy>=0.714) return "OBSERVATORY TRACKING NEAR-EARTH OBJECT "+meteorDesig(now);
  return null;
}
// the downtown LED NEWS TICKER — it reports what is actually happening in the simulation
function tickerMsg(now){
  var mn=meteorNews(now); if(mn) return mn;                     // the incoming planet-killer dominates the news for ~2 days out
  if(cityPhase==="apoc") return "EMERGENCY BROADCAST - EVACUATE "+cityName+" NOW";
  if(curWar&&curWar.f>=0&&curWar.f<1) return "INVASION UNDERWAY - SHELTER IN PLACE";
  if(curWar&&curWar.f>=1&&!curWar.win) return "CURFEW IN EFFECT BY ORDER OF THE OCCUPATION";
  if(curDis) return "BREAKING - CAT-"+curDis.intensity+" "+DIS_NAME[curDis.type]+" - SEEK SHELTER";
  var fx=wfx();
  if(fireBurning) return "WILDFIRE ON THE RIDGE - STAY CLEAR OF THE TREELINE";
  if(iceNow) return "THE BAY IS FROZEN - SKATE AT YOUR OWN JOY";
  if(curBlk) return curBlk.fix?"CREWS RESTORING POWER - GRID BACK SHORTLY":"STORM BLACKOUT DOWNTOWN - CREWS EN ROUTE";
  if(curOutbreak) return curOutbreak.f<0.7?"HEALTH ADVISORY - MASKS RECOMMENDED CITYWIDE":"OUTBREAK WANES - HOSPITALS REPORT RECOVERY";
  if(fx.thunder) return "SEVERE THUNDERSTORM WARNING FOR "+cityName;
  if(fx.snow) return "WINTER STORM - PLOWS DEPLOYED CITYWIDE";
  if(fx.rain||fx.drizzle) return "RAIN CONTINUES - "+Math.round(weather.temp==null?60:weather.temp)+"F DOWNTOWN";
  if(fx.fog) return "DENSE FOG ADVISORY - LOW VISIBILITY DOWNTOWN";
  if(fx.cloudy) return ((weather.cloud||0)>=88?"OVERCAST":"CLOUDY")+" SKIES OVER "+cityName+" - "+Math.round(weather.temp==null?60:weather.temp)+"F";
  if(curEvents&&curEvents.parade) return "PARADE TODAY ON MAIN STREET";
  if(curEvents&&curEvents.market) return "FARMERS MARKET OPEN UNTIL 4 PM";
  if(curEvents&&curEvents.movie) return "MOVIE NIGHT IN THE PLAZA AT DUSK";
  if(curSpace>0.3) return cityName+" SPACEPORT - NEXT LAUNCH BOARDING";
  var nd2=nowDate(), gm=gameNight(nd2);
  var msgs=["WELCOME TO "+cityName,"POP "+popFmt(cityPop())+" AND GROWING",cityName+" TRANSIT - ALL LINES RUNNING"];
  var appr=approvalNow(now);   // N3 (shared with the civic HUD)
  msgs.push("CITY APPROVAL "+appr+" PCT");
  msgs.push(curEcon>0.5?("BUDGET SURPLUS "+(1+Math.round(curEcon*6))+"M"):("BUDGET DEFICIT "+(1+Math.round((1-curEcon)*5))+"M"));
  if(curCruise&&curCruise.f>0.2&&curCruise.f<0.82) msgs.push("CRUISE SHIP IN PORT - WELCOME VISITORS");
  var FI=famInfo(now), cg3=cityGrowth(now);                                                   // N4+: the generations
  var FMS=[[0.30,"WEDDING BELLS - "+FI.pA+" AND "+FI.pB+" "+FI.sur],
    [FI.k1.born,"THE "+FI.sur+" FAMILY WELCOMES LITTLE "+FI.k1.name]];
  if(FI.k2) FMS.push([FI.k2.born,"A SECOND CHILD FOR THE "+FI.sur+"S - WELCOME "+FI.k2.name]);
  FMS.push([0.50,FI.k1.name+" "+FI.sur+" - FIRST DAY OF SCHOOL"],
    [0.55,FI.k1.name+" "+FI.sur+" CHOOSES A CALLING - "+JOBS[FI.k1.job][0]],
    [FI.wed,FI.k1.name+" "+FI.sur+" MARRIES IN THE PLAZA TODAY"],
    [FI.g3.born,"A GRANDCHILD FOR "+FI.pA+" AND "+FI.pB+" "+FI.sur],
    [0.70,FI.sur.toUpperCase()+" AND "+(FI.k1.name)+" OPEN \""+FI.sur+" AND "+(FI.k2?"FAMILY":"SON")+"\" ON MARKET ROW"],
    [0.74,"TWO HOUSES JOINED - A "+FI.sur+" WEDS A "+LNAMES[(FI.sur.length*7+3)%LNAMES.length]],
    [0.78,FI.k1.name+" THE "+JOBS[FI.k1.job][0]+" NAMED CITIZEN OF THE YEAR"],
    [0.82,"THE "+FI.sur+" HEIRLOOM TURNS 100 - STILL ON THE SILL"],
    [FI.elder,"THE CITY HONORS ELDER "+FI.pA+" "+FI.sur+" - FLAGS AT HALF MAST"]);
  for(var fm2=0;fm2<FMS.length;fm2++) if(Math.abs(cg3.cy-FMS[fm2][0])<0.006) return FMS[fm2][1];
  if(gm) msgs.push("GAME NIGHT - "+cityName+" "+teamName+" AT 7","GO "+teamName+"!");
  if(curMayor&&curMayor.campaign){ msgs.push("ELECTION AHEAD - "+curMayor.winName+" VS "+curMayor.loseName,"RALLY TONIGHT IN THE PLAZA");
    var nm5=curMayor.nextMeasures; if(nm5&&nm5.length) msgs.push("ON THE BALLOT - PROP "+MEASURE_LABEL[nm5[0].t]+(nm5[1]?(" AND "+MEASURE_LABEL[nm5[1].t]):"")); }
  if(curMayor&&curMayor.electionDay) msgs.push("POLLS OPEN - VOTE TODAY");
  if(curMayor&&curMayor.justElected){ msgs.push("MAYOR "+curMayor.winName+" TAKES OFFICE - "+curMayor.party.k+" AGENDA");
    var jm5=curMayor.measures||[]; for(var mi5=0;mi5<jm5.length;mi5++){ var mm5=jm5[mi5];
      msgs.push("PROP "+MEASURE_LABEL[mm5.t]+" - "+(mm5.pass?"PASSES ":"FAILS ")+mm5.yes+"-"+(100-mm5.yes)); } }
  if(curMayor&&curMayor.debate) msgs.push("MAYORAL DEBATE TONIGHT - "+curMayor.winName+" VS "+curMayor.loseName);
  if(curMayor&&curMayor.campaign) msgs.push("LATEST POLL - "+curMayor.winName+" LEADS "+curMayor.loseName);
  if(curMayor&&curMayor.justElected) msgs.push(curMayor.share>=58?("LANDSLIDE WIN FOR "+curMayor.winName):curMayor.share<=53?("RAZOR-THIN - RECOUNT CONFIRMS "+curMayor.winName):curMayor.hold?(curMayor.party.k+" HOLDS CITY HALL"):(curMayor.winName+" ELECTED MAYOR"));
  if(curMayor&&curMayor.scandal) msgs.push(curMayor.ousted?("MAYOR OUSTED - "+curMayor.winName+" SWORN IN"):(curMayor.recallVote?"RECALL VOTE UNDERWAY AT CITY HALL":"CITY HALL ROCKED BY SCANDAL"));
  if(curEcon>0.65) msgs.push("MARKETS RALLY - CRANES OVER "+cityName);
  if(curEcon<0.35) msgs.push("MARKETS SLUMP - STOREFRONTS GO DARK");
  if(cityHasBuild("casino")){ msgs.push("CASINO ZONE DRAWS RECORD CROWDS - TOURISM UP"); msgs.push("POLICE ADD PATROLS AROUND THE CASINO DISTRICT"); }
  if(curPolicies.heightcap&&curEcon<0.45) msgs.push("DEVELOPERS BLAME HEIGHT CAP FOR STALLED GROWTH");
  if(cityHasBuild("park")) msgs.push("CITY PARK NAMED BEST NEW PUBLIC SPACE");
  var bn=corpNews(now); for(var ci2=0;ci2<bn.length;ci2++) msgs.push(bn[ci2]);   // corporate business headlines (rise/IPO/merger/bankruptcy)
  return msgs[Math.floor(now/12000)%msgs.length];
}
// ---- NEWSPAPERS: when something big happens, papers spread the word — extras blow across the
//      city on the wind, tumbling out from wherever the event is. (The words themselves scroll on
//      the LED ticker; these are the papers physically spreading the news.) ----
// (newsEvent / drawNewspaper / drawNewsFlurry removed 2026-07-12 — user found the sky papers
//  weird and hard to read; major events are still narrated on the LED ticker below.)
function drawTicker(g,L,now,night){
  if(cityG<0.55) return;
  var wx=Math.round(0.47*WW), bw=46, y=HORIZON-52;
  for(var w=-1;w<=1;w++){ var X=(wx-WOFF+w*WW)|0; if(X+bw<-4||X>SW+4) continue;
    g.fillStyle=L>0.5?"#3a3f4a":"#141821"; g.fillRect(X,y+7,2,HORIZON-y-7); g.fillRect(X+bw-2,y+7,2,HORIZON-y-7);
    g.fillStyle=L>0.5?"#23262e":"#0a0b10"; g.fillRect(X-1,y-1,bw+2,9);
    g.save(); g.beginPath(); g.rect(X,y,bw,7); g.clip();
    var msg=tickerMsg(now), tw2=(msg.length*4-1)+30, off=(now*0.014)%tw2;
    drawUiText(g,msg,(X+bw-off)|0,y+1,night>0.5?"#ffb347":"#e8862a",1);
    drawUiText(g,msg,(X+bw-off+tw2)|0,y+1,night>0.5?"#ffb347":"#e8862a",1);
    g.restore();
    if(night>0.4){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,160,60,0.10)";
      g.fillRect(X,y,bw,7); g.globalCompositeOperation="source-over"; }
  }
}
// is anything news-worthy happening right now? (cuts the building screens to red BREAKING coverage)
function newsEmergency(){
  return cityPhase==="apoc" || !!curDis || (curWar&&curWar.f>=0&&curWar.f<1) || !!curBlk || !!curOutbreak || fireBurning;
}
// big LED NEWS SCREENS mounted high on the downtown towers — they run the LOCAL city news, and cut to
// red BREAKING coverage the instant anything happens (disaster, invasion, the incoming meteor…), so the
// story is visible right on the skyline. Each screen dies with its tower when the cataclysm reaches it.
function drawNewsScreens(g,L,now,night){
  if(cityG<0.5) return;
  var msg=tickerMsg(now), emerg=newsEmergency();
  var parts=cityName.split(" "), tag=""; for(var pi=0;pi<parts.length&&pi<3;pi++) tag+=parts[pi].charAt(0);
  var hdr=emerg?"BREAKING":(tag+" NEWS");
  var drawn=0;
  for(var i=0;i<near.blds.length && drawn<5;i++){ var b=near.blds[i];
    if(b.type==="park"||b.h<46||b.w<14) continue;                          // tall, wide-enough downtown towers only
    if(((b.seed>>>4)%4)!==0) continue;                                      // only some towers carry a big screen
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;             // not before the tower is built
    if(overLandmark(b.x,b.w)) continue;
    if(apocHit(b.x)) continue;                                             // the screen is gone once the tower is destroyed
    var bx=b.x-WOFF; if(bx>SW+4&&bx-WW>-4)bx-=WW; if(bx<-4-b.w&&bx+WW<SW+4)bx+=WW;
    if(bx<-40||bx>SW+40) continue;
    drawn++;
    var sw2=Math.min(b.w-4,34), sh2=13, sx=Math.round(bx+(b.w-sw2)/2), sy=HORIZON-b.h+8;   // mounted high on the facade
    g.fillStyle=emerg?"#5a1418":(L>0.5?"#474d59":"#2a2f39"); g.fillRect(sx-1,sy-1,sw2+2,sh2+2);   // metallic bezel — reads against any facade
    g.fillStyle=emerg?"#170406":"#05070c"; g.fillRect(sx,sy,sw2,sh2);                             // dark screen
    g.fillStyle=emerg?"#7a1418":"#123a4e"; g.fillRect(sx,sy,sw2,4);                               // header bar
    drawUiText(g,hdr.substr(0,Math.max(1,(sw2/4)|0)),sx+1,sy,emerg?"#ffd2c4":"#bfe8ff",1);
    if((Math.floor(now/500))&1){ g.fillStyle=emerg?"#ff3b3b":"#ff5555"; g.fillRect(sx+sw2-3,sy+1,2,2); }   // blinking LIVE dot
    g.save(); g.beginPath(); g.rect(sx+1,sy+5,sw2-2,sh2-6); g.clip();                             // scrolling news line, clipped
    var tw2=(msg.length*4-1)+24, off=((now*0.02)+b.seed*7)%tw2, tcol=emerg?"#ff9a78":(night>0.5?"#7fe0ff":"#9ad4ff");
    drawUiText(g,msg,(sx+sw2-1-off)|0,sy+6,tcol,1);
    drawUiText(g,msg,(sx+sw2-1-off+tw2)|0,sy+6,tcol,1);
    g.restore();
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle=emerg?"rgba(255,60,50,0.12)":"rgba(90,180,255,0.10)"; g.fillRect(sx,sy,sw2,sh2); g.globalCompositeOperation="source-over"; }
  }
}

// the OPEN SEA at the coast: land simply ends at a beach and the water runs on
// natural water body: smooth depth gradient + rolling two-tone swell (shared by sea & harbour).
// Crests are short drifting dashes whose speed/density grow toward the viewer — no grid pattern.
function waterTex(g,xa,xb,yTop,yBot,L,now){
  var w=xb-xa, h=yBot-yTop; if(w<=0||h<=0) return;
  var day=L>0.5, deep=mixc([26,58,84],[92,152,188],L);
  if(goldenK>0.05) deep=mixc(deep,goldC,goldenK*0.22);   // golden-hour water
  var sg2=g.createLinearGradient(0,yTop,0,yBot);
  sg2.addColorStop(0,css(mixc(deep,[168,196,224],day?0.3:0.14)));    // soft at the far edge…
  sg2.addColorStop(0.22,css(mixc(deep,[120,168,208],day?0.18:0.07)));
  sg2.addColorStop(0.55,css(deep));
  sg2.addColorStop(1,css(mixc(deep,day?[8,18,34]:[16,32,54],0.45))); // …deep, but readable at night
  g.fillStyle=sg2; g.fillRect(xa,yTop,w,yBot-yTop);
  g.fillStyle=day?"rgba(255,255,255,0.12)":"rgba(140,175,215,0.08)"; g.fillRect(xa,yTop,w,1);
  for(var y=yTop+2;y<yBot;y+=2){ var dpt=(y-yTop)/h;                 // the SWELL, row by row
    var stride=(QUAL===0?8:6)+((y*13)%4)-((dpt*3)|0);                // irregular spacing, denser up close
    var drift=Math.floor(now*(0.008+dpt*0.013)) + ((Math.sin(y*0.9)*5)|0);   // each row rolls at its own pace
    var ca=(day?0.05:0.045)+dpt*(day?0.09:0.06);
    for(var x=xa+(((drift%stride)+stride)%stride); x<xb-1; x+=stride){
      var pk=Math.sin((x+drift*0.4)*0.05+y*0.47+now*0.00035);        // the sea moves in PATCHES —
      if(pk<-0.15) continue;                                         // calm lanes between the chop
      var aa3=ca*(0.45+0.55*pk);
      var cl=1+((x*7+y*13)&1);                                       // 1-2px crest dashes, irregular
      g.fillStyle="rgba(255,255,255,"+aa3.toFixed(3)+")"; g.fillRect(x,y,cl,1);
      g.fillStyle="rgba(6,14,30,"+(0.05+dpt*0.09).toFixed(3)+")";
      g.fillRect(x+((x+y)&1?-1:cl),y+1,cl,1);                        // shadowed trough beside it
    }
  }
  if(!day){                                                          // STARLIGHT rides the water at night
    g.globalCompositeOperation="lighter";
    for(var sg3=xa+3;sg3<xb-2;sg3+=12){ var hh7=((sg3*2654435761)>>>0);
      var tw2=Math.sin(now*0.0016+(hh7%97));
      if(tw2>0.55){ g.fillStyle="rgba(190,214,255,"+(0.10+0.16*(tw2-0.55)).toFixed(3)+")";
        g.fillRect(sg3,yTop+2+(hh7>>>4)%(h-3|0||1),1,1); } }
    g.globalCompositeOperation="source-over";
  }
}
// the mountains lean into the water: their silhouette mirrored as a soft dark reflection.
// Uses the cached ridge profile, so it costs one translucent column per pixel.
function drawMtsReflection(g,xa,xb,yTop,maxD,L){
  if(!mts||!mtsCache) return;
  var day=L>0.5;
  g.fillStyle=day?"rgba(52,66,96,0.20)":"rgba(6,10,22,0.30)";
  var a=Math.max(0,xa|0), b=Math.min(SW,xb|0);
  for(var sx=a;sx<b;sx++){
    var rh=mtsCache.h[1][sx]; if(mtsCache.h[0][sx]*0.8>rh) rh=mtsCache.h[0][sx]*0.8;
    if(rh<3) continue;
    var refH=Math.min(maxD,(rh*0.36)|0);
    if(((sx*11)&7)===0) refH-=1;                                     // ripple-broken edge
    if(refH>0) g.fillRect(sx,yTop+1,1,refH);
  }
}
function drawOpenSea(g,L,now,night){
  if(!hasOcean||seaW<=0) return;
  var wTop=HORIZON-22, day=L>0.5;
  var sand=day?[216,196,150]:[86,80,64], wet=day?[168,148,110]:[62,58,46];
  var depth=(roadFNow()>0.5)?(HORIZON-wTop):(SH-wTop);        // before the causeway is paved, water runs to the screen bottom
  var bands=[[0,WW*seaW,+1],[WW*(1-seaW),WW,-1]];
  for(var bi2=0;bi2<bands.length;bi2++){ var A=bands[bi2][0], B=bands[bi2][1], side=bands[bi2][2];
    for(var w2=-1;w2<=1;w2++){ var xa=Math.max(0,(A-WOFF+w2*WW)|0), xb=Math.min(SW,(B-WOFF+w2*WW)|0);
      if(xb<=xa) continue;
      waterTex(g,xa,xb,wTop,wTop+depth,L,now);
      drawMtsReflection(g,xa,xb,wTop,depth-2,L);               // the range mirrored in the sea
      var ex=((side>0? B : A)-WOFF+w2*WW)|0;                   // the land's edge
      if(ex<-10||ex>SW+10) continue;
      for(var sy=wTop;sy<wTop+depth;sy++){                     // the BEACH — a meandering, lapping shoreline
        var dp2=(sy-wTop)/depth;
        var curve=Math.sin(sy*0.16+A*0.3)*1.6+Math.sin(sy*0.05+1.7)*2.2;     // the coast wanders as it nears
        var bx2=Math.round(ex+curve*(0.35+dp2)), bw2=3+((sy*7)%2);           // beach widens subtly downward
        g.fillStyle=css(sand); g.fillRect(side>0?bx2:bx2-bw2,sy,bw2,1);      // dry sand
        g.fillStyle=rgba(sand,0.45); g.fillRect(side>0?bx2+bw2:bx2-bw2-2,sy,2,1);   // fades into the grass
        g.fillStyle=css(wet); g.fillRect(side>0?bx2-1:bx2+1-1,sy,1,1);       // wet sand at the waterline
        var lap=Math.sin(now*0.0016+sy*0.55+A);                              // FOAM laps in and out
        if(lap>-0.2){ var fw=1+(lap>0.55?1:0);
          g.fillStyle="rgba(255,255,255,"+(0.24+0.30*Math.max(0,lap)).toFixed(2)+")";
          g.fillRect(side>0?bx2-1-fw:bx2+1,sy,fw,1); }
        if(((sy*13+((now/900)|0))%11)===0){                                  // an occasional breaker rolling in
          g.fillStyle=day?"rgba(255,255,255,0.5)":"rgba(200,220,255,0.35)";
          g.fillRect(side>0?bx2-4:bx2+2,sy,2,1); }
      }
      if(!day&&night>0.3){                                     // the moon lays a glint path on dark water
        var gx2=Math.max(xa+3,Math.min(xb-3,((xa+xb)>>1)+((A>0?-6:6))));
        g.globalCompositeOperation="lighter";
        for(var gy2=wTop+2;gy2<wTop+depth;gy2+=2){ var jig=((Math.sin(gy2*1.3+now*0.002)*2.5)|0);
          var gw2=1+((Math.sin(gy2*0.7+now*0.001)+1)*1.3|0);         // the path breathes wider and narrower
          g.fillStyle="rgba(190,210,245,"+(0.06+0.11*((gy2-wTop)/depth)).toFixed(3)+")";
          g.fillRect(gx2+jig-(gw2>>1),gy2,gw2,1); }
        g.globalCompositeOperation="source-over";
      }
    } }
}

// the settlers' FERRY: until the causeway is paved, the only way across the open water
// is a flat raft poled back and forth — it carries a wagon over, span by span
function drawFerry(g,L,now){
  if(!hasOcean||seaW<=0) return;
  var day=L>0.5, fy=HORIZON+4, bands=[[0,WW*seaW],[WW*(1-seaW),WW]];
  for(var fb=0;fb<bands.length;fb++){ var A=bands[fb][0], B=bands[fb][1];
    var run=Math.max(8,B-A-26), T=34000+fb*9000;
    var ph=((now+fb*13000)/T)%2, f=ph<1?ph:2-ph, fdir=ph<1?1:-1;   // ping-pong shore to shore
    var fwx=A+10+f*run;
    for(var wf=-1;wf<=1;wf++){ var FX=(fwx-WOFF+wf*WW)|0; if(FX<-16||FX>SW+16) continue;
      g.fillStyle=day?"#8a6242":"#4a3a26"; g.fillRect(FX,fy,13,2);            // raft deck
      g.fillStyle=day?"#6a4a30":"#362a1a"; g.fillRect(FX,fy,1,2); g.fillRect(FX+12,fy,1,2);
      g.fillStyle=day?"#5a4028":"#2c2014"; g.fillRect(FX+1,fy-3,1,3); g.fillRect(FX+11,fy-3,1,3);   // rope posts
      g.fillStyle="rgba(120,100,70,0.6)"; g.fillRect(FX+1,fy-3,11,1);         // rope rail
      g.fillStyle=day?"#6a4a30":"#3a2c1c"; g.fillRect(FX+3,fy-2,5,1);         // the wagon aboard
      g.fillStyle=day?"#e8e2d2":"#8a857a"; g.fillRect(FX+4,fy-4,3,2);         // its canvas bonnet
      var pole=(Math.floor(now/400))&1;                                       // the ferryman poling
      drawPerson(g,FX+(fdir>0?10:2),fy-1,day?"#7a5a3a":"#3e3020",SKINC[fb+1],pole);
      g.fillStyle="rgba(120,100,70,0.7)"; g.fillRect(FX+(fdir>0?12:0),fy-4+pole,1,4);
      g.fillStyle=day?"rgba(255,255,255,0.35)":"rgba(150,180,220,0.3)";       // wake trailing behind
      g.fillRect(FX+(fdir>0?-3:14),fy+1,3,1); g.fillRect(FX+(fdir>0?-1:13),fy+2,1,1);
      if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,200,90,0.35)";   // bow lantern
        g.fillRect(FX+(fdir>0?11:0),fy-5,2,2); g.globalCompositeOperation="source-over"; }
    }
  }
}

// ---- weekend farmers' market: striped stalls + produce + shoppers (residential/oldtown) ----
function drawMarket(g,L,now){
  var gy=HORIZON+1, ac=["#d23b3b","#2f9a5f","#e0a83a","#3a70b0","#a04a8a"], prod=["#e0402a","#f0a828","#3ac85a","#f07028","#e060c0","#ffd23a"];
  for(var mx=14; mx<WW; mx+=15){ var dn=districtAt(mx).name; if(dn!=="residential"&&dn!=="oldtown") continue;
    for(var off=-WW;off<=WW;off+=WW){ var X=(mx-WOFF+off)|0; if(X<-6||X>SW+8) continue;
      var pr=rng((mx*131+7)>>>0), c=ac[(mx>>2)%ac.length];
      g.fillStyle="#8a6a4a"; g.fillRect(X-3,gy-6,1,6); g.fillRect(X+4,gy-6,1,6);           // posts
      for(var aw=0;aw<8;aw++){ g.fillStyle=((aw&1)?c:"#eef1f6"); g.fillRect(X-3+aw,gy-6,1,1); }  // striped awning
      g.fillStyle=L>0.5?"#6a5238":"#241a12"; g.fillRect(X-3,gy-2,8,2);                     // table
      for(var pp=0;pp<6;pp++){ g.fillStyle=prod[(pp+ (mx>>1))%prod.length]; g.fillRect(X-3+pp+((pp>2)?1:0),gy-3,1,1); }  // produce
      drawPerson(g,X+3,gy-2,"#5a7a4a",SKINC[(mx)%SKINC.length],0);                          // stallholder
      if(pr()<0.75) drawPerson(g,X-4,gy-2,PEDC[(mx>>1)%PEDC.length],SKINC[(mx>>2)%SKINC.length],0);  // shopper
    }
  }
}
// ---- marathon: a dense stream of numbered runners flowing one way ----
function drawMarathon(g,L,now){
  var vests=["#ff4d4d","#4aa8ff","#ffd23a","#6affc0","#ff7ad0","#eef2ff"];
  for(var k=0;k<Math.round(WW/5);k++){
    var wx=wrapW(k*5 + now*0.03 + (k%3)*1.7), sx=wx-WOFF;
    if(sx>SW+3&&sx-WW>-3) sx-=WW; if(sx<-3&&sx+WW<SW+3) sx+=WW; if(sx<-2||sx>SW+2) continue;
    var lane=k%3, y=HORIZON-1+lane, bob=((sx+((now*0.02)|0)+k)&1);
    drawPerson(g,sx,y,vests[k%vests.length],SKINC[k%SKINC.length],bob);
    g.fillStyle="#ffffff"; g.fillRect(sx|0,(y+1-bob)|0,1,1);                                // race bib
  }
}
// ---- outdoor movie night: a big flickering screen + a seated audience ----
function drawMovie(g,L,now,night){
  var mx=Math.round(0.365*WW);
  for(var off=-WW;off<=WW;off+=WW){ var X=(mx-WOFF+off)|0; if(X<-24||X>SW+8) continue;
    var scW=22, scH=13, scY=HORIZON-18;
    g.fillStyle=L>0.5?"#4a4e58":"#0b0c12"; g.fillRect(X-1,scY-1,scW+2,scH+2);              // frame
    var f=(Math.floor(now/220))%4, mc=[["#3a466a","#8fa0c8"],["#7a4a2a","#f0c088"],["#2a5060","#7ad0e0"],["#5a4460","#c8a0d8"]][f];
    g.fillStyle=mc[0]; g.fillRect(X,scY,scW,scH); g.fillStyle=mc[1]; g.fillRect(X+2+f,scY+2,scW-6,4); g.fillRect(X+4,scY+scH-4,scW-9,2);
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,180,230,0.10)";  // projector glow over the crowd
      g.beginPath(); g.moveTo(X,scY+scH); g.lineTo(X-4,HORIZON); g.lineTo(X+scW+4,HORIZON); g.lineTo(X+scW,scY+scH); g.closePath(); g.fill(); g.globalCompositeOperation="source-over"; }
    g.fillStyle=L>0.5?"#3a3a44":"#14141c"; g.fillRect(X+2,scY+scH,2,3); g.fillRect(X+scW-4,scY+scH,2,3);   // posts
    for(var row=0;row<3;row++) for(var seat=0;seat<9;seat++){                                // audience
      if(((seat*3+row+ (mx))%7)===0) continue;
      drawSeated(g,X+1+seat*2, HORIZON-2-row, PEDC[(seat*3+row)%PEDC.length], SKINC[(seat+row)%SKINC.length]); }
  }
}
// ============================ LANDMARKS & ATTRACTIONS ============================
// Prominent fixed structures that appear once the city is established (gated by cityG),
// plus sky attractions (balloons, an ad-blimp). All pure functions of the world clock.
var LM_STADIUM=0.63, LM_CATHEDRAL=0.24, LM_FERRIS=0.93;        // world-x fractions
var LM_CITYHALL=0.415, LM_SCHOOL=0.685, LM_MUSEUM=0.275, LM_COASTER=0.885, LM_MEGA=[0.44,0.565];
var LM_COURTHOUSE=0.48, LM_CAPITOL=0.505, LM_POLICE=0.335, LM_FIRE=0.365, LM_LIBRARY=0.72, LM_POST=0.78;  // government district
var schoolAt=0.42, EDUB=0, POPK=0.5, SMALLW=false;   // SMALLW: single-monitor world — fewer, tighter landmarks     // per-life school timing; early schooling hastens the space age (N8)
var lmFoot=[];                                                 // cleared plaza footprints (world x-ranges), rebuilt each frame
function computeLmFoot(){ lmFoot.length=0;
  // the plots are reserved from the start (fairground), so no buildings get "demolished" when landmarks rise
  var sc=Math.round(LM_STADIUM*WW); lmFoot.push([sc-30,sc+30]);
  var hc=Math.round(LM_CITYHALL*WW); lmFoot.push([hc-26,hc+26]);   // wide plaza — city hall grows imposing with the city
  var scl=Math.round(LM_SCHOOL*WW); lmFoot.push([scl-12,scl+12]);
  var mu=Math.round(LM_MUSEUM*WW); lmFoot.push([mu-12,mu+12]);
  var mx0=Math.round(LM_MEGA[0]*WW); lmFoot.push([mx0-10,mx0+10]);
  if(heroEra()){ var hh=Math.round(LM_HERO*WW); lmFoot.push([hh-16,hh+16]); }   // clear a plaza for this life's hero monument
  var cth=Math.round(LM_COURTHOUSE*WW); lmFoot.push([cth-24,cth+24]);       // government district (courthouse + capitol always) — grow with maturity
  var cap=Math.round(LM_CAPITOL*WW); lmFoot.push([cap-30,cap+30]);
  if(!SMALLW){                                                  // the big-world extras
    var cc=Math.round(LM_CATHEDRAL*WW); lmFoot.push([cc-15,cc+15]);
    var co=Math.round(LM_COASTER*WW); lmFoot.push([co-44,co+44]);   // wider plaza: the amusement park (ferris wheel + coaster) spans ~80px
    var mx1=Math.round(LM_MEGA[1]*WW); lmFoot.push([mx1-10,mx1+10]);
    var pol=Math.round(LM_POLICE*WW); lmFoot.push([pol-9,pol+9]);           // police + fire (public safety)
    var fir=Math.round(LM_FIRE*WW); lmFoot.push([fir-9,fir+9]);
    var lib=Math.round(LM_LIBRARY*WW); lmFoot.push([lib-10,lib+10]);        // library + post office
    var pos=Math.round(LM_POST*WW); lmFoot.push([pos-10,pos+10]); } }
function overLandmark(bx,bw){ for(var i=0;i<lmFoot.length;i++){ if(bx<lmFoot[i][1] && bx+bw>lmFoot[i][0]) return true; } return false; }

function gameNight(nd){ var d=nd.getDay(); return d===3||d===5||d===6; }   // Wed/Fri/Sat home games
// fictional advertisers whose ad-blimps ply the skyline — each with a brand colour for the banner + logo
var BLIMP_ADS=[
  {t:"DRINK ZORP COLA",      c:[224,46,64]},
  {t:"FLY AEROLUX AIR",      c:[52,128,224]},
  {t:"NEXACORP - THE FUTURE",c:[150,74,224]},
  {t:"VOLTA MOTORS - GO EV", c:[40,196,146]},
  {t:"GLOWMART MEGA SALE",   c:[240,150,34]},
  {t:"BYTEHIVE CLOUD",       c:[44,178,222]},
  {t:"MOONBUX COFFEE",       c:[176,126,72]},
  {t:"TITAN TRUST BANK",     c:[214,182,66]},
  {t:"OMNIBURGER - EAT MORE",c:[230,92,42]},
  {t:"STARFIZZ ENERGY",      c:[128,214,54]},
  {t:"NIMBUS INSURANCE",     c:[96,150,214]},
  {t:"HYPERGRID INTERNET",   c:[224,64,168]},
  {t:"QUANTA PHONES",        c:[70,200,210]},
  {t:"NOVA STREAM - WATCH",  c:[236,72,120]}
];
var CORP_TAGLINES=["THE FUTURE IS NOW","SAVE BIG TODAY","EVERYONE IS SWITCHING","NOW HIRING","AS SEEN ON TV",
  "YOU DESERVE IT","JOIN THE MOVEMENT","NUMBER ONE FOR A REASON","BUILT DIFFERENT","ACCEPT NO SUBSTITUTE",
  "LIVE BETTER","IT JUST WORKS","GRAND OPENING","WE MEAN BUSINESS"];
function blimpMsg(nd,idx){
  var m=nd.getMonth()+1, day=nd.getDate();       // holidays pre-empt the ad — a civic greeting flies instead
  if(m===7&&day>=1&&day<=6) return {t:"HAPPY JULY 4 !", c:[255,92,80]};
  if(m===12&&day>=20) return {t:"HAPPY HOLIDAYS", c:[92,214,120]};
  if(m===1&&day<=2) return {t:"HAPPY NEW YEAR", c:[240,210,80]};
  if(m===10&&day>=28) return {t:"HAPPY HALLOWEEN", c:[250,140,30]};
  if(m===2&&day>=13&&day<=15) return {t:"BE MINE", c:[240,84,142]};
  var d=Math.floor(nd.getTime()/86400000);
  var C=curCorps;                                                // a currently-prominent company sponsors the blimp (weighted by size)
  if(C&&C.cos.length){ var pool=[];
    for(var i=0;i<C.cos.length;i++){ var e=C.cos[i]; if(e.bankrupt||e.size<0.15) continue; var reps=1+Math.round(e.size*3); for(var r=0;r<reps;r++) pool.push(e); }
    if(pool.length){ var pk=pool[(((idx||0)+d)%pool.length+pool.length)%pool.length];
      var tl=CORP_TAGLINES[(((pk.seed>>>4)+d)>>>0)%CORP_TAGLINES.length];
      return {t: pk.co.n+" - "+tl, c: pk.co.c}; } }
  var n=BLIMP_ADS.length;                                        // fallback: the static roster (hamlet / apoc)
  return BLIMP_ADS[(((idx||0)+d)%n+n)%n];
}

// ============================ CORPORATIONS (a corporate skyline that rises & falls) ============================
// A HUGE roster of fictional companies. Each life picks a handful appropriate to its ERA (industrial→future, like
// war tech), gives them founding dates + growth curves, and lets them RISE and FALL: an old titan fades while a
// startup climbs past it to become the reigning juggernaut whose name crowns the HQ tower and whose ads blanket the
// sky. Names are FONT-safe (UPPERCASE / digits / space / hyphen only). {n:name, g:2-3char logo tag, c:brand colour, e:era 0..3}
var COMPANIES=[
  // e0 — INDUSTRIAL age: steel, rail, coal, mills, shipping, oil
  {n:"IRONHOLM STEEL",     g:"IH", c:[150,96,60],  e:0}, {n:"ATLAS RAILWORKS",   g:"AR", c:[178,64,44],  e:0},
  {n:"VULCAN FOUNDRY",     g:"VF", c:[210,86,32],  e:0}, {n:"MERIDIAN COAL",     g:"MC", c:[86,90,102], e:0},
  {n:"GRANITE STONE CO",   g:"GS", c:[150,150,158],e:0}, {n:"COPPERLINE TELEGRAPH",g:"CT",c:[196,124,58],e:0},
  {n:"HULLINGTON SHIPPING",g:"HS", c:[46,96,146],  e:0}, {n:"OXFORD MILLWORKS",  g:"OM", c:[158,116,72], e:0},
  {n:"PACIFIC CANNERY",    g:"PC", c:[216,166,52], e:0}, {n:"BRANDT MOTORWORKS", g:"BM", c:[132,44,44],  e:0},
  {n:"KEYSTONE OIL",       g:"KO", c:[54,62,74],   e:0}, {n:"ACME DYNAMITE",     g:"AD", c:[224,64,40],  e:0},
  {n:"COGSWORTH GEARS",    g:"CG", c:[168,126,44], e:0}, {n:"BESSEMER STEEL",    g:"BS", c:[104,92,102], e:0},
  {n:"DREDGE HAUL CO",     g:"DH", c:[118,96,54],  e:0}, {n:"STOKELY IRONWORKS", g:"SI", c:[110,76,64],  e:0},
  // e1 — ATOMIC / early-modern: motors, radio, appliances, air, chemicals, plastics
  {n:"AEROLUX AIR",        g:"AL", c:[52,128,224], e:1}, {n:"VOLTA MOTORS",      g:"VM", c:[40,196,146], e:1},
  {n:"TITAN TRUST BANK",   g:"TT", c:[214,182,66], e:1}, {n:"NIMBUS INSURANCE",  g:"NI", c:[96,150,214], e:1},
  {n:"ZENITH RADIO",       g:"ZR", c:[206,64,124], e:1}, {n:"POLARIS APPLIANCE", g:"PA", c:[92,182,212], e:1},
  {n:"CHEMICOR",           g:"CX", c:[122,202,84], e:1}, {n:"ATOMIQUE POWER",    g:"AP", c:[232,202,44], e:1},
  {n:"MAJESTIC MOTORS",    g:"MM", c:[156,46,64],  e:1}, {n:"SUNRAY PLASTICS",   g:"SP", c:[240,152,42], e:1},
  {n:"CONTINENTAL RUBBER", g:"CR", c:[70,72,80],   e:1}, {n:"GLEAMCO SOAP",      g:"GC", c:[240,124,182],e:1},
  {n:"HAVERBROOK MILLS",   g:"HM", c:[162,114,82], e:1}, {n:"LUMICO BULBS",      g:"LB", c:[240,220,92], e:1},
  {n:"REGAL TYPEWRITERS",  g:"RG", c:[92,72,58],   e:1}, {n:"COMET AIRLINES",    g:"CA", c:[70,150,230], e:1},
  // e2 — MODERN: tech, retail, food, media, telecom
  {n:"ZORP COLA",          g:"ZP", c:[224,46,64],  e:2}, {n:"GLOWMART",          g:"GM", c:[240,150,34], e:2},
  {n:"NEXACORP",           g:"NX", c:[150,74,224], e:2}, {n:"BYTEHIVE CLOUD",    g:"BH", c:[44,178,222], e:2},
  {n:"MOONBUX COFFEE",     g:"MB", c:[176,126,72], e:2}, {n:"OMNIBURGER",        g:"OB", c:[230,92,42],  e:2},
  {n:"STARFIZZ ENERGY",    g:"SF", c:[128,214,54], e:2}, {n:"QUANTA PHONES",     g:"QP", c:[70,200,210], e:2},
  {n:"NOVA STREAM",        g:"NS", c:[236,72,120], e:2}, {n:"HYPERGRID",         g:"HG", c:[224,64,168], e:2},
  {n:"SNACKARONI",         g:"SN", c:[240,180,40], e:2}, {n:"BLORBO TOYS",       g:"BT", c:[255,90,160], e:2},
  {n:"MEGALO MART",        g:"ML", c:[40,120,220], e:2}, {n:"FUZZBUZZ MEDIA",    g:"FB", c:[128,84,220], e:2},
  {n:"CLICKZORP",          g:"CZ", c:[60,200,160], e:2}, {n:"PIXELPUP GAMES",    g:"PX", c:[255,140,60], e:2},
  {n:"GULPCO SODA",        g:"GU", c:[220,44,120], e:2}, {n:"TASTYWAVE FOODS",   g:"TW", c:[240,120,60], e:2},
  // e3 — FUTURE: AI, space, fusion, robotics, biotech, orbital
  {n:"HELIOS FUSION",      g:"HF", c:[255,182,44], e:3}, {n:"ASTRA MINING",      g:"AM", c:[182,142,222],e:3},
  {n:"SYNAPSE DYNAMICS",   g:"SD", c:[92,202,255], e:3}, {n:"ORBITAL LOGISTICS", g:"OL", c:[120,162,240],e:3},
  {n:"CORTEXA NEURAL",     g:"CN", c:[200,82,222], e:3}, {n:"QUBIT DYNAMICS",    g:"QD", c:[80,240,200], e:3},
  {n:"VACTRAIN TRANSIT",   g:"VT", c:[60,202,182], e:3}, {n:"BIODOME AGRO",      g:"BA", c:[102,220,92], e:3},
  {n:"AETHER POWER",       g:"AE", c:[142,122,255],e:3}, {n:"NANOFAB SYSTEMS",   g:"NF", c:[200,220,240],e:3},
  {n:"STARFREIGHT",        g:"ST", c:[92,142,255], e:3}, {n:"GENOME WORKS",      g:"GW", c:[255,122,182],e:3},
  {n:"ROBOTICA",           g:"RB", c:[186,204,224],e:3}, {n:"ZORPTECH",          g:"ZT", c:[204,60,204], e:3},
  {n:"LUNARIS MINING",     g:"LU", c:[164,182,240],e:3}, {n:"OMNICORP",          g:"OC", c:[96,116,146], e:3}
];
var CORP_SALT=0x436F7270;   // "Corp" — corporate hash stream, isolated from elections/measures/disasters
function corpEraOf(li){ return Math.min(3, li<0?0:li); }   // industrial(0) → future(3), capped, mirrors war tech
// The corporate landscape RIGHT NOW: a deterministic per-life set of era-appropriate companies, each with a smooth
// rise (and, for many, a later fall), so the reigning juggernaut changes hands over the life. Pure clock function
// (uses econOf, never the mutable curEcon) → stable, jitter-free, freeze-safe. Bounded to ≤6 companies.
function corpState(now){
  if(FORCECORP) return FORCECORP;
  var cg=cityGrowth(now); if(cg.g<0.30||cg.phase==="apoc") return null;         // no corporate skyline in a hamlet or an inferno
  var li=lifeIndexOf(now), era=corpEraOf(li), cy=cg.cy;
  var h=((((li*2654435761)>>>0) ^ CORP_SALT)>>>0);
  // build the era pool (this era + a little legacy 'old money' from the era before)
  var pool=[]; for(var i=0;i<COMPANIES.length;i++){ var ce=COMPANIES[i].e; if(ce===era||(ce===era-1&&((h>>>i)&3)===0)) pool.push(i); }
  if(!pool.length){ for(var j=0;j<COMPANIES.length;j++) if(COMPANIES[j].e===era) pool.push(j); }
  var n=Math.min(6, Math.max(4, 4+(h&1)+((cg.g>0.7)?1:0))), cos=[], used={};
  for(var k=0;k<n && pool.length;k++){ var ch=((h + k*0x9E3779B9)>>>0), pick=pool[ch%pool.length];
    if(used[pick]){ pick=pool[(ch>>>5)%pool.length]; if(used[pick]) continue; } used[pick]=1;
    var co=COMPANIES[pick];
    var established=((ch>>>1)&1)===0;                                            // half are old giants (big at birth), half are startups
    var foundCy=established ? -(0.05+((ch>>>2)%35)/100) : (0.12+((ch>>>3)%42)/100);   // giants: -0.05..-0.40 ; startups: 0.12..0.54
    var riseDur=0.34+((ch>>>9)%30)/100;                                         // 0.34..0.64 of a life to reach full size
    var cap=0.70+((ch>>>11)%30)/100;                                            // this firm's CEILING (0.70..0.99) — distinct heights give a clear, sticky pecking order (no near-tie crown swaps)
    var decl=((ch>>>17)%100) < 58;                                              // ~58% eventually decline (the churn)
    var peakCy=foundCy+riseDur+0.04+((ch>>>21)%16)/100;
    var declDur=0.28+((ch>>>25)%30)/100;
    var boom=0.94+0.10*(econOf(now)-0.5);                                       // gentle & UNIFORM (same factor for all) → colours size without reordering the king (PURE econOf, not curEcon)
    var grow=Math.max(0,Math.min(1,(cy-foundCy)/riseDur));                      // 0→1 growth fraction
    var fall=(decl&&cy>peakCy)?Math.max(0,1-(cy-peakCy)/declDur):1;             // post-peak decline
    var s=Math.max(0,Math.min(1, cap*grow*fall*boom)) + (pick%97)*1e-5;         // ceiling × growth × decline; +tiny stable tiebreak
    var past=(decl&&cy>peakCy);
    var bankrupt=(past&&s<0.13), fading=(past&&!bankrupt&&s<0.55);
    var phase=bankrupt?"bankrupt":s>=0.72?"juggernaut":s>=0.36?"growing":s>0.06?"startup":"seed";
    cos.push({co:co,idx:pick,size:s,phase:phase,fading:fading,bankrupt:bankrupt,founding:foundCy,seed:ch>>>0}); }
  // crown the biggest LIVE company (not bankrupt) if it's clearly a juggernaut
  var king=-1, best=0.60; for(var m=0;m<cos.length;m++){ if(cos[m].bankrupt)continue; if(cos[m].size>best){best=cos[m].size;king=m;} }
  return {li:li, era:era, cy:cy, cos:cos, king:king};
}
// Business-news headlines from the corporate landscape — rise/IPO/record/merger/bankruptcy, naming the firms
function corpNews(now){
  var C=curCorps||corpState(now); if(!C) return [];
  var out=[];
  for(var i=0;i<C.cos.length;i++){ var e=C.cos[i], nm=e.co.n;
    if(e.bankrupt) out.push(((e.seed>>4)&1)?(nm+" FILES FOR BANKRUPTCY"):(nm+" SHUTS ITS DOORS FOR GOOD"));   // decline takes priority over the ascending phases
    else if(e.fading) out.push(nm+" SHARES SLIDE ON WEAK EARNINGS");
    else if(e.phase==="startup") out.push("STARTUP "+nm+" OPENS DOWNTOWN");
    else if(e.phase==="growing") out.push(((e.seed>>3)&1)?(nm+" IPO SOARS ON DAY ONE"):(nm+" OPENS ITS 100TH STORE"));
    else if(e.phase==="juggernaut") out.push(i===C.king?(nm+" NAMED CITYS LARGEST EMPLOYER"):(nm+" POSTS RECORD PROFIT")); }
  if(C.king>=0&&C.cos.length>=2){ var b=(C.king+1)%C.cos.length;                 // the giant swallows a rival
    if(!C.cos[b].bankrupt&&C.cos[b].size<0.4&&((C.li>>>1)&1)) out.push(C.cos[C.king].co.n+" ACQUIRES "+C.cos[b].co.n+" IN MEGADEAL"); }
  return out;
}
// STREET BILLBOARDS: a few fixed hoardings along the boulevards carrying the current companies' ads (readable
// name + brand logo). Rotate slowly; skip the dead. Fixed count → cheap/freeze-safe.
// Every sign is VISIBLY MOUNTED (Nick: no floating signs): flush on a wide building's facade
// with brackets, on rooftop legs over a narrower one, or as a classic framed highway billboard
// on the ground when no born building covers the anchor. Selection is a pure function of the
// near-layer DNA + cityG, so every screen slices the same mounting.
var CORP_AD_X=[0.16,0.35,0.71];
function adMountAt(wx){
  if(!near||!near.blds) return null;
  var B=near.blds, best=null, bd=1e9;
  for(var k=0;k<B.length;k++){ var b=B[k];
    if(b.type==="park") continue;
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;      // unborn / still scaffolding
    if(wx<b.x-6||wx>b.x+b.w+6) continue;
    var d=Math.abs(b.x+b.w/2-wx); if(d<bd){ bd=d; best=b; } }
  return best;
}
function drawCorpAds(g,L,now,night){
  var C=curCorps; if(!C||!C.cos.length||nukeStruck()) return;
  for(var i=0;i<CORP_AD_X.length;i++){
    var wx=Math.round(CORP_AD_X[i]*WW), sx=disX(wx); if(sx<-70||sx>SW+70) continue;
    var live=[]; for(var j=0;j<C.cos.length;j++){ if(!C.cos[j].bankrupt&&C.cos[j].size>=0.12) live.push(C.cos[j]); }
    if(!live.length) continue;
    var e=live[((i*5+((now/9000)|0))%live.length+live.length)%live.length], co=e.co, brand=co.c;
    var tagW=textW(co.g), nmW=textW(co.n), pad=2, pw=pad+(tagW+3)+3+nmW+pad;
    var b=adMountAt(wx), py, x0, mount;
    if(b && b.w>=pw+4 && b.h>=24){
      // FACADE mount: flush on the wall band, clamped fully inside the building
      mount="facade"; var bx=(b.x-WOFF)|0; if(sx-bx>WW/2) bx+=WW; if(bx-sx>WW/2) bx-=WW;
      py=HORIZON-Math.min(b.h-8,26);
      x0=Math.max(bx+2,Math.min(bx+b.w-pw-2,(sx-(pw>>1))|0));
    } else if(b && b.w>=14){
      // ROOFTOP mount: panel on two legs above the roofline
      mount="roof"; py=(HORIZON-b.h-15)|0; x0=(sx-(pw>>1))|0;
    } else {
      // GROUND billboard: framed panel on two stout legs (classic highway hoarding)
      mount="ground"; py=HORIZON-24; x0=(sx-(pw>>1))|0;
    }
    if(mount!=="facade"){
      var legC=L>0.5?"#6a6152":"#2c2620", legY0=py+11, legY1=(mount==="roof")?((HORIZON-b.h)|0):HORIZON;
      g.fillStyle=legC; g.fillRect(x0+2,legY0,2,Math.max(1,legY1-legY0)); g.fillRect(x0+pw-4,legY0,2,Math.max(1,legY1-legY0));
      if(mount==="ground"){ g.fillRect(x0-1,py+12,pw+2,1); }                                     // catwalk line
      g.fillStyle="rgba(0,0,0,0.25)"; g.fillRect(x0+2,legY1-1,pw-4,1);                            // contact shadow
    } else {
      var brC=L>0.5?"#7a7264":"#3a342c";
      g.fillStyle=brC; g.fillRect(x0-1,py+2,1,7); g.fillRect(x0+pw,py+2,1,7);                     // wall brackets
      g.fillStyle="rgba(0,0,0,0.3)"; g.fillRect(x0,py+12,pw,1);                                   // drop shadow on wall
    }
    g.fillStyle="rgba(10,12,18,0.9)"; g.fillRect(x0,py,pw,11);                                   // panel
    g.fillStyle=rgba(brand,0.95); g.fillRect(x0,py-1,pw,1); g.fillRect(x0,py+11,pw,1);            // brand rails
    g.fillStyle=rgba(brand,1); g.fillRect(x0+pad-1,py+1,tagW+3,9);                                // logo box
    drawUiText(g,co.g,x0+pad,py+3,"rgba(10,12,18,0.95)",1);
    drawUiText(g,co.n,x0+pad+tagW+4,py+3, L>0.5?css(mixc(brand,[22,24,30],0.32)):css(brand),1);   // company name
    if(night>0.3){ g.globalCompositeOperation="lighter"; drawUiText(g,co.n,x0+pad+tagW+4,py+3,rgba(brand,0.3+0.35*night),1); g.globalCompositeOperation="source-over"; }
  }
}

// ---- the STADIUM: a tiered grandstand bowl with tall floodlight pylons; roars on game nights + fireworks ----
function drawStadium(g,L,now,night,nd){
  var cx=Math.round(LM_STADIUM*WW), baseY=HORIZON, rw=27, rh=14, game=gameNight(nd)&&L<0.55, lit=game?1:(night*0.55);
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X+rw<-4||X-rw>SW+4) continue;
    // grandstand: the near (front) bowl wall, curving down toward the pitch, tiered seating rows
    for(var ry=0;ry<rh;ry++){ var t=ry/rh, ww=(rw*(1-t*t*0.5))|0;
      g.fillStyle=css(mixc([22,26,34],[86,94,110],L*0.7+0.12)); g.fillRect(X-ww,baseY-rh+ry,ww*2,1);
      if(ry<rh-3 && (ry&1)===0){ g.fillStyle=css(mixc([34,40,52],[120,128,146],L*0.7+0.12)); g.fillRect(X-ww,baseY-rh+ry,ww*2,1); } }  // tier steps
    // packed crowd speckle on the stands (denser + brighter on game nights)
    for(var cxs=-rw+3;cxs<rw-3;cxs+=2){ var cyr=baseY-rh+3+((cxs*7)%(rh-6)); if(cyr>=baseY-2) continue;
      if(!game && ((cxs*3)%5)!==0) continue;
      g.fillStyle=game?["#ffd24a","#5ad0ff","#ff7ad0","#eef2ff","#7affb0"][(((cxs>>1)+(now/500|0))%5+5)%5]:"rgba(180,185,200,0.5)";
      g.fillRect(X+cxs,cyr,1,1); }
    g.fillStyle=css(mixc([40,46,60],[150,160,180],L)); g.fillRect(X-rw+1,baseY-rh,(rw-1)*2,1);         // top rim
    // the pitch (lit green on game nights, with markings)
    var pitch=game?[64,176,78]:mixc([28,52,34],[84,152,88],L);
    g.fillStyle=css(pitch); g.fillRect(X-(rw-10),baseY-4,(rw-10)*2,4);
    if(game){ g.fillStyle="rgba(255,255,255,0.55)"; g.fillRect(X,baseY-4,1,4);                          // halfway line
      g.fillStyle="rgba(255,255,255,0.35)"; g.fillRect(X-(rw-10),baseY-4,(rw-10)*2,1);                  // sideline
      g.fillStyle="rgba(255,255,255,0.4)"; g.fillRect(X-2,baseY-3,4,2); }                               // centre circle
    // four TALL floodlight pylons at the corners, with lamp banks + light cones onto the pitch
    for(var p=0;p<4;p++){ var side=(p&1)?1:-1, near=(p<2), px=X+side*(rw-2), py=baseY-rh-16;
      g.fillStyle="#2a2e38"; g.fillRect(px|0,py|0,1,baseY-py-1);                                        // mast
      g.fillStyle=css(mixc([54,60,72],[255,250,220],lit)); g.fillRect((px-2)|0,py-2,5,4);               // lamp bank
      if(lit>0.35){ g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,250,225,"+(0.35*lit)+")"; g.fillRect((px-3)|0,py-3,7,6);                  // lamp glow
        g.fillStyle="rgba(230,240,255,"+(0.10*lit)+")"; g.beginPath();                                  // light cone onto the pitch
        g.moveTo(px,py+2); g.lineTo(X-side*4,baseY-2); g.lineTo(X+side*2,baseY-2); g.closePath(); g.fill();
        g.globalCompositeOperation="source-over"; } }
    if(game){ g.globalCompositeOperation="lighter"; var cr=0.14+0.05*Math.sin(now*0.004);              // stadium bowl glow
      g.fillStyle="rgba(210,235,255,"+cr+")"; g.fillRect(X-rw,baseY-rh-4,rw*2,rh+4);
      g.globalCompositeOperation="source-over";
      // occasional celebratory fireworks over the stadium (deterministic bursts)
      var fslot=Math.floor(now/4200), fr=rng((fslot*2654435761+ (nd.getDate()))>>>0);
      if(fr()<0.5){ var fph=(now-fslot*4200); if(fph<1400){ var fp=fph/1400,
        fbx=X+((fr()*2-1)*rw), fby=baseY-rh-14-fr()*14, spread=3+fp*8;
        g.globalCompositeOperation="lighter";
        var fc=["255,90,140","120,220,255","255,220,120","150,255,180"][fslot%4];
        for(var sp=0;sp<10;sp++){ var ang=sp/10*6.283;
          g.fillStyle="rgba("+fc+","+(0.9*(1-fp))+")";
          g.fillRect((fbx+Math.cos(ang)*spread)|0,(fby+Math.sin(ang)*spread)|0,1,1); }
        g.globalCompositeOperation="source-over"; } }
    }
  }
}

// ---- the CATHEDRAL: sandstone nave + twin spires rising above the skyline + a warm rose window ----
function drawCathedral(g,L,now,night){
  var cx=Math.round(LM_CATHEDRAL*WW), baseY=HORIZON, bw=18, bh=27, hw=bw/2|0;
  var stone=mixc([64,58,66],[198,186,166],L*0.85), shad=mixc([44,40,48],[150,140,124],L*0.85);
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X+bw<-4||X-bw>SW+4) continue;
    g.fillStyle=css(stone); g.fillRect(X-hw,baseY-bh,bw,bh);                          // nave
    g.fillStyle=css(shad); g.fillRect(X+hw-2,baseY-bh,2,bh);                          // shaded right face
    // gabled roof over the nave
    for(var ry=0;ry<6;ry++){ g.fillStyle=css(mixc([38,34,44],[120,110,96],L*0.85));
      g.fillRect((X-(hw-ry))|0,baseY-bh-1-ry,(bw-ry*2)|0,1); }
    // twin front spires — tall, tapering to a finial, rising well above the surrounding roofs
    for(var s=0;s<2;s++){ var sx=X+(s?hw-3:-hw+1), sw=3, spTop=baseY-bh-18;
      g.fillStyle=css(s?shad:stone); g.fillRect(sx|0,spTop,sw,(baseY-spTop)|0);       // spire shaft
      for(var py=0;py<7;py++){ g.fillStyle=css(mixc([34,30,42],[110,100,88],L*0.85)); // tapering steeple cap
        g.fillRect((sx+ (py<sw?py*0:0) + Math.min(1,py))|0, spTop-7+py, Math.max(1,sw-((py*sw/7)|0)), 1); }
      g.fillStyle=css(mixc([80,72,60],[220,205,150],L)); g.fillRect((sx+1)|0,spTop-9,1,3);   // gold finial
      if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,120,0.5)";
        g.fillRect((sx)|0,spTop-9,3,3); g.globalCompositeOperation="source-over"; } }
    // rose window (glows warm at night)
    var glow=0.3+0.7*night, cy=baseY-bh+7;
    g.fillStyle=night>0.3?"rgba(255,196,90,"+(0.9*glow)+")":css(mixc([40,44,64],[150,170,210],L));
    g.fillRect(X-2,cy,4,4); g.fillStyle=night>0.3?"rgba(255,230,150,0.9)":css(mixc([60,64,84],[190,205,235],L)); g.fillRect(X-1,cy+1,2,2);
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,200,110,"+(0.45*glow)+")";
      g.fillRect(X-5,cy-2,10,9); g.globalCompositeOperation="source-over"; }
    // tall lancet windows down the nave
    for(var wq=0;wq<4;wq++){ g.fillStyle=night>0.3?"rgba(255,206,120,0.72)":"rgba(60,80,120,0.55)";
      g.fillRect((X-hw+3+wq*4)|0,baseY-bh+15,1,7); }
    g.fillStyle=night>0.3?"rgba(90,60,30,0.9)":"#3a2c20"; g.fillRect(X-2,baseY-7,4,7);   // arched door
    if(night>0.3){ g.fillStyle="rgba(255,200,120,0.5)"; g.fillRect(X-1,baseY-6,2,3); }
  }
}

// ---- the FERRIS WHEEL on the pier: big rotating lit gondolas over the water ----
function drawFerris(g,L,now,night){
  var cx=Math.round(LM_FERRIS*WW), R=19, cy=HORIZON-R-4, rot=now*0.00035, N=12;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X+R+4<-2||X-R-4>SW+2) continue;
    // pier deck + tall support A-frame down to the waterline
    g.fillStyle=css(mixc([34,30,36],[96,88,82],L*0.7)); g.fillRect(X-9,HORIZON-1,18,2);
    g.fillStyle=css(mixc([40,36,44],[110,102,110],L*0.7)); g.fillRect(X-1,cy,1,HORIZON-cy); g.fillRect(X+1,cy,1,HORIZON-cy);
    g.strokeStyle=css(mixc([34,30,38],[92,86,94],L*0.7)); g.lineWidth=1; g.beginPath();
    g.moveTo(X-7,HORIZON); g.lineTo(X,cy+2); g.lineTo(X+7,HORIZON); g.stroke();
    // spokes
    g.strokeStyle=css(mixc([64,64,78],[160,160,178],L)); g.lineWidth=1;
    g.beginPath(); for(var a=0;a<N;a++){ var an=rot+a/N*6.283;
      g.moveTo(X,cy); g.lineTo(X+Math.cos(an)*R, cy+Math.sin(an)*R); } g.stroke();
    // rim (double, brighter — reads as a wheel)
    g.strokeStyle=css(mixc([80,80,96],[195,195,215],L)); g.lineWidth=1;
    g.beginPath(); g.arc(X,cy,R,0,6.283); g.stroke();
    g.beginPath(); g.arc(X,cy,R-1,0,6.283); g.stroke();
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.strokeStyle="rgba(120,200,255,0.35)";  // neon rim at night
      g.beginPath(); g.arc(X,cy,R,0,6.283); g.stroke(); g.globalCompositeOperation="source-over"; }
    // gondolas (lit at night in rotating colours)
    for(var a2=0;a2<N;a2++){ var an2=rot+a2/N*6.283, gx=X+Math.cos(an2)*R, gy=cy+Math.sin(an2)*R;
      var gc=night>0.3?["#ff5a8a","#5ad0ff","#ffd24a","#7affb0","#c98cff","#ff9a4a"][a2%6]:css(mixc([46,48,60],[128,132,150],L));
      g.fillStyle=gc; g.fillRect((gx-1)|0,(gy-1)|0,3,3);
      if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle=gc; g.globalAlpha=0.45;
        g.fillRect((gx-2)|0,(gy-2)|0,5,5); g.globalAlpha=1; g.globalCompositeOperation="source-over"; } }
    g.fillStyle=css(mixc([90,90,106],[220,220,235],L)); g.fillRect(X-1,cy-1,3,3);        // hub
  }
}

// ---- HOT-AIR BALLOONS drift across calm clear skies (daytime) ----
function drawBalloons(g,L,now,fx){
  if(L<0.42||fx.cloudy||fx.rain||fx.snow||(weather.wind||5)>14) return;             // calm, clear, daylit
  if(curEvents&&curEvents.balloonfest){                                             // J3: FESTIVAL morning — a sky full of them
    var fenv=[[255,90,90],[90,150,255],[255,200,70],[110,220,140],[240,120,220],[120,230,230],[255,150,90]];
    for(var fb2=0;fb2<11;fb2++){ var fh2=((fb2*2654435761+77)>>>0);
      var fwx=wrapW((fh2%1000)/1000*WW + Math.sin(now*0.00035+fb2)*9);
      var fby=104-((now*0.0035+fb2*43)%128), fsx=fwx-WOFF;
      if(fsx>SW+8&&fsx-WW>-8) fsx-=WW; if(fsx<-8&&fsx+WW<SW+8) fsx+=WW;
      if(fsx<-6||fsx>SW+6||fby<4) continue;
      var fe=fenv[fb2%fenv.length]; g.fillStyle=css(fe);
      g.fillRect((fsx-2)|0,fby|0,5,3); g.fillRect((fsx-1)|0,(fby+3)|0,3,1);
      g.fillStyle=rgba(fe,0.55); g.fillRect((fsx-1)|0,(fby-1)|0,3,1);
      g.fillStyle="#3a2c1e"; g.fillRect(fsx|0,(fby+5)|0,1,1); }                     // basket
  }
  var envs=[[255,90,90],[90,150,255],[255,200,70],[110,220,140]];
  for(var b=0;b<3;b++){ var period=190000+b*37000, idx=Math.floor(now/period), ph=now-idx*period;
    var dir=((idx+b)%2===0)?1:-1, sp=0.006+b*0.001;
    var span=WW+40, prog=sp*ph; if(prog>span) continue;
    var wx=wrapW(dir>0? -20+prog : WW+20-prog);
    var seed=rng((idx*131+b*977)>>>0), by=20+seed()*30+Math.sin(now*0.0008+b)*3;
    var env=envs[(idx+b)%envs.length];
    for(var off=-WW;off<=WW;off+=WW){ var X=(wx-WOFF+off)|0; if(X<-8||X>SW+8) continue;
      // envelope (teardrop)
      for(var ry=0;ry<7;ry++){ var t=ry/7, ww=(5*(1-Math.abs(t-0.35)*1.1))|0; if(ww<1)ww=1;
        g.fillStyle=css(mixc([env[0]*0.5|0,env[1]*0.5|0,env[2]*0.5|0],env, 0.4+0.6*t));
        g.fillRect((X-ww)|0,(by+ry)|0,ww*2,1); }
      g.fillStyle="rgba(255,255,255,0.25)"; g.fillRect((X-2)|0,(by+1)|0,1,4);           // vertical seam highlight
      g.fillStyle="#3a2a1a"; g.fillRect(X-1,(by+9)|0,2,2);                              // basket
      g.strokeStyle="rgba(60,50,40,0.7)"; g.lineWidth=1; g.beginPath();                // ropes
      g.moveTo(X-3,by+7); g.lineTo(X-1,by+9); g.moveTo(X+3,by+7); g.lineTo(X+1,by+9); g.stroke();
    }
  }
}

// ---- an AD-BLIMP crosses on a schedule trailing a lit dot-matrix banner ----
function drawBlimp(g,L,now,night,nd){
  if(curMishap) return;               // the blimp is otherwise occupied (deflating on a rooftop)
  // a true blimp drifts: ~3min to cross the whole world, ~2.5min of clear sky between runs
  var bl=crosser(now, 360000, 0.006, 30, 0.95); if(!bl) return;
  var by=16+((bl.idx*23)%18), ad=blimpMsg(nd,bl.idx), msg=ad.t, brand=ad.c, dir=bl.dir;
  for(var off=-WW;off<=WW;off+=WW){ var X=(bl.x-WOFF+off)|0; if(X<-70||X>SW+40) continue;
    // envelope (silver)
    for(var ry=0;ry<6;ry++){ var t=ry/5, ww=(11*(1-Math.abs(t-0.5)*1.6))|0; if(ww<2)ww=2;
      g.fillStyle=css(mixc([40,44,56],[150,156,172],0.4+0.5*L)); g.fillRect((X-ww)|0,(by+ry)|0,ww*2,1); }
    g.fillStyle=css(mixc([30,32,42],[110,116,132],0.4+0.5*L)); g.fillRect((X-11)|0,(by+2)|0,3,2);   // nose
    // sponsor livery: a brand-coloured logo panel painted on the envelope flank
    g.fillStyle=css(mixc([brand[0]*0.6|0,brand[1]*0.6|0,brand[2]*0.6|0],brand,0.35+0.55*L));
    g.fillRect((X-3)|0,(by+1)|0,7,3);
    // tail fins
    g.fillStyle=css(mixc([54,58,72],[130,136,152],L)); g.fillRect((X+9)|0,(by)|0,3,2); g.fillRect((X+9)|0,(by+4)|0,3,2);
    g.fillStyle="#20222c"; g.fillRect(X-1,(by+6)|0,3,2);                                            // gondola
    if(night>0.3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba("+brand[0]+","+brand[1]+","+brand[2]+",0.12)";
      g.fillRect((X-13)|0,(by-1)|0,26,9);                                                           // envelope lit in the brand hue
      g.fillStyle="rgba("+brand[0]+","+brand[1]+","+brand[2]+",0.5)"; g.fillRect((X-3)|0,(by+1)|0,7,3);  // the logo glows
      g.globalCompositeOperation="source-over"; }
  }
  // the trailing ad banner, lit like a marquee in the sponsor's colour
  var col=night>0.3? "rgba("+brand[0]+","+brand[1]+","+brand[2]+",0.96)"
                   : "rgba("+(brand[0]*0.42|0)+","+(brand[1]*0.42|0)+","+(brand[2]*0.42|0)+",0.92)";
  var tw=textW(msg), tail=dir>0? bl.x-14-tw : bl.x+14;
  drawPixText(g,msg,Math.round(tail),by-1,col,night>0.3?0.96:0.85);
}

// dispatcher: draw all ground landmarks (gated by how established the city is)
// C4: CITY HALL — columns, dome, the flag of the republic
function drawCityHall(g,L,now,night){
  var cx=Math.round(LM_CITYHALL*WW), gy=HORIZON, day=L>0.5;
  var cs=civicScale(), csx=civicScaleX();                                         // government offices grow as the city matures
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-40||X>SW+40) continue;
    g.save(); g.translate(X,gy); g.scale(csx,cs); g.translate(-X,-gy);
    var w=24, x0=X-(w>>1);
    g.fillStyle=day?"#cfc9ba":"#3c3a34"; g.fillRect(x0,gy-12,w,12);                 // body
    g.fillStyle=day?"#e3ddcc":"#4a4840"; g.fillRect(x0-1,gy-13,w+2,2);              // entablature
    g.fillStyle=day?"#b8b2a2":"#302e28";
    for(var c2=2;c2<w-1;c2+=4) g.fillRect(x0+c2,gy-11,2,10);                        // columns
    g.fillStyle=day?"#8a8474":"#242220"; g.fillRect(x0+2,gy-1,w-4,1);               // steps
    for(var dm=0;dm<5;dm++){ var dw2=9-dm*2; g.fillStyle=day?"#9fb6a8":"#2c3a34";   // the dome
      g.fillRect(X-(dw2>>1),gy-14-dm,dw2,1); }
    g.fillStyle=day?"#6a6458":"#1e1c1a"; g.fillRect(X,gy-21,1,3);                   // flagpole
    var wave=(Math.floor(now/300))&1;
    g.fillStyle="#d23b3b"; g.fillRect(X+1,gy-21+wave*0,2,1); g.fillStyle="#eef1f6"; g.fillRect(X+1,gy-20,2,1);
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,236,180,0.18)";
      g.fillRect(x0-1,gy-13,w+2,13); g.globalCompositeOperation="source-over";
      g.fillStyle="#ffe9a0"; for(var wl2=4;wl2<w-3;wl2+=6) g.fillRect(x0+wl2,gy-8,1,2); }
    g.restore();
  }
}
// civic government offices swell from modest to imposing as the metropolis matures (bigger than any house).
// They grow tall & stately; width creeps up only gently so neighbours in the packed gov district don't collide.
function civicScale(){ return 1.12+0.9*gstage(0.58,1.0); }   // vertical
function civicScaleX(){ return 1.05+0.22*gstage(0.58,1.0); } // horizontal (gentle)
// ---- GOVERNMENT DISTRICT: courthouse, capitol, police & fire, library, post office ----
function drawCourthouse(g,L,now,night){
  var cx=Math.round(LM_COURTHOUSE*WW), gy=HORIZON, day=L>0.5, cs=civicScale(), csx=civicScaleX();
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-40||X>SW+40) continue;
    g.save(); g.translate(X,gy); g.scale(csx,cs); g.translate(-X,-gy);
    var w=22, x0=X-(w>>1);
    g.fillStyle=day?"#d6d0c2":"#3e3c36"; g.fillRect(x0,gy-13,w,13);                                   // stone body
    for(var pr=0;pr<5;pr++){ var pw=w-pr*4; g.fillStyle=day?"#e4dfd0":"#4a4840"; g.fillRect(x0+((w-pw)>>1),gy-13-pr,Math.max(1,pw),1); }  // pediment
    g.fillStyle=day?"#c0baa8":"#302e28"; g.fillRect(x0-1,gy-13,w+2,1);                                // architrave
    g.fillStyle=day?"#b8b2a2":"#2a2824"; for(var c2=2;c2<w-1;c2+=3) g.fillRect(x0+c2,gy-12,2,11);      // columns
    g.fillStyle=day?"#8a8474":"#242220"; g.fillRect(x0-1,gy-1,w+2,1); g.fillRect(x0,gy-2,w,1);         // steps
    g.fillStyle="#c9a23a"; g.fillRect(X,gy-16,1,3); g.fillRect(X-1,gy-16,3,1);                         // gilded scales of justice
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,236,180,0.16)"; g.fillRect(x0-1,gy-14,w+2,14); g.globalCompositeOperation="source-over"; }
    g.restore();
  }
}
function drawCapitol(g,L,now,night){
  var cx=Math.round(LM_CAPITOL*WW), gy=HORIZON, day=L>0.5, cs=civicScale(), csx=civicScaleX();
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-48||X>SW+48) continue;
    g.save(); g.translate(X,gy); g.scale(csx,cs); g.translate(-X,-gy);
    var w=28, x0=X-(w>>1);
    g.fillStyle=day?"#e6e2d6":"#42403a"; g.fillRect(x0,gy-14,w,14);                                   // white body
    g.fillStyle=day?"#cfc9ba":"#302e28"; for(var c2=2;c2<w-1;c2+=3) g.fillRect(x0+c2,gy-12,1,11);      // pilasters
    g.fillStyle=day?"#dcd8cc":"#3a3832"; g.fillRect(X-5,gy-18,10,4);                                  // drum
    for(var dm=0;dm<7;dm++){ var dw2=Math.max(1,11-dm*2); g.fillStyle=day?"#eef0e8":"#4a4a44"; g.fillRect(X-(dw2>>1),gy-18-dm,dw2,1); }  // dome
    g.fillStyle=day?"#c9a23a":"#8a6a20"; g.fillRect(X,gy-27,1,3);                                     // gilded lantern
    g.fillStyle=day?"#8a8474":"#242220"; g.fillRect(x0-2,gy-1,w+4,1);                                 // broad steps
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,225,255,0.20)"; g.fillRect(X-6,gy-26,12,10);
      g.fillStyle="rgba(255,236,180,0.16)"; g.fillRect(x0-1,gy-15,w+2,15); g.globalCompositeOperation="source-over";
      g.fillStyle="#ffe9a0"; for(var wl2=3;wl2<w-2;wl2+=5) g.fillRect(x0+wl2,gy-9,1,3); }
    g.restore();
  }
}
function drawPoliceStation(g,L,now,night){
  var cx=Math.round(LM_POLICE*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-14||X>SW+14) continue;
    var w=15, x0=X-(w>>1);
    g.fillStyle=day?"#8f96a2":"#2e323a"; g.fillRect(x0,gy-11,w,11);                                   // grey stone
    g.fillStyle=day?"#a4abb6":"#3a3e46"; g.fillRect(x0-1,gy-12,w+2,2);
    for(var wc2=x0+2;wc2<x0+w-2;wc2+=3){ g.fillStyle=day?"#c9cdd6":"#5a5e66"; g.fillRect(wc2,gy-8,2,3); g.fillStyle="rgba(0,0,0,0.35)"; g.fillRect(wc2,gy-8,1,3); }  // barred windows
    g.fillStyle=day?"#3a3e46":"#14161a"; g.fillRect(X-1,gy-5,3,5);                                    // door
    var bl=(Math.floor(now/500))&1; g.globalCompositeOperation="lighter"; g.fillStyle=bl?"rgba(60,120,255,0.95)":"rgba(60,120,255,0.3)"; g.fillRect(X,gy-14,1,2); g.globalCompositeOperation="source-over";   // precinct lamp
    g.fillStyle="#2a4a8a"; g.fillRect(X-3,gy-11,7,1);                                                 // blue band
  }
}
function drawFireStation(g,L,now,night){
  var cx=Math.round(LM_FIRE*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    var w=16, x0=X-(w>>1);
    g.fillStyle=day?"#9a3320":"#3a1610"; g.fillRect(x0,gy-11,w,11);                                   // red brick
    g.fillStyle="rgba(0,0,0,0.16)"; for(var mb=gy-9;mb<gy-1;mb+=2) g.fillRect(x0,mb,w,1);
    g.fillStyle=day?"#7a2818":"#2a100c"; g.fillRect(x0-1,gy-12,w+2,2);                                // cornice
    g.fillStyle=day?"#8a2c1a":"#301410"; g.fillRect(x0+w-4,gy-17,4,6); g.fillStyle="#c9a23a"; g.fillRect(x0+w-3,gy-18,1,1);   // hose tower + bell
    for(var bd=0;bd<2;bd++){ var bx=x0+2+bd*7; g.fillStyle=day?"#c9cdd6":"#5a5e66"; g.fillRect(bx,gy-8,5,8);
      g.fillStyle="rgba(0,0,0,0.2)"; for(var bln=gy-7;bln<gy-1;bln+=2) g.fillRect(bx,bln,5,1); }       // bay doors
    g.fillStyle="#ff3b3b"; g.fillRect(X-2,gy-11,4,1);                                                 // red band
    if((Math.floor(now/16000))%3===0){ g.fillStyle="#d81f1f"; g.fillRect(x0-6,gy-4,6,4); g.fillStyle="#c9c9d2"; g.fillRect(x0-5,gy-6,4,1); g.fillStyle="#0b0b10"; g.fillRect(x0-5,gy-1,1,1); g.fillRect(x0-2,gy-1,1,1); }  // engine out front
  }
}
function drawLibrary(g,L,now,night){
  var cx=Math.round(LM_LIBRARY*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    var w=18, x0=X-(w>>1);
    g.fillStyle=day?"#cabf9a":"#3a362a"; g.fillRect(x0,gy-11,w,11);                                   // sandstone
    g.fillStyle=day?"#ddd3ad":"#48443a"; g.fillRect(x0-1,gy-12,w+2,2);
    g.fillStyle=day?"#b3a884":"#2e2b22"; for(var c2=2;c2<w-1;c2+=3) g.fillRect(x0+c2,gy-10,2,9);       // columns
    g.fillStyle=day?"#8a8060":"#221f18"; g.fillRect(x0-1,gy-1,w+2,1);                                 // steps
    g.fillStyle=day?"#2e4a7a":"#22344f"; g.fillRect(x0+2,gy-13,w-4,2);                                // banner
    g.fillStyle="#e9c96a"; g.fillRect(x0+4,gy-12,1,1); g.fillRect(x0+7,gy-12,1,1); g.fillRect(x0+10,gy-12,1,1);   // gilt lettering
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,236,180,0.16)"; g.fillRect(x0,gy-11,w,11); g.globalCompositeOperation="source-over"; }
  }
}
function drawPostOffice(g,L,now,night){
  var cx=Math.round(LM_POST*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-15||X>SW+15) continue;
    var w=16, x0=X-(w>>1);
    g.fillStyle=day?"#b9b3a4":"#34322c"; g.fillRect(x0,gy-10,w,10);                                   // body
    g.fillStyle=day?"#8fa0b8":"#2a3240"; g.fillRect(x0,gy-11,w,1);
    g.fillStyle=day?"#dfe4ea":"#4a4e56"; for(var wc2=x0+2;wc2<x0+w-2;wc2+=4) g.fillRect(wc2,gy-8,3,3);  // windows
    g.fillStyle=day?"#3a3e46":"#16181c"; g.fillRect(X-2,gy-5,4,5);                                    // door
    g.fillStyle="#2a4a8a"; g.fillRect(x0+2,gy-12,w-4,1);                                              // POST banner
    g.fillStyle=day?"#6a6458":"#1e1c1a"; g.fillRect(x0+1,gy-16,1,5); g.fillStyle="#d23b3b"; g.fillRect(x0+2,gy-16,3,1); g.fillStyle="#eef1f6"; g.fillRect(x0+2,gy-15,3,1);   // flag
    if((Math.floor(now/14000))%3===1){ g.fillStyle=day?"#e9edf2":"#5a6068"; g.fillRect(x0+w+1,gy-4,6,4); g.fillStyle="#2a4a8a"; g.fillRect(x0+w+2,gy-3,4,1); g.fillStyle="#0b0b10"; g.fillRect(x0+w+2,gy-1,1,1); g.fillRect(x0+w+5,gy-1,1,1); }  // mail truck
  }
}
// C4: the SCHOOLHOUSE — bell tower, big windows, kids at recess
function drawSchool(g,L,now,night,nd){
  var cx=Math.round(LM_SCHOOL*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-18||X>SW+18) continue;
    var w=18, x0=X-(w>>1);
    g.fillStyle=day?"#a0522d":"#3c2216"; g.fillRect(x0,gy-9,w,9);                    // brick body
    g.fillStyle="rgba(0,0,0,0.15)"; for(var mb=gy-7;mb<gy-1;mb+=2) g.fillRect(x0,mb,w,1);
    g.fillStyle=day?"#5a4028":"#241a10";
    for(var rr2=0;rr2<4;rr2++) g.fillRect(x0-1+rr2,gy-10-rr2,w+2-rr2*2,1);           // pitched roof
    g.fillStyle=day?"#8a4525":"#301c12"; g.fillRect(X-2,gy-16,5,4);                  // bell tower
    g.fillStyle=day?"#6a3a20":"#241610"; g.fillRect(X-3,gy-17,7,1);
    g.fillStyle="#d9a72b"; g.fillRect(X,gy-15+((Math.floor(now/700))&1?0:0),1,1);    // the bell
    g.fillStyle=day?"#dff0ff":"#ffe9a0";
    g.fillRect(x0+2,gy-7,3,3); g.fillRect(x0+w-5,gy-7,3,3);                          // big windows
    g.fillStyle=day?"#5a4028":"#33241a"; g.fillRect(X-1,gy-4,2,4);                   // door
    g.fillStyle=day?"#6a6458":"#1e1c1a"; g.fillRect(x0-3,gy-14,1,14);                // flagpole
    g.fillStyle="#3a70b0"; g.fillRect(x0-2,gy-14,2,1);
    var hh5=nd.getHours(), dw3=nd.getDay();
    if(day&&dw3>=1&&dw3<=5&&hh5>=10&&hh5<15){                                        // RECESS
      for(var kd=0;kd<5;kd++){ var kb2=(Math.floor(now/170)+kd)&1;
        var kx2=x0+w+2+((kd*7+((now/900|0)*3))%12);
        g.fillStyle=SKINC[kd%SKINC.length]; g.fillRect(kx2,gy-3-kb2,2,1);
        g.fillStyle=["#ff5a5a","#4aa8ff","#4affc0","#ffd23a","#c58cff"][kd]; g.fillRect(kx2,gy-2-kb2,2,2); }
      g.fillStyle="#e8482a"; var bb2=(now/240)%14;                                   // the kickball
      g.fillRect((x0+w+3+bb2)|0,(gy-1-Math.abs(Math.sin(bb2*0.9))*3)|0,1,1);
    }
  }
}
// I3: the MUSEUM — a relic of the previous civilization's death stands out front
function drawMuseum(g,L,now,night){
  var cx=Math.round(LM_MUSEUM*WW), gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    var w=18, x0=X-(w>>1);
    g.fillStyle=day?"#d8d2c2":"#3e3c36"; g.fillRect(x0,gy-10,w,10);                  // hall
    for(var c3=1;c3<w-2;c3+=4){ g.fillStyle=day?"#bcb6a6":"#2e2c28"; g.fillRect(x0+c3,gy-9,2,9); }
    for(var pd2=0;pd2<4;pd2++){ g.fillStyle=day?"#e3ddcc":"#4a4840";                 // pediment
      g.fillRect(x0+pd2*2-1,gy-11-pd2,w+2-pd2*4,1); }
    g.fillStyle="#c9a23a"; g.fillRect(X-2,gy-8,5,1);                                 // gilded frieze
    // the RELIC GARDEN: one plinth per fallen civilization (newest nearest, up to 3)
    var nRel=Math.max(1,Math.min(3,curLife||0)); if((curLife||0)===0) nRel=1;
    for(var rl2=1;rl2<nRel;rl2++){ var rlx2=x0+w+4+rl2*6, dth2=DEATHS[deathOf(Math.max(0,(curLife||0)-1-rl2))];
      g.fillStyle=day?"#8a8474":"#242220"; g.fillRect(rlx2-1,gy-2,4,2);
      g.fillStyle=dth2==="meteors"?"#4a4448":(dth2==="nuke"?"#c9b23a":(dth2==="sunburst"?"#241c16":"#181a22"));
      g.fillRect(rlx2,gy-4,2,2); }
    var rlx=x0+w+4, dth=deathOf(curLife>0?curLife-1:0);   // (was DEATHS[deathOf(...)] — deathOf returns the NAME, so the relic always showed the AI core)
    g.fillStyle=day?"#8a8474":"#242220"; g.fillRect(rlx-1,gy-2,4,2);                 // plinth
    if(dth==="meteors"){ g.fillStyle="#4a4448"; g.fillRect(rlx,gy-5,3,3);
      g.fillStyle="#c0453a"; g.fillRect(rlx+1,gy-4,1,1); }                           // meteor chunk, ember vein
    else if(dth==="nuke"){ g.fillStyle="#c9b23a"; g.fillRect(rlx,gy-5,3,3);
      g.fillStyle="#1a1a1a"; g.fillRect(rlx+1,gy-4,1,1); }                           // scorched hazard sign
    else if(dth==="sunburst"){ g.fillStyle="#241c16"; g.fillRect(rlx+1,gy-6,1,4);
      g.fillStyle="#e05028"; g.fillRect(rlx+1,gy-4,1,1); }                           // charred obelisk, live ember
    else if(dth==="kaijuwar"){ g.fillStyle="#3a3f35"; g.fillRect(rlx,gy-5,3,2);       // a titan's fang, mounted
      g.fillStyle="#e8e4da"; g.fillRect(rlx+1,gy-6,1,2); }
    else if(dth==="pollution"){ g.fillStyle="#5a564e"; g.fillRect(rlx,gy-5,3,3);      // the last breathing mask
      g.fillStyle="#e8e4da"; g.fillRect(rlx,gy-4,3,1); }
    else { g.fillStyle="#181a22"; g.fillRect(rlx,gy-5,3,3);                          // the dead AI core
      if((Math.floor(now/900))%5===0){ g.fillStyle="#ff2030"; g.fillRect(rlx+1,gy-4,1,1); } }  // ...mostly dead
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,220,255,0.14)";
      g.fillRect(rlx-2,gy-7,7,7); g.globalCompositeOperation="source-over"; }        // relic uplight
  }
}
// L3: the AMUSEMENT PARK — a coaster whose car really runs the track
// Coaster track profile [x, height-above-ground]: station → lift hill → first drop → a VERTICAL LOOP → two
// camelback hills → brake run. Indices 8..16 trace the loop (a ~circle), so the car actually goes upside-down.
var COASTER_PTS=[[0,6],[3,13],[7,23],[11,32],[13,34],[16,22],[19,11],[22,8],
  [27,8],[33,10],[36,17],[33,24],[27,26],[21,24],[18,17],[21,10],[27,8],
  [31,15],[35,8],[39,14],[43,8],[47,6],[52,6]];
var COASTER_LOOP=[8,16];   // the inclusive index range of the loop points (skip vertical support posts through here)
var FERRIS_COL=["#e0483a","#e0a83a","#3ac86a","#4a90e0","#c05ad0","#e07a3a","#3ac8c8","#e04890"];
function drawCoaster(g,L,now,night){
  var cx=Math.round(LM_COASTER*WW)-40, gy=HORIZON, day=L>0.5;
  for(var off=-WW;off<=WW;off+=WW){ var X0=(cx-WOFF+off)|0; if(X0<-96||X0>SW+96) continue;
    // ============ FERRIS WHEEL (left) ============
    var fcx=X0+14, R=12, fcy=gy-R-6;
    g.fillStyle=day?"#7a8290":"#242a34";                                              // A-frame legs to the ground
    for(var lg=0;lg<=R+6;lg++){ var lt=lg/(R+6); g.fillRect((fcx-8+8*lt)|0,(gy-lg)|0,1,1); g.fillRect((fcx+8-8*lt)|0,(gy-lg)|0,1,1); }
    g.fillStyle=day?"#c0c6d0":"#39414c";                                              // rim
    for(var a=0;a<40;a++){ var an=a/40*6.283; g.fillRect((fcx+Math.cos(an)*R)|0,(fcy+Math.sin(an)*R)|0,1,1); }
    var rot=now*0.00018;                                                              // slow rotation
    for(var sp=0;sp<8;sp++){ var an2=rot+sp/8*6.283, ex=fcx+Math.cos(an2)*R, ey=fcy+Math.sin(an2)*R;
      g.fillStyle=day?"#9aa0aa":"#2c333e";
      for(var sd=1;sd<R;sd++){ var st=sd/R; g.fillRect((fcx+(ex-fcx)*st)|0,(fcy+(ey-fcy)*st)|0,1,1); }   // spoke
      var gcol=FERRIS_COL[sp]; g.fillStyle=gcol; g.fillRect((ex-1)|0,ey|0,3,2);                          // gondola
      if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle=gcol; g.fillRect(ex|0,ey|0,1,1); g.globalCompositeOperation="source-over"; } }
    g.fillStyle=day?"#e0e4ea":"#5a6472"; g.fillRect(fcx-1,fcy-1,2,2);                 // hub
    if(!day){ g.globalCompositeOperation="lighter";                                   // chasing rim bulbs at night
      for(var b=0;b<40;b+=2){ if(((b>>1)+((now/300)|0))%2===0){ var bn=b/40*6.283; g.fillStyle="#ffe27a"; g.fillRect((fcx+Math.cos(bn)*R)|0,(fcy+Math.sin(bn)*R)|0,1,1); } }
      g.globalCompositeOperation="source-over"; }
    // ============ ROLLER COASTER (right) ============
    var CX0=X0+28;
    g.fillStyle=day?"#8a8474":"#26242c";                                              // vertical support posts (skip the loop span)
    for(var pi2=0;pi2<COASTER_PTS.length;pi2++){ if(pi2>=COASTER_LOOP[0]&&pi2<=COASTER_LOOP[1]) continue; var P=COASTER_PTS[pi2];
      g.fillRect(CX0+P[0],gy-P[1],1,P[1]); }
    g.fillRect(CX0+18,gy-17,1,17); g.fillRect(CX0+36,gy-17,1,17); g.fillRect(CX0+27,gy-8,1,8);   // the loop's own supports
    g.fillStyle=day?"#9a927e":"#2e2c34";                                              // X cross-bracing up the lift hill
    for(var br=0;br<4;br++){ var Pa=COASTER_PTS[br],Pb=COASTER_PTS[br+1], nb=Math.max(2,Pb[0]-Pa[0]);
      for(var sb=0;sb<=nb;sb++){ var tb=sb/nb, xb=CX0+Pa[0]+(Pb[0]-Pa[0])*tb;
        g.fillRect(xb|0,(gy-Pa[1]*(1-tb))|0,1,1); g.fillRect(xb|0,(gy-Pb[1]*tb)|0,1,1); } }
    for(pi2=0;pi2<COASTER_PTS.length-1;pi2++){ var A5=COASTER_PTS[pi2],B5=COASTER_PTS[pi2+1];   // the rails
      var steps=Math.max(Math.abs(B5[0]-A5[0]),Math.abs(B5[1]-A5[1]));
      for(var st3=0;st3<=steps;st3++){ var t3=st3/steps;
        var rx2=CX0+A5[0]+(B5[0]-A5[0])*t3, ry2=gy-(A5[1]+(B5[1]-A5[1])*t3);
        g.fillStyle=day?"#c0453a":"#8a4038"; g.fillRect(rx2|0,ry2|0,1,1);
        if(!day&&((st3+pi2)&1)===0){ g.globalCompositeOperation="lighter"; g.fillStyle="#ffd76a"; g.fillRect(rx2|0,(ry2-1)|0,1,1); g.globalCompositeOperation="source-over"; } }
    }
    var CYC2=15000, u=((now%CYC2)/CYC2)*(COASTER_PTS.length-1);                       // the RUNNING TRAIN (loops upside-down)
    var seg=Math.min(COASTER_PTS.length-2,u|0), tt=u-seg, A6=COASTER_PTS[seg],B6=COASTER_PTS[seg+1];
    var tcx=CX0+A6[0]+(B6[0]-A6[0])*tt, tcy=gy-(A6[1]+(B6[1]-A6[1])*tt)-1;
    g.fillStyle="#e8482a"; g.fillRect((tcx-2)|0,tcy|0,5,2);
    g.fillStyle=SKINC[1]; g.fillRect((tcx-1)|0,(tcy-1)|0,1,1); g.fillRect((tcx+1)|0,(tcy-1)|0,1,1); g.fillRect((tcx+3)|0,(tcy-1)|0,1,1);
    // ============ midway + entrance ============
    g.fillStyle=day?"#c9a23a":"#7a5e1c"; g.fillRect(X0+2,gy-1,78,1);
    g.fillStyle=day?"#d0483a":"#7a2820"; g.fillRect(X0+24,gy-9,1,9); g.fillRect(X0+29,gy-9,1,9);   // entrance arch between the two rides
    g.fillStyle="#ff7ad0"; g.fillRect(X0+24,gy-10,6,1);
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,122,208,0.5)"; g.fillRect(X0+24,gy-10,6,1); g.globalCompositeOperation="source-over"; }
  }
}
// C5: MEGA-TOWER — an end-game arcology twice the height of anything else
function drawMegaTower(g,idx,L,now,night,st){
  var cx=Math.round(LM_MEGA[idx]*WW), gy=HORIZON, day=L>0.5;
  var H=Math.round((150+idx*24)*KSP*0.85), W3=16;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-16||X>SW+16) continue;
    var x0=X-(W3>>1), top=gy-H;
    var body=css(mixc([44,52,70],[120,132,158],day?0.85:0.1));
    var body2=css(mixc([32,38,54],[92,102,126],day?0.85:0.1));
    g.fillStyle=body; g.fillRect(x0,top,W3,H);
    g.fillStyle=body2; g.fillRect(x0+(W3>>1),top,W3>>1,H);                            // two-tone shaft
    g.fillStyle=body; g.fillRect(x0-2,gy-Math.round(H*0.33),W3+4,2);                  // setback flanges
    g.fillStyle=body2; g.fillRect(x0-1,gy-Math.round(H*0.66),W3+2,2);
    var la2=night>0.4?0.6:0.22;
    for(var fy2=top+4;fy2<gy-2;fy2+=4){ g.fillStyle="rgba(165,225,255,"+la2.toFixed(2)+")";
      g.fillRect(x0+1,fy2,W3-2,1); }                                                  // glass floor bands
    for(var sl2=0;sl2<3;sl2++){ var sy2=gy-Math.round(H*(0.25+sl2*0.25));             // bright SKY LOBBIES
      g.fillStyle="rgba(255,236,190,"+(night>0.4?0.85:0.4)+")"; g.fillRect(x0+1,sy2,W3-2,2); }
    g.fillStyle=body2; g.fillRect(X-1,top-8,2,8);                                     // crown spire
    if(night>0.3&&(Math.floor(now/500)+idx)%2===0){ g.fillStyle="#ff5050"; g.fillRect(X-1,top-9,1,1); g.fillRect(X+1,top-4,1,1); }
    if(st<1){ g.fillStyle=day?"#e0a83a":"#5a4418";                                    // the mega-crane tops it out
      g.fillRect(X,top-14,1,14); g.fillRect(X-9,top-14,18,1);
      if((Math.floor(now/600))&1){ g.fillStyle="#ff4040"; g.fillRect(X,top-15,1,1); } }
    if(curSpace>0.25){ g.fillStyle=FSEAM[idx%FSEAM.length]; g.globalAlpha=night>0.4?0.8:0.4;   // the future claims it early
      g.fillRect(x0,top,1,H); g.fillRect(x0+W3-1,top,1,H); g.globalAlpha=1; }
  }
}
// CORPORATE HQ: the reigning juggernaut's name + logo crown the tallest arcology — a rooftop marquee that lights up
// at night in the brand colour and RE-BRANDS as empires rise and fall. Anchored to the fixed mega-tower (idx), so
// it's deterministic; drawn only when that tower is standing (see the gate at the call site) and a king exists.
function drawCorpHQ(g,idx,L,now,night,mst){
  var C=curCorps; if(!C||C.king<0) return;
  var e=C.cos[C.king], nm=e.co.n, brand=e.co.c, tag=e.co.g;
  var megaH=Math.round((150+idx*24)*KSP*0.85)+10;                                                   // match the mega-tower's own height (incl. crown)
  var cx=Math.round(LM_MEGA[idx]*WW), gy=HORIZON, H=Math.round(megaH*(mst==null?1:mst)), top=gy-H;  // anchor to the tower's CURRENT risen top so the marquee never detaches
  var tagW=textW(tag), nmW=textW(nm), pad=3, gap=4, panelW=pad+(tagW+3)+gap+nmW+pad, sy=top-12;
  var lit=night>0.35;
  for(var off=-WW;off<=WW;off+=WW){ var bxp=(cx-(panelW>>1)-WOFF+off)|0; if(bxp+panelW<-2||bxp>SW+2) continue;
    var cX=bxp+(panelW>>1);
    // truss: base beam under the roofline + two angled stepped struts up to the panel corners + centre post
    g.fillStyle="rgba(34,38,48,0.92)";
    g.fillRect(cX-(panelW>>2), top-1, panelW>>1, 1);                                                // base beam
    var panelBotY=sy+10, beamY=top-1, stH=Math.max(1,Math.round(Math.max(0,beamY-panelBotY)/3));
    var lx=bxp, ly=panelBotY; for(var st=0;st<3;st++){ lx+=1; g.fillRect(lx,ly,1,stH); ly+=stH; }   // left strut, stepped inward
    var rx=bxp+panelW-1; ly=panelBotY; for(var st2=0;st2<3;st2++){ rx-=1; g.fillRect(rx,ly,1,stH); ly+=stH; }  // right strut, mirrored
    g.fillRect(cX-1,sy+10,2,Math.max(0,top-(sy+10)));                                               // centre post, panel to tower roof
    g.fillStyle="rgba(8,10,16,0.9)"; g.fillRect(bxp,sy,panelW,10);                                  // dark sign panel
    g.fillStyle=rgba(brand,0.95); g.fillRect(bxp,sy-1,panelW,1); g.fillRect(bxp,sy+10,panelW,1);    // brand rails
    g.fillStyle=rgba(brand,1); g.fillRect(bxp+pad-1,sy+1,tagW+3,8);                                 // brand logo box
    drawUiText(g,tag,bxp+pad,sy+2,"rgba(10,12,18,0.95)",1);                                         // tag, dark on the brand box
  }
  var nmWorldX=cx-(panelW>>1)+pad+tagW+2+gap;
  drawPixText(g,nm,nmWorldX,sy+2, lit?css(brand):css(mixc(brand,[26,28,36],0.4)), 1);               // the company name, brand-coloured
  if(lit){ g.globalCompositeOperation="lighter"; drawPixText(g,nm,nmWorldX,sy+2,rgba(brand,0.35+0.4*night),1);
    drawPixText(g,tag,cx-(panelW>>1)+pad, sy+2, rgba(brand,0.2*night),1); g.globalCompositeOperation="source-over"; }
}
// ============ CITY HERO LANDMARKS — a signature monument for each themed life ============
var LM_HERO=0.60;
function heroEra(){ var n=cityEra.name;
  return (n==="paris"||n==="london"||n==="tokyo"||n==="china"||n==="artdeco"||n==="neworleans"||n==="boston"||n==="houston")?n:null; }
function drawEiffel(g,X,gy,L,now){ var H=44, c=L>0.5?"#8a7550":"#3e3320";
  for(var y=0;y<H;y++){ var t=y/H, sp=Math.round(11*(1-t)*(1-t*0.6)); g.fillStyle=c;
    g.fillRect(X-sp,gy-1-y,1,1); g.fillRect(X+sp,gy-1-y,1,1); if(y<26&&(y&1)) g.fillRect(X-sp,gy-1-y,sp*2+1,1); }
  g.fillStyle=c; g.fillRect(X-11,gy-9,23,1); g.fillRect(X-6,gy-22,12,1); g.fillRect(X,gy-H-3,1,3);   // platforms + mast
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,224,140,0.8)"; g.fillRect(X,gy-H-4,1,1);
    for(var s=0;s<10;s++){ if((Math.floor(now/130)+s)%4===0){ var yy=(s*4)%H, sp2=Math.round(11*(1-yy/H)*(1-yy/H*0.6));
      g.fillStyle="rgba(255,240,180,0.7)"; g.fillRect(X-sp2+((s*7)%(sp2*2+1)),gy-1-yy,1,1); } } g.globalCompositeOperation="source-over"; }
}
function drawBigBen(g,X,gy,L,now){ var day=L>0.5, H=40, w=8, x0=X-(w>>1);
  g.fillStyle=day?"#b7a884":"#3a3428"; g.fillRect(x0,gy-H,w,H);
  g.fillStyle="rgba(0,0,0,0.12)"; for(var yy=gy-H+3;yy<gy-6;yy+=4) g.fillRect(x0,yy,w,1);
  g.fillStyle=day?"#e8e2c8":"#5a5440"; g.fillRect(x0,gy-H-2,w,2);
  g.fillStyle=day?"#f4f0e0":"#e8e0c0"; g.fillRect(X-1,gy-H-1,3,3); g.fillStyle="#2a2620"; g.fillRect(X,gy-H,1,1);   // clock
  g.fillStyle=day?"#5a5238":"#241f18"; for(var r=0;r<7;r++){ var rw=Math.max(1,w-r); g.fillRect(x0+((w-rw)>>1),gy-H-3-r,rw,1); }
  g.fillStyle="#c9a23a"; g.fillRect(X,gy-H-11,1,2);
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,236,170,0.6)"; g.fillRect(X-1,gy-H-1,3,3); g.globalCompositeOperation="source-over"; }
}
function drawTokyoTower(g,X,gy,L,now){ var H=46, c=L>0.5?"#d24a2a":"#7a2818", w=L>0.5?"#f0e8e0":"#5a504a";
  for(var y=0;y<H;y++){ var t=y/H, sp=Math.round(12*(1-t)*(1-t*0.5)); g.fillStyle=((Math.floor(y/4))&1)?c:w;
    g.fillRect(X-sp,gy-1-y,1,1); g.fillRect(X+sp,gy-1-y,1,1); if(y<24&&(y&1)) g.fillRect(X-sp,gy-1-y,sp*2+1,1); }
  g.fillStyle=c; g.fillRect(X-8,gy-16,16,2); g.fillRect(X-5,gy-30,10,1); g.fillRect(X,gy-H-4,1,4);   // decks + mast
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=(Math.floor(now/500)&1)?"rgba(255,80,60,0.9)":"rgba(255,80,60,0.4)"; g.fillRect(X,gy-H-5,1,1); g.globalCompositeOperation="source-over"; }
}
function drawPagodaTower(g,X,gy,L,now){ var day=L>0.5, tiers=6, tw=16, th=6;
  for(var ti=0;ti<tiers;ti++){ var py=gy-ti*th, pw=tw-ti*2, px=X-(pw>>1);
    g.fillStyle=day?"#9a3330":"#3a1614"; g.fillRect(px+1,py-th+1,pw-2,th-1);
    g.fillStyle=day?"#3a6a4a":"#16302a"; g.fillRect(px-1,py-th,pw+2,1);
    g.fillStyle=day?"#2a5a3a":"#12281f"; g.fillRect(px-2,py-th,1,1); g.fillRect(px+pw+1,py-th,1,1);
    if(L<0.62){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,196,90,0.4)"; g.fillRect(px+1,py-2,Math.max(1,pw-2),1); g.globalCompositeOperation="source-over"; } }
  g.fillStyle="#e0b040"; g.fillRect(X,gy-tiers*th-3,1,3);
}
function drawEmpireState(g,X,gy,L,now){ var day=L>0.5, H=52, segs=[[16,0.42],[12,0.72],[8,0.9]], y=gy, prev=0;
  for(var s=0;s<segs.length;s++){ var sw=segs[s][0], sh=Math.round(H*(segs[s][1]-prev)); prev=segs[s][1];
    g.fillStyle=day?"#c9c6bc":"#33343a"; g.fillRect(X-(sw>>1),y-sh,sw,sh);
    for(var wy=y-sh+2;wy<y-1;wy+=3){ g.fillStyle=(L<0.55)?"rgba(255,224,150,0.5)":"rgba(120,140,170,0.4)"; for(var wx=X-(sw>>1)+1;wx<X+(sw>>1)-1;wx+=2) g.fillRect(wx,wy,1,1); }
    y-=sh; }
  g.fillStyle=day?"#a8a496":"#2a2b30"; g.fillRect(X-1,y-10,3,10); g.fillStyle="#c9a23a"; g.fillRect(X,y-13,1,3);
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,90,0.7)"; g.fillRect(X,y-13,1,1); g.globalCompositeOperation="source-over"; }
}
function drawCathedralHero(g,X,gy,L,now){ var day=L>0.5, w=22, x0=X-(w>>1), sp=[X-8,X,X+8], sh=[10,16,10];
  g.fillStyle=day?"#d8d0bc":"#3a382e"; g.fillRect(x0,gy-16,w,16);
  g.fillStyle=day?"#c0b89c":"#2e2c24"; g.fillRect(x0+((w-6)>>1),gy-20,6,4);
  for(var i=0;i<3;i++){ var sx=sp[i]; g.fillStyle=day?"#c8c0aa":"#33312a"; g.fillRect(sx-1,gy-16-sh[i],3,sh[i]);
    for(var r=0;r<5;r++){ var rw=Math.max(1,3-r); g.fillStyle=day?"#b0a890":"#26241e"; g.fillRect(sx-(rw>>1),gy-16-sh[i]-r,rw,1); }
    g.fillStyle="#c9a23a"; g.fillRect(sx,gy-16-sh[i]-5,1,2); }
  g.fillStyle=(L<0.6)?"rgba(255,210,120,0.8)":"#8ab0d8"; g.fillRect(X-1,gy-8,3,3);
}
function drawCustomHouse(g,X,gy,L,now){ var day=L>0.5, w=9, x0=X-(w>>1), H=36;
  g.fillStyle=day?"#9a5a3a":"#341c12"; g.fillRect(x0,gy-H,w,H);
  g.fillStyle="rgba(0,0,0,0.14)"; for(var yy=gy-H+3;yy<gy-4;yy+=3) g.fillRect(x0,yy,w,1);
  g.fillStyle=day?"#c8c0a8":"#4a4638"; g.fillRect(x0-1,gy-H-2,w+2,2);
  g.fillStyle="#f0ead6"; g.fillRect(X-1,gy-H-1,3,3); g.fillStyle="#2a2620"; g.fillRect(X,gy-H,1,1);
  g.fillStyle=day?"#7a7060":"#2a2620"; for(var r=0;r<8;r++){ var rw=Math.max(1,w-r); g.fillRect(x0+((w-rw)>>1),gy-H-3-r,rw,1); }
}
function drawGlassSuper(g,X,gy,L,now){ var day=L>0.5, H=58, w=14, x0=X-(w>>1);
  for(var y=0;y<H;y++){ var tp=Math.max(0,(y-(H-14))/14), ww=Math.max(2,Math.round(w*(1-tp*0.7)));
    g.fillStyle=day?css(mixc([120,168,192],[190,222,235],(y/H)*0.5)):"#1a2634"; g.fillRect(X-(ww>>1),gy-1-y,ww,1); }
  g.globalCompositeOperation="lighter";
  for(var fy=gy-4;fy>gy-H;fy-=3){ g.fillStyle=(L<0.55)?"rgba(150,200,255,0.35)":"rgba(200,230,255,0.2)"; g.fillRect(x0+1,fy,w-2,1); }
  g.fillStyle="rgba(120,200,255,0.4)"; g.fillRect(X-2,gy-H,4,1); g.globalCompositeOperation="source-over";
  g.fillStyle=day?"#8ab0c8":"#2a3a48"; g.fillRect(X,gy-H-4,1,4);
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,60,60,0.7)"; g.fillRect(X,gy-H-5,1,1); g.globalCompositeOperation="source-over"; }
}
function drawCityHero(g,L,now){ var he=heroEra(); if(!he) return; var cx=Math.round(LM_HERO*WW), gy=HORIZON;
  for(var off=-WW;off<=WW;off+=WW){ var X=(cx-WOFF+off)|0; if(X<-44||X>SW+44) continue;
    if(he==="paris") drawEiffel(g,X,gy,L,now);
    else if(he==="london") drawBigBen(g,X,gy,L,now);
    else if(he==="tokyo") drawTokyoTower(g,X,gy,L,now);
    else if(he==="china") drawPagodaTower(g,X,gy,L,now);
    else if(he==="artdeco") drawEmpireState(g,X,gy,L,now);
    else if(he==="neworleans") drawCathedralHero(g,X,gy,L,now);
    else if(he==="boston") drawCustomHouse(g,X,gy,L,now);
    else if(he==="houston") drawGlassSuper(g,X,gy,L,now);
  }
}
function drawLandmarks(g,L,now,night,nd){
  // each landmark RISES bottom-up out of the ground while it's being built (clip reveal)
  function rise(st,fn){ if(st<=0) return;
    if(st>=1){ fn(); return; }
    g.save(); g.beginPath(); g.rect(0,HORIZON-Math.round(130*st),SW,Math.round(130*st)+GROUND+4); g.clip();
    fn(); g.restore(); }
  function rise2(st,hh,fn){ if(st<=0) return;
    if(st>=1){ fn(); return; }
    g.save(); g.beginPath(); g.rect(0,HORIZON-Math.round(hh*st),SW,Math.round(hh*st)+GROUND+4); g.clip();
    fn(); g.restore(); }
  // when the NUKE front sweeps over a landmark's plot it is RIPPED AWAY just like the rest of the skyline
  // (the incandescence flash masks the shape→rubble transition); until the front arrives it stands normally
  var _lnow=(NOWOVR!=null?NOWOVR:now), gzL=nukeGZX(_lnow), frL=nukeFrontR();
  function lmHit(frac){ return cityPhase==="apoc" && apocStruck() && curDeath!=="flood" && curDeath!=="pollution" && apocHit(Math.round(frac*WW)); }   // (flood: landmarks submerge; pollution: nothing is demolished — the city just dies)
  function lmBlow(frac,w,h,seed){
    var cxw=Math.round(frac*WW), cl, bd;
    if(curDeath==="meteors"){ var mc=meteorCollapse(cxw,now); cl=(mc.cl>=0?mc.cl:0); bd=mc.bd; }
    else if(curDeath==="sunburst"){ var scL=sunCl(cxw); cl=(scL>=0?scL:0); bd=0; }   // solar heat burns the monument down in place
    else if(curDeath==="ai"){ var acL=frontCollapse(cxw,aiFrontR()); cl=(acL>=0?acL:0); bd=0; }   // assimilated into a factory & harvested
    else if(curDeath==="bh"){ var bcL=frontCollapse(cxw,bhFrontR()); cl=(bcL>=0?bcL:0); bd=0; }   // torn from its base & streamed into the hole
    else if(curDeath==="alienwar"){ var wcL=alienCl(cxw); cl=(wcL>=0?wcL:0); bd=0; }   // beam-struck & blasted into wreckage
    else if(curDeath==="frost"){ var frL2=frostCl(cxw); cl=(frL2>=0?frL2:0); bd=0; }   // frozen over & buried
    else if(curDeath==="kaiju"){ var kcL=frontCollapse(cxw,kaijuFrontR()); cl=(kcL>=0?kcL:0); bd=0; }   // stomped flat
    else if(curDeath==="kaijuwar"){ var kwL=kwCl(cxw,now); cl=(kwL>=0?kwL:0); bd=0; }   // trampled by a titan or caught in the melee
    else { cl=Math.min(1,(frL-nukeDist(cxw,gzL))/(WW*0.09)); var sd=((cxw-gzL)%WW+WW*1.5)%WW-WW*0.5; bd=(sd>=0)?1:-1; }
    for(var o=-WW;o<=WW;o+=WW){ var sx=cxw-WOFF+o; if(sx<-w-60||sx>SW+60) continue;
      drawApocBuilding(g,{h:h,w:w,seed:seed},Math.round(sx-w/2),cl,L,now,bd); }
  }
  function lm(frac,st,w,h,seed,fn){ if(lmHit(frac)) lmBlow(frac,w,h,seed); else rise(st,fn); }
  lm(LM_STADIUM,   gstage(0.55,0.63), 98,46,  71, function(){ drawStadium(g,L,now,night,nd); });
  if(!SMALLW) lm(LM_CATHEDRAL, gstage(0.57,0.65), 42,88, 131, function(){ drawCathedral(g,L,now,night); });
  lm(LM_FERRIS,    gstage(0.50,0.58), 54,66, 233, function(){ drawFerris(g,L,now,night); });
  lm(LM_CITYHALL,  gstage(0.52,0.60), 58,60, 317, function(){ drawCityHall(g,L,now,night); });
  lm(LM_HERO,      gstage(0.54,0.64), 50,74, 419, function(){ drawCityHero(g,L,now); });          // this life's signature monument
  lm(LM_COURTHOUSE,gstage(0.54,0.62), 54,62, 523, function(){ drawCourthouse(g,L,now,night); });
  lm(LM_CAPITOL,   gstage(0.60,0.70), 62,76, 631, function(){ drawCapitol(g,L,now,night); });
  if(!SMALLW){
    lm(LM_POLICE,  gstage(0.50,0.58), 42,44, 733, function(){ drawPoliceStation(g,L,now,night); });
    lm(LM_FIRE,    gstage(0.50,0.58), 42,46, 829, function(){ drawFireStation(g,L,now,night); });
    lm(LM_LIBRARY, gstage(0.58,0.66), 50,50, 941, function(){ drawLibrary(g,L,now,night); });
    lm(LM_POST,    gstage(0.58,0.66), 46,48,1039, function(){ drawPostOffice(g,L,now,night); });
  }
  lm(LM_SCHOOL,    gstage(schoolAt,schoolAt+0.08), 54,44,1151, function(){ drawSchool(g,L,now,night,nd); });
  lm(LM_MUSEUM,    gstage(0.58,0.66), 58,52,1249, function(){ drawMuseum(g,L,now,night); });
  if(!SMALLW) lm(LM_COASTER, gstage(0.70,0.78), 82,52,1361, function(){ drawCoaster(g,L,now,night); });
  var nMega=SMALLW?1:2;
  for(var mgi=0;mgi<nMega;mgi++){ var mst=gstage(0.86+mgi*0.03,0.96+mgi*0.02), megaH=Math.round((150+mgi*24)*KSP*0.85)+10;
    if(lmHit(LM_MEGA[mgi])) lmBlow(LM_MEGA[mgi], 40, megaH, 1500+mgi*97);          // the mega high-rises blow away too
    else if(mst>0) rise2(mst,megaH,(function(ii,ss){ return function(){ drawMegaTower(g,ii,L,now,night,ss); };})(mgi,mst)); }
  var mst0=gstage(0.86,0.96);                                                                                   // HQ arcology's own rise progress
  if(curCorps&&curCorps.king>=0 && mst0>=0.85 && !lmHit(LM_MEGA[0])) drawCorpHQ(g,0,L,now,night,mst0);          // the juggernaut's name crowns the arcology — only once it's topping out, anchored to the RISEN top (never floats)
}

// ============================ LIVING NATURE ============================
// Wildlife that shares the world with the city: migrating birds overhead, deer & rabbits on the
// open land, fish in the river, dolphins/whales in the harbour. All deterministic from the clock.

// migrating flocks: north in spring, south in autumn (dir), silent otherwise
function migrationDir(nd){ var m=nd.getMonth()+1; return (m>=4&&m<=5)?1:(m>=9&&m<=10)?-1:0; }
function drawMigration(g,now,nd,L){
  if(migrationDir(nd)===0) return;
  var fl=crosser(now, 200000, 0.02, 44, 0.72); if(!fl) return;         // a flock passes every few minutes
  var cy=8+((fl.idx*13)%16), dir=fl.dir, col=L>0.5?"rgba(40,46,58,0.9)":"rgba(150,160,185,0.8)";
  for(var b=0;b<9;b++){ var arm=(b===0)?0:Math.ceil(b/2), sgn=(b%2)?1:-1;
    var bwx=fl.x - dir*arm*4.5, byy=cy + arm*sgn*2 + Math.sin(now*0.002+b)*0.6;   // proper V behind the leader
    for(var off=-WW;off<=WW;off+=WW){ var X=(bwx-WOFF+off)|0; if(X<-4||X>SW+4) continue;
      drawBird(g,X,byy,(Math.floor(now/150)+b)%4,col,dir); }              // steady travelling wingbeat
  }
}

// a single deer, side-on: grazes (head down) or stands alert with antlers
function drawDeer(g,x,y,day,now,seed){
  var c=day?[122,92,58]:[52,40,26], cc=css(c), graze=(Math.sin(now*0.0005+seed)>0);
  g.fillStyle=cc;
  g.fillRect(x,y-3,4,2);                                             // body
  g.fillRect(x,y-1,1,1); g.fillRect(x+3,y-1,1,1);                    // legs
  g.fillRect(x-1,y-2,1,1);                                           // chest
  if(graze){ g.fillRect(x-1,y-1,1,1); g.fillRect(x-2,y,1,1); }       // head down to the grass
  else { g.fillRect(x-1,y-4,1,2); g.fillRect(x-2,y-5,1,1);           // neck + head raised
    g.fillStyle=css(mixc(c,[0,0,0],0.3)); g.fillRect(x-2,y-6,1,1); g.fillRect(x,y-6,1,1); }  // antlers
}
// deer & rabbits on the undeveloped land — they retreat as the city paves over the wild
function drawWildlife(g,wild,day,now,gy){
  if(wild<0.32) return;
  var nd2=Math.max(2,Math.round(WW/95));
  for(var d=0;d<nd2;d++){ var seed=(d*2654435761)>>>0, hh=seed/4294967296;
    if(hh>wild*0.9+0.1) continue;                                    // fewer as it urbanises
    var wx=landRoute(wrapW(hh*WW + Math.sin(now*0.00006+d*1.7)*24)), gyy=gy+3+((seed>>4)%7);
    for(var o=-WW;o<=WW;o+=WW){ var X=(wx-WOFF+o)|0; if(X<-6||X>SW+6) continue; drawDeer(g,X,gyy,day,now,seed); }
  }
  var nr=Math.max(3,Math.round(WW/48));
  for(var rb=0;rb<nr;rb++){ var rs=(rb*40503+13)>>>0, rh=(rs%1000)/1000; if(rh>wild) continue;
    var hop=Math.abs(Math.sin(now*0.004+rb*2.1)), rwx=landRoute(wrapW(((rs>>2)/1073741824*WW) + now*0.002*((rb&1)?1:-1)));
    var ryy=gy+4+((rs>>6)%8) - (hop>0.6?1:0);
    for(var o2=-WW;o2<=WW;o2+=WW){ var RX=(rwx-WOFF+o2)|0; if(RX<-3||RX>SW+3) continue;
      g.fillStyle=day?"#b9a385":"#4a4238"; g.fillRect(RX,ryy,2,1); g.fillRect(RX+1,ryy-1,1,1);   // body + ear
      g.fillStyle=day?"#cbb89a":"#524a3e"; g.fillRect(RX-1,ryy,1,1); }                            // tail
  }
}
// fish arcing out of the river (over the river band drawn in drawTerrain)
function drawRiverFish(g,now,rvxWorld,gy,riverW,day){
  var slot=Math.floor(now/5200), fr=rng((slot*40503+ (rvxWorld|0))>>>0);
  if(fr()>0.42) return; var ph=now-slot*5200; if(ph>820) return;
  var t=ph/820, arc=Math.sin(t*Math.PI), fwx=rvxWorld + (fr()-0.5)*Math.max(2,riverW), fy=gy-2-arc*8;
  for(var o=-WW;o<=WW;o+=WW){ var X=(fwx-WOFF+o)|0; if(X<-4||X>SW+4) continue;
    var tilt=(t<0.5?-1:1);                                                 // nose up then down
    g.fillStyle=day?"#9fb6c2":"#5a7488"; g.fillRect(X,fy|0,2,1); g.fillRect(X+(tilt>0?2:-1),(fy+tilt)|0,1,1);  // body+tail
    g.fillStyle="rgba(220,238,255,0.8)"; g.fillRect(X,(fy-1)|0,1,1);       // glint
    if(t<0.16||t>0.84){ g.fillStyle="rgba(210,232,255,0.7)"; g.fillRect(X|0,gy-1,1,1); g.fillRect((X+2)|0,gy-1,1,1); }  // splash at entry/exit
  }
}
// dolphins arc through the harbour; a whale surfaces & spouts now and then
function drawSeaLife(g,L,now,wTop){
  eachWaterSpan(function(sa,sb){ var cw=(sa+sb)/2, span=sb-sa; if(span<20) return;
    var wcx=cw+WOFF;                                                       // world x of this water span's centre
    // dolphin pod: 2-3 dolphins arc in sequence
    var dslot=Math.floor(now/7000), dr=rng((dslot*2246822519 + (wcx|0))>>>0);
    if(dr()<0.6){ var dph=now-dslot*7000, base=sa+span*(0.25+dr()*0.5), dir=dr()<0.5?1:-1, wl=(wTop+HORIZON)/2;
      for(var k=0;k<3;k++){ var kt=(dph-k*260)/900; if(kt<0||kt>1) continue;
        var dx=base+dir*kt*18, arc=Math.sin(kt*Math.PI), dy=wl-arc*6;
        g.fillStyle=css(mixc([60,70,86],[150,164,182],L*0.6));
        g.fillRect(dx|0,dy|0,3,1); g.fillRect((dx+(dir>0?1:1))|0,(dy-1)|0,1,1);        // back
        g.fillRect((dx+(dir>0?-1:3))|0,(dy+1)|0,1,1);                                  // tail flick
        if(kt<0.2||kt>0.8){ g.fillStyle="rgba(210,232,255,0.7)"; g.fillRect(dx|0,(wl+1)|0,2,1); } }
    }
    // a whale surfaces occasionally with a spout
    var wslot=Math.floor(now/16000), wr=rng((wslot*40503 + (wcx|0)+7)>>>0);
    if(wr()<0.5){ var wph=now-wslot*16000; if(wph<4000){ var wt=wph/4000, wl2=(wTop+HORIZON)/2+2,
      wx=sa+span*(0.3+wr()*0.4), hump=Math.sin(Math.min(1,wt*1.4)*Math.PI)*3;
      g.fillStyle=css(mixc([44,52,66],[110,122,140],L*0.55));
      g.fillRect((wx-4)|0,(wl2-hump)|0,9,2); g.fillRect((wx-2)|0,(wl2-hump-1)|0,5,1);   // broad back
      if(wt>0.35&&wt<0.7){ g.fillStyle="rgba(210,230,255,0.65)";                        // spout
        for(var sp=0;sp<4;sp++) g.fillRect((wx+3)|0,(wl2-hump-2-sp)|0,1,1); }
      if(wt>0.7){ g.fillStyle=css(mixc([44,52,66],[110,122,140],L*0.55)); g.fillRect((wx+4)|0,(wl2-hump-2)|0,2,3); } }  // fluke
    }
  });
}

// ---- parade: floats + marching band + confetti down a road lane ----
// a PROTEST MARCH: a column of fuming demonstrators — raised fists, big placards, steam of anger, a lead banner
function drawProtest(g,L,now){
  var march=((now*0.012)%(WW+80))-40;
  for(var w=-1;w<=1;w++){ var base=march+w*WW-WOFF;
    var bx=base+4; if(bx>-14&&bx<SW+14){ g.fillStyle="#b03030"; g.fillRect(bx|0,HORIZON-10,13,4);        // lead banner
      g.fillStyle="#eef1f6"; g.fillRect((bx+1)|0,HORIZON-9,11,1); g.fillRect((bx+2)|0,HORIZON-7,9,1); }   // two slogan lines
    for(var i=0;i<16;i++){ var px=base-i*3+((i*7)%2), bob=(Math.floor(now/140)+i)&1, sk=SKINC[i%SKINC.length]; if(px<-4||px>SW+4) continue;
      drawPerson(g,px|0,HORIZON-1,PEDC[i%PEDC.length],sk,bob);
      var side=(i&1)?-1:1;
      if((i%3)===0){ g.fillStyle=sk; g.fillRect((px+(side>0?2:-1))|0,(HORIZON-6-bob)|0,1,1); }            // a raised FIST
      if((i%2)===0){ var sy=HORIZON-7-bob;                                                                // a big legible PLACARD
        g.fillStyle="#c9cdd6"; g.fillRect(px|0,(HORIZON-4-bob)|0,1,4);                                    // stick
        g.fillStyle=["#d23b3b","#3878c8","#3aa84a","#dbb83a","#e8e2ea"][i%5]; g.fillRect((px-2)|0,sy,5,3); // board
        g.fillStyle="rgba(20,20,26,0.7)"; g.fillRect((px-1)|0,sy+1,3,1); }                                // slogan text
      if((i%4)===1){ g.fillStyle="rgba(210,70,70,0.4)"; g.fillRect(px|0,(HORIZON-4-bob)|0,2,1);           // FUMING: red-faced anger
        var st=(Math.floor(now/200)+i)%3; g.globalCompositeOperation="lighter";                          // + puffs of steam rising off the head
        g.fillStyle="rgba(220,130,100,"+(0.55-st*0.16).toFixed(2)+")"; g.fillRect((px+(side>0?2:-1))|0,(HORIZON-5-bob-st)|0,1,1); g.globalCompositeOperation="source-over"; }
    }
  }
}
// a FILM SHOOT: a lit set with a camera on a tripod, a big lamp, a director, actors & a barrier
function drawFilmShoot(g,L,now){
  var cx=Math.round(0.55*WW)-WOFF;
  for(var w=-1;w<=1;w++){ var X=(cx+w*WW)|0; if(X<-26||X>SW+26) continue;
    g.fillStyle="#e0883a"; g.fillRect(X-16,HORIZON-1,1,1); g.fillRect(X+16,HORIZON-1,1,1);              // barrier cones
    g.fillStyle="#2a2d36"; g.fillRect(X-12,HORIZON-8,1,8); g.fillStyle="#e8e2c0"; g.fillRect(X-14,HORIZON-10,4,3);   // lamp stand + head
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,245,210,0.45)"; g.fillRect(X-14,HORIZON-11,11,9); g.globalCompositeOperation="source-over";
    g.fillStyle="#1c1e24"; g.fillRect(X+8,HORIZON-6,4,3); g.fillRect(X+9,HORIZON-3,1,3); g.fillRect(X+7,HORIZON-1,5,1);   // camera + tripod
    g.fillStyle="#3a3e46"; g.fillRect(X+12,HORIZON-5,1,1);                                              // lens
    drawPerson(g,X+5,HORIZON-1,"#2a2c34",SKINC[0],0); g.fillStyle="#5a4a30"; g.fillRect(X+4,HORIZON-3,3,1);   // director + chair
    drawPerson(g,X-6,HORIZON-1,"#d24a4a",SKINC[1],(Math.floor(now/500))&1);                             // actors under the light
    drawPerson(g,X-3,HORIZON-1,"#4a7fd2",SKINC[3],(Math.floor(now/500)+1)&1);
    if((Math.floor(now/1200))%4===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,255,255,0.28)"; g.fillRect(X-14,HORIZON-12,13,11); g.globalCompositeOperation="source-over"; }  // clapper flash
  }
}
function drawParade(g,L,now){
  var lane=1, y=HORIZON+LANE[lane].o;
  for(var k=0;k<Math.ceil(WW/38)+1;k++){
    var wx=wrapW(k*38 + now*0.014), sx=wx-WOFF;
    if(sx>SW+18&&sx-WW>-18) sx-=WW; if(sx<-18&&sx+WW<SW+18) sx+=WW; if(sx<-18||sx>SW+18) continue;
    if(k%2===0){ // float
      var fc=["#ff4d88","#3a9aff","#ffd23a","#6affc0"][k%4];
      g.fillStyle=fc; g.fillRect(sx|0,y-3,14,5); g.fillStyle="rgba(255,255,255,0.3)"; g.fillRect(sx|0,y-3,14,1);
      g.fillStyle="#0b0b10"; g.fillRect(sx+2|0,y+2,2,1); g.fillRect(sx+10|0,y+2,2,1);
      for(var b=0;b<3;b++){ var bc=["#ff5a5a","#ffd75e","#5affd7"][b]; g.fillStyle="#888"; g.fillRect((sx+3+b*4)|0,y-8,1,5); g.fillStyle=bc; g.fillRect((sx+2+b*4)|0,y-10,3,2); } // balloons
    } else { // marching band block
      for(var mrow=0;mrow<2;mrow++) for(var mc2=0;mc2<4;mc2++)
        drawPerson(g,(sx+mc2*3)|0, y+ (mrow), "#b02a2a", SKINC[(k+mc2)%SKINC.length], ((now*0.02+mc2)|0)&1);
    }
  }
  for(var cf=0;cf<20;cf++){ var cx=(cf*53+ (now*0.05))% SW, cy=(cf*31+ now*0.08)% (HORIZON+6);   // confetti
    g.fillStyle=["#ff5a5a","#ffd75e","#5affd7","#5a9dff","#ff5af0"][cf%5]; g.fillRect(cx|0,cy|0,1,1); }
}

// is a world x-range on a construction site? (so we hide the finished building there)
function overSite(bx,bw){ for(var i=0;i<sites.length;i++){ var s=sites[i];
  if(bx< s.x+s.w+2 && bx+bw> s.x-2) return true; } return false; }
// ---- construction site: scaffolded tower grows floor-by-floor over real days + a tower crane ----
function drawSite(g,st,L,now,nd){
  var dayF=nd.getTime()/86400000, buildDays=st.floors*st.dpf, hold=5, cyc=buildDays+hold;
  var ph=(((dayF-st.offset)%cyc)+cyc)%cyc, building=(ph<buildDays);
  var fb=building?Math.floor(ph/st.dpf):st.floors; fb=Math.max(1,Math.min(st.floors,fb));
  if(curPolicies.heightcap){ var capF=Math.max(2,(42/st.fh)|0); if(fb>capF){ fb=capF; building=false; } }   // HEIGHT CAP (voted, render-time only): the crane tops out at the limit — the tower stops rising this term
  for(var off=-WW;off<=WW;off+=WW){ var X=(st.x-WOFF+off)|0; if(X+st.w<-4||X>SW+24) continue;
    var w=st.w, gy=HORIZON, builtH=fb*st.fh, topY=gy-builtH;
    for(var f=0;f<fb;f++){ var fy=gy-(f+1)*st.fh, finished=(f<fb-3||!building);
      if(finished){ g.fillStyle=L>0.5?"#8a8f9a":"#2a2e38"; g.fillRect(X,fy,w,st.fh);
        for(var wx=X+1;wx<X+w-1;wx+=3){ g.fillStyle=(L<0.45&&(((wx*7+f)%3)===0))?"#ffe6a0":(L>0.5?"#aeb6c2":"#171b24"); g.fillRect(wx,fy+1,2,st.fh-2); }
      } else { g.fillStyle=L>0.5?"#6a6f7a":"#22262f"; g.fillRect(X,fy+st.fh-1,w,1);        // slab
        for(var cxp=X;cxp<=X+w;cxp+=4) g.fillRect(cxp,fy,1,st.fh); }                       // steel columns
    }
    if(building){
      // scaffolding up one side + safety netting over the top floors
      g.fillStyle=L>0.5?"rgba(190,168,96,0.85)":"rgba(96,84,52,0.85)";
      g.fillRect(X-1,topY,1,Math.min(builtH,26)); g.fillRect(X+w,topY,1,Math.min(builtH,26));
      for(var sy=topY;sy<topY+Math.min(builtH,26);sy+=4) g.fillRect(X-1,sy,w+2,1);
      g.fillStyle="rgba(90,180,120,0.15)"; g.fillRect(X,topY,w,Math.min(builtH,12));
      // tower crane on the right, mast taller than the tower
      var mastX=X+w+2, mastTop=gy-builtH-18, jy=mastTop, jib=w+10;
      g.fillStyle=L>0.5?"#e0a83a":"#5a4418"; g.fillRect(mastX,mastTop,2,gy-mastTop);       // mast (lattice)
      for(var my=mastTop+2;my<gy-2;my+=3){ g.fillStyle="rgba(0,0,0,0.25)"; g.fillRect(mastX,my,2,1); }
      g.fillStyle=L>0.5?"#e0a83a":"#5a4418";
      g.fillRect(mastX-jib,jy,jib,1);                                                       // long working jib reaches LEFT, OVER the tower it is raising
      g.fillRect(mastX+2,jy,5,1); g.fillRect(mastX+6,jy-1,2,3);                              // short counter-jib + counterweight on the far side
      g.fillStyle=L>0.5?"#c8ccd6":"#3a3e48"; g.fillRect(mastX-1,jy+1,4,3);                   // operator cab
      var troX=mastX-(0.30+0.55*(0.5+0.5*Math.sin(now*0.001+st.seed)))*jib;                  // the trolley runs in/out ALONG the jib (always over the building)
      var loadY=gy-((0.35+0.45*(0.5+0.5*Math.sin(now*0.0008+st.seed)))*builtH);              // load rises/falls
      g.fillStyle="rgba(28,28,34,0.85)"; g.fillRect(troX|0,jy,1,Math.max(1,(loadY-jy)|0));    // hoist cable
      g.fillStyle="#c9a23a"; g.fillRect((troX-1)|0,loadY|0,3,2);                              // hanging load
      if(L<0.6&&(Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect(mastX,mastTop-1,1,1); }  // aviation light
      if(L>0.4) drawPerson(g,X+2+(st.seed%Math.max(1,w-4)),topY-2,"#ffd24a",SKINC[st.seed%SKINC.length],0);  // a hi-vis worker
    }
    // hoarding / fence at the base
    g.fillStyle=L>0.5?"#3f6ab0":"#1f3048"; g.fillRect(X-1,gy-2,w+2,2);
    for(var hp=X;hp<X+w;hp+=3){ g.fillStyle="rgba(255,220,80,0.55)"; g.fillRect(hp,gy-2,1,1); }
  }
}

// ============================================================================
//  NATURAL (and unnatural) DISASTERS — deterministic from the clock, so every
//  screen sees the identical catastrophe. A disaster strikes a block, the city's
//  military + emergency services respond, then construction crews rebuild it into
//  a NEW (reseeded) tower that persists until the next one hits. Idle cost ≈ one
//  rng() check per frame that returns null.
// ============================================================================
var DIS_SLOT=7*60000;        // one potential disaster window per 7 min (LESS FREQUENT: was 5.5)
var DIS_PROB_BASE=0.24;      // baseline fraction of windows that fire (~1 per ~29 min at "normal")
var DIS_PROB=DIS_PROB_BASE*disMul(CFG.disasters);   // config "rare"/"normal"/"frequent" scales it
var DIS_DUR=240000;          // full lifecycle length (4 min): warn→build→strike→aftermath→rebuild (LONGER: was 2.75min). must stay < DIS_SLOT so t0=r()*(DIS_SLOT-DIS_DUR) has room
var DIS_LOOKBACK=10;         // how many past slots to remember rebuilt towers for
var RUIN_CHANCE=0.20;        // of the RARE lost CAT-5 events, the fraction that scar the district PERMANENTLY (rest of this life) instead of eventually rebuilding — tuned so a week-long life sees only ~a handful of dead districts (a real, memorable event; use FORCERUIN to see one on demand)
var RUIN_MAXSCAN=2000;       // hard cap on how many past slots the ruin scan walks (covers a full week-life; clamped tighter to this life's birth)
var DIS_TYPES=["asteroid","volcano","zombie","alien","kaiju","tornado","flood","mech","kraken","sandstorm","iceage","rift","blackout","smog"];
var DIS_NAME={asteroid:"ASTEROID",volcano:"VOLCANO",zombie:"ZOMBIES",alien:"ALIENS",kaiju:"KAIJU",
  tornado:"TORNADO",flood:"FLOOD",mech:"MECH WAR",kraken:"KRAKEN",sandstorm:"SANDSTORM",iceage:"ICE AGE",rift:"RIFT",
  blackout:"BLACKOUT",smog:"SMOG"};
// non-destructive threats (blackout, smog) skip the collapse→rubble→rebuild machinery: they veil the city, they don't level it.
function disDestroys(t){ return t!=="blackout" && t!=="smog"; }
var FORCEDIS=null;           // test hook: {type,intensity,xf,w,seed,f}
var FORCERUIN=null;          // test hook: {type,intensity,xf,w,seed} — pins a permanently-ruined zone for render tests

// deterministic descriptor of the disaster in slot idx (or null)
function disasterInfo(idx){
  var r=rng((idx*2246822519+13)>>>0);
  if(r()>DIS_PROB) return null;
  var type=DIS_TYPES[(r()*DIS_TYPES.length)|0];
  if(type==="kraken" && !hasOcean) type="tornado";  // a landlocked city can't be raided by a sea-beast — send weather instead
  var intensity=1+((r()*5)|0);                     // CAT 1..5
  var t0=r()*(DIS_SLOT-DIS_DUR);                    // start offset within the slot (fits fully inside)
  var cx=Math.round(0.15*WW + r()*0.70*WW);         // impact centre (world x, kept off the far edges)
  var win=r() < (0.80-intensity*0.06)*(0.7+0.6*milFund);   // the city USUALLY wins — but not always (funding matters)
  var w=Math.round((14+intensity*11)*(win?1:1.7));  // wider footprint at higher CAT; a lost battle a far wider ruin
  var seed=(r()*1e6)|0;
  var ruin = disDestroys(type) && intensity>=5 && !win && (r()<RUIN_CHANCE);   // a RARE lost CAT-5 that scars the district PERMANENTLY (rest of this life)
  return { idx:idx, type:type, intensity:intensity, t0:t0, x:cx, w:w, seed:seed, win:win, ruin:ruin };
}
// the disaster active RIGHT NOW (with phase fields), or null
function disasterNow(now){
  if(FORCEDIS){ var d={type:FORCEDIS.type,intensity:FORCEDIS.intensity,x:Math.round((FORCEDIS.xf||0.4)*WW),
    w:FORCEDIS.w||34,seed:FORCEDIS.seed||123,idx:-1}; d.f=FORCEDIS.f; d.tp=d.f*DIS_DUR; return d; }
  var idx=Math.floor(now/DIS_SLOT), di=disasterInfo(idx);
  if(!di) return null;
  var tp=now-idx*DIS_SLOT-di.t0;
  if(tp<0||tp>DIS_DUR) return null;
  di.tp=tp; di.f=tp/DIS_DUR; return di;
}
// past disasters whose rebuild has completed — their block wears the NEW tower now
function rebuiltZones(now){
  if(FORCEDIS) return [];
  var out=[], base=Math.floor(now/DIS_SLOT);
  for(var bk=0;bk<=DIS_LOOKBACK;bk++){ var di=disasterInfo(base-bk); if(!di||!disDestroys(di.type)||di.ruin) continue;   // veil threats leave nothing to rebuild; a permanently-ruined block never rebuilds
    var end=(base-bk)*DIS_SLOT+di.t0+DIS_DUR; if(end<=now) out.push(di); }   // window already over
  return out;   // nearest-first
}
// PERMANENTLY-RUINED zones: a rare lost CAT-5 leaves a dead district for the REST OF THIS LIFE. State is
// recomputed from the clock (nothing is stored) — a block is ruined iff a qualifying disaster finished
// earlier THIS life covered it. The scan is life-scoped (clamped to this life's birth) so ruins never bleed
// across the reincarnation wipe, and hard-capped so a week-long life can't run an unbounded loop.
function ruinZones(now){
  if(FORCERUIN) return [{ type:FORCERUIN.type||"asteroid", intensity:FORCERUIN.intensity||5,
    x:Math.round((FORCERUIN.xf||0.4)*WW), w:FORCERUIN.w||64, seed:FORCERUIN.seed||123, ruin:true, win:false }];
  if(FORCEDIS) return [];
  var out=[], base=Math.floor(now/DIS_SLOT);
  var lifeStart=GROW_EPOCH - GROW_OFFSET_DAYS*86400000 - WORLD_SHIFT + lifeIndexOf(now)*GROW_CYCLE;   // wall-clock birth of THIS life
  var firstSlot=Math.max(Math.ceil(lifeStart/DIS_SLOT), base-RUIN_MAXSCAN);
  for(var idx=base; idx>=firstSlot; idx--){ var di=disasterInfo(idx); if(!di||!di.ruin) continue;
    var end=idx*DIS_SLOT+di.t0+DIS_DUR; if(end<=now) out.push(di); }   // only once its disaster has fully finished collapsing
  return out;   // nearest-first
}
function inZone(wx,ww,z){ var a=z.x-(z.w>>1)-2, b=z.x+(z.w>>1)+2; return wx< b && wx+ww> a; }

// the DNA of the rebuilt tower (deterministic from the disaster seed + footprint)
function newTowerDNA(bx,bh,seed){
  var r=rng((seed ^ ((bx*2654435761)>>>0))>>>0);
  return { nh:Math.round(bh*(1.06+r()*0.4)),                       // rebuilt a little taller
           acc:NEON[(r()*NEON.length)|0], crownAnt:(r()<0.7), rr:r() };
}
// a sleek modern glass tower (the "rebuilt better" look) — reveal 0..1 adds a just-built sheen sweep
function drawNewTower(g,X,w,nh,dna,L,now,reveal){
  var gy=HORIZON, top=gy-nh;
  g.fillStyle=L>0.5?"#79839a":"#141a28"; g.fillRect(X,top,w,nh);                      // dark-glass body
  for(var rx=X+1;rx<X+w-1;rx+=2) for(var ry=top+2;ry<gy-1;ry+=3){
    var on=((rx*7+ry+((dna.rr*1000)|0))%5)!==0;
    g.fillStyle=L<0.45?(on?dna.acc:"#0c1220"):(L>0.5?(on?"#c4e2ff":"#5a6478"):"#233444");
    g.globalAlpha=L<0.45?0.9:0.5; g.fillRect(rx,ry,1,2); }
  g.globalAlpha=1;
  if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(hex2rgb(dna.acc),0.5*(1-L)+0.2);
    g.fillRect(X,top,w,1); g.globalCompositeOperation="source-over"; }
  if(dna.crownAnt){ var mx=X+(w>>1); g.fillStyle=L>0.5?"#9aa4b8":"#2a3040"; g.fillRect(mx,top-6,1,6);
    if(L<0.6&&(Math.floor(now/500))%2===0){ g.fillStyle="#ff4040"; g.fillRect(mx,top-7,1,1); } }
  if(reveal>0&&reveal<1){ g.globalCompositeOperation="lighter"; g.globalAlpha=0.3*reveal;
    g.fillStyle="rgba(232,246,255,1)"; g.fillRect(X,(top+(1-reveal)*nh)|0,w,3);
    g.globalAlpha=1; g.globalCompositeOperation="source-over"; }
}
// a rising column of smoke/ash (dens 0..1, scaled by intensity)
function drawSmoke(g,cx,topY,dens,now,intensity){
  var n=6+intensity*3;
  for(var s=0;s<n;s++){ var t=(now*0.02+s*90+intensity*20)%140, sy=topY-t*0.5,
      drift=Math.sin(now*0.0009+s)*3+t*0.06*(s&1?1:-1), sz=1+((t/40)|0);
    var a=dens*0.5*(1-t/140); if(a<=0) continue;
    g.fillStyle="rgba("+(60+s%20)+","+(58+s%16)+","+(62+s%18)+","+a+")";
    g.fillRect((cx+drift-sz/2)|0,sy|0,sz+1,sz+1); }
}
// one destroyed/rebuilding building, chosen by phase (called from drawLayer for in-zone near buildings)
function drawDisasterBuilding(g,b,X,cd,L,now){
  var gy=HORIZON, w=b.w, f=cd.f, dna=newTowerDNA(b.x,b.h,cd.seed), origTop=gy-b.h;
  if(f<0.10){                                                   // WARNING — intact, red alarm pulsing
    g.fillStyle=L>0.5?"#5a6070":"#12151f"; g.fillRect(X,origTop,w,b.h);
    for(var wy=origTop+3;wy<gy-2;wy+=5) for(var wx=X+1;wx<X+w-1;wx+=3){
      if(((wx*3+wy)%7)===0){ g.fillStyle=((now/200|0)%2)?"#ff5a3a":"#3a1510"; g.fillRect(wx,wy,2,2); } }
    if((Math.floor(now/160))%2===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,60,45,0.45)";
      g.fillRect(X-1,origTop-1,w+2,b.h+2); g.globalCompositeOperation="source-over"; }
    return;
  }
  var cold=(cd.type==="iceage"), wet=(cd.type==="flood"||cd.type==="kraken");   // wet/cold districts don't burn — no orange fire under ice or water
  if(f<0.36){                                                   // STRIKE — collapsing (fire, or freeze-shatter, or drowning)
    var p=(f-0.10)/0.26, curH=Math.max(4,b.h*(1-0.85*p)), top=gy-curH;
    g.fillStyle=L>0.5?"#5a5560":"#2a2632"; g.fillRect(X,top,w,curH);                  // lit rubble-grey (reads at night)
    for(var jx=X;jx<X+w;jx+=2){ var notch=((jx*13+(Math.floor(now/120)))%3); if(notch){ g.fillStyle=L>0.5?"#3a3640":"#151320"; g.fillRect(jx,top,2,notch); } }
    if(cold){                                                                         // FLASH-FREEZE — glazed in ice, cracking, NOT burning
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(150,210,255,"+(0.22+0.10*Math.sin(now*0.02))+")"; g.fillRect(X-1,top,w+2,Math.min(curH,20));   // icy sheen over the frozen shell
      g.globalCompositeOperation="source-over";
      for(var ic=0;ic<w;ic++){ if(((ic*7+cd.seed)%4)===0){ var icl=1+((ic*5+cd.seed)%3); g.fillStyle="#cfeaff"; g.fillRect(X+ic,top,1,icl); } }   // icicles hanging off the shear
      for(var sh=0;sh<w;sh+=3){ if(((sh*11+(Math.floor(now/110)))%4)===0){ g.fillStyle="#eaf7ff"; g.fillRect(X+sh,top+((sh*13+cd.seed)%Math.max(2,curH|0)),1,1); } }  // frost/shatter glints
    } else if(wet){                                                                    // DROWNING — swamped and slumping into the water, no fire
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(90,150,210,0.28)"; g.fillRect(X-1,top,w+2,Math.min(curH,18));  // cold spray sheen
      g.globalCompositeOperation="source-over";
      for(var fo=0;fo<w;fo++){ if(((fo*5+(Math.floor(now/70)))%3)===0){ g.fillStyle="#cfe8ff"; g.fillRect(X+fo,top-((Math.floor(now/60)+fo)%3),1,1); } }   // foam flecks at the flood line
    } else {                                                                           // FIRE — the default violent, blazing collapse
      g.globalCompositeOperation="lighter";                                             // firelight bathing the ruin
      g.fillStyle="rgba(255,110,30,"+(0.30+0.12*Math.sin(now*0.02))+")"; g.fillRect(X-1,top-3,w+2,Math.min(curH+3,20));
      g.globalCompositeOperation="source-over";
      drawFlame(g,X+(w>>1),top+2,Math.min(20,w-2),9+cd.intensity*2,now,cd.seed,0.85);   // the blaze — licking shared-idiom flames
      if(w>10) drawFlame(g,X+(w>>2),top+3,Math.min(10,w>>1),6+cd.intensity,now,cd.seed+31,0.6);   // secondary tongue off-centre
      for(var em=0;em<w;em+=2){ if(((em*3+(Math.floor(now/50)))%5)===0){ g.fillStyle="#ffc23a"; g.fillRect(X+em,(top+((em*7+now*0.08)%curH))|0,1,1); } }  // glowing embers up the face
    }
    for(var db=0;db<8;db++){ var dbx=X+((db*7+now*0.05)%w), dby=top+((db*40+now*0.12)%Math.max(6,b.h));
      g.fillStyle="#453e4a"; g.fillRect(dbx|0,dby|0,1,1); }                            // tumbling debris
    if(!wet) drawSmoke(g,X+(w>>1),top,cold?0.5:1,now,cd.intensity);                    // frozen shells barely smoke; drowned ones don't
    return;
  }
  if(f<0.50){                                                   // AFTERMATH — smouldering rubble (or frozen/waterlogged ruin) + dying smoke
    var rh=6+cd.intensity;
    for(var rx2=0;rx2<w;rx2++){ var hh=rh-Math.abs(rx2-(w>>1))*0.5+((rx2*17)%3); if(hh<1) continue;
      g.fillStyle=L>0.5?"#5a5660":"#2e2a36"; g.fillRect(X+rx2,gy-hh,1,hh|0); }
    if(cold){                                                                          // frozen rubble — pale ice crust, no embers
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,210,255,"+(0.18*(1-(f-0.36)/0.14))+")"; g.fillRect(X-1,gy-rh-2,w+2,rh+2);
      g.globalCompositeOperation="source-over";
      for(var fc=0;fc<w;fc+=2){ if(((fc+cd.seed)%3)===0){ g.fillStyle="#dff2ff"; g.fillRect(X+fc,gy-1-((fc+cd.seed)%rh),1,1); } }
    } else if(!wet){                                                                   // smouldering rubble — embers + firelight
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,20,"+(0.2*(1-(f-0.36)/0.14))+")"; g.fillRect(X-1,gy-rh-2,w+2,rh+2);
      for(var eb=0;eb<w;eb+=2){ if(((eb+(Math.floor(now/140)))%3)===0){ g.fillStyle="#ff7a1a"; g.fillRect(X+eb,gy-1-((eb+(Math.floor(now/90)))%rh),1,1); } }
      g.globalCompositeOperation="source-over";
    }
    if(!wet) drawSmoke(g,X+(w>>1),gy-rh,0.6*(1-(f-0.36)/0.14)*(cold?0.5:1),now,cd.intensity);
    return;
  }
  if(cd.ruin){ drawRuinBuilding(g,b,X,cd,L,now); return; }      // a lost CAT-5 — this district is DEAD, it never rebuilds (from here on the ruin persists via curRuins for the rest of the life)
  if(f<0.95){                                                   // REBUILD — a site grows into the new tower
    var rp=(f-0.50)/0.45, builtH=Math.max(2,dna.nh*rp), top=gy-builtH;
    drawNewTower(g,X,w,builtH,dna,L,now,0);
    g.fillStyle=L>0.5?"#6a6f7a":"#22262f"; for(var cxp=X;cxp<=X+w;cxp+=4) g.fillRect(cxp,top-3,1,4);   // steel cap
    g.fillStyle=L>0.5?"rgba(190,168,96,0.85)":"rgba(120,100,60,0.85)";                                  // scaffold
    g.fillRect(X-1,top,1,Math.min(builtH,24)|0); g.fillRect(X+w,top,1,Math.min(builtH,24)|0);
    var mastX=X+w+2, mastTop=top-14; g.fillStyle=L>0.5?"#e0a83a":"#5a4418"; g.fillRect(mastX,mastTop,2,gy-mastTop);
    var jib=w+8, slew=Math.sin(now*0.0006+cd.seed);
    if(slew>0) g.fillRect(mastX+2,mastTop,jib,1); else g.fillRect(mastX-jib,mastTop,jib,1);              // slewing jib
    if(L<0.6&&(Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect(mastX,mastTop-1,1,1); }
    if(L>0.4) drawPerson(g,X+2+(cd.seed%Math.max(1,w-4)),top-2,"#ffd24a",SKINC[cd.seed%SKINC.length],0); // hi-vis worker
    g.fillStyle=L>0.5?"#3f6ab0":"#1f3048"; g.fillRect(X-1,gy-2,w+2,2);                                   // hoarding
    return;
  }
  drawNewTower(g,X,w,dna.nh,dna,L,now,1-(f-0.95)/0.05);         // SETTLE — finished, gleaming
}
// A PERMANENTLY-RUINED building: a rare lost CAT-5 killed this block for the rest of the life. Rendered
// EVERY frame for hours, so it MUST be static + cheap — a jagged dead husk, spilled rubble, twisted rebar,
// and nature slowly reclaiming it (weeds + climbing vines), with a lone squatter's ember at night. All
// deterministic from the ruin seed + block x, so it never shimmers or grows.
function drawRuinBuilding(g,b,X,ruz,L,now){
  var gy=HORIZON, w=b.w, seed=ruz.seed|0;
  var body=L>0.5?"#3b3740":"#191620", dark=L>0.5?"#2a2630":"#0e0c12";
  var coreH=Math.max(4, Math.round(b.h*(0.16+((seed%40)/100))));    // snapped off low — most of the tower is gone
  // ragged broken silhouette, column by column
  for(var cx=0;cx<w;cx++){ var jag=Math.round((Math.sin(cx*1.3+seed)*0.5+0.5)*coreH*0.5)+(((cx*7+seed)%3));
    var ch=Math.max(2,coreH-jag); g.fillStyle=((cx+seed)%3===0)?dark:body; g.fillRect(X+cx,gy-ch,1,ch);
    if(((cx*5+seed)%4)===0){ g.fillStyle=dark; g.fillRect(X+cx,gy-ch,1,1); } }                 // gutted window holes
  // twisted rebar poking out of the shear
  g.fillStyle=L>0.5?"#5a5048":"#241d16";
  for(var rb=0;rb<3;rb++){ var rbx=X+2+((rb*13+seed)%Math.max(1,w-4)); g.fillRect(rbx,gy-coreH-3-((rb*5+seed)%3),1,4+(rb&1)); }
  // rubble mound spilling past the footprint
  var rh=3+((seed>>3)%3);
  for(var rx=-2;rx<w+2;rx++){ var hh=(rh-Math.abs(rx-(w>>1))*0.28+(((rx*17+seed)%3)))|0; if(hh<1) continue;
    g.fillStyle=((rx+seed)&1)?dark:body; g.fillRect(X+rx,gy-hh,1,hh); }
  // NATURE RECLAIMS IT — weeds along the rubble, vines climbing the husk (static)
  for(var vg=0;vg<w;vg++){ if(((vg*5+seed)%4)!==0) continue; var vh=2+((vg*7+seed)%5);
    g.fillStyle=L>0.5?"#4a7a3a":"#1b3a1d"; g.fillRect(X+vg,gy-vh,1,vh);
    g.fillStyle=L>0.5?"#6aa050":"#2a5a2c"; g.fillRect(X+vg,gy-vh,1,1); }                        // leafy tip
  for(var vc=2;vc<coreH;vc+=2){ if(((vc*3+seed)%5)!==0) continue; var vx=X+1+((vc*11+seed)%Math.max(1,w-2));
    g.fillStyle=L>0.5?"#3a6a30":"#163316"; g.fillRect(vx,gy-vc,1,2); }
  // a squatter's fire flickering in the shell at night (one cheap ember)
  if(L<0.5){ var ex=X+(w>>1)+((seed%3)-1), fl=((Math.floor(now/450)+seed)%5)<2;
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,140,50,"+(fl?0.85:0.5)+")"; g.fillRect(ex,gy-2,1,2);
    g.fillStyle="rgba(255,90,30,0.30)"; g.fillRect(ex-1,gy-3,3,3); g.globalCompositeOperation="source-over"; }
}

// ---- a world-x → screen-x with generous wrap (for centred spectacles) ----
function disX(wx){ var s=wx-WOFF; if(s>SW+60&&s-WW>-60) s-=WW; if(s<-60&&s+WW<SW+60) s+=WW; return s; }

// ---- fighter-jet strafing pass (military air support) ----
function drawJetPass(g,cx,y,dir,L,now,firing){
  var X=cx|0,Y=y|0;
  g.fillStyle=L>0.5?"#3a4150":"#20262f"; g.fillRect(X,Y,6,2); g.fillRect(X+(dir>0?5:0),Y-1,1,1);   // fuselage+nose
  g.fillStyle=L>0.5?"#2e343f":"#171b22"; g.fillRect(X+2,Y-1,2,1); g.fillRect(X+2,Y+2,2,1);          // wings
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,190,255,0.7)"; g.fillRect(X+(dir>0?-1:6),Y,1,2); // afterburner
  g.globalCompositeOperation="source-over";
  if(firing&&(Math.floor(now/60))%2===0){ g.fillStyle="#ffe27a"; for(var t=1;t<9;t+=2) g.fillRect((X+(dir>0?6+t:-t))|0,Y+1,1,1); } // tracers
}
// ---- a battle tank on the road, gun trained on the threat ----
function drawTank(g,cx,dir,L,now,firing){
  var X=cx|0, Y=HORIZON+LANE[dir>0?1:2].o;
  g.fillStyle=L>0.5?"#5a6048":"#23271a"; g.fillRect(X,Y,9,3);                        // hull
  g.fillStyle=L>0.5?"#4a5040":"#1c2016"; g.fillRect(X+2,Y-2,4,2);                    // turret
  g.fillStyle=L>0.5?"#3a3f30":"#141810"; g.fillRect(X+(dir>0?6:-3),Y-1,3,1);         // barrel
  for(var tw=X;tw<X+9;tw+=2){ g.fillStyle="#0c0e08"; g.fillRect(tw,Y+3,1,1); }        // treads
  if(firing&&(Math.floor(now/220))%3===0){ g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,230,150,0.95)"; g.fillRect(X+(dir>0?9:-6),Y-1,3,2); g.globalCompositeOperation="source-over"; }
}
// ---- the city's coordinated response: tanks, jets, barricade + troops, searchlights, EMS ----
function drawMilitaryResponse(g,cd,L,now){
  var f=cd.f; if(f<0.10||f>=0.50) return;                       // fights during strike + aftermath
  var cx=disX(cd.x), n=1+cd.intensity;
  // sandbag barricade + soldiers on the near side
  for(var side=-1;side<=1;side+=2){ var bxp=cx+side*(14+(cd.w>>1));
    if(bxp>-8&&bxp<SW+8){ g.fillStyle=L>0.5?"#8a7a4a":"#3a3218"; g.fillRect(bxp-3,HORIZON-1,6,2);   // sandbags
      for(var so=0;so<2+cd.intensity;so++){ var sxp=bxp-3+so*2;   // more troops manning the line at higher CAT
        drawPerson(g,sxp,HORIZON-1,"#4a5038",SKINC[(cd.seed+so)%SKINC.length],(Math.floor(now/120)+so)&1);
        if((Math.floor(now/70)+so)%2===0){ g.fillStyle="#ffe27a"; g.fillRect((sxp+(side>0?-1:2))|0,HORIZON-1,1,1);} } } }
  // tanks rolling toward the threat, firing (a whole armoured column at CAT-5)
  for(var t=0;t<Math.min(6,cd.intensity+1);t++){ var tdir=(t&1)?1:-1, tx=cx-tdir*(20+t*12);
    drawTank(g,tx,tdir,L,now,true);
    if((Math.floor(now/220)+t)%3===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,120,0.5)"; // shell arc
      var ax=tx+tdir*(9), pr=((now%600)/600); g.fillRect((ax+tdir*pr*18)|0,(HORIZON-2-Math.sin(pr*Math.PI)*10)|0,1,1);
      g.globalCompositeOperation="source-over"; } }
  // fighter jets strafing overhead (a full squadron at high CAT)
  for(var j=0;j<1+cd.intensity;j++){ var jdir=(j&1)?-1:1, speed=0.09+j*0.02,
      jx=disX(wrapW(cd.x + jdir*(((now*speed)%220)-110))), jy=28+j*7;
    if(jx>-8&&jx<SW+8) drawJetPass(g,jx,jy,jdir,L,now,Math.abs(jx-cx)<40); }
  // searchlights at night sweeping the threat
  if(L<0.45){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,225,255,0.06)";
    for(var s2=-1;s2<=1;s2+=2){ var slx=cx+s2*22; g.beginPath(); g.moveTo(slx,HORIZON);
      g.lineTo(cx-6+Math.sin(now*0.001)*4,30); g.lineTo(cx+6+Math.sin(now*0.001)*4,30); g.closePath(); g.fill(); }
    g.globalCompositeOperation="source-over"; }
  // emergency services on scene
  drawEmv(g, cd.x-cd.w, EMV_TYPES[2], 1, 3, L, now);
  drawEmv(g, cd.x+cd.w, EMV_TYPES[1], -1, 3, L, now);
}

// ==== the five threats ====
function drawAsteroid(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity, big=(i-1)/4;
  // ---- the shower: more & bigger streaks at higher CAT (CAT1≈4 rocks … CAT5≈12) ----
  var nrocks=2+i*2;
  for(var k=0;k<nrocks;k++){ var kf=f-(k*0.012), impactAt=0.15;
    if(kf<0||kf>impactAt) continue;
    var prog=kf/impactAt, fromX=cx+90-k*16, fromY=-12, tx=cx+(k-nrocks/2)*(5+big*3), ty=HORIZON-6;
    var mx=fromX+(tx-fromX)*prog, my=fromY+(ty-fromY)*prog, sz=1+((i+k)%3);
    g.globalCompositeOperation="lighter";                          // fiery trail
    for(var tr=0;tr<12;tr++){ var tp=prog-tr*0.018; if(tp<0) break;
      var trx=fromX+(tx-fromX)*tp, tryy=fromY+(ty-fromY)*tp;
      g.fillStyle="rgba(255,"+(110+tr*10)+",40,"+(0.55*(1-tr/12))+")"; g.fillRect(trx|0,tryy|0,sz+1,sz+1); }
    g.globalCompositeOperation="source-over";
    g.fillStyle="#3a2418"; g.fillRect(mx|0,my|0,sz+1,sz+1); g.fillStyle="#ff8a2a"; g.fillRect(mx|0,my|0,sz,1);
  }
  if(f>=0.11&&f<0.19){ var sp=(f-0.11)/0.08, R=Math.min(52,sp*(28+big*36));   // shower impact flashes + shockwave ring
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,240,190,"+(0.85*(1-sp))+")";
    g.fillRect((cx-6)|0,HORIZON-8,12,8);
    g.strokeStyle="rgba(255,200,120,"+(0.65*(1-sp))+")"; g.lineWidth=1; g.beginPath();
    g.arc(cx,HORIZON,R,Math.PI,2*Math.PI); g.stroke(); g.globalCompositeOperation="source-over"; }
  // ---- CAT-4/5 CITY-KILLER: one colossal impactor falls, then DETONATES (freeze-safe: all radii hard-clamped, big draws gated to short windows) ----
  if(i>=4){
    if(f<0.13){ var prog2=Math.min(1,f/0.13), bR=4+i, bxp=cx+64-prog2*64, byp=-16+(HORIZON+2)*prog2;
      g.globalCompositeOperation="lighter";
      for(var tt=0;tt<18;tt++){ var tp2=prog2-tt*0.02; if(tp2<0) break; var trx2=cx+64-tp2*64, try2=-16+(HORIZON+2)*tp2;
        g.fillStyle="rgba(255,"+(90+tt*6)+",30,"+(0.7*(1-tt/18))+")"; g.fillRect((trx2-bR/2)|0,(try2-bR/2)|0,bR,bR); }
      g.globalCompositeOperation="source-over";
      g.fillStyle="#4a2a18"; g.fillRect((bxp-bR/2)|0,(byp-bR/2)|0,bR,bR); g.fillStyle="#ffb84a"; g.fillRect((bxp-bR/2)|0,(byp-bR/2)|0,bR,2);
    } else if(f<0.30){ var bp=(f-0.13)/0.17;                       // DETONATION
      var flashA=Math.max(0,1-bp*3.2);                             // whole-sky flash — very brief
      if(flashA>0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,250,220,"+(flashA*0.85)+")"; g.fillRect(0,0,SW,HORIZON); g.globalCompositeOperation="source-over"; }
      var R2=Math.min(WW*0.5, bp*(WW*0.55));                       // HARD-CLAMPED shockwave ring
      g.globalCompositeOperation="lighter"; g.strokeStyle="rgba(255,180,90,"+(0.7*(1-bp))+")"; g.lineWidth=2; g.beginPath(); g.arc(cx,HORIZON,R2,Math.PI,2*Math.PI); g.stroke();
      g.strokeStyle="rgba(255,240,180,"+(0.5*(1-bp))+")"; g.lineWidth=1; g.beginPath(); g.arc(cx,HORIZON,R2*0.68,Math.PI,2*Math.PI); g.stroke();
      var fbH=Math.min(HORIZON-4, bp*(40+i*10)), fbY=HORIZON-fbH;  // rising fireball / mushroom stem
      g.fillStyle="rgba(255,"+((120-bp*60)|0)+",40,"+(0.6*(1-bp*0.7))+")"; g.fillRect((cx-8-bp*6)|0,fbY|0,(16+bp*12)|0,fbH|0);
      g.fillStyle="rgba(255,200,90,"+(0.5*(1-bp))+")"; g.fillRect((cx-5)|0,fbY|0,10,(fbH*0.5)|0);
      g.globalCompositeOperation="source-over";
      drawSmoke(g,cx,fbY,1,now,i+4);
    }
  }
}
function drawVolcano(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity, big=(i-1)/4; if(f>=0.50) return;
  var grow=Math.min(1,f/0.14), coneH=(16+i*7)*grow, coneW=28+i*10, gy=HORIZON, craterY=gy-coneH;   // a proper cone (not as wide as the whole footprint)
  // hellish red sky glow above the volcano
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,70,20,"+(0.10+0.05*Math.sin(now*0.015))+")";
  g.fillRect((cx-coneW)|0,(craterY-28)|0,(coneW*2)|0,coneH+28); g.globalCompositeOperation="source-over";
  // cone body with ember-lit slopes so it reads against the sky
  for(var y=0;y<coneH;y++){ var ww=coneW*(1-y/coneH*0.66); g.fillStyle=L>0.5?"#5a4636":"#2a1e18";
    g.fillRect((cx-ww/2)|0,(gy-y)|0,ww|0,1); }
  g.globalCompositeOperation="lighter";
  for(var sl=0;sl<coneH;sl+=1){ var sww=coneW*(1-sl/coneH*0.66);        // glowing lava veins down both slopes
    g.fillStyle="rgba(255,"+(70+sl*2%90)+",20,0.6)";
    g.fillRect((cx-sww/2+((now/160+sl)%3))|0,(gy-sl)|0,1,1); g.fillRect((cx+sww/2-1-((now/140+sl)%3))|0,(gy-sl)|0,1,1); }
  // big bright lava fountain (taller at higher CAT)
  for(var lv=0;lv<16+i*6;lv++){ var la=(now*0.035+lv*29)%64, lx=cx+Math.sin(lv*1.3)*(la*0.22)*(lv&1?1:-1),
      ly=craterY-Math.sin(la/64*Math.PI)*(20+i*6);
    g.fillStyle="rgba(255,"+(120+lv%90)+",30,"+(0.9*(1-la/64))+")"; g.fillRect(lx|0,ly|0,2,2); }
  for(var th=0;th<coneH*0.7;th++){ g.fillStyle="rgba(255,"+((100+th*3)|0)+",25,"+(0.55*(1-th/(coneH*0.7))).toFixed(3)+")"; g.fillRect((cx-1)|0,(craterY+th)|0,3,1); }  // glowing lava throat down the cone
  g.fillStyle="rgba(255,180,70,1)"; g.fillRect((cx-coneW/4)|0,(craterY-1)|0,(coneW/2)|0,3);   // white-hot crater
  g.globalCompositeOperation="source-over";
  // ---- LAVA RIVERS creep out along the street in both directions (reach scales with CAT) ----
  if(f>0.12){ var flow=Math.min(1,(f-0.12)/0.22), reach=(18+i*22)*flow;
    g.globalCompositeOperation="lighter";
    for(var side=-1;side<=1;side+=2){ for(var lr=0;lr<reach;lr++){ var rx=cx+side*(coneW*0.3+lr), a=0.7*(1-lr/reach);
      var glow=(Math.sin(lr*0.4+now*0.01)*0.5+0.5);
      g.fillStyle="rgba(255,"+((70+glow*100)|0)+",20,"+a.toFixed(3)+")"; g.fillRect(rx|0,gy-1,1,2);
      if((lr+((now/120)|0))%4===0){ g.fillStyle="rgba(255,220,120,"+a.toFixed(3)+")"; g.fillRect(rx|0,gy-1,1,1); } } }   // bright crust cracks
    g.globalCompositeOperation="source-over"; }
  // ---- ASHFALL raining down over the skyline ----
  var ashSpan=coneW*2+i*30;
  for(var ah=0;ah<Math.round(20+i*10);ah++){ var axp=cx-ashSpan/2+((ah*53+now*0.02)%ashSpan), ayp=((ah*ah*7+now*0.05)%(gy-4));
    g.fillStyle="rgba("+(40+ah%14)+","+(38+ah%12)+","+(40+ah%12)+","+(0.30+0.2*big).toFixed(3)+")"; g.fillRect(axp|0,ayp|0,1,1+(ah%2)); }
  drawSmoke(g,cx,craterY-2,1,now,i+3);                               // thick ash plume
  // ---- PYROCLASTIC BLAST at the peak (CAT-4/5): a fast dark cloud rolls out & buries the block — radius HARD-CLAMPED ----
  if(i>=4 && f>0.24 && f<0.44){ var pb=(f-0.24)/0.20, PR=Math.min(WW*0.42, pb*(WW*0.5));
    for(var side2=-1;side2<=1;side2+=2){ for(var pc=0;pc<10;pc++){ var pr2=PR*(0.4+pc*0.07), pcx=cx+side2*pr2,
        pch=(coneH*0.7)*(1-pc/12)*(0.6+0.4*Math.sin(pc+now*0.01)), pa=0.5*(1-pb)*(1-pc/12); if(pa<=0.02) continue;
      g.fillStyle="rgba("+(60+pc*3)+","+(52+pc*2)+","+(54+pc*2)+","+pa.toFixed(3)+")"; g.fillRect((pcx-3)|0,(gy-pch)|0,6,pch|0); } }
  }
}
function drawZombies(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f<0.06||f>=0.50) return;
  var spread=Math.min(1,(f-0.06)/0.30);                                  // the infection GROWS through the strike
  var reach=(38+i*14)*(0.5+0.5*spread), horde=Math.round((10+i*6)*(0.5+0.7*spread));
  // eerie green miasma drifting over the street
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(90,215,80,"+(0.12+0.05*Math.sin(now*0.01))+")";
  g.fillRect((cx-reach)|0,HORIZON-18,(reach*2)|0,20); g.globalCompositeOperation="source-over";
  // fleeing civilians at the LEADING EDGE — some caught mid-conversion (the plague spreads)
  for(var side=-1;side<=1;side+=2){ var edge=cx+side*reach;
    for(var fp=0;fp<3;fp++){ var fpx=edge+side*(4+fp*6), turning=(((fp+((now/300)|0))%3)===0)&&spread>0.3;
      if(fpx<-3||fpx>SW+3) continue;
      if(turning){ g.fillStyle="#8a9a55"; g.fillRect(fpx|0,HORIZON-3,2,1); g.fillStyle="#6a7a40"; g.fillRect(fpx|0,HORIZON-2,2,2);   // half-turned, going green
        g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,255,90,0.4)"; g.fillRect(fpx|0,HORIZON-3,1,1); g.globalCompositeOperation="source-over"; }
      else { drawPerson(g,fpx|0,HORIZON-1,PEDC[(fp*5+side+2)%PEDC.length],SKINC[fp%SKINC.length],((now/120|0)+fp)&1);   // still human, fleeing
        g.fillStyle="#ffe27a"; g.fillRect(fpx|0,HORIZON-4,1,1); } }                    // arms thrown up in panic
  }
  // the shambling horde
  for(var z=0;z<horde;z++){ var side2=(z&1)?1:-1, phase=(((now*0.004+z*0.37)%1)),
      zx=cx+side2*reach*(0.12+phase*0.8), fall=(((z*97+(Math.floor(now/1400)))%14)===0);
    if(zx<-3||zx>SW+3) continue; var zy=HORIZON-1, bob=((Math.floor(now/150))+z)&1;
    if(fall){ g.fillStyle="#3a5a2a"; g.fillRect(zx|0,zy+1,3,1); }                       // downed
    else { g.fillStyle="#7aa845"; g.fillRect(zx|0,(zy-1-bob)|0,2,1);                    // head (sickly green)
      g.fillStyle="#5a8a30"; g.fillRect(zx|0,(zy-bob)|0,2,2);                           // torso+legs
      g.fillStyle="#8ac050"; g.fillRect((zx+(side2>0?-1:2))|0,(zy-bob)|0,1,1);          // outstretched arm
      if((z%4)===0){ g.fillStyle="#7a2020"; g.fillRect((zx+(side2>0?-1:2))|0,(zy-bob+1)|0,1,1); }   // bloodied claw
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,255,90,0.5)"; g.fillRect(zx|0,(zy-1-bob)|0,1,1); // glowing eye
      g.globalCompositeOperation="source-over"; }
  }
}
function drawAliens(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var descend=Math.min(1,f/0.10), leave=(f>0.42)?(f-0.42)/0.08:0;
  var harvest=(f>=0.12&&f<0.28), raze=(f>=0.26&&f<0.44);
  // ---- CAT-5 MOTHERSHIP: a vast dark hull shadowing the whole skyline ----
  if(i>=5){ var mY=2+descend*10-leave*24, mW=Math.min(SW+40,120+cd.w*2);
    g.fillStyle=L>0.5?"#20272f":"#0c1016"; g.fillRect((cx-mW/2)|0,mY|0,mW|0,6);
    g.fillStyle=L>0.5?"#2a333d":"#10151c"; g.fillRect((cx-mW/2)|0,(mY+6)|0,mW|0,2);
    g.globalCompositeOperation="lighter";
    for(var ml=0;ml<mW;ml+=4){ g.fillStyle=(((Math.floor(now/200))+ml)&1)?"rgba(120,255,200,0.6)":"rgba(255,120,220,0.5)"; g.fillRect((cx-mW/2+ml)|0,(mY+8)|0,1,1); }
    g.globalCompositeOperation="source-over"; }
  // ---- the raiding saucers (fleet grows with CAT) ----
  var nships=1+(i>>1);                                             // CAT1-2:1 · CAT3-4:2-3 · CAT5:3
  for(var s=0;s<nships;s++){ var scx=cx+(s-(nships-1)/2)*(cd.w*0.7+14), shipY=8+descend*16-leave*30+(s&1?3:0), shipW=9+i*2;
    if(scx<-shipW||scx>SW+shipW) continue;
    g.fillStyle=L>0.5?"#3a4a5a":"#1a2430"; g.fillRect((scx-shipW/2)|0,shipY|0,shipW,3);         // saucer hull
    g.fillStyle=L>0.5?"#5a6a7a":"#26303c"; g.fillRect((scx-shipW/4)|0,(shipY-2)|0,(shipW/2)|0,2); // dome
    g.globalCompositeOperation="lighter";
    for(var lp=0;lp<shipW;lp+=2){ g.fillStyle=(((Math.floor(now/120))+lp)&1)?"#5affd0":"#ff5ad0"; g.fillRect((scx-shipW/2+lp)|0,(shipY+3)|0,1,1); } // running lights
    g.fillStyle="rgba(120,255,200,"+(0.7+0.2*Math.sin(now*0.01))+")"; g.fillRect((scx-shipW/4)|0,(shipY-2)|0,(shipW/2)|0,1);
    // HARVEST: a soft tractor cone lifting cars/people/rubble up into the ship
    if(harvest){ var bw=cd.w*0.5;
      g.fillStyle="rgba(120,255,180,"+(0.14+0.08*Math.sin(now*0.02))+")";
      g.beginPath(); g.moveTo(scx-2,shipY+3); g.lineTo(scx-bw/2,HORIZON); g.lineTo(scx+bw/2,HORIZON); g.lineTo(scx+2,shipY+3); g.closePath(); g.fill();
      for(var ab=0;ab<3;ab++){ var ay=HORIZON-(((now*0.05+ab*40+s*20)%(HORIZON-shipY-6))), axx=scx+Math.sin(ay*0.1+ab)*2, kind=(ab+s)%3;
        g.fillStyle=kind===0?"#b0553f":(kind===1?"#5a6a7a":"#4a4a52"); g.fillRect(axx|0,ay|0,kind===0?3:2,2); }   // abducted silhouettes rising
      g.globalCompositeOperation="source-over";
    }
    // RAZE: a hard bright death-ray slagging the ground
    if(raze){ g.globalCompositeOperation="lighter";
      if((((Math.floor(now/160))+s)%2)===0){ g.fillStyle="rgba(180,255,220,0.85)"; g.fillRect((scx-1)|0,(shipY+3)|0,2,(HORIZON-shipY-3)|0);
        g.fillStyle="rgba(255,255,255,0.9)"; g.fillRect(scx|0,(HORIZON-4)|0,1,4); g.fillStyle="rgba(120,255,180,0.5)"; g.fillRect((scx-3)|0,HORIZON-3,6,3); } }
    g.globalCompositeOperation="source-over";
  }
}
function drawKaiju(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f; if(f>=0.50) return;
  var i=cd.intensity, rise=Math.min(1,f/0.10), retreat=(f>0.40)?(f-0.40)/0.10:0;
  var fought=(f>0.12&&f<0.44), hurt=fought&&((Math.floor(now/650))%3===0);            // the city shoots back — it flinches (this beast can be REPELLED, unlike the finale)
  var H=Math.round((22+i*8)*rise*(1-retreat*0.9)), gy=HORIZON, top=gy-H,
      BX=cx+(cd.w>>1)-1, sway=Math.round(Math.sin(now*0.002)*2)+(hurt?Math.round(Math.sin(now*0.03)*2):0)+(retreat>0?Math.round(retreat*4):0), X0=(BX+sway)|0, W=11+i,
      breathDir=(cx<BX)?-1:1, body=L>0.5?"#2c3a2a":"#1b2a1c", dark=L>0.5?"#1e2a1d":"#0e1710";
  // backlight halo so the beast reads against the night sky
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,70,170,0.16)"; g.fillRect(X0-5,(top-8)|0,W+10,(H+8)|0);
  g.globalCompositeOperation="source-over";
  var neckY=top+7, hipY=gy-Math.round(H*0.34);
  g.fillStyle=body;
  g.fillRect(X0+1,neckY,W-2,hipY-neckY);                                 // torso
  g.fillRect(X0+2,top+3,W-4,5);                                          // neck
  g.fillRect(X0+(breathDir<0?0:2),top,6,5);                             // head/snout (juts toward the city)
  g.fillRect(X0+2,hipY,3,gy-hipY); g.fillRect(X0+W-5,hipY,3,gy-hipY);    // two legs straddling the block
  g.fillRect(X0-1,neckY+2,2,7); g.fillRect(X0+W-1,neckY+2,2,7);          // arms
  // sweeping tail out the back
  for(var tl=0;tl<10;tl++){ var txp=X0+(breathDir<0?W+tl:-1-tl), typ=hipY+2+Math.round(Math.sin(tl*0.5)*2);
    g.fillStyle=dark; g.fillRect(txp|0,typ|0,2,2); }
  // dorsal fins (neon-tipped), rim light, eyes — all additive so they glow
  g.globalCompositeOperation="lighter";
  for(var sp=0;sp<hipY-neckY;sp+=3){ g.fillStyle="rgba(150,235,255,0.8)"; g.fillRect((X0+(W>>1))|0,(neckY+sp)|0,1,2); }
  g.fillStyle="rgba(90,225,255,0.6)"; g.fillRect(X0,top,1,H);            // cyan rim (left)
  g.fillStyle="rgba(255,90,200,0.6)"; g.fillRect(X0+W-1,top,1,H);       // magenta rim (right)
  g.fillStyle="rgba(255,70,50,1)"; g.fillRect(X0+(breathDir<0?1:3),top+1,1,1); g.fillRect(X0+(breathDir<0?3:5),top+1,1,1); // eyes
  if((Math.floor(now/240))%3===0){                                              // atomic breath — a bright cyan beam
    for(var br=0;br<20;br++){ var bxp=X0+(breathDir<0?-1-br:W+br);
      g.fillStyle="rgba("+(170-br*4)+",240,255,"+(0.9*(1-br/20))+")"; g.fillRect(bxp|0,(top+1)|0,1,3); } }
  if(hurt){ for(var hs=0;hs<4;hs++){ var hx=X0+((hs*7+((now/90)|0))%W), hy=neckY+((hs*11+((now/70)|0))%Math.max(1,hipY-neckY));
    g.fillStyle="rgba(255,180,80,0.9)"; g.fillRect(hx|0,hy|0,1,1); } }                 // tank/jet hits sparking off its hide
  g.globalCompositeOperation="source-over";
  if((Math.floor(now/380))%2===0){ g.fillStyle="rgba(120,120,130,0.4)"; g.fillRect(X0-3,gy-1,W+6,1); }   // stomp dust at its feet
  if(rise>0.5&&(Math.floor(now/500))%2===0){ g.strokeStyle="rgba(255,255,255,0.22)"; g.lineWidth=1;   // roar shockwave
    g.beginPath(); g.arc(X0+(W>>1),top+2,12+((now%500)/500)*18,0,2*Math.PI); g.stroke(); }
}
function drawTornado(g,cd,L,now){
  var cx0=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var grow=Math.min(1,f/0.10), fade=(f>0.40)?1-(f-0.40)/0.10:1, gy=HORIZON, H=(gy-8)*grow;
  var wander=Math.sin(now*0.0006+cd.seed)*(14+i*8)+Math.sin(now*0.0013+cd.seed*1.7)*(6+i*3), cx=cx0+wander;   // the funnel ROAMS across the district
  var widthK=cd.w+i*6;                                                  // CAT-5 = a broad wedge
  for(var y=0;y<H;y++){ var wob=Math.sin(now*0.006+y*0.15)*(3+y*0.06), wdt=3+(y/H)*(widthK*1.2), mx=cx+wob;
    g.globalAlpha=fade*(0.55+0.3*Math.sin(now*0.02+y)); g.fillStyle=L>0.5?"#5c5c66":"#22222c";
    g.fillRect((mx-wdt/2)|0,(gy-y)|0,(wdt)|0,1);
    if((y+(Math.floor(now/40)))%3===0){ g.fillStyle="rgba(200,200,210,0.6)"; g.fillRect((mx-wdt/2)|0,(gy-y)|0,1,1); g.fillRect((mx+wdt/2-1)|0,(gy-y)|0,1,1); } }
  g.globalAlpha=1;
  for(var d=0;d<12+i*3;d++){ var a=now*0.011+d*0.55, dx=cx+Math.cos(a)*(widthK*0.8), dy=gy-2-Math.abs(Math.sin(a))*(9+i*2);
    g.fillStyle=["#5a4a30","#4a4a52","#6a5a3a","#7a4a4a"][d%4]; g.fillRect(dx|0,dy|0,2,2); }
  // HURLED debris flung out on tangents — cars, signs, torn roof sheets
  for(var h=0;h<3+(i>>1);h++){ var hp=((now*0.0009+h*0.33+cd.seed)%1), ang=h*2.1+cd.seed, dist=hp*(40+i*14),
      hx=cx+Math.cos(ang)*dist, hy=gy-4-Math.sin(hp*Math.PI)*(20+i*8)-hp*10, spin=(Math.floor(now/80)+h)&1;
    if(hx<-4||hx>SW+4) continue; var kind=h%3;
    if(kind===0){ g.fillStyle="#b0553f"; g.fillRect(hx|0,hy|0,spin?3:2,spin?2:3); g.fillStyle="#2a2a30"; g.fillRect(hx|0,(hy+1)|0,1,1); }   // tumbling car
    else if(kind===1){ g.fillStyle="#c83030"; g.fillRect(hx|0,hy|0,2,1); g.fillStyle="#8a8a92"; g.fillRect(hx|0,(hy+1)|0,1,2); }            // ripped sign
    else { g.fillStyle=L>0.5?"#6a5a4a":"#2a241c"; g.fillRect(hx|0,hy|0,spin?4:2,spin?1:2); } }                                             // roof sheet
  g.fillStyle="rgba(120,110,100,"+(0.42*fade)+")"; g.fillRect((cx-widthK*1.4)|0,gy-3,(widthK*2.8)|0,3);   // dust skirt tracks the funnel
}
function drawFlood(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var walled=cityHasBuild("seawall"), blunt=walled?0.5:1;                    // a voted SEAWALL halves the surge — the flood you can watch it hold back
  var gy=HORIZON, dir=(cd.seed&1)?1:-1, waveH=(20+i*8)*blunt, zL=(cx-cd.w*1.4)|0, zR=(cx+cd.w*1.4)|0;
  if(walled){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(210,235,255,0.6)";   // spray bursting where the wave slams the seawall and is turned back
    for(var sp=0;sp<10;sp++){ var spx=cx-dir*(cd.w*0.9)+((sp*5+now*0.03)%20)-10, spy=gy-14-((sp*3+(now/90|0))%12); g.fillRect(spx|0,spy|0,1,1); }
    g.globalCompositeOperation="source-over"; }
  // ---- APPROACH: a dark wall of water rushes in from the coast side, then breaks over the block ----
  if(f<0.18){ var ap=Math.max(0,(f-0.06)/0.12), frontX=cx-dir*(cd.w*1.7)*(1-ap), wh=waveH*(0.4+0.6*ap);
    var bx0=dir>0?zL:frontX, bx1=dir>0?frontX:zR;                     // water already surging in behind the front
    if(bx1>bx0){ for(var wy=0;wy<wh*0.5;wy++){ g.fillStyle=L>0.5?"rgba(50,100,140,0.7)":"rgba(20,48,82,0.8)"; g.fillRect(bx0|0,gy-wy,(bx1-bx0)|0,1); } }
    for(var wy2=0;wy2<wh;wy2++){ var lean=dir*Math.sin(wy2*0.16)*3; g.fillStyle=L>0.5?"rgba(45,92,132,0.85)":"rgba(18,44,78,0.9)"; g.fillRect((frontX+lean-1)|0,(gy-wy2)|0,3,1); }  // curling wave wall
    g.fillStyle="rgba(220,240,255,0.9)"; for(var cf=0;cf<wh;cf+=2){ g.fillRect((frontX+dir*Math.sin(cf*0.4)*3)|0,(gy-cf)|0,2,1); }   // foaming crest
    return;
  }
  // ---- FLOOD → RECEDE: the block sits submerged, then the water drains back to the sea ----
  var rise=Math.min(1,(f-0.16)/0.10), recede=(f>0.38)?(f-0.38)/0.12:0, level=Math.round(waveH*rise*(1-recede));
  if(level>9){ var cby=gy-Math.round(level*0.42)+Math.round(Math.sin(now*0.004)*1); drawCar(g,(cx-5)|0,cby,"#b0553f",1,L); }  // half-submerged car bobbing
  for(var wy3=0;wy3<level;wy3++){ var yy=gy-wy3;
    g.fillStyle=L>0.5?"rgba(60,110,150,0.72)":"rgba(24,54,90,0.78)";
    for(var wx=zL;wx<zR;wx++){ var surf=Math.sin(wx*0.3+now*0.006)*1.5; if(wy3>level-2+surf) continue; g.fillRect(wx,yy,1,1); } }
  g.fillStyle="rgba(200,225,245,0.5)"; for(var sx=zL;sx<zR;sx+=3){ var sy=gy-level+Math.sin(sx*0.3+now*0.006)*1.5; g.fillRect(sx,sy|0,2,1); }
  for(var d=0;d<4+i;d++){ var dx=zL+((d*30+now*0.02)%Math.max(1,(zR-zL))), dy=gy-level+Math.sin(dx*0.3+now*0.006)*1.5;
    g.fillStyle=["#7a5a3a","#4a4a52","#c8b48a"][d%3]; g.fillRect(dx|0,(dy-1)|0,3,2); }
}
// one walker: team>0 = enemy invader (red optic), team<0 = city defender (blue optic). returns its top-y.
function drawOneMech(g,mx,gy,H,team,stompPhase,body,dark){
  var top=(gy-H)|0, torsoH=Math.round(H*0.42), hipY=top+torsoH, legH=H-torsoH, stomp=stompPhase&1;
  g.fillStyle=body; g.fillRect(mx-5,hipY,3,legH-(stomp?2:0)); g.fillRect(mx+2,hipY,3,legH-(stomp?0:2));   // reverse-knee legs
  g.fillStyle=dark; g.fillRect(mx-6,gy-2,5,2); g.fillRect(mx+2,gy-2,5,2);                                 // splayed feet
  g.fillStyle=dark; g.fillRect(mx-4,hipY-2,8,3);                                                          // hips
  g.fillStyle=body; g.fillRect(mx-4,top+3,8,torsoH); g.fillStyle=dark; g.fillRect(mx-4,top+3,8,1);        // chassis
  g.fillStyle=body; g.fillRect(mx-6,top+2,2,4); g.fillRect(mx+4,top+2,2,4);                               // shoulder cannons
  g.fillStyle=dark; g.fillRect(mx-2,top,4,4);                                                             // cockpit head
  g.globalCompositeOperation="lighter"; g.fillStyle=team>0?"#ff5a5a":"#5aa8ff"; g.fillRect(mx-1,top+1,2,2); g.globalCompositeOperation="source-over";  // optic
  if(stomp){ g.fillStyle="rgba(120,120,130,0.4)"; g.fillRect(mx-7,gy-1,14,1); }                           // stomp dust
  return top;
}
function drawMech(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity, gy=HORIZON; if(f>=0.50) return;
  var body=L>0.5?"#5a5f6a":"#20242c", dark=L>0.5?"#3f434c":"#141820", adv=Math.min(1,f/0.14);
  var nEnemy=1+(i>>1), nDef=1+((i-1)>>2);                          // the city is OUTNUMBERED at high CAT (enemies scale faster)
  // ENEMY INVADERS stride in from the right, cannons blazing toward the city
  for(var e=0;e<nEnemy;e++){ var ex=(cx+(cd.w*0.9+14+e*16)*(1.35-0.35*adv))|0, H=30+i*4-e*3, top=drawOneMech(g,ex,gy,H,1,(Math.floor(now/380)+e),body,dark);
    if(((Math.floor(now/110))+e)%2===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,90,0.9)";
      for(var b=0;b<(ex-cx)+cd.w;b+=3) g.fillRect((ex-b)|0,(top+4)|0,2,1); g.globalCompositeOperation="source-over"; } }
  // CITY DEFENDER mechs hold the left flank, returning fire (allied blue)
  for(var c=0;c<nDef;c++){ var dxp=(cx-(cd.w*0.9+16+c*16))|0, H2=28+i*3, top2=drawOneMech(g,dxp,gy,H2,-1,(Math.floor(now/420)+c),body,dark);
    if(((Math.floor(now/130))+c)%2===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,200,255,0.9)";
      for(var b2=0;b2<(cx-dxp)+cd.w;b2+=3) g.fillRect((dxp+b2)|0,(top2+4)|0,2,1); g.globalCompositeOperation="source-over"; } }
  if((Math.floor(now/200))%2===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,200,120,0.85)"; g.fillRect((cx-4)|0,gy-12,8,7); g.globalCompositeOperation="source-over"; }   // crossfire impact at the front line
}
function drawKraken(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var rise=Math.min(1,f/0.12), retreat=(f>0.40)?(f-0.40)/0.10:0, amp=(1-retreat)*rise, gy=HORIZON,
      tcol=L>0.5?"#3a5a4a":"#16302a", nt=4+i*2, spread=cd.w*0.5+i*4;
  // a glimpse of the beast's mantle & baleful eyes rising between the arms (CAT-3+)
  if(i>=3){ var mH=(14+i*5)*amp, mY=gy-mH; g.fillStyle=L>0.5?"#2e4a3e":"#123028"; g.fillRect((cx-6)|0,mY|0,12,mH|0);
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,90,"+(0.7+0.2*Math.sin(now*0.02))+")"; g.fillRect((cx-3)|0,(mY+3)|0,2,2); g.fillRect((cx+2)|0,(mY+3)|0,2,2);
    g.globalCompositeOperation="source-over"; }
  for(var t=0;t<nt;t++){ var base=cx+(t-(nt-1)/2)*(spread*2/nt), H=(26+i*9)*amp*(0.6+0.4*Math.sin(t*1.3+cd.seed)), grab=(((t+((now/500)|0))%3)===0);
    for(var y=0;y<H;y++){ var yn=y/H, curl=Math.sin(y*0.16+now*0.004+t)*(y*0.16)+(grab?Math.sin(yn*Math.PI)*yn*8:0), w=Math.max(1,5-yn*3), mx=base+curl;
      g.fillStyle=tcol; g.fillRect((mx-w/2)|0,(gy-y)|0,(w+1)|0,1);
      if(y%3===0){ g.fillStyle="#8ac0a0"; g.fillRect((mx-w/2)|0,(gy-y)|0,1,1); } }   // pale suckers up the underside (a curling arm GRABS)
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(220,90,130,0.6)"; g.fillRect((base-1)|0,(gy-H)|0,3,2); g.globalCompositeOperation="source-over"; }  // glowing tip
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,200,255,0.32)"; g.fillRect((cx-cd.w*1.3)|0,gy-3,(cd.w*2.6)|0,3);   // churned foam
  for(var fs=0;fs<8;fs++){ var fsx=cx+((fs*37+now*0.05)%(cd.w*2.4))-cd.w*1.2; g.fillStyle="rgba(200,235,255,0.4)"; g.fillRect(fsx|0,gy-3-((fs*13+now*0.06)%4),1,1); }
  g.globalCompositeOperation="source-over";
}
// A rolling haboob: layered billowing dust sheets sweeping across, an ochre sky-veil that dims
// the buildings behind it, fast ground-level saltation streaks, and a piling drift at grade.
function drawSandstorm(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var inten=Math.min(1,f/0.10)*((f>0.40)?1-(f-0.40)/0.10:1); if(inten<=0) return;
  var w=cd.w*2.4+i*40, x0=cx-w/2, x1=cx+w/2; if(x1<-8||x0>SW+8) return;   // a WIDER wall at higher CAT
  var day=L>0.45, windR=((cd.x|0)&1)?1:-1;                       // which way the wall rolls
  var base=day?[208,164,96]:[122,96,54], lite=day?[234,198,132]:[152,120,70], core=day?[150,110,56]:[86,64,36];
  var maxH=(40+i*22)+90*inten, topY=(HORIZON-maxH)|0;             // TOWERING — a CAT-5 haboob swallows the whole skyline
  // ochre atmosphere over the storm span — a muddy veil that dims the skyline behind the dust
  for(var sx=Math.max(0,x0|0); sx<Math.min(SW,x1|0); sx++){
    var dxl=(sx-x0)/w, eff=1; if(dxl<0.14)eff=dxl/0.14; else if(dxl>0.86)eff=(1-dxl)/0.14; if(eff<0)eff=0;
    g.fillStyle=rgba(base,0.22*inten*eff); g.fillRect(sx,topY,1,maxH+4);
  }
  // billowing dust sheets, back→front: each a lumpy rolling top drifting with the wind
  var sheets=[[0.95,0.24,core,0.006],[0.74,0.34,base,0.010],[0.54,0.44,lite,0.015],[0.34,0.56,lite,0.021]];
  for(var s=0;s<sheets.length;s++){ var hf=sheets[s][0], a=sheets[s][1]*inten, col=sheets[s][2], spd=sheets[s][3];
    g.fillStyle=rgba(col,a);
    for(var bx=x0|0; bx<x1; bx+=2){ if(bx<-2||bx>SW+2) continue;
      var dx2=(bx-x0)/w, ef2=1; if(dx2<0.10)ef2=dx2/0.10; else if(dx2>0.90)ef2=(1-dx2)/0.10; if(ef2<0)ef2=0;
      var ph=bx*0.05 - now*spd*windR;
      var lump=Math.sin(ph)*0.5+Math.sin(ph*2.3+s)*0.30+Math.sin(ph*0.5+s*2)*0.24;
      var h=(maxH*hf*(0.5+0.5*lump))*ef2; if(h<2) continue;
      g.fillRect(bx,(HORIZON-h)|0,2,(h+4)|0);
    }
  }
  // dense choking band along the lower third — the thickest part of the wall, nearly opaque
  var bandH=Math.round(maxH*0.4);
  for(var cx2=Math.max(0,x0|0); cx2<Math.min(SW,x1|0); cx2+=2){
    var dx3=(cx2-x0)/w, ef3=1; if(dx3<0.12)ef3=dx3/0.12; else if(dx3>0.88)ef3=(1-dx3)/0.12; if(ef3<0)ef3=0;
    var wob=2+Math.sin(cx2*0.09-now*0.012*windR)*2;
    g.fillStyle=rgba(base,0.5*inten*ef3); g.fillRect(cx2,(HORIZON-bandH-wob)|0,2,(bandH+wob+4)|0);
  }
  // fast saltation streaks — dense & bright near the ground, sparse motes higher up (denser at higher CAT)
  var N=Math.round((60+i*20)*inten);
  for(var d=0;d<N;d++){
    var t=(d*61 + now*0.55)%w, px=x0 + (windR>0? t : w-t);
    var py=HORIZON-1-((d*d*7+d*13)%Math.round(maxH*0.92));
    if(px<-4||px>SW+4) continue;
    var slen=2+(d%3), la=(py>HORIZON-14?0.75:0.38)*inten;
    g.fillStyle=rgba(lite,la); g.fillRect((px-(windR>0?slen:0))|0,py|0,slen,1);
  }
  // DUNE DRIFTS piling along the ground — lumpy, growing dunes rather than a flat line
  var dl=Math.max(0,x0)|0, dr=Math.min(SW,x1)|0, duneMax=4+i*3;
  if(dr>dl){ for(var dx=dl;dx<dr;dx++){ var dn=(Math.sin(dx*0.05+cd.seed)*0.5+0.5)*(Math.sin(dx*0.13)*0.3+0.7),
    dh=Math.round(duneMax*inten*dn)+1; g.fillStyle=rgba(core,0.55*inten); g.fillRect(dx,HORIZON-dh+2,1,dh+2); } }
}
function drawIceAge(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var freeze=Math.min(1,f/0.16), shatter=(f>0.40)?(f-0.40)/0.10:0, gy=HORIZON;
  var reach=(cd.w+i*10)*(0.4+0.6*freeze), zL=(cx-reach)|0, zR=(cx+reach)|0, hgt=40+i*10;   // a FLASH FREEZE that races across the whole district
  if(shatter<1){ var gl=freeze*(1-shatter);
    g.fillStyle="rgba(150,205,240,"+(0.28*gl).toFixed(3)+")"; g.fillRect(zL,gy-hgt,(zR-zL)|0,hgt);                        // ice glaze creeping up over the skyline
    g.fillStyle="rgba(185,225,250,"+(0.22*gl).toFixed(3)+")"; g.fillRect(zL,gy-Math.round(hgt*0.5),(zR-zL)|0,Math.round(hgt*0.5));  // thicker low glaze
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(220,245,255,"+(0.6*freeze*(1-freeze)).toFixed(3)+")";       // bright leading frost edges racing outward
    g.fillRect(zL,gy-hgt,2,hgt); g.fillRect(zR-2,gy-hgt,2,hgt); g.globalCompositeOperation="source-over";
    g.fillStyle="rgba(225,245,255,"+(0.8*gl).toFixed(3)+")"; for(var ic=zL;ic<zR;ic+=4){ var il=3+((ic*7)%7); g.fillRect(ic|0,(gy-hgt)|0,1,il); }   // icicles from the frost line
    for(var ic2=zL;ic2<zR;ic2+=5){ var il2=2+((ic2*5)%5); g.fillStyle="rgba(235,250,255,"+(0.7*gl).toFixed(3)+")"; g.fillRect(ic2|0,(gy-il2-1)|0,1,il2); }  // icicles at street level
    for(var fc=0;fc<Math.round(14+i*6);fc++){ var fx=zL+((fc*53)%Math.max(1,(zR-zL))), fy=gy-6-((fc*29)%hgt); g.fillStyle="rgba(255,255,255,"+(0.75*gl).toFixed(3)+")"; g.fillRect(fx|0,fy|0,1,1); }   // frost sparkle
    for(var sn=0;sn<Math.round(20+i*8);sn++){ var sxp=zL+((sn*37+now*0.03)%Math.max(1,(zR-zL))), syp=((sn*sn*5+now*0.06)%hgt); g.fillStyle="rgba(240,250,255,"+(0.55*gl).toFixed(3)+")"; g.fillRect(sxp|0,(gy-syp)|0,1,1); }   // driving snow
    g.fillStyle="rgba(235,248,255,"+(0.7*gl).toFixed(3)+")"; g.fillRect(zL,gy-1,(zR-zL)|0,2+(i>>1));    // snow piling on the ground
  }
  if(shatter>0){ for(var sh=0;sh<Math.round(22+i*6);sh++){ var a=sh*0.3, sx=cx+Math.cos(a)*shatter*(30+i*8), sy=(gy-16)-Math.sin(a)*shatter*(22+i*4);
    g.fillStyle="rgba(205,238,255,"+(1-shatter).toFixed(3)+")"; g.fillRect(sx|0,sy|0,2,2); } }                          // the thaw shatters it into shards
}
function drawRift(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.50) return;
  var open=Math.min(1,f/0.12), close=(f>0.40)?(f-0.40)/0.10:0, R=(8+i*4)*open*(1-close), cy2=HORIZON-20;   // a wider tear at higher CAT
  g.globalCompositeOperation="lighter";
  for(var ring=0;ring<3;ring++){ g.strokeStyle="rgba("+(150-ring*30)+",80,225,"+(0.5*(1-ring*0.3))+")"; g.lineWidth=1;
    g.beginPath(); g.arc(cx,cy2,R+ring*2+Math.sin(now*0.02)*1,0,2*Math.PI); g.stroke(); }
  g.globalCompositeOperation="source-over";
  g.fillStyle="#0a0512"; g.beginPath(); g.arc(cx,cy2,Math.max(1,R),0,2*Math.PI); g.fill();
  g.globalCompositeOperation="lighter";
  for(var p=0;p<16;p++){ var a=now*0.02+p*0.42, rr=R+4+(p%5)*3, px=cx+Math.cos(a)*rr, py=cy2+Math.sin(a)*rr*0.7;
    g.fillStyle="rgba(195,120,255,0.85)"; g.fillRect(px|0,py|0,1,1); }
  g.globalCompositeOperation="source-over";
  // ---- VOID CREATURES pour out of the tear, descend to the street & spread (count scales with CAT) ----
  var ncr=Math.round((3+i*3)*open);
  for(var cr=0;cr<ncr;cr++){ var em=((now*0.0006+cr*0.211+cd.seed)%1), side=(cr&1)?1:-1;   // em 0=at the portal → 1=on the ground, spread out
    var crx=cx+side*em*(cd.w*0.7+i*6)*0.7, cry=cy2+em*(HORIZON-cy2); if(cry>HORIZON) cry=HORIZON;
    g.fillStyle=L>0.5?"#1a1024":"#0a0612"; g.fillRect(crx|0,(cry-2)|0,3,2);                 // shadow body
    g.fillStyle="rgba(60,20,90,0.7)"; g.fillRect(crx|0,cry|0,1,1); g.fillRect((crx+2)|0,cry|0,1,1);   // wispy legs
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(200,90,255,0.95)"; g.fillRect(crx|0,(cry-2)|0,1,1); g.fillRect((crx+2)|0,(cry-2)|0,1,1); g.globalCompositeOperation="source-over"; }  // glowing violet eyes
}
// CITYWIDE ATMOSPHERE — even a single-block catastrophe should feel like it's swallowing the sky.
// A wide, soft, centre-weighted wash in the threat's signature colour, over sky AND skyline. Luminous
// threats (fire/energy) glow ADDITIVELY (and harder at night); murky ones (storm/flood/plague) MULTIPLY
// the sky darker. Width & strength scale with CAT rating, and it fades in/out with the strike phase.
// [r,g,b, mode]  mode 1 = additive glow (luminous colour) · 0 = gloom (a DARK tint laid over the sky to
// darken+colour it, no "multiply" op needed — Qt Canvas support for that is spotty). sandstorm skips this
// (it draws its own ochre veil).
var DIS_ATMO={ volcano:[255,74,22,1], asteroid:[255,120,40,1], alien:[120,255,190,1], rift:[178,86,255,1],
  kaiju:[150,90,220,1], mech:[255,150,90,1], kraken:[70,196,164,1], iceage:[176,226,255,1],
  zombie:[18,44,14,0], flood:[10,28,50,0], tornado:[20,20,28,0] };
function drawDisasterAtmosphere(g,cd,L,now){
  var a=DIS_ATMO[cd.type]; if(!a) return;
  var f=cd.f; if(f<0.06||f>=0.50) return;
  var ramp=(f<0.12)?(f-0.06)/0.06:((f>0.40)?(0.50-f)/0.10:1); if(ramp<=0) return;   // fade in on strike, out into aftermath
  var lum=(a[3]===1), cx=disX(cd.x);
  var span=90+cd.intensity*62;                                                       // world-px half-width, wider at higher CAT
  if(cx+span<0||cx-span>SW) return;
  var night=1-L, pulse=1+0.14*Math.sin(now*0.02);
  var peak=(lum?(0.10+0.11*night):0.10+0.055*cd.intensity)*ramp*(lum?(0.62+0.09*cd.intensity):1)*pulse;   // glows bite harder in the dark; gloom scales with CAT
  g.globalCompositeOperation="lighter";
  if(!lum) g.globalCompositeOperation="source-over";
  var x0=Math.max(0,(cx-span)|0), x1=Math.min(SW,(cx+span)|0);
  for(var sx=x0;sx<x1;sx++){ var d=Math.abs(sx-cx)/span, fall=0.5+0.5*Math.cos(d*Math.PI);   // cosine bell falloff
    var al=peak*fall; if(al<=0.004) continue;
    g.fillStyle="rgba("+a[0]+","+a[1]+","+a[2]+","+(al<1?al:1).toFixed(3)+")";
    g.fillRect(sx,0,1,HORIZON); }
  g.globalCompositeOperation="source-over";
}
// BLACKOUT: the power grid fails — a swathe of the skyline goes dark (windows out), a few candles &
// emergency lights survive, and now and then the grid surges and tries to flicker back on.
function drawBlackout(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.55) return;
  var inten=Math.min(1,f/0.10)*((f>0.42)?1-(f-0.42)/0.13:1); if(inten<=0) return;
  var cascade=Math.min(1,f/0.18);                                  // the outage CASCADES district by district
  var w=(cd.w*2.2+60+i*50)*(0.45+0.55*cascade), x0=Math.max(0,(cx-w/2)|0), x1=Math.min(SW,(cx+w/2)|0); if(x1<=x0) return;
  var surge=((Math.floor(now/1100)%8)===0);                    // brief grid surges try to restore power
  for(var sx=x0;sx<x1;sx++){ var d=Math.abs(sx-cx)/(w/2), fall=d>=1?0:(0.5+0.5*Math.cos(d*Math.PI));
    g.fillStyle="rgba(4,5,11,"+(0.66*inten*fall*(surge?0.45:1)).toFixed(3)+")"; g.fillRect(sx,0,1,HORIZON+6); }
  g.globalCompositeOperation="lighter";
  for(var c2=0;c2<20;c2++){ var hh=((c2*2654435761+cd.seed)>>>0), lx=x0+(hh%Math.max(1,(x1-x0)|0));
    if(lx<0||lx>SW) continue; var ly=HORIZON-4-((hh>>8)%42);
    if(((Math.floor(now/500)+c2)%3)!==0){ g.fillStyle="rgba(255,178,80,"+(0.55*inten)+")"; g.fillRect(lx|0,ly|0,1,1); } }  // surviving candles/EM lights
  // LOOTER trash-fires & sweeping flashlights along the dark street (night)
  if(L<0.5){ for(var lf=0;lf<Math.round(2+i);lf++){ var lfx=x0+((lf*163+cd.seed)%Math.max(1,(x1-x0))), flick=((Math.floor(now/160)+lf)%4)<2;
      g.fillStyle="rgba(255,120,40,"+((flick?0.7:0.45)*inten).toFixed(3)+")"; g.fillRect(lfx|0,HORIZON-2,1,2);
      g.fillStyle="rgba(255,90,20,0.30)"; g.fillRect((lfx-1)|0,HORIZON-3,3,3);
      var beamx=lfx+8+Math.sin(now*0.003+lf)*10; g.fillStyle="rgba(220,235,255,"+(0.18*inten).toFixed(3)+")"; g.fillRect(beamx|0,HORIZON-6,2,6); } }  // flashlight beam
  if(surge){ g.fillStyle="rgba(120,150,255,"+(0.09*inten)+")"; g.fillRect(x0,0,x1-x0,HORIZON); }                          // whole-grid surge flash
  g.globalCompositeOperation="source-over";
}
// SMOG: a choking brown inversion settles over the district (worse in economic busts) — a muddy veil
// that dims the skyline, thickest at street level, with drifting soot.
function drawSmog(g,cd,L,now){
  var cx=disX(cd.x), f=cd.f, i=cd.intensity; if(f>=0.55) return;
  var inten=Math.min(1,f/0.12)*((f>0.42)?1-(f-0.42)/0.13:1); if(inten<=0) return;
  var w=cd.w*2.8+100+i*40, x0=Math.max(0,(cx-w/2)|0), x1=Math.min(SW,(cx+w/2)|0); if(x1<=x0) return;
  var day=L>0.4, base=day?[150,120,66]:[64,54,34], streetH=26+i*8;
  for(var sx=x0;sx<x1;sx++){ var d=Math.abs(sx-cx)/(w/2), fall=d>=1?0:(0.5+0.5*Math.cos(d*Math.PI));
    g.fillStyle="rgba("+base[0]+","+base[1]+","+base[2]+","+((0.16+0.04*i)*inten*fall).toFixed(3)+")"; g.fillRect(sx,0,1,HORIZON);              // thicker haze veil nearly hides the towers
    g.fillStyle="rgba("+base[0]+","+base[1]+","+base[2]+","+((0.30+0.05*i)*inten*fall).toFixed(3)+")"; g.fillRect(sx,HORIZON-streetH,1,streetH+4); }  // taller/denser at street level
  for(var m=0;m<Math.round(40+i*12);m++){ var mx=x0+((m*53+now*0.03)%Math.max(1,(x1-x0))), my=HORIZON-2-((m*m*7+m*13)%Math.round(30+44*inten));
    g.fillStyle="rgba("+(base[0]-34)+","+(base[1]-30)+","+(base[2]-18)+","+(0.4*inten).toFixed(3)+")"; g.fillRect(mx|0,my|0,2,1); }               // drifting soot motes
  // MASKED residents shuffling through the murk, some with blinking hazard lights
  var np=2+i;
  for(var p=0;p<np;p++){ var pw=x0+((p*197+cd.seed)%Math.max(1,(x1-x0))); if(pw<-2||pw>SW+2) continue;
    drawPerson(g,pw|0,HORIZON-1,day?"#6a6458":"#3a3830",SKINC[p%SKINC.length],((now/140|0)+p)&1);
    g.fillStyle="rgba(230,235,240,"+(0.6*inten).toFixed(3)+")"; g.fillRect(pw|0,HORIZON-3,1,1);                                  // white mask
    if((p&1)&&((Math.floor(now/300)+p)%2===0)){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,180,40,"+(0.8*inten).toFixed(3)+")"; g.fillRect((pw+2)|0,HORIZON-2,1,1); g.globalCompositeOperation="source-over"; } }  // hazard flasher
}
// lingering scars on a REBUILT block: scorch at the base + (for the worst disasters) a small memorial plaque
function drawRebuiltScars(g,X,w,rbz,L,now){
  var gy=HORIZON;
  g.fillStyle="rgba(22,17,19,0.5)"; g.fillRect(X-2,gy-1,w+4,1);                       // scorched grade line
  for(var s=0;s<w;s+=2){ if(((s*7+rbz.seed)%3)===0){ g.fillStyle="rgba(20,16,18,0.4)"; g.fillRect(X+s,gy-2-((s*5)%2),1,2); } }  // soot streaks up the base
  if(rbz.intensity>=3){                                                               // a memorial to the worst events
    var mx=X+(w>>1)-1;
    g.fillStyle=L>0.5?"#6a6f7a":"#2a2e38"; g.fillRect(mx,gy-3,3,3);                    // memorial stone
    g.fillStyle=L>0.5?"#c9a23a":"#8a6a20"; g.fillRect(mx,gy-3,3,1);                    // brass dedication plate
    if(L<0.6){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,210,120,0.45)"; g.fillRect(mx,gy-4,3,1); g.globalCompositeOperation="source-over"; }  // eternal flame
  }
}
// VICTORY BEAT: when the city WINS, the aftermath is a celebration — a cheering crowd + confetti sparks.
function drawVictoryBeat(g,cd,L,now){
  if(cd.win===false || cd.f<0.34 || cd.f>=0.56) return;
  var cx=disX(cd.x); if(cx<-30||cx>SW+30) return;
  for(var p=0;p<6;p++){ var px=cx-14+p*5, cheer=((Math.floor(now/200)+p)&1);
    drawPerson(g,px,HORIZON-1,PEDC[(p*3)%PEDC.length],SKINC[p%SKINC.length],cheer);
    if(cheer){ g.fillStyle="#ffe27a"; g.fillRect(px,HORIZON-4,1,1); } }                // raised arms
  g.globalCompositeOperation="lighter";
  for(var s=0;s<12;s++){ var t=(now*0.03+s*38)%52, sx=cx-16+((s*97)%34), sy=HORIZON-4-t*0.5;
    g.fillStyle="rgba(255,"+(170+s%70)+",90,"+(0.7*(1-t/52))+")"; g.fillRect(sx|0,sy|0,1,1); }   // confetti / sparks
  g.globalCompositeOperation="source-over";
}
function drawDisaster(g,cd,L,now){
  drawDisasterAtmosphere(g,cd,L,now);        // the sky itself reacts before any sprite is drawn
  // a general catastrophe glow over the whole block, so the emergency reads at any zoom (skip the veil threats)
  if(cd.f>=0.10&&cd.f<0.50 && cd.type!=="blackout" && cd.type!=="smog"){ var gx=disX(cd.x);
    if(gx>-50&&gx<SW+50){ g.globalCompositeOperation="lighter";
      var GLOW={alien:[110,255,180],zombie:[90,225,90],volcano:[255,120,30],flood:[70,150,220],
        kraken:[80,200,160],sandstorm:[200,160,90],iceage:[150,215,255],rift:[170,90,255],mech:[255,140,90]};
      var gc=GLOW[cd.type]||[255,95,45];
      g.fillStyle=rgba(gc,0.12+0.06*Math.sin(now*0.02)); g.fillRect((gx-cd.w)|0,HORIZON-46,(cd.w*2)|0,50);
      g.globalCompositeOperation="source-over"; } }
  if(cd.type==="asteroid") drawAsteroid(g,cd,L,now);
  else if(cd.type==="volcano") drawVolcano(g,cd,L,now);
  else if(cd.type==="zombie") drawZombies(g,cd,L,now);
  else if(cd.type==="alien") drawAliens(g,cd,L,now);
  else if(cd.type==="kaiju") drawKaiju(g,cd,L,now);
  else if(cd.type==="tornado") drawTornado(g,cd,L,now);
  else if(cd.type==="flood") drawFlood(g,cd,L,now);
  else if(cd.type==="mech") drawMech(g,cd,L,now);
  else if(cd.type==="kraken") drawKraken(g,cd,L,now);
  else if(cd.type==="sandstorm") drawSandstorm(g,cd,L,now);
  else if(cd.type==="iceage") drawIceAge(g,cd,L,now);
  else if(cd.type==="rift") drawRift(g,cd,L,now);
  else if(cd.type==="blackout") drawBlackout(g,cd,L,now);
  else if(cd.type==="smog") drawSmog(g,cd,L,now);
  if(disDestroys(cd.type)){ drawMilitaryResponse(g,cd,L,now); drawVictoryBeat(g,cd,L,now); }   // no tanks/jets fight a power cut or an inversion layer
}
// ---- emergency HUD: flashing alert bar + intensity rating, world-anchored over the impact ----
function drawDisasterHud(g,cd,now){
  var f=cd.f, msg, col;
  if(f<0.10){ msg="WARNING"; col="rgba(255,210,40,"; }
  else if(f<0.50){ msg=(cd.win===false&&f>0.30)?"DEFENSES OVERRUN":("CAT-"+cd.intensity+" "+DIS_NAME[cd.type]);
    col=(cd.win===false&&f>0.30)?"rgba(255,40,80,":(cd.intensity>=4?"rgba(255,50,40,":(cd.intensity>=3?"rgba(255,120,30,":"rgba(255,190,40,")); }
  else if(cd.ruin){ msg="DISTRICT LOST"; col="rgba(255,40,60,"; }   // a lost CAT-5 — no rebuild, the block is dead for good
  else if(f<0.95){ msg="REBUILDING"; col="rgba(90,200,255,"; }
  else { msg=DIS_NAME[cd.type]+" CLEARED"; col="rgba(90,230,140,"; }
  var blink=(Math.floor(now/220))%2, a=(f<0.50?(0.55+0.45*blink):0.9);
  var tw=textW(msg), tx=Math.round(cd.x-tw/2), ty=notifLane(0);   // lane 1 (pref): sits below the 3-line sky-clock pill
  // backing bar (world-anchored, wraps)
  for(var wp=-1;wp<=1;wp++){ var px=tx-3-WOFF+wp*WW; if(px+tw+6<-2||px>SW+2) continue;
    g.fillStyle="rgba(10,8,14,0.7)"; g.fillRect(px|0,ty-2,tw+6,9);
    g.fillStyle=col+(0.8*a)+")"; g.fillRect(px|0,ty-3,tw+6,1); g.fillRect(px|0,ty+6,tw+6,1); }
  drawPixText(g,msg,tx,ty,col+a+")",1);
  // intensity pips under the bar during the active phase
  if(f<0.50){ for(var ip=0;ip<5;ip++){ var lit=ip<cd.intensity;
    for(var wp2=-1;wp2<=1;wp2++){ var ppx=(cd.x-8+ip*4)-WOFF+wp2*WW; if(ppx<-2||ppx>SW+2) continue;
      g.fillStyle=lit?(col+a+")"):"rgba(80,80,90,0.6)"; g.fillRect(ppx|0,ty+9,3,2); } } }
  drawBattleBars(g,cd,now,ty);
}

// MONSTER vs CITY health bars — for creature attacks you can now SEE who is winning.
// Purely deterministic from the disaster phase + its predetermined outcome (cd.win), so
// every screen shows the same fight. Curves: during the STRIKE window the loser's bar
// drains hard; the winner's is scratched proportionally to CAT. A small clock-seeded
// wobble makes the exchange feel live without storing any state.
var DIS_MONSTER={zombie:1,alien:1,kaiju:1,mech:1,kraken:1,rift:1};
function drawBattleBars(g,cd,now,ty){
  if(!DIS_MONSTER[cd.type] || cd.f<0.10 || cd.f>=0.50) return;
  var p=Math.max(0,Math.min(1,(cd.f-0.10)/0.26));            // fight progress through STRIKE
  var iK=cd.intensity, wob=Math.sin(now/240+cd.seed)*0.025;  // live jitter
  var mHP, cHP;
  if(cd.win!==false){ mHP=1-p; cHP=1-p*(0.12+iK*0.07); }     // city repels it: monster drains
  else { mHP=1-p*0.45; cHP=1-p*(0.55+iK*0.06); }             // defenses overrun: city drains
  mHP=Math.max(0,Math.min(1,mHP+wob)); cHP=Math.max(0,Math.min(1,cHP-wob));
  var rows=[[DIS_NAME[cd.type],mHP,[255,64,96]],["CITY",cHP,null]];   // city colour by health below
  var BW=34, LX=cd.x-24, y0=ty+13;
  for(var ri=0;ri<rows.length;ri++){ var lab=rows[ri][0], hp=rows[ri][1], rc=rows[ri][2];
    if(!rc) rc=hp>0.5?[80,230,130]:(hp>0.25?[255,190,50]:[255,70,60]);   // city: green→amber→red
    var y=y0+ri*7;
    for(var wp3=-1;wp3<=1;wp3++){ var bx=LX-WOFF+wp3*WW; if(bx+BW+30<-2||bx>SW+2) continue;
      drawPixText(g,lab,bx,y,"rgba(235,240,255,0.92)",1);
      var brx=(bx+textW(lab)+3)|0;
      g.fillStyle="rgba(8,8,14,0.78)"; g.fillRect(brx-1,y-1,BW+2,5);                       // backing
      g.fillStyle="rgba(120,120,140,0.5)"; g.fillRect(brx-1,y-1,BW+2,1); g.fillRect(brx-1,y+3,BW+2,1);
      g.fillStyle="rgba("+rc[0]+","+rc[1]+","+rc[2]+",0.95)";
      g.fillRect(brx,y,Math.max(0,Math.round(BW*hp)),3);                                   // health fill
      if(hp>0&&hp<1){ g.fillStyle="rgba(255,255,255,0.55)"; g.fillRect(brx+Math.round(BW*hp)-1,y,1,3); } // hit edge
    }
  }
}

// ============================================================================
//  CITY GROWTH — the whole city is alive on a ~1-month "grand cycle": it grows
//  from bare wilderness → village → town → city → METROPOLIS, thrives, then a
//  cataclysm levels it and it starts over. Deterministic from the clock so every
//  screen grows in lock-step. cityG (0..1 maturity) gates every subsystem; each
//  building has a birth age (b.bAge) and rises as a construction site when due.
// ============================================================================
var GROW_CYCLE=cycleMs(CFG.cycle);   // life length. Config cycle: "1w"/"2w"/"3w"/"1mo" (or "weekly") / "test"=1 hour. See cycleMs() near the top.
var GROW_EPOCH=1783972450746;          // TEST MODE reset 2026-07-13 ~16:xx — set so cy≈0.88 at deploy (apocalypse ~4.5 min after restart, life 0 = alien war), then a new life every hour
var GROW_OFFSET_DAYS=0;                // ►► FAST-FORWARD KNOB: bump this to jump ahead N days into the city's life.
// RESTART-THE-WORLD (user-triggered): config stores the CLICK TIMESTAMP + mode; every screen
// derives the exact same phase shift from it, so the whole desktop ends/restarts in lockstep
// and the state survives reboots (still a pure function of clock + shared config).
var WORLD_SHIFT=0;
function worldShiftFrom(at,mode){
  if(!at||!isFinite(+at)) return 0;
  var target=(mode==="fresh")?0.0005:0.9555;                         // fresh = reborn wilderness; apoc = the finale begins
  var base=(((+at)-GROW_EPOCH+GROW_OFFSET_DAYS*86400000)%GROW_CYCLE+GROW_CYCLE)%GROW_CYCLE;
  return target*GROW_CYCLE-base;
}
if(CFG.worldRestartAt) WORLD_SHIFT=worldShiftFrom(CFG.worldRestartAt, CFG.worldRestartMode);
                                       //    ~0=newborn wilderness, ~6=village, ~12=growing city, ~20=near-metropolis, ~24=peak metropolis.
var GROWBAND=0.03;                     // how much of the cycle a building spends "under construction" (base, before workforce)
var laborK=1;                          // WORKFORCE → BUILD SPEED: a bigger population raises towers faster (set per-frame in draw)
function bandOf(b){ return (b.band||GROWBAND)*laborK; }   // a building's effective construction duration, scaled by the labour pool
var ARRIVE=0.012;                      // cityG when the founding caravan reaches the townsite (people FIRST, then buildings)
var FORCEAGE=null;                     // test hook: a number 0..1, or a {g,phase,apoc} object
function cityGrowth(now){
  if(FORCEAGE!=null){ if(typeof FORCEAGE==="number") return {g:FORCEAGE, phase:(FORCEAGE>=1?"peak":"grow"), apoc:0, cy:FORCEAGE*0.78}; return FORCEAGE; }
  var cy=((((now-GROW_EPOCH+GROW_OFFSET_DAYS*86400000+WORLD_SHIFT)%GROW_CYCLE)+GROW_CYCLE)%GROW_CYCLE)/GROW_CYCLE;   // 0..1 through the life
  if(cy<0.78) return {g:cy/0.78, phase:"grow", apoc:0, cy:cy};                // wilderness → metropolis
  if(cy<0.955) return {g:1, phase:"peak", apoc:0, cy:cy};                     // the thriving metropolis
  return {g:1, phase:"apoc", apoc:(cy-0.955)/0.045, cy:cy};                   // the cataclysm, then wraps to wilderness
}
// REINCARNATION: every life the city rebuilds in a different architectural age. The DNA is generated
// once, so the era is applied as a render-time material/palette transform in drawLayer.
// THE THEME LIBRARY — every life hash-picks one of these looks for its whole civilization.
// win may be a single colour or an ARRAY (windows then vary per-window, e.g. stained glass).
var ERAS=[
  {name:"cyber",     tint:null,          blend:0,    neon:true,  win:null,                              glow:null,          gardens:false},  // magenta/cyan neon (life 0 = the city you know)
  {name:"ancient",   tint:[196,168,120], blend:0.72, neon:false, win:"#ffcf7a",                         glow:[255,208,138], gardens:false},  // sandstone temples, warm lamplight
  {name:"brutal",    tint:[120,122,130], blend:0.72, neon:false, win:"#c8ccd6",                         glow:[198,204,220], gardens:false},  // raw concrete
  {name:"solar",     tint:[150,192,150], blend:0.62, neon:false, win:"#eaf6c0",                         glow:[188,230,150], gardens:true },  // green-glass solarpunk
  {name:"vaporwave", tint:[255,120,200], blend:0.18, neon:true,  win:null,                              glow:null,          gardens:false},  // pink-washed neon
  {name:"steampunk", tint:[150,105,60],  blend:0.72, neon:false, win:"#ffb84a",                         glow:[255,170,80],  gardens:false},  // brass, copper & gaslight
  {name:"gothic",    tint:[70,62,88],    blend:0.75, neon:false, win:["#c9a9ff","#ffd27a","#a9c9ff"],   glow:[180,150,255], gardens:false},  // spired stone, stained glass
  {name:"noir",      tint:[96,98,104],   blend:0.85, neon:false, win:"#e8ecf4",                         glow:[220,226,238], gardens:false},  // b&w film city
  {name:"adobe",     tint:[200,140,92],  blend:0.72, neon:false, win:"#ffd9a0",                         glow:[255,190,120], gardens:false},  // desert terracotta
  {name:"arctic",    tint:[170,200,225], blend:0.72, neon:false, win:"#cfe8ff",                         glow:[170,215,255], gardens:false},  // ice & pale steel
  {name:"jade",      tint:[90,160,120],  blend:0.68, neon:false, win:"#c0ffd8",                         glow:[130,230,170], gardens:true },  // carved jade dynasty
  {name:"lantern",   tint:[150,55,50],   blend:0.70, neon:false, win:["#ffcf7a","#ff8a5a","#ffd9a0"],   glow:[255,120,80],  gardens:false},  // crimson lantern district
  {name:"gilded",    tint:[190,160,80],  blend:0.68, neon:false, win:"#fff0b0",                         glow:[255,220,120], gardens:false},  // imperial gold
  {name:"porcelain", tint:[210,216,225], blend:0.76, neon:false, win:"#9ac8ff",                         glow:[150,200,255], gardens:false},  // white china & cobalt
  {name:"obsidian",  tint:[40,34,40],    blend:0.68, neon:false, win:["#ff7a3a","#ffb84a"],             glow:[255,120,50],  gardens:false},  // black glass over embers
  {name:"coral",     tint:[235,145,130], blend:0.64, neon:false, win:"#b0f0e8",                         glow:[120,230,215], gardens:true },  // reef pinks & aqua
  {name:"midnight",  tint:[60,70,100],   blend:0.68, neon:false, win:"#dfe8ff",                         glow:[190,205,255], gardens:false},  // blue steel & silver
  {name:"rustbelt",  tint:[140,90,60],   blend:0.72, neon:false, win:"#ffc890",                         glow:[230,160,100], gardens:false},  // corrugated copper rust
  {name:"candy",     tint:[235,190,215], blend:0.64, neon:false, win:["#ff9ad0","#9adfff","#fff0a0"],   glow:[255,170,220], gardens:false},  // pastel confection
  {name:"emeraldneon",tint:[60,180,120], blend:0.25, neon:true,  win:null,                              glow:null,          gardens:false},  // green-tinted neon
  {name:"amberneon", tint:[230,160,60],  blend:0.22, neon:true,  win:null,                              glow:null,          gardens:false},  // sodium-amber neon
  {name:"ivory",     tint:[225,220,200], blend:0.72, neon:false, win:"#ffe9b0",                         glow:[255,225,150], gardens:true },  // white marble garden city
  {name:"deepsea",   tint:[40,80,110],   blend:0.72, neon:false, win:"#7adfff",                         glow:[90,200,255],  gardens:false},  // drowned-light abyss blue
  // ---- real-city inspired ages (themed lives): Boston · NYC Art Deco · Houston · London ----
  {name:"boston",    tint:[150,78,58],   blend:0.60, neon:false, win:"#ffcf8a",                         glow:[255,180,110], gardens:false},  // Boston/NYC red-brick brownstone
  {name:"artdeco",   tint:[214,192,142], blend:0.55, neon:false, win:"#ffe6a0",                         glow:[255,214,140], gardens:false},  // NYC/Chicago Art Deco limestone & gold
  {name:"houston",   tint:[120,168,192], blend:0.42, neon:false, win:"#bfe3ff",                         glow:[150,210,255], gardens:false},  // Houston/modern blue-green glass
  {name:"london",    tint:[132,110,108], blend:0.52, neon:false, win:"#ffe0b0",                         glow:[232,200,150], gardens:false},  // London Georgian/Victorian brick & cream
  {name:"neworleans",tint:[224,176,142], blend:0.44, neon:false, win:["#ffcf8a","#ffe0a0","#c0f0d0"],   glow:[255,196,120], gardens:true },  // New Orleans French Quarter — Creole pastels, iron galleries, gas lamps
  {name:"paris",     tint:[224,212,188], blend:0.55, neon:false, win:"#ffeec0",                         glow:[255,226,160], gardens:false},  // Paris Haussmann — cream limestone, mansard roofs, iron balconies
  {name:"tokyo",     tint:[255,90,160],  blend:0.20, neon:true,  win:null,                              glow:null,          gardens:false},  // Tokyo — dense neon, tight towers, signage overload
  {name:"china",     tint:[178,66,58],   blend:0.46, neon:false, win:["#ffcf7a","#ff8a5a","#ffd9a0"],   glow:[255,140,90],  gardens:true }   // Chinese city — pagoda old-town + modern glass, red & gold, lanterns
];
var cityEra=ERAS[0];
var FORCEERA=null;   // test hook: index into ERAS (own line — multi-var declarations aren't writable via the QML import namespace)
// Config may pin the city to a themed era BY NAME ("auto"/absent = live evolving era).
if(CFG.era && CFG.era!=="auto"){ for(var _ei=0;_ei<ERAS.length;_ei++){ if(ERAS[_ei].name===CFG.era){ FORCEERA=_ei; break; } } }
function famOf(era){
  if(era==="cyber"||era==="vaporwave"||era==="emeraldneon"||era==="amberneon") return "neon";
  if(era==="ancient"||era==="adobe"||era==="gilded") return "ancient";
  if(era==="gothic"||era==="obsidian"||era==="noir"||era==="midnight") return "dark";
  if(era==="jade"||era==="lantern"||era==="porcelain") return "east";
  if(era==="rustbelt"||era==="brutal"||era==="steampunk") return "iron";
  if(era==="boston"||era==="london"||era==="artdeco"||era==="neworleans"||era==="paris") return "iron";   // masonry cities
  if(era==="houston") return "cold";                                   // glass & steel modern
  if(era==="tokyo") return "neon";
  if(era==="china") return "east";
  if(era==="arctic"||era==="deepsea") return "cold";
  if(era==="solar"||era==="ivory"||era==="coral"||era==="candy") return "bright";
  return "core";
}
var MASCOTS={ neon:["VOLTS","SPECTRES","BYTES","NEONS"], ancient:["SUNS","OBELISKS","LIONS","SPHINXES"],
  dark:["RAVENS","GARGOYLES","WRAITHS","BATS"], east:["DRAGONS","CRANES","KOI","TIGERS"],
  iron:["HAMMERS","PISTONS","FORGEMEN","SPARKS"], cold:["YETIS","ORCAS","GLACIERS","WOLVES"],
  bright:["GULLS","DOLPHINS","BLOOMS","RAYS"], core:["FOXES","BEARS","HAWKS","OTTERS"] };
function teamOf(li,era){
  var h=((li*2654435761+8887)>>>0), M=MASCOTS[famOf(era)];
  return M[h%M.length];
}
function nameOf(li,era){
  if(li===0) return "NEO NORWICH";                              // life zero honours home
  var h=((li*2654435761+331)>>>0), h2=(((h^(h>>>13))*2246822519)>>>0);
  var fam=famOf(era);
  var P={
    neon:[["NEO ","VOLT","HEX ","KURO","ZERO","CHROMA "],["KYRIA","GRID","SHINRA","NOVA","LUXE","VECTOR"]],
    ancient:[["SOL","TERRA","AURE","ZAR","KHEM"],["ARA","KESH","LIA","DUN","MARA"]],
    dark:[["RAVEN","ASH","GRIM","DUSK","ONYX"],["HOLLOW","MOOR","SPIRE","FELL","GATE"]],
    east:[["JADE ","LOTUS ","PEARL ","SILK ","CRANE "],["GATE","HARBOR","GARDEN","COURT","REACH"]],
    iron:[["IRON","FORGE","COAL","RUST","BOLT"],["HOLLOW","WORKS","FIELD","HAVEN","YARD"]],
    cold:[["FROST","NORTH","GLACIER","TIDE","STORM"],["HAVEN","WATCH","MERE","FJORD","POINT"]],
    bright:[["CORAL ","SUN","MEADOW","IVORY ","BLOOM"],["SHORE","VALE","CREST","HAVEN","BAY"]],
    core:[["NEW ","FAIR","GRAND ","EAST ","WEST "],["HAVEN","FORD","VIEW","BROOK","MONT"]]
  }[fam];
  var nm=P[0][h%P[0].length]+P[1][(h2>>>3)%P[1].length];
  if(hasOcean && ((h>>>7)&3)===0 && nm.indexOf("PORT")<0) nm="PORT "+nm;
  return nm;
}
function eraPickOf(ci){
  if(ci===0) return 0;                                          // life 0 stays the original cyberpunk city
  var h=((ci*2654435761+40503)>>>0); h^=h>>>13; h=(h*2246822519)>>>0; h=(h^(h>>>15))>>>0;   // KEEP UNSIGNED (^= gives signed int32!)
  var p=h%ERAS.length;
  var hp=(((ci-1)*2654435761+40503)>>>0); hp^=hp>>>13; hp=(hp*2246822519)>>>0; hp=(hp^(hp>>>15))>>>0;
  var prev=(ci-1===0)?0:(hp%ERAS.length);
  if(p===prev) p=(p+1)%ERAS.length;                             // never the same theme twice running
  return p;
}
function cityEraOf(now){
  if(FORCEERA!=null) return ERAS[FORCEERA];
  var ci=Math.floor((now-GROW_EPOCH+GROW_OFFSET_DAYS*86400000+WORLD_SHIFT)/GROW_CYCLE);   // which life is this?
  return ERAS[eraPickOf(ci)]||ERAS[0];
}
// ancient ruins of a fallen city, left standing in the wilderness for the next one to grow around
// THE ECONOMY: one or two slow swings per life. Booms brighten the town; busts darken storefronts.
function econOf(now){
  var li=lifeIndexOf(now), h=((li*2654435761+6673)>>>0);
  var waves=1+(h%2), ph4=((h>>>8)%628)/100;
  var cg2=cityGrowth(now);
  return 0.5+0.5*Math.sin(cg2.cy*Math.PI*2*waves+ph4);
}
// the living population: grows with the city, dips after disasters, crashes during the endtimes
var popCache={t:-1,v:0};
function cityPop(){
  var li=curLife||0, h=((li*2654435761+555)>>>0);
  // the census counts what actually STANDS: floor area of every born building
  var ck=Math.floor((NOWOVR!=null?NOWOVR:Date.now())/5000);
  if(popCache.t!==ck){ var sum=0, lays=[near,mid,far];
    var houses=0;
    for(var ly=0;ly<3;ly++){ if(!lays[ly]) continue; var bl=lays[ly].blds;
      for(var i2=0;i2<bl.length;i2++){ var b2=bl[i2];
        if(b2.type==="park"||b2.bAge===undefined) continue;
        var born2=cityG-b2.bAge;
        if(born2<=0){ if(cityG>=b2.houseAge) houses++; continue; }   // a standing house (plot not yet redeveloped)
        sum+=b2.w*b2.h*Math.min(1,born2/bandOf(b2)); } }
    popCache.t=ck; popCache.v=sum; popCache.h=houses; }
  var densK=(2.1+(h%140000)/140000*1.5)/KSP/KSP;               // persons per built cell at full density (trimmed for the taller buildings so the metropolis stays ~190k)
  // REALISM: a frontier village is low-rise — a handful of families per house — and only DENSIFIES
  // into stacked apartment towers as it matures. So the per-cell density ramps up with the city:
  // a few dozen souls in the first cabins, climbing to the metropolis' hundreds of thousands.
  var densRamp=Math.pow(Math.min(1,cityG/0.72),1.6);           // low-rise sprawl → dense high-rise (1.0 by cityG 0.72)
  var pop=popCache.v*densK*densRamp*(cityG>0?1:0)+(popCache.h||0)*4.5+Math.round(8+cityG*90);   // + a household per standing house + the folk on the open land
  if(cityG<ARRIVE) pop=0;                                      // nobody home before the caravan
  pop-=Math.min(pop*0.18, curRebuilt.length*4700);             // recent catastrophes take their toll (never erase a town)
  if(cityPhase==="apoc") pop*=Math.max(0,1-apocKill*1.05);     // the evacuation, live (a nuke empties it in seconds)
  if(curWar&&curWar.f>=0&&curWar.f<1.4) pop*=0.97;             // wartime losses
  return Math.max(0,Math.round(pop/10)*10);
}
function popFmt(n){ var t=""+n, o=""; while(t.length>3){ o=","+t.slice(-3)+o; t=t.slice(0,-3); } return t+o; }
// how much of the city is awake: lights climb through the evening, dim deep at night
function eveLit(hf){
  if(hf>=21&&hf<24) return 1;
  if(hf>=19) return 0.70+0.30*(hf-19)/2;
  if(hf>=17) return 0.35+0.35*(hf-17)/2;
  if(hf>=5)  return 0.30;
  if(hf>=2)  return 0.35;
  return 1-0.65*(hf/2);                                       // midnight → 2am: the city goes to sleep
}
function drawRuins(g,cg,L,now){
  if(cg>=0.5) return;                                       // buried once the new city covers them
  var wild=Math.min(1,(0.5-cg)/0.35), day=L>0.5, gy=HORIZON;
  var spots=[[0.28,0],[0.68,1],[0.46,2],[0.15,1],[0.57,0],[0.82,2]];   // the old world left MANY bones
  for(var s=0;s<spots.length;s++){ var rx=Math.round(spots[s][0]*WW)-WOFF, kind=spots[s][1];
    for(var wp=-1;wp<=1;wp++){ var X=(rx+wp*WW)|0; if(X<-16||X>SW+16) continue;
      g.globalAlpha=wild;
      var stone=day?"#8a8478":"#3a382f", moss=day?"#5a7048":"#243824";
      if(kind===0){ // a broken obelisk / cracked tower
        var h=18; g.fillStyle=stone; g.fillRect(X,gy-h,5,h); g.fillStyle=day?"#6a6458":"#2a2820"; g.fillRect(X+4,gy-h,1,h);
        g.fillStyle=(day?"#b8c8f0":"#0a0c14"); g.fillRect(X+1,gy-h+3,1,2); g.fillRect(X+3,gy-h+7,1,2);   // window holes
        g.fillStyle=day?"#7a7468":"#2f2d25"; g.fillRect(X-1,(gy-h-2)|0,3,3); g.fillRect(X+3,(gy-h-1)|0,3,2);  // broken jagged top
        g.fillStyle=moss; g.fillRect(X,gy-4,5,1); g.fillRect(X+1,gy-7,1,1);
        g.fillStyle=stone; g.fillRect(X-3,gy-2,11,2);        // rubble base
      } else if(kind===1){ // a ruined arch / gateway
        g.fillStyle=stone; g.fillRect(X,gy-14,3,14); g.fillRect(X+9,gy-14,3,14); g.fillRect(X,gy-16,7,2);   // one side of the lintel broken off
        g.fillStyle=moss; g.fillRect(X,gy-8,3,1); g.fillRect(X+9,gy-11,3,1);
        g.fillStyle=stone; for(var rb=0;rb<5;rb++){ g.fillRect((X+6+rb)|0,(gy-1-((rb*7)%3))|0,2,2); }        // fallen blocks
      } else { // toppled colonnade — a row of broken columns
        for(var cN=0;cN<4;cN++){ var ch=6+((cN*13)%9); g.fillStyle=stone; g.fillRect((X+cN*4)|0,gy-ch,2,ch);
          g.fillStyle=day?"#6a6458":"#2a2820"; g.fillRect((X+cN*4)|0,(gy-ch)|0,2,1); }                       // capitals
        g.fillStyle=stone; g.fillRect(X-1,gy-2,18,2); g.fillStyle=moss; g.fillRect(X+2,gy-3,1,1); g.fillRect(X+10,gy-2,1,1);
      }
      g.globalAlpha=1;
    }
  }
}
// a little pixel tree (trunk + layered canopy), seasonal-ish
// size class: most trees are normal, some are LARGE, a few are old-growth GIANTS
function treeSC(seed){ var h=((seed*40503+11)>>>0)%100;
  return h<58?1:(h<82?1.7:(h<96?2.5:3.4)); }
function drawTree(g,X,gy,day,now,seed,mul){
  var sc=treeSC(seed)*(mul||1), v=seed%7;
  var sway=Math.round(Math.sin(now*0.0008+seed)*(sc>1.8?2:1)), tx=X+sway;
  var trunk=day?"#5a4028":"#3c3020", tw=sc>=2.5?3:(sc>=1.7?2:1);
  var season=curSeason||seasonInfo(nowDate());
  var can, can2;
  if(season.bare){                                                        // WINTER: bare branches
    g.fillStyle=trunk; var th=Math.round(5*sc);
    g.fillRect(X-(tw>>1),gy-th+1,tw,th);
    for(var br=0;br<Math.round(3*sc);br++){ var by=gy-th+1-br*2, bs=(br&1)?-1:1;
      g.fillRect(X+bs*(1+(br%3)),by,Math.max(1,tw-1),1); g.fillRect(X,by-1,1,1); }
    if(snowpack>0.1){ g.fillStyle="rgba(240,244,255,0.9)"; g.fillRect(X-1-(tw>>1),gy-th,tw+2,1); }
    return;
  }
  var sc3=season.canopy&&season.canopy[0]&&season.canopy[0].length?season.canopy[seed%3]:[70,148,74];
  can=css(day?sc3:mixc(sc3,[16,26,22],0.55));                             // the season's own foliage palette
  can2=day?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.25)";
  var cv,tr;
  if(sc===1){ cv=function(x,y,w,h){ g.fillRect(tx+x,gy+y,w,h); };            // fast path: most trees are 1×
              tr=function(x,y,w,h){ g.fillRect(X+x,gy+y,w,h); }; }
  else{ cv=function(x,y,w,h){ g.fillRect(Math.round(tx+x*sc),Math.round(gy+y*sc),Math.max(1,Math.round(w*sc)),Math.max(1,Math.round(h*sc))); };
        tr=function(x,y,w,h){ g.fillRect(Math.round(X+x),Math.round(gy+y*sc),w,Math.max(1,Math.round(h*sc))); }; }
  g.fillStyle=trunk;
  if(v===0){ tr(-(tw>>1),-4,tw,5);                                        // pine
    g.fillStyle=can; cv(0,-11,1,2); cv(-1,-9,3,2); cv(-2,-7,5,2); cv(-1,-5,3,1);
    g.fillStyle=can2; cv(1,-7,1,2); }
  else if(v===1){ tr(-(tw>>1),-5,tw,6); tr(-1-(tw>>1),-4,1,1); tr(1+(tw>>1),-4,1,1);   // broad oak
    g.fillStyle=can; cv(-3,-8,7,3); cv(-2,-10,5,2); cv(-1,-11,3,1);
    g.fillStyle=can2; cv(1,-8,2,2);
    if(sc>=1.7){ g.fillStyle=day?"rgba(255,255,255,0.14)":"rgba(190,220,190,0.10)"; cv(-2,-10,2,1); } }
  else if(v===2&&sc<1.7){ tr(0,-2,1,3);                                   // sapling (never giant)
    g.fillStyle=can; cv(-1,-5,3,3); cv(0,-6,1,1); }
  else if(v===5){                                                          // BIRCH: chalk trunk, airy crown
    g.fillStyle=day?"#e8e4da":"#8a877e"; tr(-(tw>>1),-6,Math.max(1,tw),7);
    g.fillStyle=day?"#2a2620":"#141210"; tr(-(tw>>1),-3,1,1); tr(0,-5,1,1);          // bark flecks
    g.fillStyle=can; cv(-2,-9,5,2); cv(-1,-11,3,2); cv(1,-8,2,1); cv(-2,-7,2,1);
    g.fillStyle=can2; cv(1,-9,1,1); }
  else if(v===6){                                                          // POPLAR: tall narrow column
    tr(0,-3,1,4);
    g.fillStyle=can; cv(-1,-12,3,9); cv(0,-13,1,1); cv(0,-3,1,1);
    g.fillStyle=can2; cv(1,-10,1,5); }
  else{ tr(-(tw>>1),-3,tw,4);                                             // classic round crown
    g.fillStyle=can; cv(-2,-6,5,3); cv(-1,-8,3,3); cv(0,-9,1,2);
    g.fillStyle=can2; cv(1,-6,1,2);
    if(sc>=1.7){ g.fillStyle=day?"rgba(255,255,255,0.14)":"rgba(190,220,190,0.10)"; cv(-1,-8,2,1); } }
  if(snowpack>0.15){ g.fillStyle="rgba(240,246,255,"+Math.min(0.9,snowpack+0.25).toFixed(2)+")";   // snow-laden crown
    var capY=(v===0)?-11:((v===1||v===5)?-11:(v===6?-13:-9));
    cv(-1,capY,3,1); if(sc>=1.7) cv(0,capY-1,1,1); }
  if(season.blossom){ g.fillStyle="#f2b9d8";                              // SPRING blossom sprinkle
    for(var bp=0;bp<Math.round(3*sc);bp++) g.fillRect(Math.round(tx+((seed>>bp)%5-2)*sc),Math.round(gy+(-6-((seed>>(bp+2))%4))*sc),1,1); }
}
// ---- the settlers' lumber camp: axemen fell trees, a hauler carries the logs home ----
function drawAxeman(g,X,gy,dir,day,now){
  var hit=(Math.floor(now/420))%2===0;                         // swing rhythm
  drawPerson(g,X,gy-1,day?"#7a5a3a":"#55432c",SKINC[1],hit?0:1);
  g.fillStyle=day?"#6a4a2a":"#4a3622";                          // axe handle
  if(hit){ g.fillRect(X+dir*2,gy-1,2,1); } else { g.fillRect(X+dir*2,gy-3,1,2); }
  g.fillStyle="#aab2be"; g.fillRect(X+dir*(hit?3:2),gy-(hit?1:3),1,1);   // axe head
}
function drawFelling(g,X,gy,day,now,seed,p){
  var dir=(seed&1)?1:-1;                                        // which way she comes down
  if(p<0.52){                                                   // CHOP — the tree shudders at each blow
    var hit=(Math.floor(now/420))%2===0;
    drawTree(g,X+(hit?dir:0),gy,day,now,seed);
    drawAxeman(g,X-dir*3,gy,dir,day,now);
    if(hit){ g.fillStyle=day?"#d9c9a0":"#8a7a58";                // chips fly
      g.fillRect(X+dir,(gy-2-((Math.floor(now/140))%3))|0,1,1); }
  } else if(p<0.60){                                            // TIMBER — leaning over, coming down
    var lean=(p-0.52)/0.08, a=lean*1.4, trunkL=7;
    g.fillStyle=day?"#5a4028":"#3c3020";
    for(var s2=0;s2<trunkL;s2++) g.fillRect((X+dir*Math.sin(a)*s2)|0,(gy-Math.cos(a)*s2)|0,1,1);
    var tipx=X+dir*Math.sin(a)*trunkL, tipy=gy-Math.cos(a)*trunkL;
    g.fillStyle=day?"#3e7a34":"#2e5232";
    g.fillRect((tipx-1)|0,(tipy-1)|0,3,2); g.fillRect(tipx|0,(tipy-2)|0,1,1);
    drawPerson(g,X-dir*5,gy-1,day?"#7a5a3a":"#55432c",SKINC[1],0);   // axeman stands well back
  } else {                                                      // DOWN — stump, bucked logs, sawing
    g.fillStyle=day?"#6a4a2a":"#42301c"; g.fillRect(X,gy-1,1,2);              // stump
    g.fillStyle=day?"#7a5a34":"#4a3826";
    g.fillRect(X+ (dir>0?2:-6),gy-1,5,1);                                     // felled trunk
    if(p>0.72){ g.fillRect(X+(dir>0?2:-4),gy-2,3,1); }                        // bucked log stacked on top
    var saw=(Math.floor(now/500))%2===0;
    drawPerson(g,X+dir*4,gy-1,day?"#7a5a3a":"#55432c",SKINC[1],saw?0:1);      // working the log over
  }
}
// a half-built log house — the settlers' first real home, rising course by course
function drawLogHouse(g,X,gy,day,now,hp){
  var w=12, courses=Math.round(hp*5);
  g.fillStyle=day?"#6a4a2a":"#42301c"; g.fillRect(X,gy-5,1,6); g.fillRect(X+w-1,gy-5,1,6);   // corner posts
  for(var c=0;c<courses;c++){                                                                // log walls
    g.fillStyle=(c&1)?(day?"#7a5230":"#4a3420"):(day?"#8a5f38":"#523a24");
    g.fillRect(X,gy-c,w,1);
    g.fillStyle=day?"#5a3a20":"#33241a"; g.fillRect(X,gy-c,1,1); g.fillRect(X+w-1,gy-c,1,1); // log ends
  }
  if(hp>0.85){ g.fillStyle=day?"#6a4526":"#3a281a";                                          // pitched roof going on
    var rp=Math.min(1,(hp-0.85)/0.15);
    for(var rx=0;rx<Math.round(w*rp);rx++){ var rh=Math.min(rx,w-1-rx);
      g.fillRect(X+rx,gy-6-rh,1,rh+1); } }
  if(hp>=1){ g.fillStyle=day?"#c9a227":"#8a6a20"; g.fillRect(X+5,gy-3,2,4);                  // door
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,200,90,0.5)";
      g.fillRect(X+4,gy-3,4,4); g.globalCompositeOperation="source-over"; } }
  else{ var hm=(Math.floor(now/380))%2===0;                                                  // a builder hammering the top course
    drawPerson(g,X+3+((Math.floor(now/4000))%(w-6)),gy-1-courses,day?"#8a6a3a":"#5a4630",SKINC[3],hm?0:1); }
}
// the very first structure — a settler's log cabin (rises course by course, then smokes)
function drawCabin(g,X,gy,day,now,hp){
  if(hp===undefined) hp=1; if(hp<=0) return;
  var wallH=Math.max(1,Math.round(6*Math.min(1,hp/0.85)));
  g.fillStyle=day?"#7a5230":"#3a2818"; g.fillRect(X,gy-wallH,10,wallH);       // log walls rising
  for(var ly=gy-wallH+1;ly<gy;ly+=2){ g.fillStyle="rgba(0,0,0,0.2)"; g.fillRect(X,ly,10,1); }
  if(hp>0.85){ var rp=Math.min(1,(hp-0.85)/0.15);                             // pitched roof going on
    for(var rx=0;rx<Math.round(10*rp);rx++){ var rh=Math.min(rx,9-rx); g.fillStyle=day?"#6a4526":"#301f12"; g.fillRect(X+rx,gy-6-rh-1,1,rh+1); } }
  if(hp>=1){
    g.fillStyle=day?"#c9a227":"#8a6a20"; g.fillRect(X+4,gy-4,2,4);            // lit door/window
    if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,200,90,0.5)"; g.fillRect(X+3,gy-4,4,3); g.globalCompositeOperation="source-over"; }
    g.fillStyle=day?"#5a3a20":"#2a1c10"; g.fillRect(X+8,gy-9,1,3);            // chimney
    for(var sm=0;sm<4;sm++){ var st=(now*0.02+sm*40)%40; g.fillStyle="rgba(150,150,155,"+(0.4*(1-st/40))+")"; g.fillRect((X+8+Math.sin(now*0.001+sm)*2)|0,(gy-10-st*0.4)|0,2,2); }
  } else {                                                                     // settlers raising their first walls
    var hm3=(Math.floor(now/380))%2===0;
    drawPerson(g,X+2,gy-wallH,day?"#8a6a3a":"#5a4630",SKINC[0],hm3?0:1);
    drawPerson(g,X+7,gy-wallH,day?"#7a5a3a":"#4a3826",SKINC[2],hm3?1:0);
  }
}
// a building that hasn't finished growing yet — a scaffolded, rising tower + crane
function drawGrowSite(g,X,w,targetH,frac,seed,L,now,crew){
  var gy=HORIZON, builtH=Math.max(2,Math.round(targetH*frac)), top=gy-builtH;
  g.fillStyle=L>0.5?"#8a8f9a":"#2a2e38"; g.fillRect(X,top,w,builtH);
  for(var f=top+2;f<gy-1;f+=4){ for(var wx=X+1;wx<X+w-1;wx+=3){ g.fillStyle=(L<0.45&&(((wx*7+f)|0)%3===0))?"#ffe6a0":(L>0.5?"#aeb6c2":"#3a4250"); g.fillRect(wx,f,2,2); } }
  g.fillStyle=L>0.5?"#6a6f7a":"#22262f"; for(var cxp=X;cxp<=X+w;cxp+=4) g.fillRect(cxp,top-3,1,4);                       // steel-frame cap
  g.fillStyle=L>0.5?"rgba(190,168,96,0.85)":"rgba(120,100,60,0.85)"; g.fillRect(X-1,top,1,Math.min(builtH,20)|0); g.fillRect(X+w,top,1,Math.min(builtH,20)|0);
  var mastX=X+w+2, mastTop=top-12; g.fillStyle=L>0.5?"#e0a83a":"#5a4418"; g.fillRect(mastX,mastTop,1,gy-mastTop);
  var jib=w+6, slew=Math.sin(now*0.0006+seed); if(slew>0) g.fillRect(mastX+1,mastTop,jib,1); else g.fillRect(mastX-jib,mastTop,jib,1);
  var lift=((now+seed*97)%9000)/9000;                                           // a girder swings up to the deck
  if(lift<0.7){ var gx6=mastX+(slew>0?1:-1)*Math.round(jib*0.6);
    var gy6=(gy-4)+(mastTop+3-(gy-4))*(lift/0.7);                                // rising from street to deck
    g.fillStyle="rgba(150,150,160,0.7)"; g.fillRect(gx6|0,mastTop+1,1,Math.max(1,(gy6-mastTop-1)|0));   // hoist cable
    g.fillStyle=L>0.5?"#4a5568":"#1c222e"; g.fillRect((gx6-1)|0,gy6|0,3,1);      // the girder
    if(lift>0.62&&(Math.floor(now/120)&1)){ g.fillStyle="#dff0ff"; g.fillRect((gx6)|0,(mastTop+4)|0,1,1); } }   // weld spark
  if(L<0.6&&(Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect(mastX,mastTop-1,1,1); }
  g.fillStyle=L>0.5?"#3f6ab0":"#1f3048"; g.fillRect(X-1,gy-2,w+2,2);                                                    // hoarding
  // C1: the whole crew is visible on site — more builders = the tower rises faster
  crew=crew||1; var hiv=L>0.5?"#e8a020":"#8a6014";
  for(var cwk=0;cwk<crew;cwk++){ var hm2=(Math.floor(now/380)+cwk)&1;
    var wy2=(cwk===0)?gy-3:(cwk===1?top-1:top+Math.min(builtH-2,(builtH>>1)));
    drawPerson(g,X+2+((cwk*5+(seed&3))%Math.max(3,w-3)),wy2,hiv,SKINC[(seed+cwk)%SKINC.length],hm2); }
}
// ---- the distant MOUNTAIN RANGE: two hazy ridges behind everything, snow on the high peaks.
// Snowline drops in winter and after real snowfalls; snow blushes pink at sunset (alpenglow);
// at night the range is a dark silhouette with faintly moonlit caps. Pure geography — it
// outlives every city that rises and falls beneath it.
function drawMountains(g,L,now,nd){
  if(!mts) return;
  var gy=HORIZON, day=L>0.5;
  var sunsetK=goldenK;   // sourced from the shared golden-hour global (identical law)
  var mo=nd.getMonth();
  var winter=(mo===11||mo<=1)?1:((mo===2||mo===10)?0.5:0);
  var snowLo=Math.min(0.5, winter*0.26 + snowpack*0.22);          // how far the snowline creeps down
  var skc=day?[168,186,214]:[24,28,46];                           // fade the ridges toward the sky
  var farC =mixc(mixc(day?[126,146,182]:[17,21,37], skc, day?0.5:0.38), [200,124,152], sunsetK*0.34);
  var nearC=mixc(mixc(day?[100,116,152]:[13,17,30], skc, day?0.24:0.2), [150,92,124], sunsetK*0.3);
  var snF=mixc(day?[234,240,250]:[88,102,142], [255,168,148], sunsetK*0.55);   // alpenglow on the snow
  var snN=mixc(day?[246,250,255]:[110,126,168], [255,150,128], sunsetK*0.6);
  if(!mtsCache){                                                  // the silhouette is static per life —
    mtsCache={h:[[],[]], wig:[], mx:[0,0]};                       // compute it ONCE per screen, not per frame
    var lists=[mts.far,mts.near];
    for(var pi0=0;pi0<2;pi0++){ var list0=lists[pi0];
      for(var i0=0;i0<list0.length;i0++) if(list0[i0].h>mtsCache.mx[pi0]) mtsCache.mx[pi0]=list0[i0].h;
      for(var cx0=0;cx0<SW;cx0++){ var wx0=cx0+WOFF;
        var rh0=(pi0===0)? (9+Math.sin(wx0*0.011+3)*5+Math.sin(wx0*0.033)*2.5)*KSP        // rolling base ridge
                         : Math.max(0,(Math.sin(wx0*0.014+7)*9-3.5))*KSP;                 // sparse foothills
        for(var i1=0;i1<list0.length;i1++){ var p0=list0[i1];
          var d0=(((wx0-p0.x)%WW)+WW*1.5)%WW-WW*0.5; if(d0<0)d0=-d0;
          if(d0>=p0.w) continue;
          var t0=1-d0/p0.w;
          var crag=(Math.sin(wx0*0.19+p0.ph)*1.4+Math.sin(wx0*0.047+p0.ph*2.3)*2.4+Math.sin(wx0*0.093+p0.ph*5)*1.1)
                   *t0*(p0.h/(46*KSP));                           // crags grow with the mountain
          var hh0=p0.h*t0+crag*KSP;
          if(hh0>rh0) rh0=hh0; }
        mtsCache.h[pi0][cx0]=rh0;
        if(pi0===0) mtsCache.wig[cx0]=Math.sin(wx0*0.23)*2.2*KSP; // snowline wander, also static
      } }
  }
  var passes=[[css(farC),css(snF)],[css(nearC),css(snN)]];
  for(var pi=0;pi<2;pi++){
    var mc=passes[pi][0], sc=passes[pi][1], hs=mtsCache.h[pi];
    var snl=mtsCache.mx[pi]*(0.72-snowLo);                        // one ABSOLUTE snowline per ridge —
    // BASE RIDGE — run-length batched: the silhouette is static per life, so consecutive columns share the same
    // integer top; one wide fillRect per run (was one 1px rect per column). Identical pixels, far fewer draw calls.
    g.fillStyle=mc; var rs=-1, rtop=0;
    for(var sx=0;sx<=SW;sx++){ var rh=(sx<SW)?hs[sx]:-1, top=(rh>=2)?Math.max(2,(gy-rh)|0):-999;
      if(top!==rtop){ if(rs>=0&&rtop>-999) g.fillRect(rs,rtop,sx-rs,gy-rtop+2); rs=(top>-999)?sx:-1; rtop=top; } }
    // SNOW CAPS — per column (dithered melt edge); one fillStyle set for the whole ridge
    g.fillStyle=sc;
    for(var sx2=0;sx2<SW;sx2++){ var rh2=hs[sx2]; if(rh2<2) continue;
      var top2=(gy-rh2)|0; if(top2<2) top2=2;
      var cap=Math.round(rh2-(snl+mtsCache.wig[sx2]));
      if(cap>0&&((sx2+(rh2*2|0))&1)) cap+=1;
      if(cap>0) g.fillRect(sx2,top2,1,Math.min(cap,gy-top2));
    }
  }
}
// tiny mountaineers roping up the TALLEST peaks — a fair-weather daytime sight. Deterministic & very slow
// (a summit push takes the better part of an hour). Sized as SPECKS against the mountain (2px vs ~100px peaks).
function drawClimbers(g,L,now,nd,fx){
  if(!mts||!mtsCache||cityPhase==="apoc") return;              // no mountains / not during the apocalypse
  if(L<0.42||fx.thunder||fx.snow||fx.rain) return;             // clear-ish daylight only
  var peaks=mts.near; if(!peaks||!peaks.length) return;
  var mx=mtsCache.mx[1]; if(mx<40*KSP) return;                 // needs a real, tall range
  var hs=mtsCache.h[1], gy=HORIZON, drawn=0;
  for(var pk=0; pk<peaks.length && drawn<2; pk++){ var p0=peaks[pk];
    if(p0.h < mx*0.82) continue;                               // only the TALLEST peaks are worth the ascent
    var apexSx=p0.x-WOFF; if(apexSx>SW+40&&apexSx-WW>-40)apexSx-=WW; if(apexSx<-40&&apexSx+WW<SW+40)apexSx+=WW;
    if(apexSx<-30||apexSx>SW+30) continue;                     // this peak isn't on this screen
    var ph=((p0.x*13+7)>>>0), side=(ph&1)?1:-1;               // which flank the party ascends
    var routeW=Math.min(p0.w*0.68, 70);                        // horizontal span of the switchback route
    var CYC=2400000, baseP=((now+ph%CYC)%CYC)/CYC;             // ~40 min per summit push (climbing is slow)
    var col=["#e0503a","#e0a030","#d8d040"][ph%3];            // a bright jacket, so the speck reads against grey stone
    var prevX=null, prevY=null;
    for(var c=0;c<3;c++){ var pk2=baseP-c*0.08; if(pk2<0) pk2+=1;    // three roped together, spaced down the line
      var frac=0.16+0.8*pk2, cx=apexSx-side*(1-frac)*routeW;         // frac 1 = at the summit, low = down the slope
      var ci=Math.round(cx); if(ci<0)ci=0; if(ci>=SW)ci=SW-1;
      var surfH=hs[ci]; if(surfH<2) continue;
      var cy=gy-surfH-1;
      if(prevX!=null){ for(var rr=1;rr<4;rr++){ var rf=rr/4;         // the rope between climbers
        g.fillStyle="rgba(50,42,38,0.7)"; g.fillRect((cx+(prevX-cx)*rf)|0,(cy+(prevY-cy)*rf)|0,1,1); } }
      g.fillStyle=col; g.fillRect(ci,cy-1,1,2);                       // the climber — a 2px speck
      g.fillStyle="rgba(18,14,12,0.85)"; g.fillRect(ci,cy,1,1);       // legs a touch darker
      prevX=cx; prevY=cy;
    }
    drawn++;
  }
}

// ---- THE SETTLEMENT SURVIVES: hunters stalk game, gatherers forage the meadow, a cook-fire
// roasts the day's catch, hides dry on racks, and the first fenced FARM rises beside the
// homestead — crops sprout, ripen golden, and are gone by winter. Everything fades away as
// the town urbanises (same envelope as the homestead itself).
function drawSettlementLife(g,cg,L,now,nd){
  var wild=1-cg; if(cg<ARRIVE||wild<=0.5) return;
  var sa=Math.min(1,(wild-0.5)/0.08); if(sa<=0) return;
  var day=L>0.5, gy=HORIZON, cb=Math.round(0.5*WW);
  var ga0=g.globalAlpha; g.globalAlpha=ga0*sa;
  var hr2=nd.getHours();
  function W2S(wx){ var sx=wx-WOFF; if(sx>SW+20&&sx-WW>-20) sx-=WW; if(sx<-20&&sx+WW<SW+20) sx+=WW; return sx; }

  // ---- the COOK-FIRE: stone ring, spit, the day's roast, folk gathered at meal times ----
  var FX2=W2S(cb+9);
  if(FX2>-16&&FX2<SW+16){
    g.fillStyle=day?"#7a7268":"#3c3832"; g.fillRect(FX2-1,gy-1,5,1);                 // stone ring
    var meal=(hr2>=6&&hr2<8)||(hr2>=11&&hr2<13)||(hr2>=17&&hr2<21);
    drawFlame(g,FX2+1,gy-1,4,4.5,now,(cb|0)*3+1,day?0.8:1);                          // the cook-fire
    if(meal) drawFireSmoke(g,FX2+1,gy-6,now,(cb|0)*3+1,0.5,1);                       // savoury smoke at mealtimes
    if(!day){ g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,170,70,0.22)"; g.fillRect(FX2-3,gy-6,9,7);
      g.globalCompositeOperation="source-over"; }
    g.fillStyle=day?"#5a4028":"#33241a";
    g.fillRect(FX2-2,gy-4,1,4); g.fillRect(FX2+4,gy-4,1,4); g.fillRect(FX2-2,gy-4,7,1);   // the spit
    if(meal){ g.fillStyle=day?"#8a5a30":"#5a3a20"; g.fillRect(FX2,gy-3,3,1);         // the roast turning
      g.fillStyle="rgba(150,150,155,0.5)"; g.fillRect(FX2+1,(gy-6-((now/300)%3))|0,1,1);   // savoury smoke
      drawPerson(g,FX2-5,gy-1,day?"#7a5a3a":"#4a3826",SKINC[1],(Math.floor(now/700))&1);   // the cook turns it
      drawSeated(g,FX2+7,gy-2,day?"#5a6a4a":"#323a28",SKINC[3]);                     // folk eating
      if(hr2>=17) drawSeated(g,FX2+10,gy-2,day?"#6a4a3a":"#3a2c20",SKINC[0]); }
  }
  // ---- DRYING RACK: the catch cures beside the fire ----
  var RX2=W2S(cb+30);
  if(RX2>-10&&RX2<SW+10){
    g.fillStyle=day?"#6a4a2a":"#3a2c1c"; g.fillRect(RX2,gy-5,1,5); g.fillRect(RX2+6,gy-5,1,5); g.fillRect(RX2,gy-5,7,1);
    g.fillStyle=day?"#a05038":"#5c2e20"; for(var dr2=1;dr2<6;dr2+=2) g.fillRect(RX2+dr2,gy-4,1,2);   // strips of meat/fish
  }
  // ---- FIREWOOD stack ----
  var WX3=W2S(cb-14);
  if(WX3>-8&&WX3<SW+8){ g.fillStyle=day?"#7a5a34":"#4a3826";
    g.fillRect(WX3,gy-1,5,1); g.fillRect(WX3+1,gy-2,3,1); g.fillRect(WX3+2,gy-3,1,1); }

  // ---- HUNTERS: stalk out, draw the bow, and haul the kill home ----
  if(L>0.3){
    for(var hn=0;hn<2;hn++){ var HCYC=46000, hph=((now+hn*21000)%HCYC)/HCYC, hci=Math.floor((now+hn*21000)/HCYC);
      var hh5=((hci*2654435761+hn*7919)>>>0);
      var hd=(hh5&1)?1:-1, T=cb+hd*(64+(hh5>>>4)%80), hit=((hh5>>>8)%100)<45;
      var hx3;
      if(hph<0.32) hx3=cb+ (T-cb)*(hph/0.32);                                        // stalking out
      else if(hph<0.5) hx3=T;                                                        // the draw & loose
      else if(hph<0.85) hx3=T+(cb-T)*((hph-0.5)/0.35);                               // heading home
      else hx3=cb;
      var HX2=W2S(hx3); if(HX2<-6||HX2>SW+6) continue;
      var hb=(hph<0.32||hph<0.85&&hph>=0.5)?((Math.floor(now/300)+hn)&1):0;
      drawPerson(g,HX2,gy-1,day?"#5c4a30":"#3a3020",SKINC[(hn+1)%SKINC.length],hb);
      if(hph>=0.32&&hph<0.5){                                                        // bow drawn
        g.fillStyle=day?"#8a6a3a":"#55432c"; g.fillRect(HX2+hd*2,gy-4,1,3);
        if(hph>0.44){ var af=(hph-0.44)/0.06; g.fillStyle="#e8e2d2";                 // the arrow flies
          g.fillRect((HX2+hd*(3+af*10))|0,gy-4,2,1); }
        var DX2=W2S(T+hd*14);                                                        // the quarry
        if(DX2>-6&&DX2<SW+6){
          if(hph>0.46&&!hit){ var flee=(hph-0.46)/0.04;                              // it bolts
            g.fillStyle=day?"#9a7248":"#4e3c28"; g.fillRect((DX2+hd*flee*12)|0,gy-1-Math.abs(Math.sin(flee*6))*2,4,1); }
          else if(hph>0.47&&hit){ g.fillStyle=day?"#9a7248":"#4e3c28"; g.fillRect(DX2,gy,4,1); }   // it drops
          else { g.fillStyle=day?"#9a7248":"#4e3c28"; g.fillRect(DX2,gy-2,4,2);
                 g.fillRect(DX2+hd*4,gy-3,1,1); } }
      }
      if(hph>=0.5&&hph<0.85&&hit){ g.fillStyle=day?"#9a7248":"#4e3c28";              // carrying it home
        g.fillRect(HX2-1,gy-4,4,1); }
    }
  }
  // ---- GATHERERS: out to the berry patches, stooping and picking, home with full baskets ----
  if(L>0.35){
    for(var gt=0;gt<2;gt++){ var GCYC=38000, gph=((now+gt*17000)%GCYC)/GCYC, gci=Math.floor((now+gt*17000)/GCYC);
      var gh2=((gci*40503+gt*997)>>>0), gd=(gh2&1)?1:-1, GT=cb+gd*(34+(gh2>>>5)%46);
      var gx3;
      if(gph<0.3) gx3=cb+(GT-cb)*(gph/0.3);
      else if(gph<0.62) gx3=GT+Math.sin(gph*40)*1.2;                                 // working the patch
      else if(gph<0.92) gx3=GT+(cb-GT)*((gph-0.62)/0.3);
      else gx3=cb;
      var GX2=W2S(gx3); if(GX2<-5||GX2>SW+5) continue;
      var stoop=(gph>=0.3&&gph<0.62)&&(((Math.floor(now/500)+gt)&1)===0);
      drawPerson(g,GX2,gy-1+(stoop?1:0),day?"#6a5a3a":"#443a26",SKINC[(gt*2)%SKINC.length],stoop?0:((Math.floor(now/320)+gt)&1));
      g.fillStyle=day?"#8a6a42":"#4e3c28"; g.fillRect(GX2+gd*2,gy-1,2,1);            // the basket
      if(gph>=0.62){ g.fillStyle="#c03a4a"; g.fillRect(GX2+gd*2,gy-2,2,1); }         // brimming with berries
      if(gph>=0.3&&gph<0.62){ g.fillStyle=day?"#3e6a30":"#2a4a28";                   // the berry bush
        var BX2=W2S(GT+gd*4); if(BX2>-4&&BX2<SW+4){ g.fillRect(BX2,gy-2,3,2);
          g.fillStyle="#c03a4a"; g.fillRect(BX2,gy-2,1,1); g.fillRect(BX2+2,gy-1,1,1); } }
    }
  }
  // ---- the FIRST FARM: fence, furrows, crops that sprout, ripen and are reaped ----
  if(cg>0.028){
    var fa=Math.min(1,(cg-0.028)/0.008), FL=cb-78, FR=cb-44;
    var LX2=W2S(FL), RX3=W2S(FR);
    if(!(RX3<-10||LX2>SW+10)){
      var ga2=g.globalAlpha; g.globalAlpha=ga2*fa;
      g.fillStyle=day?"#6a4a2a":"#3a2c1c";
      for(var fp2=FL;fp2<=FR;fp2+=6){ var PX3=W2S(fp2); if(PX3<-2||PX3>SW+2) continue;
        g.fillRect(PX3,gy-3,1,4); }                                                  // fence posts
      var seg0=Math.max(FL,WOFF-2), seg1=Math.min(FR,WOFF+SW+2);
      if(seg1>seg0){ var A4=W2S(seg0), B4=W2S(seg1);
        g.fillStyle=day?"rgba(122,90,52,0.85)":"rgba(70,54,34,0.85)";
        g.fillRect(A4,gy-2,B4-A4,1);                                                 // top rail
        g.fillStyle=day?"#5a4028":"#33241a";
        for(var fr3=0;fr3<3;fr3++) g.fillRect(A4,gy+2+fr3*2,B4-A4,1); }              // tilled furrows
      var mo3=nd.getMonth()+1;
      var crop=(mo3>=11||mo3<=3)?0:Math.min(1,(cg-0.036)/0.05)*((mo3>=8)?1:0.6);     // bare in winter, ripe by late summer
      if(crop>0.05){
        var tall=crop>0.7, cc2=tall?(day?"#c9a72b":"#7a681e"):(day?"#5a9a40":"#3a6030");
        for(var cx3=FL+2;cx3<FR-1;cx3+=2){ var CX3=W2S(cx3); if(CX3<-2||CX3>SW+2) continue;
          g.fillStyle=cc2; g.fillRect(CX3,gy+1-(tall?2:1),1,tall?3:2);
          if(tall){ g.fillStyle=day?"#e8cc50":"#8a7a2a"; g.fillRect(CX3,gy-2,1,1); } }
      }
      var SCX=W2S(cb-61);                                                            // the scarecrow
      if(SCX>-4&&SCX<SW+4){ g.fillStyle=day?"#6a4a2a":"#3a2c1c"; g.fillRect(SCX,gy-5,1,5);
        g.fillRect(SCX-2,gy-4,5,1); g.fillStyle=day?"#c9a227":"#8a6a20"; g.fillRect(SCX,gy-6,1,1); }
      if(day&&hr2>=7&&hr2<18){                                                       // the farmer hoes the rows
        var fwx3=FL+6+((now/700)%(FR-FL-12)), FWX=W2S(fwx3);
        if(FWX>-4&&FWX<SW+4){ var hoe=(Math.floor(now/380))&1;
          drawPerson(g,FWX,gy-1,day?"#7a5a3a":"#4a3826",SKINC[2],hoe);
          g.fillStyle=day?"#8a6a3a":"#55432c"; g.fillRect(FWX+2,gy-3+hoe,1,2); } }
      for(var ch2=0;ch2<3;ch2++){                                                    // hens peck the yard
        var hx4=cb-42+((ch2*13+((now/1600)|0)*7)%14), HX4=W2S(hx4);
        if(HX4<-2||HX4>SW+2) continue;
        var peck=((Math.floor(now/420)+ch2)&3)===0;
        g.fillStyle=ch2===1?"#8a5a30":"#eee8dc"; g.fillRect(HX4,gy+1+(peck?1:0),2,1);
        g.fillStyle="#c03a2a"; g.fillRect(HX4+1,gy+(peck?1:0),1,1); }
      g.globalAlpha=ga2;
    }
  }
  g.globalAlpha=ga0;
}
// NEW ENGLAND: a classic red barn (gambrel roof, white trim, hayloft) with a grain silo alongside.
function drawBarn(g,X,gy,day,now){
  var red=day?"#8f3a2c":"#4c2018", roof=day?"#3c3c46":"#171720", trim=day?"#e8e4d8":"#8a8880";
  var w=14, h=9, bx=X, wallTop=gy-h+3;
  // silo (behind, left)
  g.fillStyle=day?"#bcb4a4":"#5a564e"; g.fillRect(bx-4,gy-h-1,3,h+1);
  g.fillStyle=day?"#8c8678":"#3e3a34"; g.fillRect(bx-4,gy-h-2,3,1);                    // domed cap
  // barn walls
  g.fillStyle=red; g.fillRect(bx,wallTop,w,h-3);
  g.fillStyle="rgba(0,0,0,0.12)"; for(var vb=2;vb<w;vb+=3) g.fillRect(bx+vb,wallTop,1,h-3);   // board-and-batten
  // gambrel roof (steep lower, shallow upper)
  var gh=5;
  for(var r=0;r<gh;r++){ var rw=(r<2)?(w-r*1):(w-2-(r-2)*3); rw=Math.max(3,rw);
    g.fillStyle=roof; g.fillRect(bx+((w-rw)>>1),wallTop-1-r,rw,1); }
  g.fillStyle=trim; g.fillRect(bx-1,wallTop,w+2,1);                                    // white eave trim
  // big sliding door + white X-frame, hayloft window
  g.fillStyle=day?"#5e281e":"#331410"; g.fillRect(bx+w-6,wallTop+1,5,h-4);
  g.fillStyle=trim; g.fillRect(bx+w-6,wallTop+1,5,1); g.fillRect(bx+w-6,wallTop+1,1,h-4); g.fillRect(bx+w-2,wallTop+1,1,h-4);
  g.fillStyle=trim; g.fillRect(bx+2,wallTop+2,3,3); g.fillStyle=day?"#3a2a22":"#20140f"; g.fillRect(bx+3,wallTop+3,1,1);   // hayloft window
  if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,196,110,0.35)";  // lit door at night
    g.fillRect(bx+w-5,wallTop+3,3,h-6); g.globalCompositeOperation="source-over"; }
}
// low fieldstone wall — a run of weathered rounded stones along the ground
function drawStoneWall(g,X,gy,day){
  g.fillStyle=day?"#9a968c":"#4a4842";
  for(var s=0;s<24;s++){ var sx=X-14+s*2, sy=gy-1-((s*7+3)%3?0:1); g.fillRect(sx,sy,2,2);
    if(s&1){ g.fillStyle=day?"#8a867c":"#3e3c36"; g.fillRect(sx,sy+1,2,1); g.fillStyle=day?"#9a968c":"#4a4842"; } }   // shadowed underside
}
// the wilderness the city grows out of — hills, grass, a river, scattered trees, the first cabin
function drawTerrain(g,cg,L,now,nd,pass){
  if(cg>=0.985) return;                                     // fully urban
  var BGp=pass!=="fg", FGp=pass!=="bg";                     // which halves of the landscape to paint
  var wild=1-cg, gy=HORIZON, day=L>0.5;
  // rolling hills on the horizon (behind the skyline). They dominate the wild era but never fully vanish —
  // a faint band of soft green hills lingers behind the mature city so the backdrop is never a hard flat line.
  var hillA=Math.max(0.16,wild-0.12);
  if(hillA>0&&BGp){ var hc=day?[64,112,58]:[38,58,44];
    g.globalAlpha=hillA; g.fillStyle=css(hc);
    for(var hx=0;hx<SW;hx+=2){ var wx=hx+WOFF, hh=7+Math.sin(wx*0.03)*4+Math.sin(wx*0.011+2)*5+Math.sin(wx*0.006)*4;
      g.fillRect(hx,(gy-hh)|0,2,(hh+8)|0); }                        // 2px step: the soft hill band is a faint backdrop — halves the per-frame column rects
    g.globalAlpha=1;
    // a second, gentler ridge a touch lower for depth (only once the town has grown past the wild era)
    if(cg>0.3){ g.globalAlpha=hillA*0.7; g.fillStyle=css(day?[78,126,68]:[44,66,50]);
      for(var hx2=0;hx2<SW;hx2+=2){ var wx3=hx2+WOFF, hh2=4+Math.sin(wx3*0.02+1.5)*3+Math.sin(wx3*0.009)*3;
        g.fillRect(hx2,(gy-hh2)|0,2,(hh2+8)|0); }
      g.globalAlpha=1; }
  }
  // grass foreground (greens fading toward city-grey as it paves over)
  var grass=mixc(day?[74,116,58]:[48,68,52], day?[150,158,150]:[44,48,60], cg*0.9);
  if(BGp){ g.globalAlpha=Math.min(1,wild+0.12); g.fillStyle=css(grass); g.fillRect(0,gy,SW,SH-gy); g.globalAlpha=1; }
  if(!day&&BGp){                                                            // moonlight: the meadow stays visible on a dark night
    var mgl=g.createLinearGradient(0,gy,0,SH);
    mgl.addColorStop(0,"rgba(168,190,232,"+(0.10*wild+0.03)+")");
    mgl.addColorStop(1,"rgba(120,140,190,"+(0.04*wild)+")");
    g.fillStyle=mgl; g.fillRect(0,gy,SW,SH-gy); }
  if(wild>0.3&&BGp){ g.fillStyle=day?"rgba(58,94,46,0.5)":"rgba(34,52,38,0.6)";
    for(var gx=0;gx<SW;gx+=3){ var wx2=gx+WOFF; if(((wx2*7)%5)<2) g.fillRect(gx,(gy+2+((wx2*3)%6))|0,1,1); }
    g.fillStyle=day?"rgba(122,96,58,0.7)":"rgba(84,70,48,0.7)"; g.fillRect(0,(gy+Math.round((SH-gy)*0.5))|0,SW,3); }  // dirt trail where the road will be
  // a river winding through, present early, culverted as the city grows
  var riverW=Math.round(6*wild);
  if(riverW>0&&BGp){ var rvx=Math.round(0.62*WW), rsx=rvx-WOFF;
    for(var wp=-1;wp<=1;wp++){ var RX=rsx+wp*WW; if(RX<-24||RX>SW+24) continue;
      for(var ry=0;ry<SH-gy+4;ry++){ var mx=RX+Math.sin((gy+ry)*0.15)*4+Math.sin((gy+ry)*0.55)*0.8;
        g.fillStyle=day?"rgba(90,150,200,0.85)":"rgba(58,92,150,0.9)"; g.fillRect(mx|0,(gy-2+ry)|0,riverW,1);
        g.fillStyle=day?"rgba(70,105,70,0.55)":"rgba(40,58,52,0.6)";                       // soft muddy banks
        g.fillRect((mx-1)|0,(gy-2+ry)|0,1,1); g.fillRect((mx+riverW)|0,(gy-2+ry)|0,1,1);
        var rp2=Math.sin(now*0.002+ry*0.8);                                                // drifting current glints
        if(rp2>0.3&&((ry*7)%3)===0){ g.fillStyle="rgba(200,225,255,"+(0.2+0.25*rp2).toFixed(2)+")";
          g.fillRect((mx+1+((ry*5+((now/400)|0))%(riverW>2?riverW-2:1)))|0,(gy-2+ry)|0,1,1); } } }
  }
  // a plank bridge carries the trail over the river
  if(riverW>0&&wild>0.25&&BGp){ var bry=Math.round((SH-gy)*0.5), rvx2=Math.round(0.62*WW);
    var mxb=rvx2-WOFF+Math.sin((gy+bry)*0.15)*4;
    for(var wpB=-1;wpB<=1;wpB++){ var BXr=(mxb+wpB*WW)|0; if(BXr<-20||BXr>SW+20) continue;
      g.fillStyle=day?"#8a6242":"#54402c"; g.fillRect(BXr-3,gy-2+bry-1,riverW+6,2);   // deck
      g.fillStyle=day?"#6a4a30":"#3e3020"; g.fillRect(BXr-3,gy-2+bry+1,1,3); g.fillRect(BXr+riverW+2,gy-2+bry+1,1,3);   // posts
      g.fillStyle=day?"#9a7252":"#5e4834"; g.fillRect(BXr-3,gy-2+bry-2,riverW+6,1);   // rail
    } }
  // distant treeline along the hill crest (the deep woods beyond the meadow)
  if(hillA>0&&BGp){ g.globalAlpha=hillA; g.fillStyle=day?"#2e5628":"#26402e";
    for(var hx2=0;hx2<SW;hx2+=2){ var wx3=hx2+WOFF;
      if(((wx3*13)%7)<4){ var hh2=7+Math.sin(wx3*0.03)*4+Math.sin(wx3*0.011+2)*5+Math.sin(wx3*0.006)*4;
        g.fillRect(hx2,(gy-hh2-1-((wx3*5)%3))|0,2,2+((wx3*3)%2)); } }
    g.globalAlpha=1; }
  // ---- the FOREST (dense in the wild days; the settlers clear it as the town takes hold) ----
  var treeN=Math.round(WW/(QUAL===0?7:4.5)), cbwx=Math.round(0.5*WW), houseWX=cbwx+16;
  function treeWX(t){ return (((t*2654435761)>>>0)/4294967296)*WW; }
  function treeAlive(t){ return !inSea(treeWX(t)) && (((t*40503)%1000)/1000)<=wild; }
  // felling crews — each works one tree per slot: chop → TIMBER → buck the logs (pure clock, cross-screen synced)
  var CH_SLOT=80000, chopOn=(wild>0.5 && L>0.35 && cg>=ARRIVE), chopTgt={};   // daylight only, and not before the founders arrive
  if(chopOn){ for(var ck=0;ck<3;ck++){
    var cofs=ck*(CH_SLOT/3), slot=Math.floor((now+cofs)/CH_SLOT), cr=rng(((slot*2654435761)^(ck*7919+13))>>>0);
    for(var tries=0;tries<8;tries++){ var ti=(cr()*treeN)|0;
      if(!treeAlive(ti)||chopTgt[ti]!==undefined) continue;
      if(treeSC(ti)>1.2) continue;                              // the giants are beyond a lone axeman
      if(ck===0 && Math.abs(treeWX(ti)-cbwx)>110) continue;      // crew 0 works the woods near the homestead
      chopTgt[ti]=((now+cofs)%CH_SLOT)/CH_SLOT; break; }
  } }
  for(var t=0;t<treeN;t++){ if(!treeAlive(t)) continue;
    if(overLandmark(treeWX(t)-4,8)) continue;                     // don't grow the wild forest on a landmark plaza (e.g. the amusement park)
    var tsx=treeWX(t)-WOFF, tfs=fireStateAt(treeWX(t),now);
    for(var wp3=-1;wp3<=1;wp3++){ var TX=(tsx+wp3*WW)|0; if(TX<-8||TX>SW+8) continue;
      if(tfs){ if(tfs.ph===0){ if(FGp) drawBurningTree(g,TX,gy,day,now,t,tfs.k); }   // flames are FG
        else if(tfs.ph===1){ if(BGp) drawSnag(g,TX,gy,day,tfs.k,t); }
        else if(BGp) drawTree(g,TX,gy,day,now,t,0.2+0.8*tfs.k); }     // the forest returns
      else if(chopTgt[t]!==undefined){ if(FGp) drawFelling(g,TX,gy,day,now,t,chopTgt[t]); }
      else if(BGp) drawTree(g,TX,gy,day,now,t); }
  }
  // the burn SCAR heals in a wave that follows the fire front (same per-column reach as the trees):
  // charred black → dying embers → fading ash → fresh green shoots pushing up → young grass filling
  // back in. Above it the trees regrow in step (drawTree, size 0.2→1). All pure-clock, cross-screen.
  for(var fz=0;fz<fireZones.length;fz++){ var F2=fireZones[fz], age2=now-F2.t0;
    if(age2<0||age2>CHAR_T+REGROW_T) continue;
    for(var wz=-1;wz<=1;wz++){ var ZA=(F2.x-F2.r-WOFF+wz*WW)|0, ZB=(F2.x+F2.r-WOFF+wz*WW)|0;
      if(ZB<0||ZA>SW) continue;
      var gA=Math.max(0,ZA), gB=Math.min(SW,ZB);
      if(BGp) for(var gx=gA;gx<gB;gx++){
        var wxg=gx+WOFF-wz*WW, d=Math.abs(wxg-F2.x); if(d>F2.r) continue;
        var reach=(d/F2.r)*FIRE_DUR*0.5, local=age2-reach; if(local<0) continue;   // the front hasn't reached this spot yet
        var hh4=((gx*2654435761)>>>0);
        if(local<CHAR_T){                                            // scorched black earth (+ embers dying in the ash)
          var sk=Math.min(0.62,0.62*local/(FIRE_DUR*0.5));
          g.fillStyle="rgba(20,15,11,"+sk.toFixed(2)+")"; g.fillRect(gx,gy,1,7);
          if(local<FIRE_DUR&&(hh4%4===0)){ g.globalCompositeOperation="lighter";
            g.fillStyle="rgba(255,95,22,"+(0.5*(1-local/FIRE_DUR)).toFixed(2)+")"; g.fillRect(gx,gy+1+((hh4>>3)%5),1,1);
            g.globalCompositeOperation="source-over"; }
        } else {                                                     // regrowing: ash fades as fresh grass rises
          var rk=(local-CHAR_T)/REGROW_T;                           // 0..1 through the regrow
          var ash=0.55*(1-rk);
          if(ash>0.02){ g.fillStyle="rgba(28,22,16,"+ash.toFixed(2)+")"; g.fillRect(gx,gy,1,7); }
          if((hh4%100)/100 < rk*1.15){                              // this blade of grass has come up yet?
            var yng=rk<0.55, bh=1+((hh4>>4)%(yng?2:3));             // new growth is a brighter green, then it matures
            g.fillStyle = yng ? (day?"#79d24a":"#37702f") : (day?"#4e7c3c":"#2c4c34");
            g.fillRect(gx,gy-bh,1,bh+2); }
        }
      }
      if(FGp&&age2<FIRE_DUR&&!fxRainNow){ var ZC=((ZA+ZB)>>1);      // the smoke pall + night fire-glow while it still rages
        g.fillStyle="rgba(110,104,100,0.30)";
        for(var pk2=0;pk2<5;pk2++){ var pt2=(now*0.02+pk2*47)%110;
          g.fillRect((ZC-14+pk2*7+Math.sin(now*0.0006+pk2)*5)|0,(gy-26-pt2*0.6)|0,7,4); }
        if(!day){ g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,110,30,0.10)"; g.fillRect(gA-4,gy-30,gB-gA+8,30);
          g.globalCompositeOperation="source-over"; } }
    }
  }
  // ---- C1: THE FOUNDERS ARRIVE — a caravan treks in from the world's edge to found the town ----
  var arrF=Math.min(1,cg/ARRIVE);
  if(cg>0.0004 && arrF<1 && FGp){
    var stX=(hasOcean&&seaW>0)?WW*seaW+12:24;                   // they step off at the shore (or the world's edge)
    var headX=stX+(cbwx-stX)*arrF;
    drawHorse(g,headX,gy+2,1,L,now,0);                          // a scout rides at the head
    drawHorse(g,headX-13,gy+2,1,L,now,2);                       // the covered wagon with everything they own
    var FGARB=["#7a5a3a","#5a6a4a","#6a4a3a","#8a7a5a","#4a4a3a","#7a6a4a"];   // homespun frontier garb
    for(var fca=0;fca<6;fca++){                                 // the founders walking behind
      var fwx2=headX-26-fca*4-(fca%2), fsx2=fwx2-WOFF;
      for(var wpc=-1;wpc<=1;wpc++){ var FPX=(fsx2+wpc*WW)|0; if(FPX<-4||FPX>SW+4) continue;
        drawPerson(g,FPX,gy+1,FGARB[fca],SKINC[fca%SKINC.length],(Math.floor(now/300)+fca)&1); } }
    var dgx=headX-50-WOFF;                                      // and the dog trotting at the tail
    for(var wpd=-1;wpd<=1;wpd++){ var DGX=(dgx+wpd*WW)|0; if(DGX<-4||DGX>SW+4) continue;
      g.fillStyle=day?"#8a6a4a":"#4a3a28"; g.fillRect(DGX,gy+2,2,1); g.fillRect(DGX+2,gy+1,1,1); }
  }
  // ---- the HOMESTEAD: camp first, then the cabin, then the first log house beside it ----
  if(wild>0.55 && cg>=ARRIVE && FGp){
    var hAlpha=Math.min(1,(wild-0.55)/0.08); g.globalAlpha=hAlpha;
    var chp=Math.max(0,Math.min(1,(cg-ARRIVE)/0.008));          // the cabin goes up first…
    var hp=Math.max(0,Math.min(1,(cg-0.02)/0.03));              // …then the log house
    for(var wp4=-1;wp4<=1;wp4++){
      var CX=(cbwx-WOFF+wp4*WW)|0;
      if(CX>-30&&CX<SW+14){
        if(cg<0.06){                                            // the founders' CAMP while they build
          var campA=Math.min(1,(cg-ARRIVE)/0.003)*(cg>0.045?Math.max(0,1-(cg-0.045)/0.015):1);
          if(campA>0){ var ga0=g.globalAlpha; g.globalAlpha=ga0*campA;
            g.fillStyle=day?"#6a4a30":"#3a2c1c"; g.fillRect(CX-22,gy-2,7,1);          // the parked wagon
            g.fillStyle=day?"#e8e2d2":"#8a857a"; g.fillRect(CX-21,gy-5,5,3);
            g.fillStyle="#16181f"; g.fillRect(CX-21,gy-1,1,1); g.fillRect(CX-17,gy-1,1,1);
            for(var tn2=0;tn2<2;tn2++){ var TXc=CX-14+tn2*6;                          // two canvas tents
              g.fillStyle=day?(tn2?"#c9b896":"#d8d2be"):"#6a6558";
              for(var tr2=0;tr2<3;tr2++) g.fillRect(TXc+tr2,gy-1-tr2,4-tr2*2>0?4-tr2*2:1,1); }
            g.fillStyle=day?"#5a4028":"#2c2014"; g.fillRect(CX-4,gy-1,3,1);            // the log ring
            drawFlame(g,CX-3,gy-1,4,5,now,(CX|0)+17,day?0.85:1);                       // the campfire
            drawFireSmoke(g,CX-3,gy-6,now,(CX|0)+17,day?0.4:0.6,1);
            if(!day){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,160,60,0.3)";
              g.fillRect(CX-7,gy-5,8,5); g.globalCompositeOperation="source-over"; }
            drawSeated(g,CX-6,gy-2,day?"#7a5a3a":"#3e3020",SKINC[1]);                 // settlers round the fire
            drawSeated(g,CX-1,gy-2,day?"#5a6a4a":"#323a28",SKINC[3]);
            g.globalAlpha=ga0; }
        }
        drawCabin(g,CX,gy,day,now,chp);
      }
      var HX=(houseWX-WOFF+wp4*WW)|0;
      if(HX>-16&&HX<SW+16 && hp>0){ drawLogHouse(g,HX,gy,day,now,hp);
        g.fillStyle=day?"#7a5a34":"#4a3826";                    // the log pile the haulers feed
        g.fillRect(HX-5,gy,4,1); g.fillRect(HX-4,gy-1,3,1); g.fillRect(HX-4,gy-2,2,1); }
    }
    // the hauler: trudges out to crew 0's felled tree, shoulders a log, carries it home
    if(chopOn){ var htgt=-1; for(var tk in chopTgt){ if(chopTgt[tk]>0.60 && Math.abs(treeWX(+tk)-cbwx)<=110){ htgt=+tk; break; } }
      if(htgt>=0){ var HT=9000, hph=(now%HT)/HT, loaded=hph<0.5, hf=loaded?(1-hph*2):(hph-0.5)*2;
        var hwx=treeWX(htgt)+(houseWX-2-treeWX(htgt))*(1-hf);   // hf 1=at tree … 0=at house
        var hsx=hwx-WOFF;
        for(var wp5=-1;wp5<=1;wp5++){ var PX=(hsx+wp5*WW)|0; if(PX<-4||PX>SW+4) continue;
          drawPerson(g,PX,gy-1,day?"#5a4a34":"#3e3424",SKINC[2],(Math.floor(now/300))&1);
          if(loaded){ g.fillStyle=day?"#7a5a34":"#4a3826"; g.fillRect(PX-1,gy-3,3,1); } }   // log on the shoulder
      } }
    g.globalAlpha=1;
  }
  if(FGp) drawSettlementLife(g,cg,L,now,nd);   // hunters, gatherers, the cook-fire, the first farm
  // NEW ENGLAND: red barns & fieldstone walls out at the rural edges — they fade as the town paves in
  if(REGION==="newengland" && FGp && wild>0.3){
    var barnA=Math.min(1,(wild-0.3)/0.3);
    var barnXs=[0.15*WW,0.85*WW];
    for(var bni=0;bni<barnXs.length;bni++){ if(inSea(barnXs[bni])) continue;
      var BSX=barnXs[bni]-WOFF; if(BSX>SW+24&&BSX-WW>-24) BSX-=WW; if(BSX<-24&&BSX+WW<SW+24) BSX+=WW;
      if(BSX<-24||BSX>SW+24) continue;
      g.globalAlpha=barnA; drawStoneWall(g,BSX|0,gy,day); drawBarn(g,BSX|0,gy,day,now); g.globalAlpha=1; }
  }
  if(BGp) drawRuins(g,cg,L,now);   // the bones of the fallen city the new one grows around
}

// ============================ ELECTIONS ============================
// The city governs itself: mayoral terms on their own calendar. Campaign season fills the
// streets with posters and rallies; election day brings the queues; the winner's PLATFORM
// visibly changes how the city runs until the next race.
var TERM=0.18;                                                 // of a life per mayoral term (~5-6 mayors per civilization)
var LNAMES=["VOSS","OKONKWO","REYES","CHEN","HALE","IBARRA","KOVACS","DIALLO","MERCER","TANAKA","BLACKWOOD","LUNDGREN"];
var PARTIES=[ {k:"BUILDERS",c:"#e0a83a"}, {k:"GREENS",c:"#3ac86a"}, {k:"SAFETY",c:"#4a90e0"}, {k:"TRANSIT",c:"#c05ad0"} ];
var curMayor=null;
var curBuilds=[];                                              // permanent build-measures standing this life (set each frame)
var curPolicies={heightcap:false,carfree:false,surveil:false}; // term-scoped policy-measures in force right now
var FORCEELECT=null;   // test hook: {partyK,party2K,winName,loseName,phase,measures,builds,policies,scandal} — own line (QML namespace writable)
var curCorps=null;     // this life's corporate landscape (rising/juggernaut/fading companies) — set each frame
var FORCECORP=null;    // test hook: pin a corpState() {li,era,cos,king,cy} for render tests — own line (QML namespace writable)
function mayorState(now){
  var cg2=cityGrowth(now); if(cg2.g<0.35||cg2.phase==="apoc") return null;   // no politics in a hamlet or an inferno
  var li=lifeIndexOf(now), term=Math.floor(cg2.cy/TERM);
  var h=((li*2654435761+term*7919+101)>>>0);
  var a=h%LNAMES.length, b2=(a+1+((h>>>6)%(LNAMES.length-1)))%LNAMES.length;
  var pi=(h>>>4)%4, pj=(pi+1+((h>>>9)%3))%4;
  var aWins=((h>>>16)&1)===0, share=52+((h>>>12)%9);
  var prevP=-1;
  if(term>0){                                                     // N10: a bust at the polls hurts the incumbent party
    var ph2=((li*2654435761+(term-1)*7919+101)>>>0);
    var pWA=((ph2>>>16)&1)===0, pPi=(ph2>>>4)%4, pPj=(pPi+1+((ph2>>>9)%3))%4; prevP=pWA?pPi:pPj;
    var tE=now-(cg2.cy-term*TERM)*GROW_CYCLE;                     // the moment of THIS election (stable)
    if(econOf(tE)<0.42&&((h>>>20)%10)<7){ if(pi===prevP) aWins=false; else if(pj===prevP) aWins=true; }
  }
  var hold=(prevP>=0 && (aWins?pi:pj)===prevP);                   // the incumbent PARTY held City Hall (a re-election)
  var tf=(cg2.cy-term*TERM)/TERM;
  // SCANDAL → RECALL, isolated on its OWN hash so it never perturbs the core term math or who won the race.
  var sh=((((li*2654435761)>>>0) ^ (((term+3)*19349663)>>>0) ^ 0x2545F491)>>>0);
  var scandalTerm=((sh%100)<16), recalled=(scandalTerm&&(((sh>>>8)&1)===0)), recallCy=0.50;
  var M={ term:term, tf:tf,
    winName:LNAMES[aWins?a:b2], loseName:LNAMES[aWins?b2:a],
    party:PARTIES[aWins?pi:pj], party2:PARTIES[aWins?pj:pi], electedParty:PARTIES[aWins?pi:pj], share:share,
    campaign:(tf>0.80&&tf<=0.965), electionDay:(tf>0.965), justElected:(tf<0.07), debate:(tf>0.71&&tf<=0.80),
    hold:hold,                                       // incumbent party re-elected (a "hold"); a fresh party is a "flip"
    scandalTerm:scandalTerm, scandal:(scandalTerm&&tf>0.34&&tf<0.60), recallVote:(scandalTerm&&tf>=0.47&&tf<0.58),
    recalled:recalled, ousted:false,
    measures:termMeasures(li,term),                 // props decided at THIS term's election (already law)
    nextMeasures:termMeasures(li,term+1) };          // props on the ballot in the upcoming race (campaign signage)
  if(recalled && tf>=recallCy){                      // the mayor is thrown out mid-term — the RIVAL party takes City Hall for the rest of the term (a consequence you can watch: party policies flip)
    M.party=PARTIES[aWins?pj:pi]; M.winName=LNAMES[aWins?b2:a]; M.ousted=true; }
  if(FORCEELECT){                                    // test hook: pin party / phase / candidates / scandal for render tests
    if(FORCEELECT.partyK) for(var pk=0;pk<PARTIES.length;pk++){ if(PARTIES[pk].k===FORCEELECT.partyK) M.party=PARTIES[pk]; }
    if(FORCEELECT.party2K) for(var p2=0;p2<PARTIES.length;p2++){ if(PARTIES[p2].k===FORCEELECT.party2K) M.party2=PARTIES[p2]; }
    if(FORCEELECT.winName) M.winName=FORCEELECT.winName;
    if(FORCEELECT.loseName) M.loseName=FORCEELECT.loseName;
    if(FORCEELECT.phase){ M.campaign=(FORCEELECT.phase==="campaign"); M.electionDay=(FORCEELECT.phase==="electionDay"); M.justElected=(FORCEELECT.phase==="justElected"); M.debate=(FORCEELECT.phase==="debate"); }
    if(FORCEELECT.measures){ M.measures=FORCEELECT.measures; M.nextMeasures=FORCEELECT.measures; }
    if(FORCEELECT.scandal){ M.scandal=true; M.scandalTerm=true; }
    if(FORCEELECT.recallVote) M.recallVote=true;
  }
  return M;
}
// City approval 15..92 — the SINGLE source of truth for the news ticker + civic HUD. DISPLAY-ONLY: it reads the
// live per-frame globals (curEcon/curWar/curMayor/curBuilds/curPolicies) and must NEVER feed back into mayorState /
// termMeasures / who-wins (that would re-create the war-outcome flip bug). Purely what the sign shows right now.
function approvalNow(now){
  var a=48 + curEcon*34 - (curWar&&curWar.f>=0&&curWar.f<1.2?18:0) + (curMayor?4:0);
  if(curMayor){ if(curMayor.ousted) a-=10; else if(curMayor.scandal) a-=14; if(curMayor.justElected) a+=6; }  // honeymoon / disgrace
  if(curPolicies){ if(curPolicies.surveil) a-=4; if(curPolicies.carfree) a+=3; if(curPolicies.heightcap) a-=3; }  // soft mood swings
  for(var i=0;i<curBuilds.length;i++){ var t=curBuilds[i].t; if(t==="park")a+=4; else if(t==="stadium"||t==="casino")a+=2; }
  return Math.max(15,Math.min(92,Math.round(a)));
}
// ---------- BALLOT MEASURES ----------
// Props the city votes on, decided deterministically per (life,term) from a SEPARATE hash stream (MEASURE_SALT)
// so they never perturb who wins the mayor's race. Some BUILD permanent landmarks (life-scoped, like ruins);
// some are term-scoped POLICIES that a later election can flip. ~65% of props pass (yes>=50).
var MEASURE_SALT=0x51ED2701;
var MEASURES=[ {t:"monorail",kind:"build",w:0}, {t:"stadium",kind:"build",w:60}, {t:"park",kind:"build",w:70},
  {t:"casino",kind:"build",w:66}, {t:"seawall",kind:"build",w:0},
  {t:"heightcap",kind:"policy"}, {t:"carfree",kind:"policy"}, {t:"surveil",kind:"policy"} ];
var MEASURE_LABEL={monorail:"MONORAIL",stadium:"STADIUM",park:"CITY PARK",casino:"CASINO ZONE",seawall:"SEAWALL",heightcap:"HEIGHT CAP",carfree:"CAR-FREE",surveil:"SAFE CAMS"};
var PARTY_SLOGAN={BUILDERS:"BUILD IT",GREENS:"GO GREEN",SAFETY:"SAFE STREETS",TRANSIT:"RIDE ON"};
function termMeasures(li,term){
  if(term<0) return [];
  var mh=((((li*2654435761)>>>0) ^ (((term+1)*40503)>>>0) ^ MEASURE_SALT)>>>0);
  var n=1+(mh&1), out=[], used=-1;
  for(var i=0;i<n;i++){ var hh=((mh + i*0x9E3779B9)>>>0);
    var mi=hh%MEASURES.length; if(mi===used) mi=(mi+1)%MEASURES.length; used=mi;
    var base=MEASURES[mi], type=base.t, kind=base.kind, w=base.w||0;
    if(type==="seawall"&&!hasOcean){ type="stadium"; kind="build"; w=60; }        // landlocked → seawall is meaningless, swap in a stadium
    var yes=42+((hh>>>8)%26);                                                     // 42..67 → passes iff >=50 (~65% pass)
    out.push({t:type,kind:kind,pass:(yes>=50),yes:yes,w:w,x:((hh>>>3)%Math.max(1,WW))|0,seed:hh,term:term}); }
  return out;
}
// PERMANENT BUILDS standing this life: every past election's PASSED build-measure, still here. Term-indexed
// (≤~6 terms/life) so the scan is tiny + inherently life-scoped — nothing bleeds across the reincarnation wipe.
function passedBuilds(now){
  if(FORCEELECT&&FORCEELECT.builds) return FORCEELECT.builds;
  var out=[], cg=cityGrowth(now); if(cg.g<0.35||cg.phase==="apoc") return out;
  var li=lifeIndexOf(now), curTerm=Math.floor(cg.cy/TERM);
  for(var t=0;t<=curTerm;t++){ var ms=termMeasures(li,t);
    for(var i=0;i<ms.length;i++){ var m=ms[i]; if(m.kind!=="build"||!m.pass) continue;
      if(t===curTerm){ var bt=(cg.cy-t*TERM)/TERM;                                  // LIFECYCLE: this term's build is still going up
        if(bt<0.06) continue;                                                       // ground not yet broken (just after the vote)
        else if(bt<0.30){ m.bp="cons"; m.prog=Math.max(0.05,(bt-0.06)/0.24); }      // under construction (crane + scaffold, rising)
        else if(bt<0.37){ m.bp="open"; m.prog=1; }                                  // GRAND OPENING — ribbon-cutting beat
        else { m.bp="done"; m.prog=1; }
      } else { m.bp="done"; m.prog=1; }                                             // a build from a past term simply stands, finished
      out.push(m); } }
  return out;
}
// does a given permanent build stand this life? (cheap scan of the tiny curBuilds list, set each frame)
function cityHasBuild(t){ for(var i=0;i<curBuilds.length;i++) if(curBuilds[i].t===t) return true; return false; }
// TERM POLICIES in force this term (soft, repealable): the seated mayor's passed policy-measures.
function curPoliciesOf(now){
  var p={heightcap:false,carfree:false,surveil:false};
  if(FORCEELECT&&FORCEELECT.policies){ for(var k in FORCEELECT.policies) p[k]=FORCEELECT.policies[k]; return p; }
  var cg=cityGrowth(now); if(cg.g<0.35||cg.phase==="apoc") return p;
  var li=lifeIndexOf(now), t=Math.floor(cg.cy/TERM), tf=(cg.cy-t*TERM)/TERM; if(tf<0.06) return p;
  var ms=termMeasures(li,t); for(var i=0;i<ms.length;i++){ var m=ms[i]; if(m.kind==="policy"&&m.pass) p[m.t]=true; }
  return p;
}
function drawElections(g,L,now,night){
  var M=curMayor; if(!M) return;
  if(M.campaign){
    // posters go up on every fourth building — both parties, block by block
    var pDrawn=0;
    for(var i=0;i<near.blds.length&&pDrawn<12;i++){ var b=near.blds[i];
      if(b.type==="park"||((b.seed>>>2)%4)!==0) continue;
      if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;
      var bx=(b.x-WOFF)|0; if(bx>SW+4||bx+b.w<-4) continue; pDrawn++;
      var pc=(((b.seed>>>5)&1)===0)?M.party.c:M.party2.c;
      g.fillStyle="#e8ecf4"; g.fillRect(bx+2,HORIZON-8,3,4);           // the poster
      g.fillStyle=pc; g.fillRect(bx+2,HORIZON-8,3,1); g.fillRect(bx+3,HORIZON-6,1,1); }
    // the rally in the plaza: podium, candidate, crowd, party banners
    var rx=Math.round(0.365*WW)-WOFF;
    for(var w=-1;w<=1;w++){ var RX=(rx+w*WW)|0; if(RX<-30||RX>SW+30) continue;
      g.fillStyle=L>0.5?"#6a4a30":"#3e3020"; g.fillRect(RX-2,HORIZON-4,6,3);          // podium
      drawPerson(g,RX,HORIZON-5,M.party.c,"#c9a184",(Math.floor(now/500))&1);         // the candidate, mid-speech
      for(var cr2=0;cr2<8;cr2++) drawPerson(g,RX-14+cr2*3+((cr2*7)%2),HORIZON-1,PEDC[cr2%PEDC.length],SKINC[cr2%SKINC.length],0);
      g.fillStyle=M.party.c; g.fillRect(RX-14,HORIZON-12,1,8); g.fillRect(RX-13,HORIZON-12,4,2);   // banners
      g.fillStyle=M.party2.c; g.fillRect(RX+16,HORIZON-12,1,8); g.fillRect(RX+13,HORIZON-12,3,2);
    }
    // READABLE campaign billboard over the rally: party slogan + VOTE <name> (drawPixText wraps internally → call once)
    var rxw=Math.round(0.365*WW), slo=PARTY_SLOGAN[M.party.k]||"VOTE", sw=textW(slo);
    var vn="VOTE "+M.winName, vw=textW(vn), pw=Math.max(sw,vw);
    for(var wb=-1;wb<=1;wb++){ var bxp=rxw-(pw>>1)-2-WOFF+wb*WW; if(bxp>SW+2||bxp+pw+4<-2) continue;
      g.fillStyle="rgba(10,14,26,0.78)"; g.fillRect(bxp|0,HORIZON-31,pw+4,15);                       // billboard plate
      g.fillStyle=M.party.c; g.fillRect(bxp|0,HORIZON-32,pw+4,1); g.fillRect(bxp|0,HORIZON-16,pw+4,1);
      g.fillStyle=L>0.5?"#5a4a34":"#2a2018"; g.fillRect((bxp+ (pw>>1))|0,HORIZON-16,2,16); }         // post
    drawPixText(g,slo,rxw-(sw>>1),HORIZON-29,M.party.c,1);
    drawPixText(g,vn, rxw-(vw>>1),HORIZON-23,"#eef4ff",0.95);
    // LIVE POLL board to the left of the rally — the two candidates' numbers drift toward the result as election day nears
    var campProg=Math.max(0,Math.min(1,(M.tf-0.80)/0.165)), wob=Math.round(1.5*Math.sin(now*0.0009+M.term));
    var pnum=Math.max(1,Math.min(99,Math.round(50+(M.share-50)*campProg)+wob));
    var pl1=M.winName.substr(0,4)+" "+pnum, pl2=M.loseName.substr(0,4)+" "+(100-pnum), plW=Math.max(textW(pl1),textW(pl2),textW("LIVE POLL")), polX=Math.round(0.30*WW);
    for(var wp=-1;wp<=1;wp++){ var pbx=polX-(plW>>1)-2-WOFF+wp*WW; if(pbx>SW+2||pbx+plW+4<-2) continue;
      g.fillStyle="rgba(8,12,22,0.82)"; g.fillRect(pbx|0,HORIZON-31,plW+4,18);
      g.fillStyle="#5ad0ff"; g.fillRect(pbx|0,HORIZON-32,plW+4,1);
      g.fillStyle=L>0.5?"#4a4034":"#241c14"; g.fillRect((pbx+(plW>>1))|0,HORIZON-13,2,13); }
    drawPixText(g,"LIVE POLL",polX-(textW("LIVE POLL")>>1),HORIZON-30,"#8fd8ff",0.9);
    drawPixText(g,pl1,polX-(textW(pl1)>>1),HORIZON-24,M.party.c,1);
    drawPixText(g,pl2,polX-(textW(pl2)>>1),HORIZON-18,M.party2.c,1);
    var moT=crosser(now,16000,0.05,30,0.7);                             // a MOTORCADE rolls through flying the candidate's colors
    if(moT) for(var mc=0;mc<4;mc++){ var mlane=(moT.dir>0?1:2), mcx=disX(moT.x)-moT.dir*mc*11; if(mcx<-12||mcx>SW+12) continue;
      drawCar(g,mcx|0,HORIZON+LANE[mlane].o,(mc&1)?M.party.c:M.party2.c,moT.dir,L);
      g.fillStyle=(mc&1)?M.party.c:M.party2.c; g.fillRect(mcx|0,HORIZON+LANE[mlane].o-4,1,3); g.fillStyle="#eef1f6"; g.fillRect(mcx|0,HORIZON+LANE[mlane].o-4,2,1); }  // roof flag
  }
  if(M.debate){                                                        // DEBATE NIGHT: two podiums under crossing spotlights, candidates facing off, a watching crowd
    var dxw=Math.round(0.365*WW), dx=dxw-WOFF;
    for(var wd=-1;wd<=1;wd++){ var DX=(dx+wd*WW)|0; if(DX<-40||DX>SW+40) continue;
      g.fillStyle=L>0.5?"#2a2f3a":"#12151d"; g.fillRect(DX-18,HORIZON-2,36,2);                        // stage
      g.fillStyle=M.party.c; g.fillRect(DX-12,HORIZON-6,4,4); g.fillStyle=M.party2.c; g.fillRect(DX+8,HORIZON-6,4,4);   // two podiums
      drawPerson(g,DX-11,HORIZON-6,M.party.c,"#c9a184",(Math.floor(now/600))&1);
      drawPerson(g,DX+9,HORIZON-6,M.party2.c,"#b98a6a",(Math.floor(now/600)+1)&1);
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,250,220,0.13)";                     // crossing spotlights
      for(var sl=0;sl<8;sl++){ g.fillRect((DX-10+Math.sin(now*0.001)*4)|0,(HORIZON-24+sl*3)|0,1+sl,1); g.fillRect((DX+10-Math.sin(now*0.001)*4-sl)|0,(HORIZON-24+sl*3)|0,1+sl,1); }
      g.globalCompositeOperation="source-over";
      for(var dc=0;dc<10;dc++) drawPerson(g,DX-16+dc*3+((dc*5)%2),HORIZON-1,PEDC[dc%PEDC.length],SKINC[dc%SKINC.length],0); }
    var dl="DEBATE TONIGHT", dlw=textW(dl);
    for(var wdb=-1;wdb<=1;wdb++){ var dbxp=dxw-(dlw>>1)-2-WOFF+wdb*WW; if(dbxp>SW+2||dbxp+dlw+4<-2) continue;
      g.fillStyle="rgba(10,14,26,0.82)"; g.fillRect(dbxp|0,HORIZON-27,dlw+4,8); g.fillStyle="#e0d24a"; g.fillRect(dbxp|0,HORIZON-28,dlw+4,1); }
    drawPixText(g,dl,dxw-(dlw>>1),HORIZON-26,"#ffe27a",1);
  }
  if(M.electionDay){
    var vx=Math.round(0.29*WW)-WOFF;                                    // the polling place queue
    for(var w2=-1;w2<=1;w2++){ var VX=(vx+w2*WW)|0; if(VX<-24||VX>SW+24) continue;
      g.fillStyle=L>0.5?"#eef1f6":"#c8ccd6"; g.fillRect(VX,HORIZON-9,7,2);
      g.fillStyle="#2a4a8a"; g.fillRect(VX+1,HORIZON-8,5,1);                          // VOTE sign
      for(var q3=0;q3<6;q3++) drawPerson(g,VX-3-q3*3,HORIZON-1,PEDC[q3%PEDC.length],SKINC[q3%SKINC.length],((Math.floor(now/800)+q3)&1));
    }
    if(M.share<=53){                                                   // a nail-biter — the result won't settle until the recount
      var ncl="TOO CLOSE TO CALL", ncw=textW(ncl), ncx=Math.round(0.29*WW);
      for(var wn2=-1;wn2<=1;wn2++){ var nbx=ncx-(ncw>>1)-2-WOFF+wn2*WW; if(nbx>SW+2||nbx+ncw+4<-2) continue;
        g.fillStyle="rgba(26,20,6,0.86)"; g.fillRect(nbx|0,HORIZON-22,ncw+4,8); g.fillStyle="#ffcf40"; g.fillRect(nbx|0,HORIZON-23,ncw+4,1); }
      if((Math.floor(now/400)&1)) drawPixText(g,ncl,ncx-(ncw>>1),HORIZON-21,"#ffe27a",1);   // blinking
    }
  }
  if(M.justElected){                                                    // the results, city-wide
    var rm;                                                             // how the night was won (a HOLD names the PARTY, not a fresh person — matches the ticker)
    if(M.share>=58) rm="LANDSLIDE "+M.winName+" - "+M.share+" TO "+(100-M.share);
    else if(M.share<=53) rm="RECOUNT CONFIRMS "+M.winName+" - "+M.share+" TO "+(100-M.share);
    else if(M.hold) rm=M.party.k+" HOLDS CITY HALL - "+M.share+" TO "+(100-M.share);
    else rm="MAYOR-ELECT "+M.winName+" - "+M.share+" TO "+(100-M.share);
    var tw4=textW(rm), tx4=Math.round(WW*0.5-tw4/2), ly4=notifLane(1);
    for(var w3=-1;w3<=1;w3++){ var px4=tx4-3-WOFF+w3*WW; if(px4+tw4+6<-2||px4>SW+2) continue;
      g.fillStyle="rgba(8,14,30,0.80)"; g.fillRect(px4|0,ly4,tw4+6,9);
      g.fillStyle=M.party.c; g.fillRect(px4|0,ly4-1,tw4+6,1); g.fillRect(px4|0,ly4+8,tw4+6,1); }
    drawPixText(g,rm,tx4,ly4+2,"rgba(235,240,250,0.95)",1);
    // ELECTION-NIGHT PARTY in the winner's plaza — a cheering crowd, party-colour balloons, fireworks over the skyline
    var pxw=Math.round(0.365*WW), pcx=pxw-WOFF;
    for(var w5=-1;w5<=1;w5++){ var PX=(pcx+w5*WW)|0; if(PX<-32||PX>SW+32) continue;
      for(var pc2=0;pc2<12;pc2++){ var jump=((Math.floor(now/200)+pc2)&1); drawPerson(g,PX-18+pc2*3,HORIZON-1-jump,(pc2%3)?M.party.c:PEDC[pc2%PEDC.length],SKINC[pc2%SKINC.length],jump); }
      for(var bl2=0;bl2<6;bl2++){ var by=HORIZON-8-((now*0.01+bl2*7)%40), bxx=PX-14+bl2*5+Math.sin(now*0.002+bl2)*2;
        g.fillStyle=(bl2&1)?M.party.c:M.party2.c; g.fillRect(bxx|0,by|0,2,2); g.fillStyle="rgba(255,255,255,0.4)"; g.fillRect(bxx|0,(by+2)|0,1,2); } }
    if(L<0.55) for(var fw=0;fw<3;fw++){ var fsd=((fw*97+Math.floor(now/1400))>>>0), fwx=(fsd%SW), fwy=40+((fsd>>4)%80), age=((now/1400)%1), fcol=["#ff6a6a","#ffd24a","#6ad0ff","#b06cff","#3ac86a"][fsd%5];
      g.globalCompositeOperation="lighter"; g.globalAlpha=1-age;
      for(var ray=0;ray<10;ray++){ var ang=ray/10*6.283, rad=age*12; g.fillStyle=fcol; g.fillRect((fwx+Math.cos(ang)*rad)|0,(fwy+Math.sin(ang)*rad)|0,1,1); }
      g.globalAlpha=1; g.globalCompositeOperation="source-over"; }
  }
  if(M.scandal){                                                       // SCANDAL → RECALL: crowds protest at City Hall with placards; a recall vote looms; sometimes the mayor is ousted
    var sxw=Math.round(0.42*WW), scx=sxw-WOFF;
    for(var w6=-1;w6<=1;w6++){ var SX=(scx+w6*WW)|0; if(SX<-44||SX>SW+44) continue;
      for(var pr=0;pr<16;pr++){ var prx=SX-22+pr*3+((Math.floor(now/300)+pr)%2), sway=((Math.floor(now/250)+pr)&1);
        drawPerson(g,prx,HORIZON-1,(pr%2)?"#c0433a":"#3a5aa0",SKINC[pr%SKINC.length],sway);
        if((pr%3)===0){ g.fillStyle="#5a4a34"; g.fillRect(prx+1,HORIZON-6,1,5); g.fillStyle="#eef1f6"; g.fillRect(prx,HORIZON-9,3,3); g.fillStyle="#c0433a"; g.fillRect(prx,HORIZON-9,3,1); } } }
    var scl=M.ousted?(M.winName+" SWORN IN - RECALL PASSED"):(M.recallVote?"RECALL VOTE TODAY":"SCANDAL AT CITY HALL"), scw=textW(scl);
    for(var w7=-1;w7<=1;w7++){ var sbxp=sxw-(scw>>1)-2-WOFF+w7*WW; if(sbxp>SW+2||sbxp+scw+4<-2) continue;
      g.fillStyle="rgba(30,8,10,0.86)"; g.fillRect(sbxp|0,HORIZON-30,scw+4,8); g.fillStyle="#ff4040"; g.fillRect(sbxp|0,HORIZON-31,scw+4,1); }
    drawPixText(g,scl,sxw-(scw>>1),HORIZON-29,"#ff6a6a",1);
  }
}
// CIVIC POLICY: the winning party visibly reshapes the city for their term — GREENS bolt solar to the
// rooftops, SAFETY hangs security cameras (+ patrols), BUILDERS throw up cranes. (TRANSIT already runs
// extra buses; GREENS also line the boulevard with trees; BUILDERS juice the economy → which lifts every
// neighbourhood's wealth via wealthOf — so an election you can literally watch reshape the class map.)
function drawCivicPolicy(g,L,now){
  if(!curMayor||!near||!near.blds) return; var k=curMayor.party.k;
  if(k==="GREENS"){                                             // rooftop solar arrays
    for(var i=0;i<near.blds.length;i++){ var b=near.blds[i]; if(b.type==="park"||b.nePitch||b.h<12||((b.seed>>>6)%3)!==0) continue;
      var top=near.y0-b.h, sx=(b.x-WOFF); if(sx>SW+4||sx+b.w<-4) continue;
      for(var p=2;p<b.w-3;p+=3){ g.fillStyle=L>0.5?"#26386a":"#141d38"; g.fillRect((sx+p)|0,top,2,2);
        g.globalCompositeOperation="lighter"; g.fillStyle="rgba(130,180,255,"+(0.28*L+0.05).toFixed(2)+")"; g.fillRect((sx+p)|0,top,1,1); g.globalCompositeOperation="source-over"; } }
  } else if(k==="SAFETY"){                                      // security cameras blink on the light poles
    for(var c=0;c<10;c++){ var hh=((c*2654435761+55)>>>0), cx=(hh%WW)-WOFF; if(cx>SW+4&&cx-WW>-4)cx-=WW; if(cx<-4&&cx+WW<SW+4)cx+=WW;
      if(cx<-2||cx>SW+2||inSea(cx+WOFF)) continue;
      g.fillStyle=L>0.5?"#3a3e46":"#1a1c22"; g.fillRect(cx|0,HORIZON-9,2,1);
      if((Math.floor(now/700)+c)&1){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,60,60,0.85)"; g.fillRect(cx|0,HORIZON-9,1,1); g.globalCompositeOperation="source-over"; } }
  } else if(k==="BUILDERS"){                                    // a building boom — an extra crane swinging over a tower
    var bi=(Math.floor(now/9000))%Math.max(1,near.blds.length), b2=near.blds[bi];
    if(b2&&b2.type!=="park"&&b2.h>14){ var top2=near.y0-b2.h, sx2=(b2.x-WOFF)+b2.w;
      if(sx2>-4&&sx2<SW+4){ g.fillStyle=L>0.5?"#e0a83a":"#5a4418"; g.fillRect(sx2|0,top2-14,2,14);
        var jib=10, slew=Math.sin(now*0.0006+bi); if(slew>0) g.fillRect((sx2+2)|0,top2-14,jib,1); else g.fillRect((sx2-jib)|0,top2-14,jib,1); } }
  }
  if(curPolicies.surveil){                                     // SURVEILLANCE ACT (voted): full police-state look — a camera on every pole + a patrol drone sweeping a searchlight
    for(var sc=0;sc<14;sc++){ var sh=((sc*2654435761+91)>>>0), scx=(sh%WW)-WOFF; if(scx>SW+4&&scx-WW>-4)scx-=WW; if(scx<-4&&scx+WW<SW+4)scx+=WW;
      if(scx<-3||scx>SW+3||inSea(scx+WOFF)) continue; var camY=HORIZON-16, ldir=(sh&1)?1:-1;
      g.fillStyle=L>0.5?"#2c3038":"#12141a"; g.fillRect(scx|0,camY,3,2);                                // camera housing
      g.fillStyle=L>0.5?"#1a1c22":"#0a0b0f"; g.fillRect((scx+(ldir>0?3:-1))|0,camY,1,2);                 // lens snout, aimed at the street
      g.fillStyle="#5a6068"; g.fillRect((scx+1)|0,camY+2,1,2);                                           // pole mount
      g.globalCompositeOperation="lighter"; var bl=((Math.floor(now/500)+sc)&1);                        // steady red watch-eye
      g.fillStyle="rgba(255,40,40,"+(bl?0.95:0.55)+")"; g.fillRect((scx+(ldir>0?3:-1))|0,camY,1,1); g.globalCompositeOperation="source-over"; }
    var dph=((now*0.02)%(SW+140))-70, dy=HORIZON-50-((Math.sin(now*0.002)*4)|0);                        // a patrol drone tracking down the boulevard
    g.fillStyle=L>0.5?"#22262e":"#0c0e13"; g.fillRect(dph|0,dy,5,2);                                     // fuselage
    g.fillStyle="#3a3f48"; g.fillRect((dph+1)|0,dy-1,3,1); g.fillRect((dph-1)|0,dy,1,1); g.fillRect((dph+5)|0,dy,1,1);   // rotors
    if((Math.floor(now/200))&1){ g.fillStyle="#ff3b3b"; g.fillRect(dph|0,dy+1,1,1); }                    // nav light
    g.globalCompositeOperation="lighter";                                                               // a bright searchlight cone sweeping down to a pool on the road
    var coneH=Math.max(6,HORIZON-(dy+2));
    for(var lc=0;lc<12;lc++){ var fr=lc/11, lcw=1+Math.round(fr*7);
      g.fillStyle="rgba(200,225,255,"+(0.20*(1-fr)+0.05).toFixed(2)+")"; g.fillRect((dph+2-(lcw>>1))|0,(dy+2+fr*coneH)|0,lcw,(Math.ceil(coneH/12)+1)); }
    g.fillStyle="rgba(200,225,255,0.28)"; g.fillRect(((dph+2)|0)-4,HORIZON-1,8,1);                       // light pool on the street
    g.globalCompositeOperation="source-over";
  }
  if(curPolicies.heightcap){                                   // HEIGHT CAP (voted): a zoning ceiling drawn across the skyline — cranes top out here (see drawSite), the city stays low-rise
    var capY=HORIZON-42;
    g.globalCompositeOperation="lighter";
    for(var zx=((now/140|0)%7); zx<SW; zx+=7){ g.fillStyle="rgba(255,130,60,0.5)"; g.fillRect(zx,capY,4,1); }   // dashed zoning-limit line (slowly marching = surveyor's tape)
    g.globalCompositeOperation="source-over";
    var zl="ZONING LIMIT", zw=zl.length*4-1;
    g.fillStyle="rgba(18,10,6,0.82)"; g.fillRect(42,capY-8,zw+4,7); g.fillStyle="rgba(255,130,60,0.9)"; g.fillRect(42,capY-9,zw+4,1);
    drawUiText(g,zl,44,capY-7,"#ffb060",1);
  }
  if(curMayor.campaign){                                        // campaign season: yard signs everywhere
    for(var y=0;y<20;y++){ var yh=((y*2654435761+207)>>>0), yx=(yh%WW)-WOFF; if(yx>SW+4&&yx-WW>-4)yx-=WW; if(yx<-4&&yx+WW<SW+4)yx+=WW;
      if(yx<-2||yx>SW+2||inSea(yx+WOFF)) continue;
      g.fillStyle="#c9cdd6"; g.fillRect(yx|0,HORIZON-3,1,3);
      g.fillStyle=((yh>>3)&1)?curMayor.party.c:curMayor.party2.c; g.fillRect((yx-1)|0,HORIZON-4,3,2); }
  }
}
// ============================ WAR ============================
// Some lives get invaded (deterministic per life). An election sets the defense budget
// everyone can see; the battle's outcome depends on it. Victory ends in funerals and
// repair; defeat ends in OCCUPATION — the invaders' banners fly until the endtimes.
function warState(now){
  var li=lifeIndexOf(now), h=((li*2654435761+7717)>>>0);
  if((h%100)>=62) return null;                                 // ~38% of lives never see war
  var cg2=cityGrowth(now); if(cg2.phase==="apoc"||cg2.g<0.55) return null;
  var cyAt=0.50+((h>>>8)%1000)/1000*0.20;
  var warMayor=mayorState(now+(cyAt-cg2.cy)*GROW_CYCLE);       // the mayor IN OFFICE when the war begins funds the defense — locking to cyAt keeps the outcome stable even if the battle spans a new election or a recall
  var mf2=Math.min(1,milFund+((warMayor&&(warMayor.electedParty||warMayor.party).k==="SAFETY")?0.18:0));
  var winP=0.45+0.42*mf2, win=(((h>>>16)%1000)/1000)<winP;
  var f=(cg2.cy-cyAt)/0.035;
  if(f<-0.15) return null;                                     // (f<0 = pre-war: election season)
  return {f:f, win:win, x:Math.round(WW*(0.28+((h>>>4)%450)/1000)), seed:h, cyAt:cyAt, cy:cg2.cy};
}
// ============================ PERMANENT BUILDS (voted landmarks) ============================
// A passed BUILD-measure stands for the rest of the life. Zone-builds (stadium/park/casino) occupy a
// district — the building loop clears the ground there (skips those buildings) and the whole structure is
// drawn here in ONE pass, in the near layer (so traffic passes in front). Rendered EVERY frame for hours →
// every renderer is STATIC/cheap with hard-bounded loops (same freeze discipline as ruins).
function isZoneBuild(t){ return t==="stadium"||t==="park"||t==="casino"; }
function drawBuilds(g,L,now,night){
  if(!curBuilds.length||nukeStruck()) return;
  for(var i=0;i<curBuilds.length;i++){ var cb=curBuilds[i];
    if(cb.t==="monorail"){ drawMonorail(g,L,now,cb); continue; }          // full-width elevated line (positions itself)
    if(cb.t==="seawall"){ if(hasOcean) drawSeawall(g,L,now,cb); continue; } // runs along the shore
    var cx=disX(cb.x); if(cx<-(cb.w||70)-24||cx>SW+(cb.w||70)+24) continue;  // zone-builds: offscreen cull (disX wraps)
    if(cb.bp==="cons"){ drawBuildSite(g,cx,cb,L,now,night); continue; }      // still going up → construction site, not the finished landmark
    if(cb.t==="stadium") drawArena(g,cx,cb,L,now,night);
    else if(cb.t==="casino") drawCasino(g,cx,cb,L,now);
    else if(cb.t==="park") drawCityPark(g,cx,cb,L,now);
    if(cb.bp==="open") drawRibbon(g,cx,cb,L,now);                            // GRAND OPENING beat, overlaid on the finished build
  }
}
// A zone-build UNDER CONSTRUCTION: hoarding fence, rising scaffold + shell, a swaying tower crane, a night
// worklight, and a "COMING SOON — <PROJECT>" board with a progress bar. Everything derives from cb.prog (0..1),
// so it visibly climbs across the term until the ribbon-cutting. Cheap/bounded → freeze-safe.
function drawBuildSite(g,cx,cb,L,now,night){
  var gy=HORIZON, w=cb.w||60, x0=(cx-(w>>1))|0, seed=(cb.seed>>>0), prog=(cb.prog==null?0.5:cb.prog);
  var sh=Math.round((16+(seed%8))*prog);                                                       // current build height
  // hoarding fence with caution stripes
  for(var sx2=x0;sx2<x0+w;sx2+=4){ g.fillStyle=(((sx2-x0)>>2)&1)?"#e0b040":"#20242c"; g.fillRect(sx2,gy-6,3,6); }
  // partly-built concrete shell behind the scaffold
  if(sh>2){ g.fillStyle=L>0.5?"#6b7280":"#1c222c"; g.fillRect(x0+6,gy-6-Math.round(sh*0.85),w-12,Math.round(sh*0.85)); }
  // scaffolding: decks + uprights
  for(var lv=0; lv<sh; lv+=4){ g.fillStyle=L>0.5?"#9098a4":"#2c333e"; g.fillRect(x0+3,gy-6-lv,w-6,1); }
  for(var vp=x0+4; vp<x0+w-3; vp+=8){ g.fillStyle=L>0.5?"#828a96":"#262c36"; g.fillRect(vp,gy-6-sh,1,sh); }
  // tower crane on the right edge: mast + jib + swaying hook load
  var mx=x0+w-5, mastTop=gy-6-sh-12;
  g.fillStyle=L>0.5?"#d0a840":"#7a6320"; g.fillRect(mx,mastTop,2,gy-6-mastTop);
  var jib=Math.round(w*0.5); g.fillRect(mx-jib,mastTop,jib+2,2);
  var hookX=(mx-jib+8+Math.round(3*Math.sin(now*0.0016+seed)))|0, hookY=(mastTop+4+Math.round(5+4*Math.sin(now*0.0013+seed)))|0;
  g.fillStyle=L>0.5?"#c8ccd2":"#3a4048"; g.fillRect(hookX,mastTop+2,1,hookY-mastTop-2);
  g.fillStyle=L>0.5?"#a08040":"#5a4a20"; g.fillRect(hookX-2,hookY,4,3);
  if(L<0.5){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,240,180,0.4)"; g.fillRect(x0+4,gy-6-sh-1,6,3); g.globalCompositeOperation="source-over"; }
  // "COMING SOON — <PROJECT>" board with a live progress bar
  var lab=MEASURE_LABEL[cb.t]||"PROJECT", tw=textW(lab), bw2=Math.max(tw,textW("COMING SOON"))+6, bxb=(cx-(bw2>>1))|0, byb=mastTop-13;
  g.fillStyle="rgba(10,12,18,0.86)"; g.fillRect(bxb,byb,bw2,14);
  g.fillStyle="#e0b040"; g.fillRect(bxb,byb-1,bw2,1); g.fillRect(bxb,byb+14,bw2,1);
  drawUiText(g,"COMING SOON",(cx-(textW("COMING SOON")>>1))|0,byb+2,"rgba(200,220,240,0.85)",1);
  drawUiText(g,lab,(cx-(tw>>1))|0,byb+8,"#ffe0a0",1);
  g.fillStyle="rgba(255,255,255,0.15)"; g.fillRect(bxb+2,byb+14+2,bw2-4,2);
  g.fillStyle="#ffd24a"; g.fillRect(bxb+2,byb+14+2,Math.round((bw2-4)*prog),2);
}
// GRAND OPENING (ribbon-cutting) — a brief celebration overlaid on the just-finished landmark: red ribbon + bow,
// a small opening-day crowd, confetti, and a "NOW OPEN" banner. Bounded loops + wrap-limited confetti → freeze-safe.
function drawRibbon(g,cx,cb,L,now){
  var gy=HORIZON, w=cb.w||60, x0=(cx-(w>>1))|0, seed=(cb.seed>>>0);
  g.fillStyle="#e0304a"; g.fillRect(x0,gy-8,w,2); g.fillStyle="#ff5a6e"; g.fillRect(x0,gy-8,w,1);   // ribbon
  g.fillStyle="#ffd24a"; g.fillRect(cx-2,gy-9,4,4);                                                 // gold bow
  for(var p=0;p<8;p++){ var px=x0+4+((p*seed+p*p*13)%(w-8));                                         // opening-day crowd
    drawPerson(g,px|0,gy,PEDC[(p+seed)%PEDC.length],SKINC[(p*3+seed)%SKINC.length],Math.abs(Math.sin(now*0.01+p))); }
  var CONF=["#ff5a6e","#ffd24a","#5ad0ff","#6ad06a","#ff9af0"];
  g.globalCompositeOperation="lighter";
  for(var c=0;c<16;c++){ var cc=((c*seed+c*17)>>>0), cxp=x0+(cc%w), cyp=gy-26+((now*0.05+c*23)%40);   // confetti fall
    g.fillStyle=CONF[c%CONF.length]; g.fillRect(cxp|0,cyp|0,1,1); }
  g.globalCompositeOperation="source-over";
  var msg="NOW OPEN", tw=textW(msg), bxb=(cx-((tw+8)>>1))|0, byb=gy-36;
  g.fillStyle="rgba(10,12,18,0.86)"; g.fillRect(bxb,byb,tw+8,9);
  g.fillStyle="#ffd24a"; g.fillRect(bxb,byb-1,tw+8,1); g.fillRect(bxb,byb+9,tw+8,1);
  drawUiText(g,msg,bxb+4,byb+2,"#ffe6a0",1);
}
// A voted ARENA: an oval bowl with tiered seating, corner floodlight towers, a readable marquee, and
// EVENT NIGHTS (~1 in 3 nights) when the floods blaze, the pitch glows, and the crowd sparkles.
// (Named drawArena — NOT drawStadium — to avoid colliding with the civic-landmark drawStadium at ~4341.)
function drawArena(g,cx,cb,L,now,night){
  var gy=HORIZON, w=cb.w||60, x0=(cx-(w>>1))|0, seed=(cb.seed>>>0), H=20+(seed%6);
  var wallB=L>0.5?"#8790a0":"#242a38", wallD=L>0.5?"#6b7382":"#171c28";
  // the bowl — a domed oval wall, column by column (center taller than the ends)
  for(var cxx=0;cxx<w;cxx++){ var tN=(cxx/(w-1))*2-1, rimDrop=Math.round(tN*tN*6), top=gy-H+rimDrop;
    g.fillStyle=((cxx%5)===0)?wallD:wallB; g.fillRect(x0+cxx,top,1,gy-top); }
  for(var ty=1;ty<=3;ty++){ g.fillStyle=wallD; g.fillRect(x0+1,gy-ty*5,w-2,1); }          // tier/seating rings
  var rimY=gy-H-1; g.fillStyle=L>0.5?"#9aa4b4":"#2c3444"; g.fillRect(x0+2,rimY,w-4,2);      // open rim
  var event=(((Math.floor(now/9000)+seed)%3)===0), lit=(L<0.5&&event);                      // is a game on tonight?
  // corner floodlight towers
  for(var s=-1;s<=1;s+=2){ var fx=x0+(s<0?3:w-5);
    g.fillStyle=L>0.5?"#c0c6d0":"#3a4150"; g.fillRect(fx,gy-H-10,1,10);                      // pole
    g.fillStyle=lit?"#fffbe0":(L>0.5?"#d8dee8":"#4a5262"); g.fillRect(fx-1,gy-H-12,3,2);     // lamp bank
    if(lit){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,250,210,0.5)";
      for(var ck=0;ck<6;ck++) g.fillRect((fx+(s<0?1:-1-ck))|0,gy-H-10+ck,1+ck,1);            // light cone toward the pitch
      g.globalCompositeOperation="source-over"; } }
  if(lit){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,220,140,0.28)"; g.fillRect(x0+3,rimY-1,w-6,3); // pitch glow
    g.globalCompositeOperation="source-over";
    for(var cf=0;cf<w;cf+=2){ if(((cf*7+Math.floor(now/300)+seed)%4)===0){ g.fillStyle=["#ffd24a","#ff6a6a","#6ad0ff","#eaeaea"][(cf+seed)%4]; g.fillRect(x0+cf,gy-H+2,1,1); } } } // crowd sparkle
  // readable marquee on the front face
  var lab=teamName+" STADIUM", lw=textW(lab); if(lw>w+18){ lab=teamName; lw=textW(lab); }
  var mx=(cx-(lw>>1))|0, my=gy-6;
  g.fillStyle=lit?"rgba(20,16,8,0.9)":"rgba(14,18,28,0.85)"; g.fillRect(mx-2,my-1,lw+4,7);
  drawPixText(g,lab, (cb.x-(lw>>1)), my, lit?"#ffe27a":"#cfe0ff", 1);                        // world-x so it wraps to the same on-screen spot as the body
}
// A voted CASINO ZONE: a dark glitzy block drowned in chase-animated neon, roofline bulbs, and a hot-pink marquee.
function drawCasino(g,cx,cb,L,now){
  var gy=HORIZON, w=cb.w||66, x0=(cx-(w>>1))|0, seed=(cb.seed>>>0), H=30+(seed%10);
  g.fillStyle=L>0.5?"#2a2440":"#160f24"; g.fillRect(x0,gy-H,w,H);                             // glitzy block
  var pal=["#ff2a9d","#05d9e8","#ffd23a","#b06cff","#ff6a3a"];                                // dense neon window grid, chasing
  for(var wy=gy-H+3; wy<gy-2; wy+=3){ for(var wx=x0+2; wx<x0+w-2; wx+=3){
    var on=((wx*7+wy*3+Math.floor(now/220))%3)!==0;
    g.fillStyle=on?pal[((wx+wy+seed)>>1)%pal.length]:(L>0.5?"#3a3350":"#0e0a18");
    g.globalAlpha=on?0.9:0.5; g.fillRect(wx,wy,2,2); } }
  g.globalAlpha=1; g.globalCompositeOperation="lighter";                                      // roofline chase bulbs
  for(var rb=x0; rb<x0+w; rb+=2){ if(((rb+Math.floor(now/120))%4)===0){ g.fillStyle="rgba(255,210,90,0.9)"; g.fillRect(rb,gy-H-1,1,1); } }
  g.globalCompositeOperation="source-over";
  var word="CASINO", ww2=textW(word);                                                        // hot-pink marquee
  g.fillStyle="rgba(10,6,16,0.9)"; g.fillRect((cx-(ww2>>1))-2, gy-H+1, ww2+4, 7);
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,42,157,0.30)"; g.fillRect((cx-(ww2>>1))-3, gy-H, ww2+6, 9); g.globalCompositeOperation="source-over";
  drawPixText(g, word, cb.x-(ww2>>1), gy-H+2, "#ff5ab0", 1);
}
// A voted CITY PARK: grass, a pond, scattered trees, path lamps at night, a few people strolling.
// (drawCityPark — NOT drawPark — to avoid colliding with the near-row greenspace drawPark(g,p,bx,...) at ~2624.)
function drawCityPark(g,cx,cb,L,now){
  var gy=HORIZON, w=cb.w||70, x0=(cx-(w>>1))|0, seed=(cb.seed>>>0);
  g.fillStyle=L>0.5?"#3f6a34":"#16301a"; g.fillRect(x0,gy-3,w,3);                             // grass
  g.fillStyle=L>0.5?"#4c7d3e":"#1b3a20"; g.fillRect(x0,gy-4,w,1);
  var pw=Math.round(w*0.30), px=x0+(w>>1)-(pw>>1);                                            // pond
  g.fillStyle=L>0.5?"#3f78b0":"#1a3050"; g.fillRect(px,gy-3,pw,2);
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,200,255,0.22)"; g.fillRect(px+1,gy-3,pw-2,1); g.globalCompositeOperation="source-over";
  var nT=Math.max(3,(w/11)|0);                                                                // trees (deterministic)
  for(var t=0;t<nT;t++){ var th=((t*2654435761+seed)>>>0), tx=x0+3+(th%Math.max(1,w-6)), trunkTop=gy-6, ch=3+(th%3);
    if(tx>px-2&&tx<px+pw+2) continue;                                                         // keep the pond clear
    g.fillStyle=L>0.5?"#5a3f26":"#241a10"; g.fillRect(tx,trunkTop,1,3);                       // trunk
    g.fillStyle=L>0.5?"#3c6e30":"#14301a"; g.fillRect(tx-2,trunkTop-ch,5,ch);                 // canopy
    g.fillStyle=L>0.5?"#4f8a40":"#1c4226"; g.fillRect(tx-1,trunkTop-ch,3,1); }               // sunlit crown
  if(L<0.5) for(var lp=x0+6; lp<x0+w-4; lp+=15){ g.fillStyle="#3a3f48"; g.fillRect(lp,gy-8,1,5);   // path lamps
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,220,150,0.8)"; g.fillRect(lp,gy-9,1,1); g.globalCompositeOperation="source-over"; }
  for(var pp=0;pp<3;pp++){ var ppx=x0+8+pp*((w/3)|0)+((Math.floor(now/1000)+pp)%3);            // strollers
    drawPerson(g,ppx,gy-1,PEDC[(pp+seed)%PEDC.length],SKINC[pp%SKINC.length],(Math.floor(now/400)+pp)&1); }
  var lab="CITY PARK", lw=textW(lab); if(lw<=w) drawPixText(g,lab, cb.x-(lw>>1), gy-13, L>0.5?"#bfe0b0":"#8fd08a", 0.9);
}
// A voted MONORAIL: a full-width elevated beam on world-anchored pylons, with a sleek train gliding along.
// Rides HIGH above the pre-existing el-train viaduct (which sits at ~HORIZON-GROUND*1.1) so the two lines never
// share a level; under construction, a railhead crane lays the beam left→right (supports leading the deck).
function drawMonorail(g,L,now,cb){
  var gy=HORIZON, ry=gy-(Math.round(GROUND*1.1)+34)-((cb.seed||0)%4), spacing=64, prog=(cb.prog==null?1:cb.prog);
  var beamEnd=Math.round(SW*prog);                                                            // under construction: the line extends left→right
  var pylonEnd=Math.min(SW,beamEnd+(prog<1?spacing:0));                                        // supports are erected a span AHEAD of the laid beam
  var startW=Math.floor((WOFF-spacing)/spacing)*spacing;
  for(var wx=startW; wx<WOFF+SW+spacing; wx+=spacing){ var sx=(wx-WOFF)|0; if(sx>pylonEnd+2) continue;   // world-anchored pylons
    g.fillStyle=L>0.5?"#8a9099":"#20252e"; g.fillRect(sx,ry+3,2,gy-(ry+3)); g.fillRect(sx-2,ry+1,6,2); }
  g.fillStyle=L>0.5?"#9aa0a8":"#252b34"; g.fillRect(0,ry,beamEnd,3);                          // the beam
  g.fillStyle=L>0.5?"#c0c6cc":"#39414c"; g.fillRect(0,ry,beamEnd,1);                          // rail highlight
  if(prog<1){                                                                                 // UNDER CONSTRUCTION — a railhead crane lays the beam
    var hx=Math.min(SW-2,beamEnd);
    g.fillStyle=L>0.5?"#e0a83a":"#7a6320"; g.fillRect(hx,ry-18,3,gy-(ry-18));                 // crane mast at the railhead (tall, hi-vis)
    g.fillRect(hx-13,ry-18,16,2);                                                             // jib reaching back over the finished beam
    g.fillRect(hx+2,ry-18,4,1);                                                               // counter-jib
    var seg=Math.round(5+(1+Math.sin(now*0.003))*5);                                          // a beam segment swinging up on the hoist
    g.fillStyle="rgba(40,40,48,0.85)"; g.fillRect(hx-9,ry-16,1,seg);
    g.fillStyle=L>0.5?"#9aa0a8":"#3a414c"; g.fillRect(hx-12,(ry-16+seg)|0,7,2);               // the girder on the hook
    if((Math.floor(now/500))&1){ g.fillStyle="#ff4040"; g.fillRect(hx,ry-19,1,1); }           // aircraft-warning strobe atop the mast
    g.fillStyle="#ffcf40"; g.fillRect(hx-1,ry-1,3,6);                                         // hi-vis railhead marker
    if((Math.floor(now/110))%3===0){ g.globalCompositeOperation="lighter";                    // WELDING FLASH at the railhead — the eye-catcher
      g.fillStyle="rgba(190,225,255,0.95)"; g.fillRect(hx-1,ry-3,3,3);
      g.fillStyle="rgba(255,255,225,0.75)"; g.fillRect(hx-3,ry-4,6,1); g.fillRect(hx,ry-6,1,2);
      g.globalCompositeOperation="source-over"; }
    return;                                                                                   // no train until the line is finished
  }
  var trainW=42, tx=((now*0.05)%(SW+trainW+90))-trainW-50;                                    // the train glides across
  if(tx>-trainW-4&&tx<SW+4) drawMonoTrain(g,tx|0,ry,L);
}
function drawMonoTrain(g,x,ry,L){
  var carC=L>0.5?"#e8edf3":"#c8d2e0", win=L>0.5?"#2a3550":"#0a1830", winLit="#8fd0ff";
  g.fillStyle=carC; g.fillRect(x-2,ry-5,2,4);                                                 // nose
  if(L<0.5){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,210,255,0.5)"; g.fillRect(x-3,ry-4,1,2); g.globalCompositeOperation="source-over"; }
  for(var c=0;c<3;c++){ var cx0=x+c*14;
    g.fillStyle=carC; g.fillRect(cx0,ry-6,12,6); g.fillStyle="#8a94a4"; g.fillRect(cx0,ry-1,12,1);
    for(var wq=cx0+2; wq<cx0+11; wq+=3){ g.fillStyle=(L<0.5)?winLit:win; g.fillRect(wq,ry-4,2,2); } }
}
// A voted SEAWALL (ocean lives only): a raised concrete barrier at each shore, wave-washed at its base.
function drawSeawall(g,L,now,cb){
  if(!hasOcean||seaW<=0) return; var gy=HORIZON, prog=(cb.prog==null?1:cb.prog), wallH=Math.max(2,Math.round(11*prog));   // rises with construction progress
  var shores=[Math.round(WW*seaW), Math.round(WW*(1-seaW))];
  for(var s=0;s<2;s++){ var sx=disX(shores[s]); if(sx<-10||sx>SW+10) continue;
    g.fillStyle=L>0.5?"#8a8f96":"#33383f"; g.fillRect((sx-3)|0,gy-wallH,6,wallH);             // concrete barrier
    g.fillStyle=L>0.5?"#6f747b":"#23272d"; g.fillRect((sx-3)|0,gy-wallH,6,1);                 // cap
    if(wallH>=6){ g.fillStyle=L>0.5?"#767b82":"#2a2e34"; g.fillRect((sx-3)|0,gy-wallH+4,6,1); }   // seam (only on a full-height wall)
    var seaward=(s===0?-1:1);                                                                 // wave breaking on the sea side
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(180,220,255,"+(0.30+0.22*Math.sin(now*0.006+s)).toFixed(2)+")";
    g.fillRect((sx+seaward*4)|0,gy-3,2,3); g.fillRect((sx+seaward*3)|0,gy-1,3,1); g.globalCompositeOperation="source-over"; }
}
// The military tech EVOLVES as the city is reborn across its lives: the first civilisation
// fights with swords & bows, later ones with muskets, then modern rifles+tanks, then energy weapons.
var WAR_TIERS=[
  {id:0, era:"MEDIEVAL", label:"SIEGE"},        // swords, bows, catapults, shields
  {id:1, era:"MUSKET",   label:"ASSAULT"},      // muskets, cannons, black-powder smoke
  {id:2, era:"MODERN",   label:"INVASION"},     // rifles, tracers, tanks
  {id:3, era:"LASER",    label:"INCURSION"}      // energy rifles, beams, walkers
];
function warTech(li){ return WAR_TIERS[Math.min(3, li<0?0:li)]; }   // life 0 = medieval → advances to laser

// A clearly-visible ~7px soldier. inv=enemy(red) vs the city's own defenders(steel-blue).
// The weapon is drawn per tech tier and faces the enemy; some medieval troops are archers/shield-bearers.
function drawWarSoldier(g,X,gy,inv,tier,now,k,face){
  face=(face===undefined)?(inv?-1:1):face; X=X|0;
  var uni=inv?"#8a2a30":"#3f5f96", uniD=inv?"#511820":"#26385e",
      helm=inv?"#5e222a":"#93a2ba", skin=SKINC[k%SKINC.length];
  var bob=((Math.floor(now/150)+k)&1), Y=(gy-bob)|0;
  g.fillStyle=uniD; g.fillRect(X,Y-2,2,2);                              // legs
  g.fillStyle=uni;  g.fillRect(X,Y-5,2,3);                              // torso
  g.fillStyle=skin; g.fillRect(X,Y-6,2,1);                              // head
  g.fillStyle=helm; g.fillRect(X,Y-7,2,1);                             // helmet
  if(!inv){ g.fillStyle=helm; g.fillRect(X+(face>0?0:1),Y-8,1,1); }     // defenders wear a crest
  else    { g.fillStyle="#c02030"; g.fillRect(X+(face>0?0:1),Y-8,1,1); }// invaders a red spike
  var hand=X+(face>0?2:-1), hy=Y-4, tip=face>0?hand+1:hand-1;
  var fire=(((Math.floor(now/130)+k*3)%4)===0);
  if(tier===0){                                                        // MEDIEVAL
    if(k%3===2){ g.fillStyle="#6a4a24"; g.fillRect(hand,Y-7,1,5);       //  archer: bow stave
      g.fillStyle="rgba(210,210,210,0.6)"; g.fillRect(hand+(face>0?-1:1),Y-6,1,3); }   // string
    else { g.fillStyle="#c8ccd6"; g.fillRect(hand,Y-9,1,5);            //  swordsman: raised blade
      g.fillStyle="#8a6a3a"; g.fillRect(hand,Y-5,1,1);                 //   hilt
      g.fillStyle=inv?"#611820":"#2f4a78"; g.fillRect(X+(face>0?-1:2),Y-5,1,3); }      // shield on the off-hand
  } else if(tier===1){                                                 // MUSKET
    g.fillStyle="#3a2c1c"; g.fillRect(face>0?hand:hand-2,hy,3,1);       //  long barrel
    g.fillStyle="#6a5030"; g.fillRect(hand,hy+1,1,1);                   //  stock
    if(fire){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,220,140,0.95)"; g.fillRect(tip+(face>0?1:-1),hy,2,1);
      g.globalCompositeOperation="source-over"; g.fillStyle="rgba(150,150,155,0.55)"; g.fillRect(tip+(face>0?1:-2),hy-1,2,2); } // muzzle flash + smoke
  } else if(tier===2){                                                 // MODERN RIFLE
    g.fillStyle="#20242a"; g.fillRect(face>0?hand:hand-1,hy,2,1);
    if(fire){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,235,150,0.95)"; g.fillRect(tip+(face>0?1:-1),hy,1,1); g.globalCompositeOperation="source-over"; }
  } else {                                                             // LASER
    g.fillStyle="#2a2f3a"; g.fillRect(face>0?hand:hand-1,hy,2,1);
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,240,255,0.9)"; g.fillRect(tip,hy,1,1);
    if(fire){ g.fillStyle="rgba(150,250,255,0.85)"; g.fillRect(tip+(face>0?1:-1),hy,1,1); } g.globalCompositeOperation="source-over";
  }
}
// A siege engine / heavy weapon per tier, behind its line. dir points toward the enemy.
function drawSiege(g,X,dir,tier,inv,now,L){
  X=X|0; var gy=HORIZON;
  if(tier===2){ drawTank(g,X,dir,L,now,true); return; }
  if(tier===0){ g.fillStyle="#5a3f22"; g.fillRect(X,gy-2,7,2);                       // catapult frame
    g.fillStyle="#3a2a16"; g.fillRect(X+1,gy-1,1,1); g.fillRect(X+5,gy-1,1,1);
    var sw=Math.sin(now*0.004)*2; g.fillStyle="#6a4a28"; g.fillRect(X+3,gy-2-((3+sw)|0),1,(3+sw)|0);  // throwing arm
    return; }
  if(tier===1){ g.fillStyle="#2a2420"; g.fillRect(X,gy-2,6,2);                       // cannon carriage
    g.fillStyle="#4a4038"; g.fillRect(dir>0?X+4:X-1,gy-3,3,2);                        // barrel
    g.fillStyle="#101010"; g.fillRect(X+1,gy,1,1); g.fillRect(X+4,gy,1,1);            // wheels
    if((Math.floor(now/300))%3===0){ g.fillStyle="rgba(160,160,165,0.5)"; g.fillRect((dir>0?X+7:X-3)|0,gy-4,2,2); } // smoke
    return; }
  // tier 3: a walker / energy artillery
  g.fillStyle=inv?"#3a2028":"#26303f"; g.fillRect(X,gy-6,6,4);                        // body
  g.fillStyle="#141820"; g.fillRect(X,gy-1,1,1); g.fillRect(X+5,gy-1,1,1);            // legs
  g.globalCompositeOperation="lighter"; g.fillStyle=inv?"rgba(255,90,90,0.9)":"rgba(120,240,255,0.9)";
  g.fillRect(X+2,gy-4,2,2); g.fillRect((dir>0?X+6:X-2)|0,gy-4,2,1); g.globalCompositeOperation="source-over";  // core + cannon glow
}
function drawWar(g,L,now,night){
  var cw3=curWar; if(!cw3) return;
  var f=cw3.f, wx=cw3.x;
  var TE=warTech(curLife!=null?curLife:0), tier=TE.id;   // which weapons era this civilisation fights in
  // ---- ELECTION SEASON (the vote that funds the army) ----
  if(f<0){ var el=(cw3.cy-(cw3.cyAt-0.055))/0.012;
    if(el>=0&&el<1){ var yes=Math.round(28+milFund*68);
      var em2="ELECTION - DEFENSE FUNDING - YES "+yes+" PCT";
      var tw3=textW(em2), tx3=Math.round(WW*0.5-tw3/2), ly3=notifLane(1);
      for(var wp=-1;wp<=1;wp++){ var px3=tx3-3-WOFF+wp*WW; if(px3+tw3+6<-2||px3>SW+2) continue;
        g.fillStyle="rgba(8,14,30,0.80)"; g.fillRect(px3|0,ly3,tw3+6,9);
        g.fillStyle="rgba(90,160,255,0.85)"; g.fillRect(px3|0,ly3-1,tw3+6,1); g.fillRect(px3|0,ly3+8,tw3+6,1); }
      drawPixText(g,em2,tx3,ly3+2,"rgba(160,205,255,0.95)",1); }
    return; }
  if(f<0.22){ // ---- THE ENEMY ARMY APPROACHES (from the right, marching on the city) ----
    var adv=f/0.22, FXa=wx-WOFF;
    for(var wa=-1;wa<=1;wa++){ var BXa=FXa+wa*WW; if(BXa<-120||BXa>SW+120) continue;
      var appr=(1-adv)*120;                                              // starts 120px off, closes in
      // a marching column of invaders + their siege engine, advancing leftward toward the city
      for(var c5=0;c5<7;c5++){ var mx5=BXa+appr+30+c5*7 + (Math.sin(now*0.006+c5)*1);
        if(mx5>-6&&mx5<SW+6) drawWarSoldier(g,mx5,HORIZON,true,tier,now,c5,-1); }
      drawSiege(g,BXa+appr+80,-1,tier,true,now,L);
      // their banner leads the column
      var bnx=BXa+appr+26; g.fillStyle="#3a1015"; g.fillRect(bnx|0,HORIZON-11,1,11);
      g.fillStyle="#c02030"; g.fillRect((bnx-3)|0,HORIZON-11,3,3);
    }
    drawDoomHud(g,0.2,now,TE.era+" ARMY APPROACHING - "+cityName,TE.era+" ARMY APPROACHING - "+cityName);
    return; }
  if(f<1){ // ---- THE BATTLE at the front: city defenders (left) vs invaders (right) ----
    var FX=wx-WOFF;
    for(var w6=-1;w6<=1;w6++){ var BXX=FX+w6*WW; if(BXX<-90||BXX>SW+90) continue;
      g.fillStyle="rgba(255,120,40,"+(0.07+0.05*Math.sin(now*0.01))+")";           // the front glows
      g.fillRect(BXX-40,HORIZON-24,80,24);
      // battlefield smoke rising over the fighting — reads as a warzone from across the desktop
      for(var sm=0;sm<3;sm++){ var smx=BXX-22+sm*20, smd=((now*0.02+sm*400)%1)/1;
        for(var sy=0;sy<9;sy++){ var puff=HORIZON-6-sy*4-((now*0.01+sm)%4);
          g.fillStyle="rgba("+(60+sy*4)+","+(56+sy*3)+","+(54+sy*2)+","+(0.34-sy*0.03)+")";
          g.fillRect((smx+Math.sin(sy*0.7+now*0.003+sm)*3)|0,puff|0,3,3); } }
      // -- civilians fleeing the fighting, behind the city line (running left, away) --
      for(var cv=0;cv<3;cv++){ var flee=(BXX-30 - ((now*0.03+cv*90)%60));
        if(flee>-4&&flee<SW+4) drawPerson(g,flee,HORIZON-1,PEDC[cv%PEDC.length],SKINC[(cv+2)%SKINC.length],(Math.floor(now/120)+cv)&1); }
      // -- the CITY WALL / barricade the defenders hold (tier-appropriate) --
      if(tier===0){ g.fillStyle=L>0.5?"#8a8f98":"#3a3e46"; g.fillRect(BXX-14,HORIZON-6,4,6);   // stone rampart w/ crenels
        g.fillRect(BXX-14,HORIZON-8,1,2); g.fillRect(BXX-12,HORIZON-8,1,2); }
      else if(tier===3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,220,255,"+(0.25+0.12*Math.sin(now*0.02))+")";
        g.fillRect(BXX-12,HORIZON-9,1,9); g.globalCompositeOperation="source-over"; }         // energy shield
      else { g.fillStyle=L>0.5?"#8a7a4a":"#3a3218"; g.fillRect(BXX-14,HORIZON-2,6,2); }        // sandbags
      // the city's own flag flying over the defenders
      g.fillStyle=L>0.5?"#c9ccd4":"#7a8090"; g.fillRect(BXX-20,HORIZON-12,1,12);
      g.fillStyle="#3f6fbf"; g.fillRect(BXX-19,HORIZON-12,3,2);
      // -- DEFENDERS (city, steel-blue) hold the line, facing right --
      for(var s5=0;s5<5;s5++) drawWarSoldier(g,BXX-12-s5*5,HORIZON,false,tier,now,s5,1);
      // -- INVADERS (red) press from the right, facing left --
      for(var s6=0;s6<5;s6++) drawWarSoldier(g,BXX+12+s6*5,HORIZON,true,tier,now,s6+3,-1);
      // -- siege engines behind each side --
      drawSiege(g,BXX-34,1,tier,false,now,L);
      drawSiege(g,BXX+28,-1,tier,true,now,L);
      // -- crossing fire across no-man's-land, styled per tier --
      for(var p=0;p<7;p++){ var dir3=(p&1)?1:-1;
        var spd=(tier>=2?1.05:0.55), t3=((now*spd+p*181)%620)/620;
        var sxp=dir3>0?(BXX-9+t3*18):(BXX+9-t3*18);
        var arc=(tier===0?Math.sin(t3*Math.PI)*11:Math.sin(t3*Math.PI)*3), pyp=HORIZON-4-arc;
        if(tier===3){ if(((Math.floor(now/120)+p)&1)===0){ g.globalCompositeOperation="lighter";
            g.fillStyle=dir3>0?"rgba(140,240,255,0.85)":"rgba(255,120,120,0.85)";
            g.fillRect((dir3>0?BXX-9:BXX-1)|0,(HORIZON-5)|0,10,1); g.globalCompositeOperation="source-over"; } }
        else if(tier===2){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,226,122,0.9)"; g.fillRect(sxp|0,pyp|0,2,1); g.globalCompositeOperation="source-over"; }
        else if(tier===1){ g.fillStyle="rgba(40,34,28,0.95)"; g.fillRect(sxp|0,pyp|0,1,1); }
        else { g.fillStyle="#e6dcc0"; g.fillRect((sxp-dir3)|0,pyp|0,2,1); }   // arrow shaft
      }
      // -- tier-3 INVASION FORCE: gunmetal dropships hover over the invader line, raking
      //    AIMED bolts into no-man's-land — telegraph, then CRACK, always shy of the wall --
      if(tier===3){
        for(var ds9=0;ds9<2;ds9++){ var dh9=((ds9*2654435761+41)>>>0);
          var dbob=Math.sin(now*0.0012+ds9*2.6)*5;
          drawDropship(g,BXX+22+ds9*24+Math.sin(now*0.001+ds9)*4,HORIZON-44+dbob-ds9*9,2,now); }
        var SLOT9=950, ph9=(now%SLOT9)/SLOT9, sl9=Math.floor(now/SLOT9);
        var h9=((sl9*2654435761+515)>>>0); h9^=h9>>>13;
        var btx=BXX-13+((h9>>>17)%11), muzX9=BXX+22+((h9>>>21)&1)*24, muzY9=HORIZON-44-((h9>>>22)&1)*9;
        g.globalCompositeOperation="lighter";
        if(ph9<0.6){ var swp9=muzX9+(btx-muzX9)*(ph9/0.6);
          g.fillStyle="rgba(255,200,90,0.4)"; g.fillRect(swp9|0,(HORIZON-2)|0,2,2); }
        else { var k9=(ph9-0.6)/0.4;
          for(var t9=0;t9<=10;t9++){ var tf9=t9/10;
            g.fillStyle="rgba(255,200,90,"+(0.85*(1-tf9*0.3)*(1-k9*0.5)).toFixed(3)+")";
            g.fillRect((muzX9+(btx-muzX9)*tf9)|0,(muzY9+((HORIZON-2)-muzY9)*tf9)|0,2,2); }
          g.fillStyle="rgba(255,240,200,"+(0.8*(1-k9)).toFixed(3)+")"; fillEllipse(g,btx,HORIZON-2,4+k9*4,2); }
        g.globalCompositeOperation="source-over";
        // fading scorches in no-man's-land from the last few bolts
        for(var sc9=1;sc9<=6;sc9++){ var so9=sl9-sc9, sage=(now-((so9+1)*SLOT9))/14000; if(sage>=1) break;
          var sh9=((so9*2654435761+515)>>>0); sh9^=sh9>>>13;
          g.fillStyle="rgba(30,22,18,"+(0.45*(1-sage)).toFixed(3)+")"; fillEllipse(g,BXX-13+((sh9>>>17)%11),HORIZON-1,3,1); }
      }
      // -- heavy shellbursts landing --
      for(var ex2=0;ex2<3;ex2++){ var eph2=((now*0.4+ex2*777)%1400)/1400;
        if(eph2<0.22){ g.globalCompositeOperation="lighter";
          g.fillStyle="rgba(255,220,140,"+(0.85*(1-eph2/0.22))+")";
          g.fillRect((BXX-16+((ex2*41+Math.floor(now/500))%34))|0,(HORIZON-5-eph2*26)|0,4,4);
          g.globalCompositeOperation="source-over"; } }
      // -- CIVILIAN CASUALTIES: the fallen at the front line --
      for(var cc=0;cc<3;cc++){ var cbx=BXX-6+cc*5;
        g.fillStyle=cc%2?"#6a2028":"#2f3a2a"; g.fillRect(cbx|0,HORIZON-1,3,1);        // a body, down
        g.fillStyle=SKINC[cc%SKINC.length]; g.fillRect((cbx+(cc%2?3:-1))|0,HORIZON-1,1,1);  // a hand/head
        g.fillStyle="rgba(150,20,26,0.5)"; g.fillRect((cbx-1)|0,HORIZON,4,1); }        // spilt
    }
    drawDoomHud(g,0.2,now,TE.era+" "+TE.label+" - DEFEND "+cityName,TE.era+" "+TE.label+" - DEFEND "+cityName);
    return; }
  if(cw3.win){ // ---- VICTORY: repairs, half-mast, the funerals ----
    if(f<1.5){ var FP=wx-WOFF;
      for(var w7=-1;w7<=1;w7++){ var PX2=FP+w7*WW; if(PX2<-40||PX2>SW+40) continue;
        var mx3=((f-1)*40)%30;
        for(var m5=0;m5<6;m5++) drawPerson(g,PX2-20+m5*4-mx3,HORIZON-1,"#20222c","#c9a184",0);   // the procession, in black
        g.fillStyle="#3a3f4a"; g.fillRect(PX2+6-mx3,HORIZON-3,6,2);                              // the casket, carried slow
        g.fillStyle="#5a6172"; g.fillRect(PX2+26,HORIZON-12,1,12);                               // the flag at half-mast
        g.fillStyle="#c02030"; g.fillRect(PX2+27,HORIZON-8,3,2); }
      drawDoomHud(g,0.9,now,"VICTORY - HONORING THE FALLEN","VICTORY - HONORING THE FALLEN"); }
    return; }
  // ---- DEFEAT: the OCCUPATION (until the endtimes free them) ----
  g.fillStyle="rgba(120,20,26,0.06)"; g.fillRect(0,0,SW,HORIZON);                 // their colour hangs over everything
  for(var ob=0;ob<near.blds.length;ob++){ var nb2=near.blds[ob];
    if(nb2.type==="park"||((nb2.seed||ob)%4)!==0) continue;
    if(nb2.bAge!==undefined && cityG-nb2.bAge<=bandOf(nb2)) continue;
    var obx=(nb2.x-WOFF)|0; if(obx<-nb2.w||obx>SW+4) continue;
    var otop=HORIZON-nb2.h;
    g.fillStyle="#c02030"; g.fillRect(obx+(nb2.w>>1),otop-4,1,4); g.fillRect(obx+(nb2.w>>1)+1,otop-4,3,2);   // their flag on our roofs
    g.fillStyle="#1a0c10"; g.fillRect(obx+1,otop+3,2,6);                                                      // banner draped down the face
    g.fillStyle="#c02030"; g.fillRect(obx+1,otop+4,2,2); }
  var pt2=((now*0.008)%(WW))|0, psx=pt2-WOFF;                                     // patrols walk OUR streets
  for(var w8=-1;w8<=1;w8++){ var PPX=psx+w8*WW; if(PPX<-6||PPX>SW+6) continue;
    drawWarSoldier(g,PPX,HORIZON,true,tier,now,1,1); drawWarSoldier(g,PPX+5,HORIZON,true,tier,now,2,1); }
  if(((Math.floor(now/6000))%4)===0) drawDoomHud(g,0.9,now,"OCCUPIED TERRITORY","OCCUPIED TERRITORY");
}
// which death this life ends by — every civilization falls differently
var DEATHS=["meteors","nuke","sunburst","ai","bh","alienwar","frost","kaiju","flood","kaijuwar","pollution"];   // append-only (auto-mode hash maps h%length)
var CFG_FINALE=null;   // config: pin which apocalypse ends EVERY life ("auto"/unset = varied per life)
function deathOf(li){ if(CFG_FINALE) return CFG_FINALE;
  var h=((li*2654435761+977)>>>0); h=(h^(h>>>15))>>>0; return DEATHS[h%DEATHS.length]; }
var curDeath="meteors";
if(CFG.finale&&CFG.finale!=="auto"&&DEATHS.indexOf(CFG.finale)>=0) CFG_FINALE=CFG.finale;
var FORCEDEATH=null;   // test hook: "meteors"|"nuke"|"sunburst"|"ai" (own line — QML namespace writable)
// ---- THE NUKE CLOCK: the strike plays out in REAL SECONDS, not over the ~7.5-hour apoc phase. apocMs
// is real ms since detonation (set per-frame in draw). One bomb: bang → a heat wave races across the
// whole city in ~6 s, vaporizing everything in its path → a huge mushroom towers in the distance. ----
var apocMs=0;                       // real ms elapsed since the cataclysm began (set per-frame)
var blastMs=0;                      // real ms since the warhead DETONATED (= apocMs - the fall; 0 while it's still incoming)
var apocKill=0;                     // "everything stops/dies" progress on the FAST clock (nuke: 0→1 over ~4s; other deaths: = cityApoc)
var NUKE_FALL_MS=1900;              // the warhead is visibly INCOMING for ~1.9 s (streaking down) before it hits — the city is still alive
var NUKE_WIPE_MS=6000;              // the blast & thermal front cross the ENTIRE city in ~6 s
var METEOR_SWARM_MS=4000;          // ~4s in, a swarm of SMALL meteors begins peppering the city (scattered fires/craters) while the big one falls
var METEOR_IMPACT_MS=25000;        // the ONE massive planet-killer is visibly falling for ~25s (growing, sky reddening) before it hits
var METEOR_WIPE_MS=5200;           // its colossal fiery blast front then sweeps the WHOLE city in ~5.2s, leveling everything (nuke-style, fierier)
// ---- SUNBURST: the sun swells into a red giant that BAKES the whole earth at once, then detonates ----
var SUN_IGNITE_MS=22000;           // the sun swells for ~22s (sky reddening, heat rising) until its glare IGNITES everything on the ground
var SUN_STAGGER_MS=3800;           // once ignited, structures don't all combust together — they catch over a ~3.8s spread (deterministic per-key)
var SUN_BURN_MS=2600;              // each thing then chars & collapses over ~2.6s (burns DOWN in place, not blown sideways)
var SUN_EXPLODE_MS=30000;          // at ~30s the swollen sun DETONATES → blinding whiteout, then a dead scorched world
// ---- AI TAKEOVER: AI factories boot at an epicenter, a conversion front spreads out assimilating the city into machines, strip-mines the planet's resources, then kills it ----
var AI_WAKE_MS=3000;               // the factories power on for ~3s (core lights, drones launch, sky glitches) before the takeover spreads — city still alive
var AI_WIPE_MS=10000;              // the assimilation front then sweeps the WHOLE city in ~10s, converting every building into a machine-factory & harvesting it
// ---- BLACK HOLE: a singularity forms in the sky, its pull reaches out and streams the whole city into the void ----
var BH_FORM_MS=3200;               // the hole forms & the accretion disk spins up for ~3.2s before its tidal pull reaches the ground
var BH_WIPE_MS=11000;              // the pull-radius then grows to swallow the WHOLE city in ~11s (nearest structures sucked in first)
// ---- ALIEN WAR: two alien fleets battle overhead; Earth is caught in the crossfire — stray beam strikes & falling wreckage rake the city apart ----
var WAR_ONSET_MS=3000;             // the fleets arrive & open fire for ~3s (battle overhead) before the crossfire starts hitting the ground — city still alive
var WAR_STAGGER_MS=8000;           // the chaotic crossfire then rakes across the WHOLE city over ~8s (scattered strikes, not a clean front)
var WAR_HIT_MS=1400;               // each struck building is beam-vaporized & blasted into burning wreckage over ~1.4s
// ---- DEEP FREEZE / ICE AGE: temperature craters, a blizzard whites out the sky, everything frosts, ices over & is buried ----
var FROST_ONSET_MS=4000;           // the cold snaps & the blizzard hits ~4s in (city still alive, people fleeing the freeze)
var FROST_STAGGER_MS=6000;         // the freeze then takes the whole city over ~6s (scattered — some blocks ice first)
var FROST_FREEZE_MS=3000;          // each structure frosts → encases in ice → is buried over ~3s
// ---- KAIJU: a colossal monster rises at the epicentre and rampages across the city, smashing everything ----
var KAIJU_ARRIVE_MS=3500;          // the beast emerges & roars for ~3.5s before the rampage spreads (city still alive)
var KAIJU_WIPE_MS=11000;           // its swath of destruction then crosses the whole city in ~11s (nearest first)
// ---- THE FLOOD: the sea rises and drowns the city — tall towers hold out longest, then topple & vanish under the water ----
var FLOOD_ONSET_MS=3000;           // the waters start rising ~3s in (city still alive, people running for high ground)
var FLOOD_RISE_MS=13000;           // the sea then climbs to swallow the whole skyline over ~13s
// ---- KAIJU WAR: TWO titans battle EACH OTHER across the skyline; the city is collateral.
// Outskirts are trampled INWARD as they advance from opposite edges; downtown is wrecked
// OUTWARD by the melee. A different victor each life; the loser topples like a building.
var KW_ARRIVE_MS=4500;             // both titans rise at opposite world edges & trade roars (city still alive)
var KW_APPROACH_MS=6000;           // they advance toward the battleground, trampling the outskirts behind them
var KW_CLASH_MS=12000;             // the melee at the battleground: beam-rake / lunge / grapple beats
var KW_DECIDE_MS=2000;             // the killing blow lands; the loser topples
var KW_SAFE=0.12;                  // fraction of WW around the battleground the approach SPARES (the melee wrecks it)
// ---- POLLUTION: the only finale with NO real-seconds clock — the whole apoc phase IS the
// timeline (cityApoc 0..1 across ~7.5h in weekly mode): veil settles → district lights die
// one-by-one → grey corrosion → dead grey. Nothing is ever demolished; the city suffocates.
var DEMO_APOC_SEC=0;                // ►► TEST HOOK: >0 plays the apocalypse LIVE on a repeating N-second loop (0=off, normal 1-week life)
function nukeDetId(now){ return DEMO_APOC_SEC>0 ? Math.floor(now/(DEMO_APOC_SEC*1000)) : lifeIndexOf(now); }   // a fresh id per detonation (per life normally; per demo-loop in demo mode)
function nukeGZX(now){ var h=((nukeDetId(now)*2654435761+13)>>>0); h=(h^(h>>>15))>>>0; return Math.round(WW*(0.10+0.80*(h/4294967296))); }  // GROUND ZERO — random per drop, anywhere across the whole world; every effect keys off this
function nukeFrontR(){ return (blastMs/NUKE_WIPE_MS)*(WW*0.62); }   // radius (world px) the heat wave has raced out from ground zero (only after impact)
function nukeDist(x,gz){ var d=((x-gz)%WW+WW*1.5)%WW-WW*0.5; return Math.abs(d); }   // shortest wrap distance from ground zero
// EPICENTRE — the single point every POSITIONAL death radiates from (nuke ground-zero, AI core, black-hole singularity). Random per life.
function apocEpiX(now){ return nukeGZX(now); }
// a front radius (world px) that starts growing waitMs into the apoc and crosses the city over wipeMs — shared by nuke-style sweeps (AI assimilation, black-hole pull)
function apocFrontR(waitMs,wipeMs){ return (Math.max(0,apocMs-waitMs)/wipeMs)*(WW*0.62); }
function aiFrontR(){ return apocFrontR(AI_WAKE_MS,AI_WIPE_MS); }     // the AI assimilation front
function bhFrontR(){ return apocFrontR(BH_FORM_MS,BH_WIPE_MS); }     // the black-hole pull radius
// the black hole's on-screen position — a singularity hanging in the sky above the epicentre (everything is sucked UP toward it)
function bhPos(now){ var sx=apocEpiX(now)-WOFF; if(sx>SW+600&&sx-WW>-600)sx-=WW; if(sx<-600&&sx+WW<SW+600)sx+=WW; return {sx:sx, sy:Math.round(HORIZON*0.24)}; }
// collapse progress 0..1 for a world-x under a nuke-style front (how far past the front it is), or -1 if the front hasn't reached it
function frontCollapse(x,frontR){ var d=nukeDist(x,apocEpiX(NOWOVR!=null?NOWOVR:Date.now())); return frontR>d ? Math.min(1,(frontR-d)/(WW*0.075)) : -1; }
// ---- KAIJU WAR helpers (all pure functions of the clock + per-life hash) ----
function kwWinner(now){ var h=((nukeDetId(now)*40503+9257)>>>0); h=(h^(h>>>13))>>>0; return h%2; }   // 0 = the reptile (beams) · 1 = the ape (fists)
function kwBX(now){ return apocEpiX(now); }                          // the battleground (per-life epicenter)
function kwT1(){ return Math.max(0,Math.min(1,(apocMs-KW_ARRIVE_MS)/KW_APPROACH_MS)); }   // approach progress 0..1
// each titan's world-x: rises at its edge, advances to the battleground, then drifts with the melee beats
function kwTitanX(now,side){
  var bx=kwBX(now), t1=kwT1(), gap=WW*0.025*(side?1:-1);
  var x=bx+(side?1:-1)*WW*0.5*(1-t1)+gap*t1;
  var tc=apocMs-KW_ARRIVE_MS-KW_APPROACH_MS;
  if(tc>0){ var cyc=Math.floor(tc/3000), dh=((cyc*2654435761+nukeDetId(now)*7+side)>>>0);
    x+=(((dh>>>4)%9)-4)*WW*0.008; }
  return ((x%WW)+WW)%WW;
}
function kwClashR(){ var tc=apocMs-KW_ARRIVE_MS-KW_APPROACH_MS;      // melee collateral radius, grows over the clash
  return tc<=0?0:Math.min(WW*KW_SAFE, WW*0.02+(tc/KW_CLASH_MS)*WW*(KW_SAFE-0.02)); }
// collapse progress 0..1 for world-x under the war (or -1): trampled inward during the approach
// (outskirts first), wrecked outward by the growing melee radius (downtown last)
function kwCl(x,now){
  var d=nukeDist(x,kwBX(now)), t1=kwT1(), cl=-1;
  var titanD=WW*0.5*(1-t1);
  if(t1>0 && d>=Math.max(titanD,WW*KW_SAFE)) cl=Math.min(1,(d-Math.max(titanD,WW*KW_SAFE))/(WW*0.075)+0.15);
  var cr=kwClashR(); if(cr>0 && d<cr) cl=Math.max(cl,Math.min(1,(cr-d)/(WW*0.05)));
  return cl;
}
// ---- POLLUTION helpers: per-life hashed district death order; per-building stagger ----
var DIST_INDEX={downtown:0,entertainment:1,residential:2,oldtown:3,industrial:4};   // stable index per district name
function polDistOrder(now,di){ var h=((nukeDetId(now)*2246822519+di*40503+5)>>>0); h=(h^(h>>>15))>>>0; return (h%1000)/1000; }   // 0..1 rank for district index di
// has this building's lights died yet? (lights die from cityApoc 0.25→0.70, district by district,
// each building staggered ±0.03 around its district's threshold)
function polDark(b){
  if(curDeath!=="pollution"||cityPhase!=="apoc") return false;
  var nd5=NOWOVR!=null?NOWOVR:Date.now();
  var di=0; try{ di=DIST_INDEX[b.district]||0; }catch(e){}
  var thr=0.25+polDistOrder(nd5,di)*0.45;
  var stg=((((b.seed|0)*2654435761)>>>0)%1000)/1000*0.06-0.03;
  return cityApoc>=(thr+stg);
}
// ---- GENERIC APOCALYPSE DISPATCH ----
// Each death type answers three questions the whole engine keys off: has world-x been destroyed yet
// (apocHit), is the ENTIRE city gone (apocFull), and has the cataclysm actually STRUCK (apocStruck).
// Every entity/structure gate calls these, so bringing a new death up to nuke quality is just adding
// its case here + a per-building branch + its drawApoc* — no touching the ~48 scattered call sites.
// apocPositional() = this death destroys the city by POSITION (a front / impacts), so cars/peds/etc.
// die exactly as it reaches them, rather than fading out globally over the phase.
function apocPositional(){ return curDeath==="nuke" || curDeath==="meteors" || curDeath==="ai" || curDeath==="bh" || curDeath==="kaiju" || curDeath==="kaijuwar"; }
function apocStruck(){ if(cityPhase!=="apoc") return false;
  if(curDeath==="nuke")    return apocMs>=NUKE_FALL_MS;                                  // the warhead has DETONATED
  if(curDeath==="meteors") return apocMs>=METEOR_SWARM_MS;                              // the small-meteor swarm has begun
  if(curDeath==="sunburst") return apocMs>=SUN_IGNITE_MS;                               // the sun's glare has IGNITED the ground
  if(curDeath==="ai")      return apocMs>=AI_WAKE_MS;                                   // the AI factories have booted & the takeover is spreading
  if(curDeath==="bh")      return apocMs>=BH_FORM_MS;                                   // the singularity has formed & its pull has reached the ground
  if(curDeath==="alienwar") return apocMs>=WAR_ONSET_MS;                               // the crossfire has started raining on the city
  if(curDeath==="frost")   return apocMs>=FROST_ONSET_MS;                              // the killing freeze has begun
  if(curDeath==="kaiju")   return apocMs>=KAIJU_ARRIVE_MS;                             // the beast has emerged & begun its rampage
  if(curDeath==="flood")   return apocMs>=FLOOD_ONSET_MS;                              // the waters have started rising
  if(curDeath==="kaijuwar") return apocMs>=KW_ARRIVE_MS;                               // the titans have engaged
  if(curDeath==="pollution") return cityApoc>0.02;                                     // the inversion has settled in
  return false; }
function apocHit(x){ if(cityPhase!=="apoc") return false;
  if(curDeath==="nuke")    return nukeFrontR() >= nukeDist(x,nukeGZX(NOWOVR!=null?NOWOVR:Date.now()));   // the heat-wave front reached world-x
  if(curDeath==="meteors") return meteorCollapse(x, NOWOVR!=null?NOWOVR:Date.now()).cl>=0;   // a small strike OR the big impact's front has reached it
  if(curDeath==="sunburst") return sunCl(x)>=0;                                         // the solar heat has combusted world-x (global, staggered)
  if(curDeath==="ai")      return frontCollapse(x,aiFrontR())>=0;                       // the assimilation front reached & converted world-x
  if(curDeath==="bh")      return frontCollapse(x,bhFrontR())>=0;                       // the pull reached world-x → sucked in
  if(curDeath==="alienwar") return alienCl(x)>=0;                                       // a stray beam/wreckage strike has raked world-x
  if(curDeath==="frost")   return frostCl(x)>=0;                                        // the freeze has reached & frozen world-x
  if(curDeath==="kaiju")   return frontCollapse(x,kaijuFrontR())>=0;                    // the monster's rampage has reached world-x
  if(curDeath==="flood")   return floodGroundHit(x);                                    // the water has risen above the ground here
  if(curDeath==="kaijuwar") return kwCl(x,NOWOVR!=null?NOWOVR:Date.now())>=0;           // trampled or caught in the melee
  if(curDeath==="pollution") return cityApoc>=0.92;                                     // nothing is DEMOLISHED until the very end (movers die via apocKill fade)
  return false; }
function apocFull(){ if(cityPhase!=="apoc") return false;
  if(curDeath==="nuke")    return nukeFrontR() >= WW*0.5;                               // the front has swept the ENTIRE city (≈5s)
  if(curDeath==="meteors") return apocMs >= METEOR_IMPACT_MS+METEOR_WIPE_MS;            // the big impact's fiery front has swept the whole city
  if(curDeath==="sunburst") return apocMs >= SUN_IGNITE_MS+SUN_STAGGER_MS+SUN_BURN_MS; // everything has ignited & burned down (~28.4s)
  if(curDeath==="ai")      return aiFrontR() >= WW*0.5;                                 // the assimilation front has converted the whole city
  if(curDeath==="bh")      return bhFrontR() >= WW*0.5;                                 // the pull has swallowed the whole city
  if(curDeath==="alienwar") return apocMs >= WAR_ONSET_MS+WAR_STAGGER_MS+WAR_HIT_MS;   // the crossfire has raked the whole city (~12.4s)
  if(curDeath==="frost")   return apocMs >= FROST_ONSET_MS+FROST_STAGGER_MS+FROST_FREEZE_MS;   // the whole city is frozen & buried (~13s)
  if(curDeath==="kaiju")   return kaijuFrontR() >= WW*0.5;                              // the rampage has flattened the whole city
  if(curDeath==="flood")   return floodLevel() >= floodMax()*0.95;                      // the water has risen over the whole skyline
  if(curDeath==="kaijuwar") return kwT1()>=1 && kwClashR()>=WW*KW_SAFE*0.98;             // trample complete + the melee has wrecked downtown
  if(curDeath==="pollution") return cityApoc>=0.92;                                     // the air is gone
  return false; }
// SUNBURST global heat: burn-progress at deterministic key k (a building seed, or a world-x for entities).
// Unlike a spatial front, there is no ground zero — the whole earth bakes at once, only staggered so it
// doesn't all combust on the same frame. -1 = not ignited yet; 0→1 = charring & collapsing.
function sunCl(k){
  if(apocMs<SUN_IGNITE_MS) return -1;
  var stag=((((k|0)*2654435761)>>>0)%1000)/1000*SUN_STAGGER_MS;   // this key's own delay into the firestorm
  var t=apocMs-SUN_IGNITE_MS-stag;
  if(t<0) return -1;
  return Math.min(1,t/SUN_BURN_MS);
}
// ALIEN WAR crossfire: like sunCl but the trigger is a stray beam/wreckage strike raking across the city (chaotic,
// scattered by a per-key hash), NOT the sun's global heat. -1 = not hit yet; 0→1 = beam-vaporizing into wreckage.
function alienCl(k){
  if(apocMs<WAR_ONSET_MS) return -1;
  var stag=((((k|0)*2654435761+443)>>>0)%1000)/1000*WAR_STAGGER_MS;   // when the crossfire happens to rake this spot
  var t=apocMs-WAR_ONSET_MS-stag;
  if(t<0) return -1;
  return Math.min(1,t/WAR_HIT_MS);
}
// DEEP FREEZE global cold: like sunCl but the trigger is the spreading killing freeze. -1 = not frozen yet; 0→1 = frosting → iced → buried.
function frostCl(k){
  if(apocMs<FROST_ONSET_MS) return -1;
  var stag=((((k|0)*2654435761+911)>>>0)%1000)/1000*FROST_STAGGER_MS;
  var t=apocMs-FROST_ONSET_MS-stag; if(t<0) return -1;
  return Math.min(1,t/FROST_FREEZE_MS);
}
function kaijuFrontR(){ return apocFrontR(KAIJU_ARRIVE_MS,KAIJU_WIPE_MS); }   // the monster's advancing swath of destruction
// THE FLOOD — the rising waterline in world-px above HORIZON (0 until the waters come, then climbs to swallow the skyline)
function floodMax(){ return HORIZON*0.92; }
function floodLevel(){ return Math.max(0,Math.min(1,(apocMs-FLOOD_ONSET_MS)/FLOOD_RISE_MS)) * floodMax(); }
// a building of height h topples/washes away as the water nears its top; -1 until then, 0→1 collapsing (tall towers hold out longest)
function floodCl(h){ var w=floodLevel(); return (w >= h*0.7) ? Math.min(1,(w - h*0.7)/(h*0.35+10)) : -1; }
// has the water risen above the ground at world-x yet? (low-lying spots go under first) — governs movers & parks
function floodGroundHit(x){ return floodLevel() > (2 + ((((x|0)*2654435761)>>>0)%8)); }
function meteorFrontR(){ return Math.max(0,(apocMs-METEOR_IMPACT_MS)/METEOR_WIPE_MS)*(WW*0.62); }   // radius the massive impact's fiery blast has raced out (only after it lands)
// how far into collapse world-x is under the meteor apocalypse — {cl:0..1 progress, bd:debris dir}; cl<0 = not hit yet.
// Unifies the two destroyers: the ONE massive impact's radial front (the main leveler) + the scattered SMALL strikes.
function meteorCollapse(x,now){
  if(apocMs>=METEOR_IMPACT_MS){ var gz=nukeGZX(now), fr=meteorFrontR(), sd=((x-gz)%WW+WW*1.5)%WW-WW*0.5, d=Math.abs(sd);
    if(fr>d) return {cl:Math.min(1,(fr-d)/(WW*0.075)), bd:sd>=0?1:-1}; }                // the planet-killer's front
  var mh=meteorHitAt(x); if(mh.t>=0) return {cl:Math.min(1,(apocMs-mh.t)/650), bd:mh.d>=0?1:-1};   // a small strike landed here
  if(apocMs>=METEOR_IMPACT_MS+METEOR_WIPE_MS) return {cl:1, bd:(x&1)?1:-1};             // swept clean — any straggler is gone
  return {cl:-1, bd:1};
}
// legacy aliases — the many bare call sites across the engine still read the nuke names
function nukeStruck(){ return apocStruck(); }
function nukeHit(x){ return apocHit(x); }
function nukeFull(){ return apocFull(); }

// ---- the SMALL-METEOR SWARM: a sparse, scattered set of little strikes that pepper the city while the
//      big planet-killer falls — each takes out a building or two + leaves a small fire/crater. NOT full
//      coverage (that's the massive impact's job). Deterministic + memoised per detonation. ----
var _metId=null, _metArr=null;
function meteorImpacts(){
  var id=nukeDetId(NOWOVR!=null?NOWOVR:Date.now());
  if(id===_metId && _metArr) return _metArr;
  var n=Math.max(7,Math.round(WW/120)), arr=[];                             // ~one small strike per ~120wp of city
  for(var i=0;i<n;i++){ var h=((id*2654435761 + i*374761393 + 17)>>>0); h=(h^(h>>>13))>>>0;
    var x=Math.round((0.04+0.92*((h%10000)/10000))*WW);                     // scattered anywhere across the world
    var t=METEOR_SWARM_MS + ((h>>>10)%1000)/1000*(METEOR_IMPACT_MS-1500-METEOR_SWARM_MS);   // lands sometime during the long approach
    var big=(((h>>>21)%5)===0);                                             // an occasional slightly-bigger one
    arr.push({x:x, t:t, r:(big?16:9)+((h>>>16)%6), big:big, seed:h});       // small radius — a couple of buildings each
  }
  _metId=id; _metArr=arr; return arr;
}
// the EARLIEST impact (already landed) whose disk covers world-x — feeds the gate, the collapse progress & the debris direction
function meteorHitAt(x){ var arr=meteorImpacts(), best=null;
  for(var i=0;i<arr.length;i++){ var im=arr[i]; if(apocMs<im.t) continue;
    var d=((x-im.x)%WW+WW*1.5)%WW-WW*0.5;
    if(Math.abs(d)<im.r && (!best || im.t<best.t)) best={t:im.t,x:im.x,r:im.r,d:d,big:im.big}; }
  return best || {t:-1,x:0,r:0,d:0,big:false};
}
// ---- THE GRAND CATACLYSM: a world-ending event that levels the whole city at the end of its life ----
function drawApocalypse(g,ap,L,now){
  if(curDeath==="nuke"){ drawApocNuke(g,ap,L,now); return; }
  if(curDeath==="meteors"){ drawApocMeteor(g,ap,L,now); return; }
  if(curDeath==="sunburst"){ drawApocSun(g,ap,L,now); return; }
  if(curDeath==="ai"){ drawApocAI(g,ap,L,now); return; }
  if(curDeath==="bh"){ drawApocBlackHole(g,ap,L,now); return; }
  if(curDeath==="alienwar"){ drawApocAlienWar(g,ap,L,now); return; }
  if(curDeath==="frost"){ drawApocFrost(g,ap,L,now); return; }
  if(curDeath==="kaiju"){ drawApocKaiju(g,ap,L,now); return; }
  if(curDeath==="flood"){ drawApocFlood(g,ap,L,now); return; }
  if(curDeath==="kaijuwar"){ drawApocKaijuWar(g,ap,L,now); return; }
  if(curDeath==="pollution"){ drawApocPollution(g,ap,L,now); return; }
}
// ---- KAIJU WAR: two titans battle EACH OTHER; the city is collateral. A different victor each life. ----
// drawTitan: shared silhouette painter. kind 0 = the reptile (dorsal fins, cyan rim, atomic breath),
// kind 1 = the ape (broad shoulders, long arms, amber rim, fists). pose: 0 advance · 1 attack ·
// 2 stagger · 3 grapple-lean · 4 topple(prog via tp) · 5 victor roar. facing: +1 faces right.
function drawTitan(g,sx,gy,H,kind,facing,pose,now,tp){
  var W=Math.round(H*(kind?0.30:0.22));
  var lean=(pose===2)?-facing*Math.round(W*0.30):(pose===3)?facing*Math.round(W*0.20):0;
  var sink=(pose===4)?Math.round(H*0.55*tp):0, tilt=(pose===4)?Math.round(tp*W*0.6):0;
  var top=gy-H+sink, cx=(sx+lean+facing*tilt)|0;
  var body=kind?"#241d16":"#1b2a1c", dark=kind?"#161009":"#142115";
  var rimL=kind?"rgba(255,180,90,0.5)":"rgba(90,225,255,0.55)", rimR=kind?"rgba(255,120,60,0.5)":"rgba(255,90,200,0.55)";
  g.globalCompositeOperation="lighter";
  g.fillStyle=kind?"rgba(200,140,60,0.07)":"rgba(120,70,170,0.08)"; fillEllipse(g,cx,top+H*0.5,W*0.85,H*0.55);
  g.globalCompositeOperation="source-over";
  var neckY=top+Math.round(H*(kind?0.16:0.20)), hipY=gy-Math.round(H*0.30)+sink;
  // torso rows — ape: broad shoulders tapering DOWN · reptile: narrow neck broadening to the hips.
  // Rim light hugs each row's edges (every other row) so it follows the body, never floats.
  for(var by2=neckY; by2<hipY; by2++){ var tf2=(by2-neckY)/Math.max(1,hipY-neckY);
    var tw=kind?Math.round(W*(1.0-0.38*tf2)):Math.round(W*(0.44+0.56*tf2));
    var rx=cx-(tw>>1)+((pose===4)?Math.round(tilt*tf2):0);
    g.fillStyle=body; g.fillRect(rx,by2,tw,1);
    if((by2&1)===0){ g.globalCompositeOperation="lighter";
      g.fillStyle=rimL; g.fillRect(rx,by2,1,1); g.fillStyle=rimR; g.fillRect(rx+tw-1,by2,1,1);
      g.globalCompositeOperation="source-over"; } }
  g.fillStyle=body;
  g.fillRect(cx-2,top+Math.round(H*0.09),4,Math.round(H*0.12));                          // neck
  var hd=Math.round(W*(kind?0.55:0.6)), hh7=Math.round(H*(kind?0.12:0.09)), hy=top+Math.round(H*(kind?0.02:0.04));
  var hx0=(facing>0?cx-(hd>>2):cx+(hd>>2)-hd)|0;
  g.fillRect(hx0,hy,hd,hh7);                                                             // head (mostly centered, jutting slightly forward)
  if(!kind){ g.fillRect((facing>0?hx0+hd-2:hx0-3)|0,hy+2,4,Math.max(2,(hh7*0.6)|0)); }   // reptile snout
  if(kind){ g.fillStyle=dark; g.fillRect(hx0+1,hy-2,hd-2,2); g.fillStyle=body; }         // ape brow ridge
  var legW=Math.round(W*(kind?0.26:0.24));
  g.fillRect(cx-Math.round(W*0.30),hipY,legW,Math.max(0,gy-hipY));
  g.fillRect(cx+Math.round(W*0.30)-legW,hipY,legW,Math.max(0,gy-hipY));                  // legs
  // arms — the ape's are long and heavy, knuckles near the ground; punch extends the lead arm
  var armW=kind?4:3, armL=Math.round(H*(kind?0.46:0.24)), armY=neckY+Math.round(H*0.02);
  var punch=(pose===1&&kind)?Math.round(W*0.6+((Math.floor(now/220))&1)*5):0;
  g.fillStyle=dark;
  var shW=kind?Math.round(W*0.5):(W>>1);
  if(punch){ g.fillRect((facing>0?cx+shW-2:cx-shW+2-armL)|0,armY+2,armL,armW); }         // punching: the lead arm goes HORIZONTAL at the foe
  else g.fillRect((facing>0?cx+shW-armW:cx-shW)|0,armY,armW,armL);
  g.fillRect((facing>0?cx-shW:cx+shW-armW)|0,armY,armW,Math.round(armL*0.85));           // trailing arm
  if(!kind){ for(var tl=0;tl<Math.round(H*0.4);tl++){ var txp=cx-facing*(Math.round(W*0.5)+tl), typ=hipY+2+Math.round(Math.sin(tl*0.28)*4)+Math.round(tl*0.22);
    g.fillStyle=dark; g.fillRect(txp|0,Math.min(gy-1,typ)|0,2,3); } }                    // reptile tail
  g.globalCompositeOperation="lighter";
  if(!kind){ for(var sp=0;sp<hipY-neckY;sp+=3){ var fw=1+((sp/3)&1);
    g.fillStyle="rgba(150,235,255,0.85)"; g.fillRect((cx-(fw>>1))|0,(neckY+sp)|0,fw,2); } }   // dorsal fins
  g.fillStyle=kind?"rgba(255,200,60,1)":"rgba(255,70,50,1)";
  g.fillRect((facing>0?hx0+hd-3:hx0+2)|0,(hy+2)|0,2,2);                                  // the eye
  if(pose===5&&((now%6000)<900)){ var rr=((now%900)/900)*W*2.2;                          // victor roar ring
    g.fillStyle="rgba(255,240,210,"+(0.4*(1-(now%900)/900))+")";
    g.fillRect((cx-rr)|0,(hy-2)|0,Math.max(2,rr*2)|0,1); g.fillRect((cx-rr*0.7)|0,(hy+3)|0,Math.max(2,rr*1.4)|0,1); }
  g.globalCompositeOperation="source-over";
  if(pose!==4){ g.fillStyle="rgba(120,100,86,0.4)"; g.fillRect(cx-W,gy-3,W*2,3); }       // stomp dust
  return {cx:cx, headY:hy, headX:(facing>0?hx0+hd:hx0), W:W, top:top};
}
function drawApocKaijuWar(g,ap,L,now){
  var gy=HORIZON, winner=kwWinner(now), loser=1-winner;
  var bxW=kwBX(now), t1=kwT1();
  var arriveP=Math.min(1,apocMs/KW_ARRIVE_MS);
  var tc=apocMs-KW_ARRIVE_MS-KW_APPROACH_MS;                                             // clash-phase clock
  var decided=tc>=KW_CLASH_MS, tD=Math.max(0,Math.min(1,(tc-KW_CLASH_MS)/KW_DECIDE_MS)); // topple progress
  var after=apocMs>KW_ARRIVE_MS+KW_APPROACH_MS+KW_CLASH_MS+KW_DECIDE_MS+1500;
  var names=["THE LIZARD KING","THE GREAT APE"];
  // screen positions of both titans (wrap-aware)
  function scr(wx){ var sx=wx-WOFF; if(sx>SW+150&&sx-WW>-150)sx-=WW; if(sx<-150&&sx+WW<SW+150)sx+=WW; return sx; }   // tight margins: a titan just off one slice edge must wrap into view
  var xA=scr(kwTitanX(now,0)), xB=scr(kwTitanX(now,1));
  var prog=Math.min(1, Math.max(t1*0.6, kwClashR()/(WW*KW_SAFE)*0.4+t1*0.6));

  // ===== LONG AFTERMATH: dust pall, the victor on the rubble, a roar beat every ~6s =====
  if(after){
    g.fillStyle="rgba(58,44,42,0.55)"; g.fillRect(0,0,SW,gy);
    g.globalCompositeOperation="lighter"; for(var sm=0;sm<6;sm++){ var smx=((sm*2654435761)>>>0)%SW;
      g.fillStyle="rgba(90,70,60,0.10)"; g.fillRect(smx-20,(gy*0.3)|0,40,(gy*0.7)|0); } g.globalCompositeOperation="source-over";
    var vx=scr(bxW), H3=Math.round(gy*0.30);
    if(vx>-200&&vx<SW+200){
      g.fillStyle="#2a2320"; g.fillRect((vx-40)|0,gy-8,80,8);                            // the rubble mound
      var roar=((now%6000)<900)?5:0;                                                     // periodic roar pose
      drawTitan(g,vx,gy-6,H3,winner,(winner?-1:1),roar||0,now,0);
      g.fillStyle="#1a1512"; fillEllipse(g,vx+ (winner? -70: 70),gy-5,46,7);             // the fallen — a dark mound nearby
    }
    g.fillStyle="rgba(6,4,5,0.88)"; g.fillRect(0,gy,SW,SH-gy);
    drawDoomHud(g,ap,now,names[winner]+" STANDS VICTORIOUS","THE CITY PAID THE PRICE");
    return;
  }

  // dust-choked sky deepens with the battle
  g.fillStyle="rgba(70,50,44,"+(0.10+0.40*prog)+")"; g.fillRect(0,0,SW,gy);

  // ===== THE TWO TITANS =====
  var H=Math.round(gy*(0.24+0.20*arriveP));
  var beat=(tc>0&&!decided)?Math.floor(tc/3000)%3:-1;                                    // 0 reptile attacks · 1 ape attacks · 2 grapple
  var poseA=0, poseB=0;                                                                  // A = reptile(kind 0, faces right) · B = ape(kind 1, faces left)
  if(tc>0&&!decided){ poseA=(beat===0)?1:(beat===1)?2:3; poseB=(beat===1)?1:(beat===0)?2:3; }
  if(decided){ if(loser===0){ poseA=4; poseB=5; } else { poseB=4; poseA=5; } }
  var tA=null, tB=null;
  if(xA>-260&&xA<SW+260) tA=drawTitan(g,xA,gy,H,0, 1,poseA,now,(decided&&loser===0)?tD:0);
  if(xB>-260&&xB<SW+260) tB=drawTitan(g,xB,gy,H,1,-1,poseB,now,(decided&&loser===1)?tD:0);

  // reptile's atomic breath rakes AT THE APE during its attack beat (and the killing blow)
  if(tA&&(poseA===1||(decided&&winner===0&&tD<0.7))&&((Math.floor(now/280))%2===0)){
    var mx=tA.headX, my=tA.headY+2, tx=(tB?tB.cx:xB), span=Math.max(8,Math.abs(tx-mx))|0;
    for(var br=0;br<span;br+=2){ var bxp=mx+(tx>mx?br:-br); if(bxp<-2||bxp>SW+2) continue;
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba("+Math.round(180-br*0.15)+",245,255,"+(0.85*(1-br/span))+")"; g.fillRect(bxp|0,my|0,2,4);
      g.globalCompositeOperation="source-over"; }
    if(tB){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(220,255,255,0.7)"; fillEllipse(g,tB.cx,my+2,7,9); g.globalCompositeOperation="source-over"; } }
  // impact flashes + shockwave ring on the grapple beat
  if(beat===2&&tA&&tB){ var gph=(tc%3000)/3000, rr2=gph*Math.abs(xB-xA)*0.9+8;
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,220,170,"+(0.30*(1-gph))+")";
    g.fillRect(((xA+xB)/2-rr2)|0,gy-4,(rr2*2)|0,2); g.globalCompositeOperation="source-over"; }

  var msg=(apocMs<KW_ARRIVE_MS)?"TWO TITANS RISE"
        :(t1<1)?"THE TITANS CLOSE IN"
        :(!decided)?"CLASH OF TITANS"
        :names[loser]+" HAS FALLEN";
  drawDoomHud(g,ap,now,msg,"THE CITY PAYS THE PRICE");
}
// ---- POLLUTION: the slow suffocation. The only finale paced on cityApoc (the WHOLE phase),
// not real seconds: veil settles → district lights die → grey corrosion → dead grey pall. ----
function drawApocPollution(g,ap,L,now){
  var gy=HORIZON, day=L>0.5;
  var base=day?[168,150,72]:[54,50,30], toxic=day?[110,120,60]:[40,50,26];
  var k=Math.min(1,ap/0.25);                                                             // band 1 ramp
  var veilA=0.10+0.38*k+(ap>0.25?0.12*Math.min(1,(ap-0.25)/0.45):0);
  var c=mixc(base,toxic,Math.min(1,ap*1.4));
  g.fillStyle="rgba("+c[0]+","+c[1]+","+c[2]+","+veilA.toFixed(3)+")"; g.fillRect(0,0,SW,SH);
  g.fillStyle="rgba("+Math.round(c[0]*0.8)+","+Math.round(c[1]*0.8)+","+Math.round(c[2]*0.8)+","+(veilA*0.8).toFixed(3)+")";
  g.fillRect(0,(gy*0.55)|0,SW,SH-((gy*0.55)|0));                                          // smoke settles LOW
  var moteN=Math.round((QUAL===0?16:34)*Math.min(1,0.3+ap));                  // drifting soot
  g.fillStyle=day?"rgba(96,88,58,0.55)":"rgba(30,28,18,0.6)";
  for(var mi=0;mi<moteN;mi++){ var mh=((mi*2654435761+31)>>>0);
    var mx2=((mh%(SW+40))+now*(0.003+((mh>>>7)%10)*0.0007))%(SW+40)-20;
    var my2=((mh>>>11)%(gy+GROUND))+Math.sin(now*0.0005+mi)*3;
    g.fillRect(mx2|0,my2|0,1,1); }
  if(ap>0.70){                                                                            // band 3: grey corrosion eats the skyline
    var cor=Math.min(1,(ap-0.70)/0.22);
    g.fillStyle="rgba(120,115,105,"+(0.30*cor).toFixed(3)+")";
    for(var cx3=0;cx3<SW;cx3+=4){ var ch3=((cx3*2654435761)>>>0)%7;                       // ragged top edge, cheap 4px columns
      g.fillRect(cx3,ch3,4,gy-ch3); } }
  if(ap>=0.92){                                                                           // band 4: the dead grey pall
    var dd=Math.min(1,(ap-0.92)/0.06);
    g.fillStyle="rgba(95,90,82,"+(0.45+0.4*dd).toFixed(3)+")"; g.fillRect(0,0,SW,SH); }
  var msg=(ap<0.25)?"AIR QUALITY EMERGENCY - STAY INSIDE"
        :(ap<0.70)?"THE LIGHTS ARE GOING OUT"
        :(ap<0.92)?"THE CITY IS CHOKING"
        :"THE AIR IS GONE";
  drawDoomHud(g,ap,now,msg,cityName+" SUFFOCATED");
}
// a single meteor impact crater, carved into the ground band (age-driven dig + cooling molten floor)
function drawMeteorCrater(g,sx,R,ageMs){
  var dig=Math.min(1,ageMs/900); if(dig<=0) return; R=R*dig; if(R<2) return;
  var gy=HORIZON, hot=Math.max(0,1-ageMs/9000), maxDepth=Math.min(SH-gy-1,R*0.55);
  for(var dx=-R;dx<=R;dx++){ var ex=dx/R, cx=(sx+dx)|0, e2=ex*ex, depth=(1-e2)*maxDepth;
    g.fillStyle=e2>0.80?"#4a382c":(e2>0.45?"#281c16":"#130d0b"); g.fillRect(cx,gy-1,1,(depth+2)|0);
    if(hot>0.02&&e2<0.7){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,120,36,"+(0.5*hot*(1-e2))+")"; g.fillRect(cx,(gy-2+depth)|0,1,2); g.globalCompositeOperation="source-over"; } }
  var rimH=Math.max(1,(R*0.14)|0);
  for(var s=-1;s<=1;s+=2){ var lipX=sx+s*R; for(var rr=0;rr<rimH;rr++){ var t=rr/rimH, mw=Math.max(1,(1-t)*rimH*1.4);
    g.fillStyle=t<0.4?"#5a4636":"#3a2c22"; g.fillRect((lipX-mw)|0,(gy-1-rr)|0,(mw*2)|0,1); } }
}
// THE PLANET-KILLER: for a long ~25s the sky slowly reddens as ONE massive meteor grows from a distant
// dot into a sky-filling fireball plunging toward ground zero — a swarm of small meteors peppers the city
// the whole time — then it HITS: a colossal fiery blast, a firestorm front that levels everything, a huge
// crater and a burning mushroom. (The skyline itself is smashed building-by-building in the main draw loop.)
var METEOR_STREAK_LEAD=1500;                                    // a SMALL meteor is visibly incoming for ~1.5s before it lands
function drawApocMeteor(g,ap,L,now){
  var gz=nukeGZX(now), nx=gz-WOFF; if(nx>SW+300&&nx-WW>-300)nx-=WW; if(nx<-300&&nx+WW<SW+300)nx+=WW;
  var app=Math.min(1,apocMs/METEOR_IMPACT_MS);                  // approach progress 0→1 (1 = the moment of impact)
  var mBlast=apocMs-METEOR_IMPACT_MS;                           // ms since the massive impact (<0 = still falling)
  // ---- THE SKY: reddens steadily as the object nears, then the impact sears it to a hellish glare ----
  var skyA=(mBlast<0)? 0.12+0.52*app*app : Math.min(1,0.64+mBlast/1500*0.36);
  var SKB=[[40,10,44],[92,16,40],[140,30,26],[184,64,18],[214,96,20]];
  var segN=SKB.length-1, sstep=6;
  for(var yy=0; yy<HORIZON; yy+=sstep){ var tt=yy/HORIZON*segN, si=Math.min(segN-1,tt|0), tf=tt-si, ca=SKB[si], cb=SKB[si+1];
    g.fillStyle="rgba("+((ca[0]+(cb[0]-ca[0])*tf)|0)+","+((ca[1]+(cb[1]-ca[1])*tf)|0)+","+((ca[2]+(cb[2]-ca[2])*tf)|0)+","+(0.66*skyA)+")";
    g.fillRect(0,yy,SW,sstep); }
  var arr=meteorImpacts();
  // ---- SMALL-METEOR SWARM: streak in, flash & crater — the prelude while the big one falls ----
  g.globalCompositeOperation="lighter";
  for(var i=0;i<arr.length;i++){ var im=arr[i], lead=im.t-apocMs;
    if(lead<=0 || lead>=METEOR_STREAK_LEAD) continue;
    var q=1-lead/METEOR_STREAK_LEAD; var sx=im.x-WOFF; if(sx>SW+40&&sx-WW>-40)sx-=WW; if(sx<-40&&sx+WW<SW+40)sx+=WW; if(sx<-40||sx>SW+40) continue;
    var hx=sx-(1-q)*40, hy=HORIZON*q*q;
    for(var tr=0;tr<10;tr++){ var tx=hx-tr*3.6, ty=hy-tr*4.6; if(tx<-4||tx>SW+4||ty<0) continue;
      g.fillStyle="rgba(255,"+(180-tr*11)+","+(70-tr*4)+","+(0.8*(1-tr/10)*q)+")"; g.fillRect(tx|0,ty|0,1+((tr<3)?1:0),1+((tr<3)?1:0)); }
    g.fillStyle="rgba(255,244,206,"+(0.9*q)+")"; g.fillRect(hx|0,hy|0,2,2); }
  for(var i2=0;i2<arr.length;i2++){ var im2=arr[i2], age=apocMs-im2.t; if(age<0||age>460) continue;
    var sx2=im2.x-WOFF; if(sx2>SW+40&&sx2-WW>-40)sx2-=WW; if(sx2<-40&&sx2+WW<SW+40)sx2+=WW; if(sx2<-40||sx2>SW+40) continue;
    var fa=1-age/460, fr2=(im2.big?18:11)*(0.5+age/460);
    g.fillStyle="rgba(150,50,12,"+(0.5*fa)+")"; fillEllipse(g,sx2,HORIZON-fr2*0.5,fr2*1.05,fr2);
    g.fillStyle="rgba(255,150,48,"+(0.85*fa)+")"; fillEllipse(g,sx2,HORIZON-fr2*0.5,fr2*0.66,fr2*0.64);
    g.fillStyle="rgba(255,242,190,"+(0.95*fa)+")"; fillEllipse(g,sx2,HORIZON-fr2*0.5,fr2*0.32,fr2*0.3); }
  g.globalCompositeOperation="source-over";
  for(var i3=0;i3<arr.length;i3++){ var im3=arr[i3], age3=apocMs-im3.t; if(age3<0) continue;
    var sx3=im3.x-WOFF; if(sx3>SW+60&&sx3-WW>-60)sx3-=WW; if(sx3<-60&&sx3+WW<SW+60)sx3+=WW; if(sx3<-im3.r-60||sx3>SW+im3.r+60) continue;
    drawMeteorCrater(g,sx3,im3.r*0.7,age3); }
  if(mBlast<0){
    // ================= THE MASSIVE METEOR, still falling — a dot swelling into a sky-filling fireball =================
    var app3=app*app*app, mez=2+74*app3;                        // grows slowly, then dramatically as it nears
    var startX=nx-150, startY=-34;
    var mmx=startX+(nx-startX)*app, mmy=startY+(HORIZON-startY)*(app*app);   // arcs in from upper-left, accelerating down toward gz
    var vdx=nx-startX, vdy=HORIZON-startY, vmag=Math.sqrt(vdx*vdx+vdy*vdy), udx=vdx/vmag, udy=vdy/vmag, tailLen=26+app*130;
    g.globalCompositeOperation="lighter";
    var gA=0.12+0.55*app*app;                                   // its glow floods the heavens as it nears
    g.fillStyle="rgba(255,120,40,"+(gA*0.45)+")"; fillEllipse(g,mmx,mmy,mez*3.4,mez*3.4);
    g.fillStyle="rgba(255,72,28,"+(gA*0.28)+")";  fillEllipse(g,mmx,mmy,mez*6.0,mez*6.0);
    for(var tl=1;tl<=20;tl++){ var tf3=tl/20, txp=mmx-udx*tailLen*tf3, typ=mmy-udy*tailLen*tf3, tw3=Math.max(1,mez*(1-tf3)*0.9);   // fiery tail up its path
      g.fillStyle="rgba(255,"+((180-tl*6)|0)+","+((60-tl*2)|0)+","+(0.7*(1-tf3))+")"; fillEllipse(g,txp,typ,tw3,tw3); }
    if(app>0.5){ for(var fgi=0;fgi<3;fgi++){ var foff=(fgi-1)*mez*1.5, fgx=mmx+foff+Math.sin(now*0.011+fgi*2)*3, fgy=mmy-7-fgi*5;   // fragments breaking off
      g.fillStyle="rgba(255,150,50,0.8)"; fillEllipse(g,fgx,fgy,Math.max(1,mez*0.26),Math.max(1,mez*0.26)); } }
    g.fillStyle="rgba(150,50,14,0.9)";   fillEllipse(g,mmx,mmy,mez*1.15,mez*1.1);      // the head — rock wrapped in fire
    g.fillStyle="rgba(255,140,40,0.95)"; fillEllipse(g,mmx,mmy,mez*0.85,mez*0.82);
    g.fillStyle="rgba(255,232,170,1)";   fillEllipse(g,mmx,mmy,mez*0.5,mez*0.48);
    g.globalCompositeOperation="source-over";
    g.fillStyle="#2a1410"; fillEllipse(g,mmx,mmy,Math.max(1,mez*0.30),Math.max(1,mez*0.28));   // dark rocky nucleus
  } else {
    // ================= THE IMPACT — a colossal FIRE blast; the firestorm front levels the whole city =================
    if(mBlast<640){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,246,228,"+(0.98*(1-mBlast/640))+")"; g.fillRect(0,0,SW,SH); g.globalCompositeOperation="source-over"; }   // blinding white flash
    if(mBlast<2600){ var fl=Math.max(0,1-mBlast/2600), fr0=32+(1-fl)*156, fby=HORIZON-fr0*0.5-(1-fl)*fr0*0.7;   // a titanic fireball lofting
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(150,44,10,"+(0.7*fl)+")";   fillEllipse(g,nx,fby,fr0*1.08,fr0);
      g.fillStyle="rgba(255,116,30,"+(0.92*fl)+")"; fillEllipse(g,nx,fby,fr0*0.8,fr0*0.78);
      g.fillStyle="rgba(255,224,150,"+(0.98*fl)+")";fillEllipse(g,nx,fby,fr0*0.42,fr0*0.4);
      g.globalCompositeOperation="source-over"; }
    var fr=meteorFrontR(), edge=WW*0.68;                        // the FIRESTORM shockwave front
    if(fr>4&&fr<edge){ var fade=1-fr/edge; g.globalCompositeOperation="lighter";
      for(var s=-1;s<=1;s+=2){ var fxE=nx+s*fr; if(fxE>-60&&fxE<SW+60){ var domeH=30+fr*0.12;
        for(var t2=0;t2<20;t2++){ var a2=1-t2/20, rough=Math.sin(t2*2.3+now*0.006+s)*3;
          g.fillStyle="rgba("+((205-t2*4)|0)+","+((92-t2*3)|0)+","+((30-t2)|0)+","+(0.42*a2*fade)+")"; g.fillRect((fxE-s*t2*3)|0,(HORIZON-domeH+rough)|0,3,(domeH-rough)|0); }
        for(var e2=0;e2<3;e2++){ g.fillStyle="rgba(255,220,150,"+((0.8-e2*0.2)*fade)+")"; g.fillRect((fxE+s*e2)|0,(HORIZON-domeH-4)|0,2,(domeH+4)|0); } } }
      g.fillStyle="rgba(180,80,30,"+(0.4*fade)+")"; g.fillRect((nx-fr)|0,HORIZON-6,(fr*2)|0,6);
      g.globalCompositeOperation="source-over"; }
    g.globalCompositeOperation="lighter";                      // the whole city ABLAZE — a wall of flame along the horizon
    var blazeA=Math.min(1,mBlast/1200)*Math.max(0,1-mBlast/17000);
    for(var fb=0; fb<SW; fb+=2){ var fh=4+((Math.floor(now/60)+fb*7)%9);
      g.fillStyle=["#ff4410","#ff7a1a","#ffb43a"][((Math.floor(now/80))+fb)%3]; g.globalAlpha=0.5*blazeA; g.fillRect(fb,HORIZON-fh,1,fh); }
    g.globalAlpha=1; g.globalCompositeOperation="source-over";
    drawMeteorCrater(g,nx,WW*0.13,mBlast);                     // the COLOSSAL crater (bigger than the nuke's)
    var frac=Math.min(1,Math.pow(mBlast/38000,0.45));          // a burning MUSHROOM firestorm towering over the ruins
    g.fillStyle="rgba(150,90,60,"+(0.6*Math.min(1,mBlast/1500))+")"; var bs=16+frac*80; g.fillRect((nx-bs)|0,HORIZON-4,(bs*2)|0,4);
    drawMushroom(g,nx,Math.max(0.06,frac),now,777,L,3.0);
    g.globalCompositeOperation="lighter";                      // fire glowing through the plume's stem
    g.fillStyle="rgba(255,108,30,"+(0.55*Math.max(0,1-mBlast/15000))+")"; fillEllipse(g,nx,HORIZON-12,WW*0.05,44);
    g.globalCompositeOperation="source-over";
  }
  // drifting ash over the doomed/dead city
  var ashA=0.38*Math.min(1,apocMs/6000);
  for(var fo=0;fo<48;fo++){ var fx2=((fo*97+now*0.02)%SW), fy2=((fo*61+now*0.05)%HORIZON);
    g.fillStyle="rgba(150,140,132,"+ashA+")"; g.fillRect(fx2|0,fy2|0,1,1); }
  var msg = (mBlast<0) ? "☄ IMPACT IMMINENT - EVACUATE "+cityName+" NOW ☄"
          : (mBlast<9000) ? "☄ IMPACT - "+cityName+" DECIMATED ☄" : cityName+" IS GONE";
  drawDoomHud(g,ap,now,msg,msg);
}

// ============================ THE SPACE AGE ============================
// In its final days the metropolis evolves into a space-faring city: a launch
// complex, hover-car sky lanes, holo-ring retrofits on the towers, a space
// elevator, an orbital station — and when the endtimes come, evacuation ships
// carry the city's people away before the fall. All pure functions of the clock.
var SPACEPORT_XF=0.115;                                        // world fraction of the launch complex (industrial outskirts)
function drawRocketSprite(g,X,Y,day){                          // 3-wide × 12-tall launch vehicle, nose at Y
  g.fillStyle=day?"#e8ecf4":"#c8d0e0"; g.fillRect(X,Y+2,3,10); // hull
  g.fillRect(X+1,Y,1,2);                                       // nose cone
  g.fillStyle="#ff5a3a"; g.fillRect(X+1,Y+1,1,1);              // nose band
  g.fillStyle="#05d9e8"; g.fillRect(X+1,Y+4,1,1);              // crew window
  g.fillStyle=day?"#9aa4b4":"#6a7484"; g.fillRect(X-1,Y+10,1,2); g.fillRect(X+3,Y+10,1,2);   // fins
}
function drawSpaceport(g,L,now,night){
  var wx=Math.round(SPACEPORT_XF*WW), day=L>0.5;
  for(var w=-1;w<=1;w++){ var X=(wx-WOFF+w*WW)|0; if(X<-30||X>SW+30) continue;
    var gy=HORIZON, padY=gy-2;
    g.fillStyle=day?"#8a8f9a":"#3a4050"; g.fillRect(X-10,padY,24,2);            // raised pad
    g.fillStyle=day?"#6a6f7a":"#2a3040"; g.fillRect(X-10,gy,24,1);
    var sps=Math.max(0,Math.min(1,(curSpace-0.05)/0.30));                       // the complex is BUILT first
    if(sps<1){ var gh=Math.max(2,Math.round(16*sps));
      g.fillStyle=day?"#4a505c":"#20242f"; g.fillRect(X+8,padY-gh,2,gh);        // gantry rising
      g.fillStyle=day?"#e0a83a":"#5a4418"; g.fillRect(X+11,padY-gh-6,1,gh+6); g.fillRect((X+4)|0,padY-gh-6,8,1);  // crane
      if((Math.floor(now/700))%2===0){ g.fillStyle="#ff4040"; g.fillRect(X+11,padY-gh-7,1,1); }
      continue; }
    g.fillStyle=day?"#4a505c":"#20242f"; g.fillRect(X+8,padY-16,2,16);          // gantry tower
    g.fillStyle=day?"#5a606c":"#262b36";
    for(var gv=padY-15;gv<padY;gv+=3) g.fillRect(X+7,gv,4,1);                   // lattice rungs
    if(((Math.floor(now/700))%2)===0){ g.fillStyle="#ff4040"; g.fillRect(X+8,padY-17,1,1); }  // tower beacon
    var SLOT=210000, ph=(now%SLOT)/SLOT, rx=X+1, ry;
    if(ph<0.70){                                                                // fueling on the pad
      drawRocketSprite(g,rx,padY-14,day);
      g.fillRect(X+6,padY-10,2,1);                                              // service arm across
      var vp=(Math.floor(now/900))%3; g.fillStyle="rgba(220,228,240,0.5)";      // venting vapor wisps
      g.fillRect(rx-1-vp,padY-3-vp,1,1);
      if(night){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(230,240,255,0.10)";   // floodlit at night
        g.fillRect(X-8,padY-16,20,16); g.globalCompositeOperation="source-over"; }
    } else if(ph<0.735){                                                        // IGNITION
      drawRocketSprite(g,rx+((Math.floor(now/60))%2===0?0:1)-0,padY-14,day);    // rumble jitter
      g.globalCompositeOperation="lighter";
      var ig=(ph-0.70)/0.035;
      g.fillStyle="rgba(255,240,190,"+(0.5+0.5*ig)+")"; g.fillRect(rx-1,padY-2,5,2);
      g.fillStyle="rgba(255,150,60,0.7)"; g.fillRect(rx-3,padY-1,9,1);
      g.globalCompositeOperation="source-over";
      g.fillStyle="rgba(200,204,214,0.55)";                                     // billowing steam
      g.fillRect(X-9+((now/80)%5)|0,padY-3,4,2); g.fillRect(X+5,padY-4,4,3);
    } else if(ph<0.88){                                                         // LIFTOFF — she climbs away
      var u=(ph-0.735)/0.145, alt=u*u*(SH+50);
      ry=padY-14-alt;
      if(ry>-16){ drawRocketSprite(g,rx+u*2,ry,day);
        g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(255,235,170,0.9)"; g.fillRect((rx+u*2+1)|0,(ry+12)|0,1,3);          // engine flame
        g.fillStyle="rgba(255,160,70,0.6)";  g.fillRect((rx+u*2)|0,(ry+14)|0,3,2);
        g.globalCompositeOperation="source-over"; }
      g.fillStyle="rgba(210,216,226,0.4)";                                      // the smoke column hangs in the air
      for(var sp2=0;sp2<6;sp2++){ var say=padY-4-alt*sp2/6, ssz=1+((5-sp2));
        if(say>ry+16&&say<padY) g.fillRect((rx+1-ssz/2+Math.sin(sp2*3+now*0.001)*1.5)|0,say|0,ssz,2); }
      g.fillStyle="rgba(190,196,208,0.5)"; g.fillRect(X-8,padY-3,20,3);         // pad steam lingers
    }                                                                            // else: pad empty, next vehicle stacks at wrap
  }
}
function drawHoverTraffic(g,L,now,night){
  var lanes=[[HORIZON-64,1,0.052],[HORIZON-52,-1,0.045]], HC=["#7af5ff","#ff7ad0","#eef4ff","#8affc9"];
  g.globalCompositeOperation="lighter";
  for(var ln=0;ln<2;ln++){ var lay=lanes[ln], n=16;
    for(var i=0;i<n;i++){
      var h=((i*2654435761+ln*97)>>>0), x0=(h%WW), sp=lay[2]*(0.8+((h>>>8)%40)/100);
      if((((h>>>10)%100)/100) > curSpace) continue;                  // the sky lanes fill up craft by craft
      var wx=wrapW(x0+lay[1]*sp*now), sx=wx-WOFF;
      if(sx>SW+8&&sx-WW>-8) sx-=WW; if(sx<-8&&sx+WW<SW+8) sx+=WW;
      if(sx<-6||sx>SW+6) continue;
      var y=lay[0]+((h>>>4)%3)-1, a=curSpace*(night?0.9:0.45), c=HC[(h>>>6)%4];
      g.globalAlpha=a; g.fillStyle=c; g.fillRect(sx|0,y,2,1);                    // the craft
      for(var tl=1;tl<=3;tl++){ g.globalAlpha=a*(0.5-tl*0.13);                   // light trail
        g.fillRect((sx-lay[1]*(1+tl))|0,y,1,1); }
    } }
  g.globalAlpha=1; g.globalCompositeOperation="source-over";
}
// G1 MASS-EFFECT TRANSFORMATION: the building re-emerges as a gunmetal future tower —
// light-band floors, glowing edge seams, spire/halo/tapered crowns. While spf<1 the old
// tower stands shrouded above a rising work line; the new skin climbs from the street up.
var FSEAM=["#7af5ff","#b9f6ff","#ff7ad0","#eafcff"];
function drawFutureBuilding(g,b,bx,layer,L,now,night,dayLit,spf){
  var top=(layer.y0-b.h)|0, bh=HORIZON-top; if(bh<3) return;
  var riseY=(spf>=1)?top:HORIZON-Math.round(bh*spf);
  var sc=FSEAM[b.seed%FSEAM.length];
  var body=css(mixc([46,52,68],[104,114,138],dayLit));
  var body2=css(mixc([32,36,50],[78,86,108],dayLit));
  for(var sgi=0;sgi<b.segs.length;sgi++){ var sg=b.segs[sgi];
    var sX=bx+sg.dx, sTop=top+sg.top, sBot=(sgi===0)?HORIZON:(top+sg.bot);
    if(spf<1&&sTop<riseY){                                        // the SHROUDED old hull above the work line
      var shB=Math.min(sBot,riseY);
      g.fillStyle=css(mixc([34,36,44],[70,74,86],dayLit)); g.fillRect(sX,sTop,sg.w,shB-sTop);
      g.fillStyle="rgba(122,245,255,0.10)";
      for(var ly2=sTop+2;ly2<shB;ly2+=4) g.fillRect(sX,ly2,sg.w,1);   // wrap lattice
    }
    var fTop=Math.max(sTop,riseY); if(fTop>=sBot) continue;
    g.fillStyle=body; g.fillRect(sX,fTop,sg.w,sBot-fTop);          // the new gunmetal skin
    g.fillStyle=body2; g.fillRect(sX+(sg.w>>1),fTop,(sg.w+1)>>1,sBot-fTop);   // two-tone panel split
    var la=night>0.4?0.55:0.20;                                    // light-band floors
    g.fillStyle="rgba("+(b.seed%3===0?"255,214,150":"165,240,255")+","+la.toFixed(2)+")";
    for(var fy=fTop+3;fy<sBot-1;fy+=5) g.fillRect(sX+1,fy,sg.w-2,1);
    g.fillStyle=sc; g.globalAlpha=night>0.4?0.75:0.35;             // glowing edge seams
    g.fillRect(sX,fTop,1,sBot-fTop); g.fillRect(sX+sg.w-1,fTop,1,sBot-fTop);
    g.globalAlpha=1;
  }
  var tX=bx+b.topDx, tW=b.topW;
  if(spf>=1){                                                      // the CROWN of the future
    var ck=b.seed%3;
    if(ck===0){ g.fillStyle=body2; g.fillRect(tX+(tW>>1)-1,top-2,2,2);              // spire
      g.fillStyle=sc; g.fillRect(tX+(tW>>1),top-Math.max(4,bh>>3),1,Math.max(4,bh>>3));
      if(night>0.3&&(Math.floor(now/600)&1)===0){ g.fillStyle="#ff5050"; g.fillRect(tX+(tW>>1),top-Math.max(4,bh>>3)-1,1,1); } }
    else if(ck===1&&tW>=8){ g.globalCompositeOperation="lighter";                    // floating halo ring
      var hp2=now*0.0012+b.seed;
      for(var hd=0;hd<7;hd++){ var ha=hp2+hd*Math.PI*2/7;
        g.globalAlpha=(night>0.4?0.5:0.22)*(0.5+0.5*Math.sin(ha*2));
        g.fillStyle=sc; g.fillRect((tX+(tW>>1)+Math.cos(ha)*(tW*0.45))|0,(top-3+Math.sin(ha)*1.2)|0,1,1); }
      g.globalAlpha=1; g.globalCompositeOperation="source-over"; }
    else{ g.fillStyle=body; g.fillRect(tX+1,top-1,tW-2,1); g.fillRect(tX+2,top-2,tW-4,1);   // tapered glass tip
      g.fillStyle=sc; g.globalAlpha=0.5; g.fillRect(tX+2,top-2,tW-4,1); g.globalAlpha=1; }
  } else {                                                         // the WORK LINE climbs with sparks
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(170,248,255,0.8)"; g.fillRect(bx,riseY,b.w,1);
    var spk=(Math.floor(now/90)+b.seed)%b.w;
    g.fillStyle="#ffffff"; g.fillRect(bx+spk,riseY-1,1,1);
    g.globalCompositeOperation="source-over";
  }
  if(night>0.5){                                                   // future towers glow from within
    g.globalCompositeOperation="lighter";
    g.fillStyle=rgba(hex2rgb(sc),0.05+0.05*Math.min(1,spf)); g.fillRect(bx-1,Math.max(top,riseY)-1,b.w+2,HORIZON-Math.max(top,riseY)+1);
    g.globalCompositeOperation="source-over";
  }
}
function drawSpaceRetrofit(g,L,now,night){
  // holo-rings + beacon spires bloom on the tallest towers as the city goes interstellar
  var drawn=0;
  g.globalCompositeOperation="lighter";
  for(var i=0;i<near.blds.length&&drawn<10;i++){ var b=near.blds[i];
    if(b.type==="park"||b.h<42||((b.seed||i)%5)!==0) continue;
    if(b.bAge!==undefined && cityG-b.bAge<=bandOf(b)) continue;
    if(b.spAge!==undefined && curSpace>=b.spAge) continue;         // already transformed — no more teaser rings
    var bx=b.x-WOFF; if(bx>SW+4&&bx-WW>-4) bx-=WW; if(bx<-4-b.w&&bx+WW<SW+4) bx+=WW;
    if(bx<-b.w-4||bx>SW+4) continue; drawn++;
    var cx=(bx+(b.w>>1))|0, cy2=HORIZON-b.h-6, rp=now*0.0016+(b.seed||i);
    for(var d2=0;d2<5;d2++){ var aa2=rp+d2*Math.PI*2/5;                          // rotating holo ring
      g.globalAlpha=curSpace*(night?0.55:0.28)*(0.5+0.5*Math.sin(aa2+rp));
      g.fillStyle=(d2&1)?"#7af5ff":"#ff7ad0";
      g.fillRect((cx+Math.cos(aa2)*5)|0,(cy2+Math.sin(aa2)*1.6)|0,1,1); }
    if(curSpace>0.5&&((Math.floor(now/500))+i)%4===0){ g.globalAlpha=curSpace*0.3;
      g.fillStyle="#7af5ff"; g.fillRect(cx,cy2-8,1,7); }                         // data uplink beam
  }
  g.globalAlpha=1;
  // the SPACE ELEVATOR — a tether rising from the downtown core clean off the sky
  if(curSpace>0.6){ var ea=(curSpace-0.6)/0.4, ewx=Math.round(0.5*WW);
    for(var w2=-1;w2<=1;w2++){ var EX=(ewx-WOFF+w2*WW)|0; if(EX<-4||EX>SW+4) continue;
      g.globalAlpha=ea*(night?0.7:0.45); g.fillStyle="#aee8f4"; g.fillRect(EX,0,1,HORIZON-2);
      g.globalAlpha=ea*0.9; g.fillStyle="#e8f6fa"; g.fillRect(EX-1,HORIZON-6,3,6);            // anchor terminal
      for(var cl=0;cl<3;cl++){ var cy3=(HORIZON-((now*0.02+cl*(HORIZON/3))%HORIZON))|0;       // climbers going up
        g.fillStyle=cl===1?"#ff7ad0":"#7af5ff"; g.fillRect(EX,cy3,1,2); }
      if(((Math.floor(now/600))%2)===0){ g.fillStyle="#ff5050"; g.fillRect(EX,2,1,1); }       // aircraft warning strobe
      g.globalAlpha=1; }
  }
  g.globalCompositeOperation="source-over";
}
function drawOrbitals(g,L,now,fx){
  if(L>0.62||fx.cloudy||fx.rain||fx.snow||fx.thunder||fx.fog) return;
  var oa=Math.max(0,Math.min(1,(curSpace-0.35)/0.2)); if(oa<=0) return;
  g.globalAlpha=oa;
  // the orbital station sails across the whole world's sky
  var owx=(now*(WW/240000))%WW, osx=owx-WOFF;
  if(osx>SW+6&&osx-WW>-6) osx-=WW; if(osx<-6&&osx+WW<SW+6) osx+=WW;
  if(osx>=-4&&osx<=SW+4){ var oy=12+Math.sin(owx*0.02)*5;
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(240,248,255,0.95)"; g.fillRect(osx|0,oy|0,1,1);                        // hub
    g.fillStyle="rgba(122,205,255,0.7)";  g.fillRect((osx-2)|0,oy|0,2,1); g.fillRect((osx+1)|0,oy|0,2,1);  // panel wings
    g.fillStyle="rgba(200,230,255,0.18)"; g.fillRect((osx-2)|0,(oy-1)|0,5,3);                 // glow
    g.globalCompositeOperation="source-over"; }
  // now and then a shuttle re-enters, streaking down toward the spaceport
  var RS=480000, rp2=(now%RS)/RS;
  if(rp2>0.94){ var ru=(rp2-0.94)/0.06, tx2=Math.round(SPACEPORT_XF*WW)+40-ru*60, ty2=ru*(HORIZON*0.55);
    var rsx=tx2-WOFF; if(rsx>SW+8&&rsx-WW>-8) rsx-=WW; if(rsx<-8&&rsx+WW<SW+8) rsx+=WW;
    if(rsx>=-6&&rsx<=SW+6){ g.globalCompositeOperation="lighter";
      for(var rt=0;rt<5;rt++){ g.fillStyle="rgba(255,"+(200-rt*25)+","+(120-rt*18)+","+(0.8-rt*0.15)+")";
        g.fillRect((rsx+rt*2)|0,(ty2-rt*1.4)|0,2,1); }
      g.globalCompositeOperation="source-over"; } }
  g.globalAlpha=1;
}
// the EVACUATION: as the endtimes rage, the ships get the people out — the space age pays off
function drawEvacuation(g,ap,now){
  var SLOT=70000;
  for(var back=0;back<3;back++){                                 // up to 3 ships airborne at once
    var idx=Math.floor(now/SLOT)-back, h=((idx*2654435761)>>>0);
    var lx=(h%WW), lph=((now-idx*SLOT)/SLOT)+back;               // continues climbing across slots
    var u=Math.min(1.8,lph*1.3), alt=u*u*(SH*0.55);
    var sx=lx-WOFF; if(sx>SW+8&&sx-WW>-8) sx-=WW; if(sx<-8&&sx+WW<SW+8) sx+=WW;
    if(sx<-6||sx>SW+6) continue;
    var ry=(HORIZON-30-alt)|0; if(ry<-16) continue;
    drawRocketSprite(g,sx|0,ry,false);
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(255,235,170,0.9)"; g.fillRect((sx+1)|0,ry+12,1,3);
    g.fillStyle="rgba(255,160,70,0.6)";  g.fillRect(sx|0,ry+14,3,2);
    g.fillStyle="rgba(220,235,255,0.25)"; g.fillRect((sx+1)|0,ry+17,1,Math.min(24,(HORIZON-ry-17)|0));  // exhaust trail
    g.globalCompositeOperation="source-over";
  }
}

// NUKES: flash, staggered mushroom clouds, shockwaves, fallout
// A single billowing mushroom cloud: wide dust base → turbulent rising stem with a hot core →
// a cauliflower cap with a rounded dome top, a lumpy underside skirt and an orange heat-glow.
// a filled ellipse via horizontal spans (rounder than a fillRect — for fireballs & soft glows). Set fillStyle first.
function fillEllipse(g,cx,cy,rx,ry){ if(rx<1||ry<1) return;
  for(var yy=-ry; yy<=ry; yy++){ var t=yy/ry, ww=(rx*Math.sqrt(Math.max(0,1-t*t)))|0; if(ww<=0) continue;
    g.fillRect((cx-ww)|0,(cy+yy)|0,(ww*2)|0,1); } }
function drawMushroom(g,nx,nph,now,seed,L,scale){
  if(nph<=0) return; scale=scale||1;
  // a MUCH bigger cloud: the cap radius scales up hard, but the rise is held back so the giant cap
  // still tops out on-screen (cap centre kept ≥ its own radius below the top) — it fills the sky.
  var capRx=(9+nph*40)*scale, capRy=(6+nph*22)*scale;                         // cap half-width / half-height
  var baseY=HORIZON, riseH=Math.min(HORIZON-capRy*1.15, nph*HORIZON*0.62*(1+(scale-1)*0.18)), capCy=baseY-riseH;
  var stemTopW=Math.max(3,capRx*0.34), stemBaseW=capRx*0.9;
  var day=L>0.4, smokeD=day?[84,72,60]:[44,38,34], smokeL=day?[150,134,112]:[86,76,66];
  // STEM — rises from a broad dust base to the cap, leaning with turbulence, hot near the ground
  var stemTop=capCy+capRy*0.35;
  for(var y=baseY; y>stemTop; y--){ var t=(baseY-y)/Math.max(1,(baseY-stemTop));
    var w=lerp(stemBaseW,stemTopW,Math.pow(t,0.7)), lean=Math.sin(t*3+now*0.001+seed)*capRx*0.10*t;
    var cx=nx+lean, wob=Math.sin(y*0.3+now*0.004+seed)*1.2*t;
    g.fillStyle=rgba(mixc(smokeD,smokeL,0.25+0.45*t),0.9); g.fillRect((cx-w/2-wob)|0,y|0,(w+wob*2)|0,1);
    if(t<0.5){ g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(255,140,40,"+(0.42*(1-t*2)*(1-nph*0.5))+")"; g.fillRect((cx-w*0.3)|0,y|0,(w*0.6)|0,1);
      g.globalCompositeOperation="source-over"; } }
  // CAP — billowing cauliflower, built column-by-column in 3 shaded bands: rounded dome top, lumpy underside skirt
  var capMid=rgba(mixc(smokeL,smokeD,0.5),0.94), capTop=rgba(smokeL,0.94), capBot=rgba(smokeD,0.94);
  for(var dx=-capRx; dx<=capRx; dx++){ var ex=dx/capRx;
    var lump=Math.sin(dx*0.5+now*0.003+seed)*0.12+Math.sin(dx*0.9+seed*2)*0.08;
    var dome=Math.sqrt(Math.max(0,1-ex*ex));
    var y0=(capCy-capRy*dome*(1+lump))|0, y1=(capCy+capRy*0.5*Math.sqrt(Math.max(0,1-ex*ex*0.7))*(1+lump*1.5)+capRy*0.3)|0;
    var colX=(nx+dx)|0, hh=Math.max(1,y1-y0), bA=(hh*0.42)|0, bB=(hh*0.76)|0;   // top-lit → dark underside, 3 bands
    g.fillStyle=capTop; g.fillRect(colX,y0,1,Math.max(1,bA));
    g.fillStyle=capMid; g.fillRect(colX,y0+bA,1,Math.max(1,bB-bA));
    g.fillStyle=capBot; g.fillRect(colX,y0+bB,1,Math.max(1,hh-bB));
    g.globalCompositeOperation="lighter";                                    // heat still glowing under the cap
    g.fillStyle="rgba(255,120,40,"+(0.34*(1-nph*0.6))+")"; g.fillRect(colX,y1-1,1,2);
    g.globalCompositeOperation="source-over";
  }
  // the condensation collar — the classic skirt where the stem meets the cap
  g.fillStyle=rgba(smokeL,0.45); g.fillRect((nx-capRx*0.7)|0,(capCy+capRy*0.75)|0,(capRx*1.4)|0,1);
}
// the CRATER the bomb gouges at ground zero — a massive scorched bowl with raised ejecta rims and a
// molten-glass floor that cools over ~15s. Digs to full in ~1.6s and stays for the whole aftermath.
function drawNukeCrater(g,nx,now){
  var dig=Math.min(1,blastMs/1600); if(dig<=0) return;
  var R=(WW*0.115)*dig; if(R<3) return;                       // a MASSIVE bowl, wider than the mushroom's stem
  var gy=HORIZON, hot=Math.max(0,1-blastMs/15000);
  var maxDepth=Math.min(SH-gy-1, R*0.6);
  // the excavated bowl — charred earth & fused glass, deepest at the centre, carved into the ground band
  for(var dx=-R; dx<=R; dx++){ var ex=dx/R, colX=(nx+dx)|0, e2=ex*ex;
    var depth=(1-e2)*maxDepth;
    g.fillStyle = e2>0.80 ? "#4a382c" : (e2>0.45 ? "#281c16" : "#130d0b");   // rim-lip → mid wall → dark deep
    g.fillRect(colX, gy-1, 1, (depth+2)|0);
    if(hot>0.02 && e2<0.72){ g.globalCompositeOperation="lighter";           // molten glass glowing on the floor while hot
      g.fillStyle="rgba(255,116,32,"+(0.55*hot*(1-e2))+")"; g.fillRect(colX,(gy-2+depth)|0,1,2);
      g.globalCompositeOperation="source-over"; }
  }
  // raised ejecta rim mounds at both lips (earth blasted up and out)
  var rimH=Math.max(2,(R*0.16)|0);
  for(var s=-1;s<=1;s+=2){ var lipX=nx+s*R;
    for(var rr=0; rr<rimH; rr++){ var t=rr/rimH, mw=Math.max(1,(1-t)*rimH*1.4);
      g.fillStyle=t<0.4?"#5a4636":"#3a2c22"; g.fillRect((lipX-mw)|0,(gy-1-rr)|0,(mw*2)|0,1); } }
}
// THE INCOMING WARHEAD — before the blast, a missile streaks down out of the sky toward ground zero,
// a fiery contrail behind it and a blinking target reticle on the ground. The city is still alive & intact.
function drawWarheadFall(g,nx,now){
  var fp=Math.min(1,apocMs/NUKE_FALL_MS), acc=fp*fp;                     // accelerating fall (gravity)
  var wy=acc*(HORIZON-3), wx=nx - (1-fp)*(SW*0.05);                      // comes in at a slight slant
  // the fiery contrail streaming up behind it into the sky
  g.globalCompositeOperation="lighter";
  for(var tr=1; tr<26; tr++){ var ty=wy-tr*5; if(ty<-4) break;
    var tx=wx + (1-fp)*(SW*0.05)*(tr/26), a=(1-tr/26)*0.6;
    g.fillStyle="rgba(255,"+(200-tr*4)+","+(120-tr*3)+","+(a*0.7)+")"; g.fillRect((tx-1)|0,ty|0,2,4);   // hot smoke
    if(tr>8){ g.fillStyle="rgba(210,210,220,"+(a*0.5)+")"; g.fillRect((tx)|0,ty|0,1,4); } }             // cooling to grey vapor
  g.globalCompositeOperation="source-over";
  // the warhead itself — a dark finned body with a white-hot nose
  g.fillStyle="#26262e"; g.fillRect((wx-1)|0,(wy-5)|0,3,6);
  g.fillStyle="#3a3a44"; g.fillRect((wx-2)|0,(wy-4)|0,1,2); g.fillRect((wx+2)|0,(wy-4)|0,1,2);           // fins
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(255,236,180,0.95)"; g.fillRect((wx-1)|0,(wy)|0,3,2);                                 // white-hot nose
  g.fillStyle="rgba(255,150,60,0.8)";   g.fillRect((wx-1)|0,(wy+1)|0,3,3);
  g.globalCompositeOperation="source-over";
  // a blinking red target reticle on the ground where it's about to hit
  if((Math.floor(now/140))&1){ g.fillStyle="rgba(255,40,40,"+(0.5+0.4*fp)+")";
    g.fillRect((nx-4)|0,HORIZON-1,3,1); g.fillRect((nx+2)|0,HORIZON-1,3,1);
    g.fillRect((nx-1)|0,HORIZON-4,1,3); g.fillRect((nx-1)|0,HORIZON,1,2); }
}
function drawApocNuke(g,ap,L,now){
  // ONE bomb. Ground zero is off in the distance: it falls out of the sky, then a blinding double-flash,
  // a rising fireball, an overpressure shockwave that blows the city flat, and a colossal mushroom.
  var gz=nukeGZX(now), nx=gz-WOFF;
  if(nx>SW+300&&nx-WW>-300) nx-=WW; if(nx<-300&&nx+WW<SW+300) nx+=WW;
  // ---- BEFORE IMPACT: the warhead is still incoming — draw it falling; the city carries on, untouched ----
  if(apocMs<NUKE_FALL_MS){ drawWarheadFall(g,nx,now); return; }
  // an EPIC irradiated sky within ~1.2s and it stays — even a noon blast goes to an apocalyptic twilight:
  // the heavens are painted from a deep violet high overhead down through crimson to a smouldering ember
  // orange at the horizon (a graded pall, not a flat brown wash)
  var skyA=Math.min(1,blastMs/1200);
  var SKB=[[34,10,54],[80,16,58],[120,26,44],[168,52,20],[204,86,20]];   // violet(top) → magenta → crimson → ember → orange(horizon)
  var segN=SKB.length-1, sstep=6;
  for(var yy=0; yy<HORIZON; yy+=sstep){ var tt=yy/HORIZON*segN, si=Math.min(segN-1,tt|0), tf=tt-si, ca=SKB[si], cb=SKB[si+1];
    g.fillStyle="rgba("+((ca[0]+(cb[0]-ca[0])*tf)|0)+","+((ca[1]+(cb[1]-ca[1])*tf)|0)+","+((ca[2]+(cb[2]-ca[2])*tf)|0)+","+(0.64*skyA)+")";
    g.fillRect(0,yy,SW,sstep); }
  // a COLOSSAL fireglow blooms out of ground zero, lighting the whole sky — a white-hot heart out through
  // orange and blood-red to a vast violet shock-halo arching far overhead
  g.globalCompositeOperation="lighter";
  var glowA=skyA*(1-Math.min(1,blastMs/13000)), gr=WW*0.12+blastMs*0.014;
  if(glowA>0.01){ var BLOOM=[[150,54,146,0.14],[214,58,40,0.22],[255,120,40,0.30],[255,206,132,0.32]];   // violet halo → red → orange → hot core
    for(var bl=0; bl<BLOOM.length; bl++){ var bc=BLOOM[bl], brr=gr*(1.4-bl*0.28);
      g.fillStyle="rgba("+bc[0]+","+bc[1]+","+bc[2]+","+(glowA*bc[3])+")"; fillEllipse(g,nx,HORIZON-2,brr,brr*0.82); } }
  g.globalCompositeOperation="source-over";

  // 1) THE BANG — a blinding whiteout, then a huge fireball that lofts up to seed the mushroom
  if(blastMs<650){ var fl0=1-blastMs/650, dbl=(blastMs<70?1:(blastMs<150?0.6:1));             // the characteristic double flash
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,255,247,"+(0.98*fl0*dbl)+")"; g.fillRect(0,0,SW,SH);
    g.globalCompositeOperation="source-over"; }
  if(blastMs<1800){ var fl=Math.max(0,1-blastMs/1800);
    var fr0=20+(1-fl)*98, fby=HORIZON-fr0*0.55-(1-fl)*fr0*0.8;                              // a big round fireball, swelling then lofting into the sky
    g.globalCompositeOperation="lighter";
    g.fillStyle="rgba(150,50,12,"+(0.6*fl)+")";   fillEllipse(g,nx,fby,fr0*1.05,fr0);        // dark rim
    g.fillStyle="rgba(255,142,44,"+(0.9*fl)+")";  fillEllipse(g,nx,fby,fr0*0.8,fr0*0.78);    // orange shell
    g.fillStyle="rgba(255,240,178,"+(0.98*fl)+")";fillEllipse(g,nx,fby,fr0*0.45,fr0*0.44);   // white-hot core
    g.globalCompositeOperation="source-over"; }

  // 2) THE OVERPRESSURE SHOCKWAVE — a compression dome races out from ground zero, flattening the city
  var fr=nukeFrontR(), edge=WW*0.68;
  if(fr>4 && fr<edge){ var fade=1-fr/edge;
    g.globalCompositeOperation="lighter";
    for(var s=-1;s<=1;s+=2){ var fxE=nx+s*fr;                                             // both flanks of the expanding wall
      if(fxE>-60&&fxE<SW+60){
        var domeH=26+fr*0.10;                                                             // the wall of churning dust & fire, taller as it grows
        // churning dust body trailing back toward the blast (dark, roiling)
        for(var t2=0;t2<20;t2++){ var a2=(1-t2/20), rough=Math.sin((t2*2.3)+now*0.006+s)*3;
          g.fillStyle="rgba("+(150-t2*3)+","+(110-t2*3)+","+(80-t2*2)+","+(0.34*a2*fade)+")";
          g.fillRect((fxE-s*t2*3)|0,(HORIZON-domeH+rough)|0,3,(domeH-rough)|0); }
        // white-hot leading edge (the Mach front)
        for(var e2=0;e2<3;e2++){ g.fillStyle="rgba(255,244,206,"+((0.75-e2*0.2)*fade)+")";
          g.fillRect((fxE+s*e2)|0,(HORIZON-domeH-4)|0,2,(domeH+4)|0); }
      } }
    // the ground dust curtain kicked up behind the whole front
    g.fillStyle="rgba(120,102,80,"+(0.42*fade)+")"; g.fillRect((nx-fr)|0,HORIZON-6,(fr*2)|0,6);
    g.globalCompositeOperation="source-over";
    // a faint condensation ring (Wilson cloud) racing just ahead of the fireball early on
    if(blastMs<3000){ var wr=fr*1.12, wa=0.25*fade;
      g.fillStyle="rgba(210,214,220,"+wa+")"; g.fillRect((nx-wr)|0,(HORIZON-20)|0,2,20); g.fillRect((nx+wr)|0,(HORIZON-20)|0,2,20); }
  }

  // the CRATER at ground zero (drawn over the flattened ruins, before the column so the stem rises from it)
  drawNukeCrater(g,nx,now);

  // 3) THE MUSHROOM — one colossal cloud towering over the ruins; rises fast off the fireball, then keeps billowing to full
  var frac=Math.min(1,Math.pow(blastMs/40000,0.45));                                         // already sizeable by ~3 s (bridges the fireball), full by ~40 s
  g.fillStyle="rgba(120,100,70,"+(0.6*Math.min(1,blastMs/1500))+")"; var bs=14+frac*70;    // wide base surge under the column
  g.fillRect((nx-bs)|0,HORIZON-4,(bs*2)|0,4);
  drawMushroom(g,nx,Math.max(0.06,frac),now,777,L,2.9);

  // fallout drifting down over the dead city
  var foA=0.4*Math.min(1,blastMs/8000);
  for(var fo=0;fo<48;fo++){ var fx2=((fo*97+now*0.02)%SW), fy2=((fo*61+now*0.04)%HORIZON);
    g.fillStyle="rgba(180,175,160,"+foA+")"; g.fillRect(fx2|0,fy2|0,1,1); }
  var doom=blastMs<8000?"☢ NUCLEAR STRIKE ☢":cityName+" IS GONE";
  drawDoomHud(g,ap,now,doom,doom);
}
// SUNBURST: the sun swells into a red giant that BAKES the whole earth, then DETONATES → a dead scorched world.
// Timeline is on the real-time apocMs clock (grow 0..22s → ignite/firestorm → detonate ~30s → long static aftermath).
function drawApocSun(g,ap,L,now){
  var grow=Math.min(1,apocMs/SUN_IGNITE_MS);                                                // the sun swells over ~22s
  var burnMs=apocMs-SUN_IGNITE_MS;                                                          // >0 once the ground has ignited
  var expMs=apocMs-SUN_EXPLODE_MS;                                                          // >0 once the sun detonates
  var sunWX=nukeGZX(now), sx=sunWX-WOFF;                                                    // ONE sun anchored to a world position (consistent across monitors)
  if(sx>SW+600 && sx-WW>-600) sx-=WW;  if(sx<-600 && sx+WW<SW+600) sx+=WW;
  var sy=HORIZON*0.34;

  // ===== LONG AFTERMATH (hours): the detonation flash has passed → a CHEAP, STATIC scorched world =====
  // drawApocalypse runs EVERY frame for the whole ~7.5h apoc phase; nothing below may grow with time.
  if(expMs>1600){
    g.fillStyle="rgba(34,9,9,0.95)"; g.fillRect(0,0,SW,HORIZON);                            // dead dark-red sky
    var fadeW=Math.max(0,1-(expMs-1600)/9000);                                              // the blinding flash fades out over ~9s
    if(fadeW>0){ g.fillStyle="rgba(255,240,218,"+(0.9*fadeW)+")"; g.fillRect(0,0,SW,SH); }
    g.globalCompositeOperation="lighter";                                                   // a dull bloated dead ember where the sun was (FIXED size — bounded)
    g.fillStyle="rgba(150,36,16,0.42)"; fillEllipse(g,sx,sy,150,132);
    g.fillStyle="rgba(190,54,20,0.5)";  fillEllipse(g,sx,sy,92,84);
    g.fillStyle="rgba(70,16,10,0.6)";   fillEllipse(g,sx,sy,44,42);
    g.globalCompositeOperation="source-over";
    g.fillStyle="rgba(8,4,5,0.92)"; g.fillRect(0,HORIZON,SW,SH-HORIZON);                    // black scorched ground
    drawDoomHud(g,ap,now,cityName+" IS ASH",cityName+" IS ASH");
    return;
  }

  // ===== SKY: reddens & darkens as the sun swells; glares white-hot at ignition =====
  var skyA=Math.min(0.94,0.14+0.74*grow*grow+(burnMs>0?0.1:0));
  var SKB=[[46,10,20],[104,22,20],[158,44,16],[196,78,18],[226,118,26]];                    // deep-red top → hot-orange horizon
  var segs=SKB.length-1, sstep=6;
  for(var yy=0; yy<HORIZON; yy+=sstep){ var fpos=yy/HORIZON*segs, si=Math.min(segs-1,fpos|0), sf=fpos-si, c0=SKB[si],c1=SKB[si+1];
    g.fillStyle="rgba("+Math.round(c0[0]+(c1[0]-c0[0])*sf)+","+Math.round(c0[1]+(c1[1]-c0[1])*sf)+","+Math.round(c0[2]+(c1[2]-c0[2])*sf)+","+skyA+")";
    g.fillRect(0,yy,SW,sstep); }

  // ===== THE SUN — a swelling red giant (additive glare, so the skyline shows through then washes out) =====
  var R=12+grow*grow*(SW*0.28);                                                             // grows to ~0.28·SW radius by ignition — a huge menacing orb, but the burning city stays visible beneath it
  if(burnMs>0) R+=Math.min(SW*0.10, burnMs*0.003);                                          // keeps bloating through the firestorm (bounded)
  if(expMs>=0) R+=Math.pow(Math.max(0,expMs)/1000,1.25)*SW*1.9;                             // DETONATION expands it fast to swallow the sky…
  R=Math.min(R, SW*1.5);                                                                    // …HARD-CLAMPED so a giant fillEllipse can never freeze the wallpaper
  if(expMs<400){                                                                            // only draw the disk while it still reads (the whiteout saturates by ~325ms)
    g.globalCompositeOperation="lighter";
    if(expMs<0){                                                                            // corona + surface flares only pre-detonation (keeps big frames rare)
      for(var cg=3; cg>=1; cg--){ var rr=R*(1.1+cg*0.28); g.fillStyle="rgba(255,"+(70+cg*20)+",22,"+(0.045+0.03*grow)+")"; fillEllipse(g,sx,sy,rr,rr*0.94); }
      for(var sp=0; sp<10; sp++){ var hh=((sp*2654435761)>>>0), aa=(hh%628)/100, rr3=R*(0.25+((hh>>4)%100)/100*0.6);
        g.fillStyle="rgba(255,150,40,0.4)"; g.fillRect((sx+Math.cos(aa+now*0.0005)*rr3)|0,(sy+Math.sin(aa+now*0.0005)*rr3*0.94)|0,2,2); }
    }
    g.fillStyle="rgba(220,48,14,"+(0.42+0.26*grow)+")"; fillEllipse(g,sx,sy,R,R*0.96);       // deep-red body
    g.fillStyle="rgba(255,116,32,"+(0.44+0.24*grow)+")"; fillEllipse(g,sx,sy,R*0.78,R*0.76); // orange mantle
    g.fillStyle="rgba(255,188,80,"+(0.42+0.26*grow)+")"; fillEllipse(g,sx,sy,R*0.5,R*0.48);  // hot inner
    g.fillStyle="rgba(255,246,214,"+(0.4+0.5*Math.max(grow,expMs>=0?1:0))+")"; fillEllipse(g,sx,sy,R*0.26,R*0.26);   // white-hot core
    g.globalCompositeOperation="source-over";
  }

  // ===== AT IGNITION: the whole horizon is ablaze + a rising wall of heat glare =====
  if(burnMs>0 && expMs<0){ var blazeA=Math.min(1,burnMs/1600);
    g.globalCompositeOperation="lighter";
    for(var fb=0; fb<SW; fb+=2){ var fh=5+((Math.floor(now/60)+fb*7)%12);
      g.globalAlpha=0.5*blazeA; g.fillStyle=["#ff5210","#ff8c1c","#ffc63a"][((Math.floor(now/80))+fb)%3]; g.fillRect(fb,(HORIZON-fh)|0,1,fh); }
    g.globalAlpha=1; g.fillStyle="rgba(255,120,40,"+(0.16*blazeA)+")"; g.fillRect(0,HORIZON-34,SW,34);
    g.globalCompositeOperation="source-over"; }

  // ===== THE DETONATION → blinding whiteout (short, bounded window; aftermath takes over past 1600ms) =====
  if(expMs>=0){ g.fillStyle="rgba(255,249,236,"+Math.min(1,0.35+expMs/500)+")"; g.fillRect(0,0,SW,SH); }

  var msg=(burnMs<=0)?("SOLAR EXPANSION - "+cityName+" BAKES"):(expMs<0)?("THE SUN CONSUMES "+cityName):"THE SUN HAS DIED";
  drawDoomHud(g,ap,now,msg,msg);
}
// AI TAKEOVER: AI factories boot at an epicentre, an assimilation front spreads outward converting the
// city into machine-factories & harvesting it, the planet's resources drain, then it's enslaved & killed.
// Timeline on the real-time apocMs clock (boot ~3s → assimilation front crosses the city ~10s → dead machine world).
// ---- INVASION SPECTACLE (shared by the AI takeover + alien-war finale + tier-3 war):
// descending dropships and AIMED beams that telegraph, then CRACK into the street.
// Near-misses ONLY (targets are hash-offset away from any ped anchor); crowds scatter via
// the existing apoc/war ped machinery. Everything is a pure function of the clock. ----
function drawDropship(g,sx,sy,kind,now){                       // kind 0 machine-red · 1 saucer · 2 gunmetal
  var hull=kind===0?"#2a1218":(kind===1?"#1a2030":"#232830");
  var glow=kind===0?"255,60,50":(kind===1?"140,220,255":"255,200,90");
  g.fillStyle=hull; g.fillRect((sx-7)|0,sy|0,14,4); g.fillRect((sx-4)|0,(sy-3)|0,8,3);
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba("+glow+",0.7)"; g.fillRect((sx-5)|0,(sy+4)|0,10,1);                  // underglow
  if(((Math.floor(now/300))&1)===0){ g.fillStyle="rgba("+glow+",0.9)"; g.fillRect((sx+(((now/300)|0)%2?6:-7))|0,(sy+1)|0,1,1); }
  g.globalCompositeOperation="source-over";
}
// a fleet of descending dropships on wrapped ~11s S-curve paths (count bounded)
function drawInvasionFleet(g,now,salt,n,kind,yMax){
  for(var i=0;i<n;i++){ var h=((i*2654435761+salt)>>>0); h^=h>>>15;
    var ph=((now*(0.8+((h>>>6)%5)*0.1)/11000)+((h>>>9)%97)/97)%1;
    var dx=((h%WW)+Math.sin(ph*6.28+i)*30)-WOFF; if(dx<-16||dx>SW+16) continue;
    drawDropship(g,dx,6+ph*yMax,kind,now); }
}
// one aimed strike per ~950ms slot: a telegraph dot sweeps to the target, then the CRACK —
// thick beam + ground flash + dust ring. Returns nothing; purely visual, always a near-miss.
function drawAimedBeam(g,now,salt,muzX,muzY,colRGB){
  var SLOT=950, sl=Math.floor(now/SLOT), ph=(now%SLOT)/SLOT;
  var h=((sl*2654435761+salt)>>>0); h^=h>>>13;
  var tx=(h%WW)-WOFF; if(tx<-40||tx>SW+40) return;
  tx+=(((h>>>21)&1)?1:-1)*(6+((h>>>17)%9));                    // guaranteed near-miss offset off any anchor
  g.globalCompositeOperation="lighter";
  if(ph<0.6){                                                   // telegraph: the aim point skims the street
    var swp=muzX+(tx-muzX)*(ph/0.6);
    g.fillStyle="rgba("+colRGB+",0.28)"; g.fillRect(swp|0,(HORIZON-3)|0,2,3);
    g.fillStyle="rgba("+colRGB+",0.55)"; g.fillRect(swp|0,(HORIZON-1)|0,2,1);
  } else {                                                      // CRACK
    var k=(ph-0.6)/0.4;
    for(var t=0;t<=14;t++){ var tf=t/14;
      g.fillStyle="rgba("+colRGB+","+(0.9*(1-tf*0.3)*(1-k*0.5)).toFixed(3)+")";
      g.fillRect((muzX+(tx-muzX)*tf)|0,(muzY+((HORIZON-2)-muzY)*tf)|0,3,3); }
    g.fillStyle="rgba(255,245,220,"+(0.9*(1-k)).toFixed(3)+")"; fillEllipse(g,tx,HORIZON-2,5+k*6,3);
    g.fillStyle="rgba(200,160,120,"+(0.5*(1-k)).toFixed(3)+")"; fillEllipse(g,tx,HORIZON-5,3+k*10,2);   // dust ring
  }
  g.globalCompositeOperation="source-over";
}
// the last ~10 strikes leave fading scorch smudges + a dying ember (pure fn of the clock)
function drawScorches(g,now,salt){
  var SLOT=950, base=Math.floor(now/SLOT);
  for(var k2=1;k2<=10;k2++){ var sl2=base-k2, age=(now-((sl2+1)*SLOT))/20000; if(age>=1) break;
    var h2=((sl2*2654435761+salt)>>>0); h2^=h2>>>13;
    var sx2=(h2%WW)-WOFF; if(sx2<-10||sx2>SW+10) continue;
    sx2+=(((h2>>>21)&1)?1:-1)*(6+((h2>>>17)%9));
    g.fillStyle="rgba(30,22,18,"+(0.5*(1-age)).toFixed(3)+")"; fillEllipse(g,sx2,HORIZON-1,4,1);
    if(age<0.4&&((Math.floor(now/160)+k2)&1)){ g.fillStyle="rgba(255,120,40,"+(0.5*(1-age/0.4)).toFixed(3)+")"; g.fillRect(sx2|0,(HORIZON-2)|0,1,1); }
  }
}
function drawApocAI(g,ap,L,now){
  var boot=Math.min(1,apocMs/AI_WAKE_MS);                    // factory boot progress (0..1)
  var frontR=aiFrontR(), prog=Math.min(1,frontR/(WW*0.5));   // how much of the city has been assimilated
  var epiX=apocEpiX(now), sx=epiX-WOFF;                      // the mega-factory / AI core
  if(sx>SW+600&&sx-WW>-600)sx-=WW; if(sx<-600&&sx+WW<SW+600)sx+=WW;
  var coreY=HORIZON-2;

  // ===== LONG AFTERMATH (hours): the city is fully assimilated → a CHEAP STATIC dead machine wasteland =====
  if(apocMs>AI_WAKE_MS+AI_WIPE_MS+1500){
    g.fillStyle="rgba(14,6,12,0.95)"; g.fillRect(0,0,SW,HORIZON);                            // dead machine-dark sky
    g.globalCompositeOperation="lighter";
    for(var gl0=0;gl0<SW;gl0+=26){ g.fillStyle="rgba(120,20,40,0.06)"; g.fillRect(gl0,0,1,HORIZON); }   // cold dim red grid
    g.fillStyle="rgba(90,20,34,0.14)"; g.fillRect(0,HORIZON*0.5,SW,HORIZON*0.5);             // low industrial smog
    g.globalCompositeOperation="source-over";
    var mH=Math.round(HORIZON*0.42);                                                          // the cold mega-factory monolith, standing dead
    g.fillStyle="#0a0510"; g.fillRect((sx-9)|0,coreY-mH,18,mH); g.fillRect((sx-16)|0,coreY-Math.round(mH*0.6),8,Math.round(mH*0.6)); g.fillRect((sx+8)|0,coreY-Math.round(mH*0.55),7,Math.round(mH*0.55));
    g.fillStyle="rgba(150,30,50,"+(0.3+0.15*(Math.floor(now/700)&1))+")"; g.fillRect((sx-3)|0,coreY-Math.round(mH*0.7),6,6);   // its reactor-eye barely pulsing
    g.fillStyle="rgba(6,3,8,0.92)"; g.fillRect(0,HORIZON,SW,SH-HORIZON);                     // dead machine ground
    drawDoomHud(g,ap,now,"PLANET ENSLAVED","CIVILIZATION DELETED");
    return;
  }

  // ===== machine-red sky + digital grid + sweeping scan-line (deepens toward the dead-machine aftermath as the takeover spreads) =====
  var mA=Math.min(0.92,0.16+0.74*Math.max(boot*0.5,prog));
  g.fillStyle="rgba(48,2,14,"+mA+")"; g.fillRect(0,0,SW,HORIZON);
  g.globalCompositeOperation="lighter";
  g.fillStyle="rgba(150,26,40,"+(0.08+0.26*prog)+")"; g.fillRect(0,(HORIZON*0.52)|0,SW,(HORIZON*0.48)|0);   // furnace-glow rising off the factory city
  for(var gl2=0;gl2<SW;gl2+=24){ g.fillStyle="rgba(255,40,60,"+(0.06+0.09*prog)+")"; g.fillRect(gl2+((Math.floor(now/300))%24),0,1,HORIZON); }
  var scanY=((now*0.06)%(HORIZON+40))-20; g.fillStyle="rgba(255,60,80,"+(0.2+0.25*prog)+")"; g.fillRect(0,scanY|0,SW,2);
  g.globalCompositeOperation="source-over";

  // ===== the MEGA-FACTORY / AI CORE rising at the epicentre (boots first, then towers over the machine city) =====
  var fH=Math.round(HORIZON*(0.18+0.30*boot+0.06*prog));
  g.fillStyle="#0a0510"; g.fillRect((sx-9)|0,coreY-fH,18,fH);                                 // central tower
  g.fillRect((sx-17)|0,coreY-Math.round(fH*0.62),8,Math.round(fH*0.62)); g.fillRect((sx+9)|0,coreY-Math.round(fH*0.56),8,Math.round(fH*0.56));   // flanking stacks
  g.globalCompositeOperation="lighter";
  for(var st=0;st<3;st++){ var stx0=[sx-13,sx,sx+13][st], smp=((now*0.03+st*90)%110)/110;    // stacks belching machine-smog
    g.fillStyle="rgba(150,36,50,"+(0.5*(1-smp))+")"; g.fillRect((stx0-1+Math.sin(now*0.003+st)*2)|0,(coreY-fH-2-smp*22)|0,3,3); }
  var eyePulse=0.55+0.45*Math.sin(now*0.012);                                                 // the giant reactor-eye
  g.fillStyle="rgba(255,50,80,"+(0.5+0.4*eyePulse)+")"; fillEllipse(g,sx,coreY-Math.round(fH*0.72),6+2*eyePulse,6+2*eyePulse);
  g.fillStyle="rgba(255,200,210,"+(0.5*eyePulse)+")"; g.fillRect((sx-1)|0,(coreY-Math.round(fH*0.72)-1)|0,2,2);
  g.globalCompositeOperation="source-over";

  // ===== the ASSIMILATION FRONT — a sweeping wall of red digital light at radius frontR from the core =====
  if(apocStruck() && frontR<WW*0.62){ g.globalCompositeOperation="lighter";
    for(var side=-1;side<=1;side+=2){ var fwx=sx+side*frontR;
      if(fwx<-10||fwx>SW+10) continue;
      g.fillStyle="rgba(255,40,70,0.28)"; g.fillRect((fwx-side*4)|0,0,8,HORIZON);                         // the wall's glow
      for(var fy=0;fy<HORIZON;fy+=2){ var cflk=((Math.floor(now/60)+fy*7+side*13)%4)===0;                // cascading code down the leading edge
        g.fillStyle=cflk?"rgba(170,225,255,0.85)":"rgba(255,50,80,0.6)"; g.fillRect(fwx|0,fy,3,2); } }
    g.globalCompositeOperation="source-over"; }

  // ===== drone swarm thickening over the converting city =====
  for(var dr2=0;dr2<Math.round(6+prog*22);dr2++){
    var dh=((dr2*2654435761)>>>0), dx2=((dh%WW)+now*(0.02+((dh>>>8)%20)*0.002))%WW-WOFF, dy2=14+((dh>>>4)%(HORIZON-60));
    if(dx2<-4||dx2>SW+4) continue;
    g.fillStyle="#1a0c10"; g.fillRect(dx2|0,dy2|0,2,1);
    if(((Math.floor(now/160))+dr2)%2===0){ g.fillStyle="#ff2444"; g.fillRect((dx2+((dr2&1)?0:1))|0,(dy2+1)|0,1,1); }
  }

  // ===== THE INVASION FORCE: machine dropships descend from above the monolith; the
  // reactor-eye SWEEPS, LOCKS and cracks an aimed laser into the streets (near-misses —
  // the fleeing crowds are already handled by the apoc ped machinery) =====
  if(apocStruck()){
    drawInvasionFleet(g,now,911,4,0,Math.round(HORIZON*0.5));
    drawScorches(g,now,912);
    var eyeY=coreY-Math.round(fH*0.7);
    drawAimedBeam(g,now,912,sx,eyeY,"255,60,70");
    g.globalCompositeOperation="lighter";                                                    // the eye flares as it fires
    g.fillStyle="rgba(255,60,70,"+(0.35+0.25*((Math.floor(now/240))&1))+")"; fillEllipse(g,sx,eyeY,5,4);
    g.globalCompositeOperation="source-over";
  }

  // ===== harvested data-voxels streaming up out of the converted city, converging on the core =====
  if(apocStruck()){ g.globalCompositeOperation="lighter";
    for(var hv=0;hv<Math.round(prog*26);hv++){ var hh=((hv*2654435761+7)>>>0), hph=((now*0.05+hv*61+hh)%100)/100;
      var ox=((hh%WW)-WOFF), oy=HORIZON-4;
      var hx=ox+(sx-ox)*hph*0.6, hy=oy+(coreY-fH*0.7-oy)*hph;                                 // drift from the ground toward the core
      if(hx<-3||hx>SW+3) continue;
      g.fillStyle=(hv&1)?"rgba(255,70,100,"+(0.6*(1-hph))+")":"rgba(120,200,255,"+(0.6*(1-hph))+")"; g.fillRect(hx|0,hy|0,2,2); }
    g.globalCompositeOperation="source-over"; }

  var msg = (boot<1) ? "AI FACTORIES ONLINE - BOOTING"
          : (prog<0.55) ? "ASSIMILATION "+Math.round(prog*100)+" PCT"
          : (prog<1) ? "RESOURCES DEPLETING - "+Math.round(prog*100)+" PCT"
                     : "PLANET ENSLAVED";
  drawDoomHud(g,ap,now,msg,"CIVILIZATION DELETED");
}
// BLACK HOLE: a singularity forms in the sky, its accretion disk blazes, and its growing pull streams the whole city up into the void.
// Timeline on the real-time apocMs clock (form ~3.2s → pull-radius swallows the city ~11s → a static dark void).
function drawApocBlackHole(g,ap,L,now){
  var formP=Math.min(1,apocMs/BH_FORM_MS);                    // singularity formation
  var frontR=bhFrontR(), prog=Math.min(1,frontR/(WW*0.5));   // how much of the city has been pulled in
  var bp=bhPos(now), sx=bp.sx, sy=bp.sy, spin=now*0.006;

  // ===== LONG AFTERMATH (hours): a STATIC void — near-black warped sky, cold stars, the quiet dim hole, empty ground =====
  if(apocMs>BH_FORM_MS+BH_WIPE_MS+1500){
    g.fillStyle="rgba(3,2,9,0.97)"; g.fillRect(0,0,SW,HORIZON);
    for(var stp=0;stp<40;stp++){ var sh0=((stp*2654435761)>>>0); g.fillStyle="rgba(180,190,220,"+(0.2+0.2*((sh0>>>3)&1))+")"; g.fillRect(sh0%SW,(sh0>>>9)%HORIZON,1,1); }
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(60,40,110,0.28)"; fillEllipse(g,sx,sy,26,24); g.globalCompositeOperation="source-over";   // residual halo (FIXED size)
    g.fillStyle="#000"; fillEllipse(g,sx,sy,15,15);                                             // the black disk remains
    g.fillStyle="rgba(4,3,10,0.95)"; g.fillRect(0,HORIZON,SW,SH-HORIZON);                       // empty dark ground
    drawDoomHud(g,ap,now,cityName+" CONSUMED",cityName+" CONSUMED");
    return;
  }

  // ===== sky darkens & warps as the hole swallows the daylight; stars emerge =====
  var skyA=Math.min(0.95,0.2+0.72*Math.max(formP*0.5,prog));
  g.fillStyle="rgba(6,4,16,"+skyA+")"; g.fillRect(0,0,SW,HORIZON);
  g.globalCompositeOperation="lighter";
  for(var st2=0;st2<Math.round(skyA*44);st2++){ var s2=((st2*2654435761)>>>0); g.fillStyle="rgba(170,180,215,"+(0.3*skyA)+")"; g.fillRect(s2%SW,(s2>>>9)%HORIZON,1,1); }

  // ===== gravitational LENSING halo — concentric distortion rings (drawn only, never a pixel read) =====
  var Rd=8+formP*16+prog*10;                                                                    // the hole/disk scale (bounded)
  for(var lr=4;lr>=1;lr--){ var rr=Rd*(1.5+lr*0.65); g.fillStyle="rgba(60,80,165,"+(0.035+0.015*lr)+")"; fillEllipse(g,sx,sy,rr,rr*0.9); }

  // ===== the ACCRETION DISK — a blazing tilted ring of superheated matter spiralling in (Doppler-brightened on one side) =====
  for(var adk=0; adk<44; adk++){ var aa=(adk/44)*Math.PI*2+spin, hot=(Math.sin(aa)+1)*0.5;
    g.fillStyle="rgba(255,"+((140+80*hot)|0)+","+((40+60*hot)|0)+","+(0.5+0.4*hot)+")"; g.fillRect((sx+Math.cos(aa)*Rd*2.1)|0,(sy+Math.sin(aa)*Rd*0.66)|0,2,2); }
  for(var ad2=0; ad2<30; ad2++){ var aa2=(ad2/30)*Math.PI*2-spin*1.5; g.fillStyle="rgba(180,210,255,0.7)"; g.fillRect((sx+Math.cos(aa2)*Rd*1.35)|0,(sy+Math.sin(aa2)*Rd*0.46)|0,1,1); }
  g.globalCompositeOperation="source-over";

  // ===== the singularity — a pure black disk ringed by a bright photon sphere =====
  g.fillStyle="#000"; fillEllipse(g,sx,sy,Rd,Rd);
  g.globalCompositeOperation="lighter";
  for(var pr=0; pr<30; pr++){ var pa=(pr/30)*Math.PI*2; g.fillStyle="rgba(220,180,255,0.8)"; g.fillRect((sx+Math.cos(pa)*(Rd+1.5))|0,(sy+Math.sin(pa)*(Rd+1.5))|0,1,1); }

  // ===== everything is dragged in — debris/dust/light spiralling toward the hole =====
  if(apocStruck()){ for(var pt=0; pt<Math.round(14+prog*30); pt++){ var ph=((pt*2654435761+3)>>>0);
      var life=((now*0.05+pt*37+ph)%100)/100, ang=(ph%628)/100+life*7, rad=(1-life)*(Rd*2+((ph%100)/100)*SW*0.5);
      var pxp=sx+Math.cos(ang)*rad, pyp=sy+Math.sin(ang)*rad*0.8;
      if(pxp<-3||pxp>SW+3) continue;
      g.fillStyle=(pt&1)?"rgba(200,170,255,"+(0.6*(1-life))+")":"rgba(255,150,90,"+(0.6*(1-life))+")"; g.fillRect(pxp|0,pyp|0,1+((ph>>4)&1),1); } }
  g.globalCompositeOperation="source-over";

  var msg=(formP<1)?"SINGULARITY FORMING":(prog<1)?"EVENT HORIZON EXPANDING - "+Math.round(prog*100)+" PCT":cityName+" CONSUMED";
  drawDoomHud(g,ap,now,msg,cityName+" CONSUMED");
}
// ALIEN WAR: two alien fleets battle overhead; Earth is collateral — stray beams & burning wreckage rake the city apart.
// Timeline on the real-time apocMs clock (fleets engage ~3s → crossfire rakes the city ~8s → devastated wasteland).
function drawApocAlienWar(g,ap,L,now){
  var onsetP=Math.min(1,apocMs/WAR_ONSET_MS);
  var battleP=Math.min(1,Math.max(0,apocMs-WAR_ONSET_MS)/(WAR_STAGGER_MS+WAR_HIT_MS));
  var intensity=Math.max(onsetP*0.55,battleP), skyH=HORIZON;

  // ===== LONG AFTERMATH (hours): a STATIC devastated wasteland under a scarred, smoking sky =====
  if(apocMs>WAR_ONSET_MS+WAR_STAGGER_MS+WAR_HIT_MS+1500){
    g.fillStyle="rgba(20,10,20,0.95)"; g.fillRect(0,0,SW,skyH);
    g.globalCompositeOperation="lighter";
    for(var af=0;af<5;af++){ var ax=((af*2654435761)>>>0)%SW; g.fillStyle="rgba(90,40,30,0.10)"; g.fillRect(ax-30,(skyH*0.4)|0,60,(skyH*0.6)|0); }   // smoke palls
    for(var dh2=0;dh2<2;dh2++){ var hx=SW*(0.32+0.36*dh2)+Math.sin(now*0.0003+dh2)*10, hy=skyH*(0.2+0.1*dh2);   // dead alien hulks drifting, a dying ember aboard
      g.globalCompositeOperation="source-over"; g.fillStyle="#0c0710"; g.fillRect((hx-5)|0,hy|0,10,3);
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,50,"+(0.22+0.15*(Math.floor(now/600)&1))+")"; g.fillRect((hx-1)|0,(hy+1)|0,2,1); }
    g.globalCompositeOperation="source-over";
    g.fillStyle="rgba(6,4,8,0.92)"; g.fillRect(0,skyH,SW,SH-skyH);
    drawDoomHud(g,ap,now,"EARTH - CAUGHT IN THE CROSSFIRE","EARTH WAS COLLATERAL");
    return;
  }

  // ===== the WAR-TORN SKY: near-night, strobing with distant weapon-fire =====
  var skyA=Math.min(0.94,0.24+0.66*intensity);
  g.fillStyle="rgba(12,5,20,"+skyA+")"; g.fillRect(0,0,SW,skyH);
  g.globalCompositeOperation="lighter";
  for(var stw=0;stw<Math.round(skyA*34);stw++){ var s3=((stw*2654435761)>>>0); g.fillStyle="rgba(150,160,205,"+(0.3*skyA)+")"; g.fillRect(s3%SW,(s3>>>9)%(skyH|0),1,1); }
  var flash=((Math.floor(now/230)%6)===0)?1:0;                                                  // a capital-ship detonation lights the whole sky
  if(flash){ var ffac=(Math.floor(now/230)&1); g.fillStyle=ffac?"rgba(255,120,80,0.10)":"rgba(120,200,255,0.10)"; g.fillRect(0,0,SW,skyH); }

  // ===== TWO FLEETS trading fire overhead (cyan vs red saucers) =====
  var nShips=Math.round(6+intensity*10), shipX=[], shipY=[];
  for(var sp=0; sp<nShips; sp++){ var sh=((sp*2654435761+17)>>>0), fac=sp&1;
    var sxp=((sh%1000)/1000)*SW+Math.sin(now*0.0004+sp)*20, syp=6+((sh>>>7)%Math.max(1,(skyH*0.40)|0));
    shipX[sp]=sxp; shipY[sp]=syp; var col=fac?"255,90,70":"110,210,255";
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba("+col+",0.35)"; fillEllipse(g,sxp,syp+1,6,2);   // underglow halo
    g.globalCompositeOperation="source-over"; g.fillStyle=fac?"#4a1a1e":"#12333c"; g.fillRect((sxp-4)|0,syp|0,8,2); g.fillRect((sxp-2)|0,(syp-1)|0,4,1);   // saucer hull + dome
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba("+col+",0.95)"; g.fillRect((sxp-1)|0,syp|0,2,1);
    if(((Math.floor(now/130)+sp)%3)===0){ g.fillStyle="rgba("+col+",0.95)"; g.fillRect((sxp-5)|0,(syp+2)|0,10,1); } }   // muzzle flash
  for(var bm=0; bm<Math.round(4+intensity*7); bm++){ var bh2=((bm*2654435761+91)>>>0);
    if(((Math.floor(now/110)+bm)%2)!==0) continue;                                              // flicker
    var a=bh2%nShips, b2=(bh2>>>8)%nShips; if((a&1)===(b2&1)) b2=(b2+1)%nShips;                  // opposing factions
    var ax0=shipX[a], ay0=shipY[a], colB=(a&1)?"255,120,90":"150,225,255";
    for(var tt=0;tt<=10;tt++){ var tf=tt/10; g.fillStyle="rgba("+colB+",0.8)"; g.fillRect((ax0+(shipX[b2]-ax0)*tf)|0,(ay0+(shipY[b2]-ay0)*tf)|0,2,2); } }   // thick bright beam
  for(var ex=0; ex<3; ex++){ if(((Math.floor(now/260)+ex)%3)!==0) continue;                      // hit ships flare & detonate
    var es=((ex*2654435761+Math.floor(now/1100))>>>0)%nShips; g.fillStyle="rgba(255,210,140,0.9)"; fillEllipse(g,shipX[es],shipY[es],5,4);
    g.fillStyle="rgba(255,140,60,0.6)"; fillEllipse(g,shipX[es],shipY[es],8,6); }
  g.globalCompositeOperation="source-over";

  // ===== CROSSFIRE raining on the CITY — stray beams lancing down + falling burning wreckage =====
  if(apocStruck()){
    // dropship waves descend beneath the capital-ship battle; their fire is AIMED — a
    // telegraphing dot skims the street, then the beam CRACKS down (always a near-miss)
    drawInvasionFleet(g,now,713,3,1,Math.round(HORIZON*0.55));
    drawScorches(g,now,714);
    for(var ab=0;ab<Math.min(3,1+Math.round(battleP*2));ab++){
      var ms=((ab*2654435761+Math.floor(now/950))>>>0)%nShips;
      drawAimedBeam(g,now,714+ab*37,shipX[ms],shipY[ms],(ab&1)?"255,110,80":"140,220,255");
    }
    g.globalCompositeOperation="lighter";
    for(var wr=0; wr<Math.round(2+battleP*9); wr++){ var wh=((wr*2654435761+7)>>>0), wph=((now*0.04+wr*53+wh)%100)/100;
      var wx0=((wh%WW)-WOFF); if(wx0<-4||wx0>SW+4) continue;
      g.fillStyle="rgba(255,"+(120+(wh%80))+",40,"+(0.75*(1-wph))+")"; g.fillRect((wx0+wph*24)|0,(wph*HORIZON)|0,2,2);
      g.fillStyle="rgba(120,60,30,"+(0.4*(1-wph))+")"; g.fillRect((wx0+wph*24-2)|0,(wph*HORIZON-1)|0,2,1); }   // burning wreckage + smoke trail arcing down
    g.globalCompositeOperation="source-over"; }

  var msg=(apocMs<WAR_ONSET_MS)?"ALIEN FLEETS ENGAGE - CROSSFIRE IMMINENT":(battleP<1)?"EARTH CAUGHT IN THE CROSSFIRE - "+Math.round(battleP*100)+" PCT":"EARTH IS COLLATERAL";
  drawDoomHud(g,ap,now,msg,"EARTH WAS COLLATERAL");
}
// DEEP FREEZE / ICE AGE: temperature craters, a blizzard whites out the sky, the city frosts over & is buried in snow.
function drawApocFrost(g,ap,L,now){
  var onsetP=Math.min(1,apocMs/FROST_ONSET_MS);
  var freezeP=Math.min(1,Math.max(0,apocMs-FROST_ONSET_MS)/(FROST_STAGGER_MS+FROST_FREEZE_MS));
  var intensity=Math.max(onsetP*0.5,freezeP), skyH=HORIZON;

  // ===== LONG AFTERMATH (hours): a STATIC frozen-white wasteland under a pale sky + aurora =====
  if(apocMs>FROST_ONSET_MS+FROST_STAGGER_MS+FROST_FREEZE_MS+1500){
    g.fillStyle="rgba(214,228,246,0.93)"; g.fillRect(0,0,SW,skyH);
    g.globalCompositeOperation="lighter";
    for(var au=0;au<SW;au+=6){ g.fillStyle="rgba(120,220,200,0.05)"; g.fillRect(au,(skyH*0.18)|0,3,(skyH*0.32)|0); }   // faint aurora
    g.globalCompositeOperation="source-over";
    g.fillStyle="rgba(238,246,255,0.96)"; g.fillRect(0,skyH-4,SW,SH-skyH+4);                                          // snow-buried ground
    for(var sf=0;sf<40;sf++){ var sh=((sf*2654435761)>>>0); g.fillStyle="rgba(255,255,255,0.5)"; g.fillRect(sh%SW,((sh>>>9)+Math.floor(now*0.02))%skyH,1,1); }   // drifting flakes
    drawDoomHud(g,ap,now,cityName+" FROZEN OVER","A NEW ICE AGE");
    return;
  }

  // ===== the cold deepens → overcast → whiteout blizzard =====
  g.fillStyle="rgba(150,180,220,"+(0.16+0.7*intensity)+")"; g.fillRect(0,0,SW,skyH);
  g.globalCompositeOperation="lighter";
  for(var au2=0;au2<SW;au2+=5){ var awv=Math.sin(au2*0.02+now*0.0008); g.fillStyle="rgba(120,230,200,"+(0.06*intensity)+")"; g.fillRect(au2,(skyH*0.14+awv*10)|0,3,(skyH*0.34)|0); }   // aurora as it plunges
  g.globalCompositeOperation="source-over";
  var nsnow=Math.round(40+intensity*170);                                                                            // BLIZZARD (density grows)
  for(var sn=0;sn<nsnow;sn++){ var snh=((sn*2654435761+3)>>>0);
    var sxp=((snh%SW)+now*0.05+intensity*30)%SW, syp=((snh>>>9)%skyH + now*0.12)%skyH;
    g.fillStyle="rgba(240,248,255,"+(0.4+0.5*((snh>>4)&1))+")"; g.fillRect(sxp|0,syp|0,1,1+((snh>>3)&1)); }
  if(freezeP>0.5){ g.fillStyle="rgba(232,242,255,"+((freezeP-0.5)*1.2)+")"; g.fillRect(0,0,SW,SH); }                  // whiteout at full freeze
  g.fillStyle="rgba(220,234,250,"+(0.2+0.4*intensity)+")"; g.fillRect(0,skyH-16,SW,16);                              // ice fog on the ground

  var msg=(apocMs<FROST_ONSET_MS)?"TEMPERATURE PLUMMETING":(freezeP<1)?"THE BIG FREEZE - "+Math.round(freezeP*100)+" PCT":"FROZEN SOLID";
  drawDoomHud(g,ap,now,msg,"A NEW ICE AGE");
}
// KAIJU: a colossal monster towers over the city, atomic breath raking the skyline, destruction radiating out.
function drawApocKaiju(g,ap,L,now){
  var arriveP=Math.min(1,apocMs/KAIJU_ARRIVE_MS);
  var frontR=kaijuFrontR(), prog=Math.min(1,frontR/(WW*0.5));
  var epiX=apocEpiX(now), sx=epiX-WOFF, gy=HORIZON;
  if(sx>SW+900&&sx-WW>-900)sx-=WW; if(sx<-900&&sx+WW<SW+900)sx+=WW;

  // ===== LONG AFTERMATH (hours): a STATIC flattened city under a dust-choked sky, the beast departing =====
  if(apocMs>KAIJU_ARRIVE_MS+KAIJU_WIPE_MS+1500){
    g.fillStyle="rgba(58,44,42,0.55)"; g.fillRect(0,0,SW,gy);
    g.globalCompositeOperation="lighter"; for(var sm=0;sm<6;sm++){ var smx=((sm*2654435761)>>>0)%SW; g.fillStyle="rgba(90,70,60,0.10)"; g.fillRect(smx-20,(gy*0.3)|0,40,(gy*0.7)|0); } g.globalCompositeOperation="source-over";
    var dmx=sx+130, H2=Math.round(gy*0.2);                                                                          // the monster small, on the horizon, moving on
    g.fillStyle="#141a14"; g.fillRect((dmx-4)|0,gy-H2,8,H2); g.fillRect((dmx-2)|0,gy-H2-3,6,4);
    g.fillStyle="rgba(6,4,5,0.88)"; g.fillRect(0,gy,SW,SH-gy);
    drawDoomHud(g,ap,now,cityName+" IN RUINS","THE MONSTER MOVES ON");
    return;
  }

  g.fillStyle="rgba(70,50,44,"+(0.12+0.42*prog)+")"; g.fillRect(0,0,SW,gy);                                          // dust-choked sky
  g.globalCompositeOperation="lighter";                                                                             // dust boiling along the flattened swath
  for(var dc2=0;dc2<14;dc2++){ var dhx=((dc2*2654435761)>>>0), dsx=sx+((dhx%1000)/1000*2-1)*frontR;
    if(dsx<-20||dsx>SW+20) continue; var dph=((now*0.02+dc2*70)%100)/100;
    g.fillStyle="rgba(150,120,100,"+(0.16*(1-dph))+")"; g.fillRect((dsx-4)|0,(gy-6-dph*30)|0,8,6); }
  g.globalCompositeOperation="source-over";

  // ===== THE BEAST — a towering silhouette straddling the epicentre, thrashing =====
  var H=Math.round(gy*(0.30+0.24*arriveP)), top=gy-H, W=Math.round(H*0.30);
  var sway=Math.round(Math.sin(now*0.003)*3), X0=(sx-W/2+sway)|0, breathDir=(Math.floor(now/1100)&1)?1:-1;
  var cxB=X0+(W>>1);
  g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,70,170,0.09)"; fillEllipse(g,cxB,top+H*0.5,W*0.9,H*0.6); g.globalCompositeOperation="source-over";   // soft backlight so the beast reads against the sky
  var neckY=top+Math.round(H*0.22), hipY=gy-Math.round(H*0.32);
  g.fillStyle="#1b2a1c";
  // hunched torso — narrow shoulders tapering to a broad hip (draw as stacked rows)
  for(var by2=neckY; by2<hipY; by2++){ var tf2=(by2-neckY)/Math.max(1,hipY-neckY), tw=Math.round(W*(0.5+0.5*tf2)); g.fillRect(cxB-(tw>>1),by2,tw,1); }
  g.fillRect(cxB-2,top+Math.round(H*0.1),4,Math.round(H*0.14));                                // neck
  var hd=Math.round(W*0.62), hy=top+Math.round(H*0.06);                                        // head juts forward the way it breathes
  g.fillRect((breathDir<0?cxB-2-hd:cxB-2)|0,hy,hd,Math.round(H*0.11)); g.fillRect((breathDir<0?cxB-2-hd:cxB+hd-4)|0,hy+1,3,Math.round(H*0.07));   // + snout
  var legW=Math.round(W*0.26);
  g.fillRect(cxB-Math.round(W*0.36),hipY,legW,gy-hipY); g.fillRect(cxB+Math.round(W*0.36)-legW,hipY,legW,gy-hipY);   // two straddling legs
  g.fillRect((breathDir<0?cxB-Math.round(W*0.5)-2:cxB+Math.round(W*0.5)-1)|0,neckY+3,3,Math.round(H*0.24));          // the forward arm/claw
  for(var tl=0;tl<Math.round(H*0.5);tl++){ var txp=cxB+(breathDir<0?Math.round(W*0.4)+tl:-Math.round(W*0.4)-tl), typ=hipY+2+Math.round(Math.sin(tl*0.28)*4)+Math.round(tl*0.25); g.fillStyle="#142115"; g.fillRect(txp|0,Math.min(gy-1,typ)|0,2,3); }   // a long sweeping tail
  g.globalCompositeOperation="lighter";
  for(var sp=0;sp<hipY-neckY;sp+=3){ var fw=1+((sp/3)&1); g.fillStyle="rgba(150,235,255,0.85)"; g.fillRect((cxB-(fw>>1))|0,(neckY+sp)|0,fw,2); }   // glowing dorsal fins down the spine
  g.fillStyle="rgba(90,225,255,0.55)"; g.fillRect(cxB-Math.round(W*0.5),top,1,H); g.fillStyle="rgba(255,90,200,0.55)"; g.fillRect(cxB+Math.round(W*0.5),top,1,H);   // rim light
  g.fillStyle="rgba(255,70,50,1)"; g.fillRect((breathDir<0?cxB-hd+1:cxB+hd-4)|0,(hy+1)|0,2,2);   // baleful eye on the head
  if((Math.floor(now/280))%2===0){ var by=hy+1, mouth=(breathDir<0?cxB-hd:cxB+hd), blen=Math.round(SW*0.5);   // ATOMIC BREATH — a bright cyan beam raking the skyline from the mouth
    for(var br=0;br<blen;br++){ var bxp=mouth+(breathDir<0?-1-br:1+br); if(bxp<-2||bxp>SW+2) continue;
      g.fillStyle="rgba("+Math.round(180-br*0.22)+",245,255,"+(0.9*(1-br/blen))+")"; g.fillRect(bxp|0,by|0,2,4); }
    g.fillStyle="rgba(220,255,255,0.8)"; g.fillRect((mouth+(breathDir<0?-blen:blen))|0,by-2,4,8); }   // white-hot beam tip
  g.globalCompositeOperation="source-over";
  g.fillStyle="rgba(120,100,86,0.4)"; g.fillRect(cxB-W,gy-3,W*2,3);                             // stomp dust at its feet

  var msg=(apocMs<KAIJU_ARRIVE_MS)?"IT RISES FROM THE DEEP":(prog<1)?"KAIJU RAMPAGE - "+Math.round(prog*100)+" PCT":cityName+" IN RUINS";
  drawDoomHud(g,ap,now,msg,"THE MONSTER MOVES ON");
}
// THE FLOOD: the sea rises and drowns the city. Draws the rising body of water (overlay) that swallows the skyline.
function drawApocFlood(g,ap,L,now){
  var w=floodLevel(), gy=HORIZON, waterY=gy-w;
  var riseP=Math.min(1,Math.max(0,apocMs-FLOOD_ONSET_MS)/FLOOD_RISE_MS);
  g.fillStyle="rgba(40,52,66,"+(0.1+0.34*riseP)+")"; g.fillRect(0,0,SW,gy);                     // storm-dark deluge sky
  if(riseP<1){ for(var rn=0;rn<90;rn++){ var rnh=((rn*2654435761+1)>>>0); g.fillStyle="rgba(180,200,220,0.28)"; g.fillRect(rnh%SW,(((rnh>>>9)+now*0.4)%gy)|0,1,3); } }   // driving rain

  if(w>0){
    for(var yy=waterY; yy<SH; yy+=3){ var dep=(yy-waterY)/Math.max(1,SH-waterY);               // the rising body of water (darker deep)
      g.fillStyle="rgba("+Math.round(26+18*(1-dep))+","+Math.round(58+40*(1-dep))+","+Math.round(88+50*(1-dep))+","+(0.74+0.2*dep)+")"; g.fillRect(0,yy|0,SW,3); }
    g.globalCompositeOperation="lighter";                                                       // wave shimmer on the surface
    for(var wv=0;wv<SW;wv+=2){ var wh=Math.sin(wv*0.15+now*0.006)*1.2+Math.sin(wv*0.05-now*0.004); g.fillStyle="rgba(160,210,240,0.35)"; g.fillRect(wv,(waterY+wh)|0,2,1); }
    g.globalCompositeOperation="source-over";
    for(var db=0;db<Math.round(6+riseP*16);db++){ var dbh=((db*2654435761+5)>>>0), dbx=((dbh%SW)+now*0.01*((dbh&1)?1:-1)+SW*2)%SW;   // floating debris
      g.fillStyle=(db&1)?"#3a2f2a":"#2f3a42"; g.fillRect(dbx|0,(waterY+Math.sin(dbx*0.1+now*0.005)*1.4)|0,3+((dbh>>3)%3),2); }
  }
  var msg=(w<HORIZON*0.28)?"THE WATERS ARE RISING":(riseP<1)?"THE FLOOD - "+Math.round(riseP*100)+" PCT":cityName+" IS UNDER WATER";
  drawDoomHud(g,ap,now,msg,cityName+" DROWNED");
}
// a single building dying in the cataclysm: shaking, cracking, burning, collapsing to rubble
function drawApocBuilding(g,b,bx,cl,L,now,bdir){
  var gy=HORIZON, keep=Math.max(3,Math.round(b.h*(1-cl*0.92)));
  var top=gy-keep, wob=(cl<0.7)?((Math.floor(now/90)+bx)&1):0;
  if(curDeath==="ai"){                                          // ASSIMILATED into an AI factory, then strip-mined to a dead husk (its material harvested skyward as the planet's resources are drained)
    var Ha=b.h, Wa=b.w;
    var keepA=Math.max(2,Math.round(Ha*(1-cl*0.86)));           // dismantled from the top down as it's harvested
    var topA=gy-keepA, glow=Math.max(0,1-cl*1.15);              // machine glow — bright when converted, dies as resources deplete
    if(cl<0.16){ var af=1-cl/0.16;                              // the assimilation flash: a red scan-bloom as the front converts it
      g.fillStyle="#141018"; g.fillRect(bx,gy-Ha,Wa,Ha);
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,40,70,"+(0.6*af)+")"; g.fillRect(bx,gy-Ha,Wa,Ha); g.globalCompositeOperation="source-over"; }
    g.fillStyle="#100a12"; g.fillRect(bx+wob,topA,Wa,keepA);    // the machine-factory hulk (dark body)
    for(var wy=topA+2; wy<gy-2; wy+=4) for(var wx2=bx+1;wx2<bx+Wa-1;wx2+=4)   // red-eye windows
      if(((wx2*7+wy*13)&3)===0){ g.fillStyle="rgba(255,40,70,"+(0.35+0.6*glow)+")"; g.fillRect(wx2,wy,2,2); }
    g.globalCompositeOperation="lighter";
    for(var cxa=bx+2; cxa<bx+Wa-1; cxa+=5){ g.fillStyle="rgba(255,60,90,"+(0.5*glow)+")"; g.fillRect(cxa,topA,1,keepA); }   // glowing circuit conduits
    g.fillStyle="rgba(255,40,70,"+(0.7*glow)+")"; g.fillRect(bx,topA,Wa,1);   // hot converted top edge
    g.globalCompositeOperation="source-over";
    if(Wa>=10 && keepA>10){ var stx=bx+Wa-4;                    // a smokestack belching on the taller factories
      g.fillStyle="#0c0810"; g.fillRect(stx,topA-4,3,5);
      for(var sk=0;sk<3;sk++){ var skp=((now*0.03+sk*140+b.seed)%120)/120;
        g.fillStyle="rgba(120,30,40,"+(0.5*(1-skp)*(0.4+glow))+")"; g.fillRect((stx-1+Math.sin(now*0.004+sk)*2)|0,(topA-5-skp*16)|0,3,3); } }
    if(cl>0.12 && cl<0.98){ g.globalCompositeOperation="lighter";   // HARVEST: data-voxels lifted off the dismantled top, drifting up to the core
      var nv=2+(Wa>>2);
      for(var vv=0;vv<nv;vv++){ var vh=((b.seed*97+vv*2654435761)>>>0), vph=((now*0.05+vv*53+vh)%100)/100;
        var vx=bx+(vh%Math.max(1,Wa)), vy=topA-2-vph*(20+Ha*0.4), va=(1-vph)*(0.5+0.4*glow);
        g.fillStyle=(vv&1)?"rgba(255,70,100,"+va+")":"rgba(120,200,255,"+va+")"; g.fillRect(vx|0,vy|0,2,2); }
      g.globalCompositeOperation="source-over"; }
    g.fillStyle="rgba(30,20,28,"+(0.4+0.4*cl)+")"; g.fillRect(bx-1,gy-3,Wa+2,3);   // stripped foundation
    if(cl>=0.9){ g.fillStyle="#0a0710"; for(var mb=0;mb<Wa;mb+=3){ var mh=1+((mb*7+b.seed)%3); g.fillRect(bx+mb,gy-mh,2,mh);   // dead machine rubble
      if(((mb+Math.floor(now/300))%9)===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,40,70,0.4)"; g.fillRect(bx+mb,gy-mh,1,1); g.globalCompositeOperation="source-over"; } } }
    return;
  }
  if(curDeath==="nuke"||curDeath==="meteors"){                  // BLOWN APART — a flash, then the mass shears into slabs & shrapnel hurled outward
    var H=b.h, W=b.w; bdir=bdir||1;
    var fire=(curDeath==="meteors");                            // meteors: a molten-orange impact fireball & the wreck keeps BURNING (vs the nuke's white thermal flash)
    // 0 .. 0.12  the strike — the whole building is engulfed (white-hot for the nuke, molten-orange for a meteor), then flashes to char
    if(cl<0.12){ var vf=1-cl/0.12;
      g.fillStyle=fire?"#2a1712":"#241a1e"; g.fillRect(bx,gy-H,W,H);                    // instantly scorched
      g.globalCompositeOperation="lighter";
      if(fire){ g.fillStyle="rgba(255,178,68,"+(0.92*vf)+")"; g.fillRect(bx-1,gy-H-1,W+2,H+2);   // molten fireball engulfs it
                g.fillStyle="rgba(255,88,24,"+(0.72*vf)+")";  g.fillRect(bx,gy-H,W,H); }
      else    { g.fillStyle="rgba(255,250,226,"+(0.95*vf)+")"; g.fillRect(bx-1,gy-H-1,W+2,H+2);  // thermal bloom engulfs it
                g.fillStyle="rgba(255,172,74,"+(0.7*vf)+")";  g.fillRect(bx,gy-H,W,H); }
      g.globalCompositeOperation="source-over"; return; }
    // 0.12 .. 1  the OVERPRESSURE RIPS the building apart — it shears into SLABS that are hurled downwind,
    // TOP-FIRST (the blast peels it from the top down); each slab rips into tumbling sub-chunks as it flies.
    var p=(cl-0.12)/0.88;
    var N=Math.max(3,Math.min(11,(H/5)|0)), slabH=H/N;
    for(var sl=0; sl<N; sl++){
      var topness=(N>1)?sl/(N-1):1;                                                     // 0 = base slab, 1 = top slab
      var relP=(1-topness)*0.5;                                                         // top tears off at p=0, base by p=0.5
      var lp=(p-relP)/Math.max(0.001,1-relP); if(lp<0) lp=0; if(lp>1) lp=1;
      var origY=gy-(sl+1)*slabH;
      if(lp<=0){                                                                        // not torn yet — the charred stump still stands
        g.fillStyle=(sl===N-1)?"#0e0b12":"#17131c"; g.fillRect(bx,origY|0,W,Math.ceil(slabH)+1);
        if(p>0.05){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,110,40,"+(0.35*(1-p))+")"; g.fillRect(bx,origY|0,W,1); g.globalCompositeOperation="source-over"; }  // fire licking the shear line
        continue; }
      var v=0.85+topness*1.8;                                                           // upper slabs are thrown faster & farther
      var riseH=(0.5+topness)*slabH*2.2;                                                // how high it lofts (top slabs higher)
      var dropH=(sl+1)*slabH+riseH+4;                                                    // fall term tuned so it ALWAYS returns to ground by lp=1
      var dxo=bdir*v*lp*W*1.5, dyo=-riseH*lp + dropH*lp*lp;                              // hurled up & out on a real arc, then it comes back down
      var sxp=bx+dxo, syp=origY+dyo;
      if(syp>gy+2 || sxp<-12 || sxp>SW+12) continue;                                     // landed / flown off screen — gone, never frozen mid-air
      var nc=2+(W>14?1:0), cw=W/nc;                                                      // the slab breaks into sub-chunks that fan apart
      for(var ck=0; ck<nc; ck++){
        var cxp=sxp + ck*cw + bdir*lp*(ck*4+topness*7), cyp=syp + lp*slabH*ck*0.6;       // fan out downwind + tumble
        g.fillStyle=((sl+ck)&1)?"#1a1620":"#231b29"; g.fillRect(cxp|0,cyp|0,Math.ceil(cw),Math.ceil(slabH));
        if(lp<0.5){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,132,50,"+(0.55*(1-lp*2))+")"; g.fillRect(cxp|0,cyp|0,Math.ceil(cw),1); g.globalCompositeOperation="source-over"; }  // white-hot fracture face
      }
    }
    // SHRAPNEL — a spray of small chunks & embers blasted off the structure
    var nfr=6+(W>>1);
    for(var d=0; d<nfr; d++){ var dh=((b.seed*131+d*374761393)>>>0);
      var fvx=(0.7+((dh)%100)/100*2.1)*bdir, fvy=(0.9+((dh>>>7)%100)/100*1.6);
      var fsy=gy-2-((dh>>>3)%Math.max(1,H)), friseH=fvy*H*0.55, fdropH=(fsy-gy)*-1+friseH+H*1.4+4;   // fall tuned so EVERY ember returns to ground by p=1
      var fxp=bx+(dh%Math.max(1,W))+fvx*p*W*1.6, fyp=fsy-friseH*p + fdropH*p*p;                       // ballistic arc, no frozen sky bricks
      if(fyp>gy||fxp<-4||fxp>SW+4) continue;
      var sz=1+((dh>>>5)%2);
      g.fillStyle=(d&3)?"#171320":"#231b29"; g.fillRect(fxp|0,fyp|0,sz,sz);
      if((dh&7)===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,150,55,"+(0.7*(1-p))+")"; g.fillRect(fxp|0,fyp|0,1,1); g.globalCompositeOperation="source-over"; }
    }
    // dust boiling up + a low rubble mound at the torn-out base
    g.fillStyle="rgba(74,68,62,"+(0.32+0.35*p)+")";
    for(var du=0; du<3; du++){ var dph=((now*0.03+du*160+b.seed)%150)/150, dux=bx+(W>>1)+bdir*dph*W;
      g.fillStyle="rgba(80,74,68,"+(0.42*(1-dph))+")"; g.fillRect((dux)|0,(gy-4-dph*H*0.8)|0,3,3); }
    g.fillStyle="rgba(72,66,62,"+(0.3+0.4*p)+")"; g.fillRect(bx-2,gy-3,W+4,3);
    if(p>0.4){ g.fillStyle="#151119"; for(var rbn=0;rbn<W+3;rbn+=2){ var rhn=1+((rbn*7+b.seed)%3); g.fillRect(bx+bdir*2+rbn,gy-rhn,2,rhn); } }   // rubble spilled downwind
    if(fire && p>0.25){ g.globalCompositeOperation="lighter";                          // the meteor-struck wreck BURNS — flames licking up off the rubble
      for(var fla=0; fla<Math.max(2,W>>2); fla++){ var fsd=((b.seed*61+fla*2654435761)>>>0);
        var flx=bx+2+(fsd%Math.max(1,W-3)), flph=((now*0.02+fla*33+fsd)%100)/100, flh=2+((fsd>>7)%4);
        g.fillStyle="rgba(255,"+(88+((fsd>>3)%80))+",28,"+(0.55*(1-flph))+")"; g.fillRect(flx|0,(gy-1-flh-flph*6)|0,1,flh); }
      g.globalCompositeOperation="source-over"; }
    return;
  }
  if(curDeath==="sunburst"){                                    // BAKED: the sun's heat chars it black, engulfs it in flame, and it collapses straight down into glowing ash
    var Hs=b.h, Ws=b.w, keepS=Math.max(2,Math.round(Hs*(1-cl*0.9))), topS=gy-keepS;
    g.fillStyle=(cl<0.4)?"#2a1a14":"#160f0c"; g.fillRect(bx,topS,Ws,keepS);            // charring, blacker as it burns
    for(var nxs=bx;nxs<bx+Ws;nxs+=2){ var nhs=1+((nxs*13+b.seed)%4); g.fillStyle="#0f0a08"; g.fillRect(nxs,(topS-nhs)|0,2,nhs); }   // ragged burnt crown
    g.globalCompositeOperation="lighter";
    var eng=Math.max(0,1-cl*1.3);                                                      // whole-body incandescence — peaks as it ignites, fades to embers
    if(eng>0){ g.fillStyle="rgba(255,150,50,"+(0.5*eng)+")"; g.fillRect(bx,topS,Ws,keepS);
               g.fillStyle="rgba(255,90,26,"+(0.4*eng)+")"; g.fillRect(bx,topS,Ws,keepS); }
    for(var fxs=bx-1; fxs<bx+Ws+1; fxs+=2){ if(((fxs+Math.floor(now/60))%3)!==2){       // flames roaring off it
      var fhs=(4+((fxs*7+Math.floor(now/50))%8))*(0.5+0.5*(1-cl));
      g.fillStyle=["#ff3410","#ff7a1a","#ffcf3a"][((fxs>>1)+Math.floor(now/70))%3]; g.fillRect(fxs,(topS-fhs)|0,2,fhs|0); } }
    for(var em=0; em<Math.max(3,Ws>>2); em++){ var eh=((b.seed*53+em*2654435761)>>>0), eph=((now*0.02+em*37+eh)%100)/100;   // embers rising
      g.fillStyle="rgba(255,"+(120+(eh%100))+",40,"+(0.7*(1-eph))+")"; g.fillRect((bx+(eh%Math.max(1,Ws)))|0,(topS-eph*22)|0,1,1); }
    g.globalCompositeOperation="source-over";
    for(var sms=0;sms<3;sms++){ var smts=((now*0.03+sms*150+b.seed)%120);               // smoke columns
      g.fillStyle="rgba(44,36,34,"+(0.5*(1-smts/120))+")"; g.fillRect((bx+(Ws>>1)-2+Math.sin(now*0.002+sms)*3)|0,(topS-6-smts*0.5)|0,3,3); }
    g.fillStyle="rgba(50,30,24,"+(0.3+0.4*cl)+")"; g.fillRect(bx-2,gy-3,Ws+4,3);        // ash spreading at the base
    if(cl>=0.85){ for(var as=0;as<Ws;as+=2){ var ah=1+((as*7+b.seed)%3);                // …down to a glowing-ember ash pile
      g.fillStyle=((as+b.seed)&3)?"#1a1210":"#241612"; g.fillRect(bx+as,gy-ah,2,ah);
      if(((as+Math.floor(now/220))&7)===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,90,30,0.6)"; g.fillRect(bx+as,gy-ah,1,1); g.globalCompositeOperation="source-over"; } } }
    return;
  }
  if(curDeath==="bh"){                                          // SUCKED IN — torn from its base and streamed toward the singularity, stretched (spaghettified) & shrinking to nothing
    var Hb=b.h, Wb=b.w, bp=bhPos(now), hx=bp.sx, hy=bp.sy, oxc=bx+Wb*0.5;
    var Nb=Math.max(3,Math.min(9,(Hb/6)|0)), slabHb=Hb/Nb;
    for(var slb=0; slb<Nb; slb++){
      var topn=(Nb>1)?slb/(Nb-1):0;                             // top chunks are nearer the hole → torn away first
      var lpb=(cl-(1-topn)*0.16)/0.84; if(lpb<0)lpb=0; if(lpb>1)lpb=1;
      if(lpb>=0.99) continue;                                   // reached the singularity — gone
      var ez=Math.pow(lpb,1.45);                                // accelerating fall inward
      var oyc=gy-(slb+0.5)*slabHb;
      var cxp=oxc+(hx-oxc)*ez, cyp=oyc+(hy-oyc)*ez;             // streamed toward the hole
      var dxh=hx-cxp, dyh=hy-cyp, dl=Math.sqrt(dxh*dxh+dyh*dyh)||1;
      g.globalCompositeOperation="lighter";                     // spaghettified streak trailing toward the hole (heated infalling matter)
      var stlen=lpb*Math.min(70,dl);
      for(var ss=1; ss<=6; ss++){ var sf=ss/6; g.fillStyle="rgba(170,140,240,"+(0.4*lpb*(1-sf))+")"; g.fillRect((cxp+dxh/dl*stlen*sf)|0,(cyp+dyh/dl*stlen*sf)|0,1,1); }
      g.globalCompositeOperation="source-over";
      var sh=Math.max(1,slabHb*(1-lpb*0.75)), sw=Math.max(1,Wb*(1-lpb*0.7));   // the chunk, shrinking as it falls in
      g.fillStyle=(slb&1)?"#171320":"#221a2c"; g.fillRect((cxp-sw/2)|0,(cyp-sh/2)|0,Math.ceil(sw),Math.ceil(sh));
    }
    if(cl<0.5){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,90,190,"+(0.32*(1-cl*2))+")"; g.fillRect(bx,gy-2,Wb,2); g.globalCompositeOperation="source-over"; }   // the foundation glowing as it's ripped up
    return;
  }
  if(curDeath==="alienwar"){                                    // BEAM-STRUCK — a stray energy beam vaporizes it, then it burns as wreckage in the crossfire
    var Hw=b.h, Ww=b.w, fc=(b.seed&1), beamR=fc?"120,220,255":"255,120,60";   // which faction's fire hit it (cyan vs red-orange)
    var keepW=Math.max(2,Math.round(Hw*(1-cl*0.9))), topW=gy-keepW;
    if(cl<0.18){ var wf=1-cl/0.18;                              // the BEAM strike: a bright energy column lances down through it, everything flashes
      g.fillStyle="#0e0a10"; g.fillRect(bx,gy-Hw,Ww,Hw);
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba("+beamR+","+(0.9*wf)+")"; g.fillRect((bx+Ww/2-1)|0,0,3,gy-1);              // the beam from the sky
      g.fillStyle="rgba("+beamR+","+(0.7*wf)+")"; g.fillRect(bx-1,gy-Hw-1,Ww+2,Hw+2);              // the building engulfed
      g.fillStyle="rgba(255,255,255,"+(0.7*wf)+")"; g.fillRect((bx+Ww/2-2)|0,(gy-Hw)|0,4,Hw);      // white-hot core
      g.globalCompositeOperation="source-over"; return; }
    var pw=(cl-0.18)/0.82;                                      // then it bursts into BURNING WRECKAGE
    g.fillStyle="#120c14"; g.fillRect(bx+wob,topW,Ww,keepW);
    for(var nxw=bx;nxw<bx+Ww;nxw+=2){ var nhw=1+((nxw*13+b.seed)%4); g.fillStyle="#0b070d"; g.fillRect(nxw+wob,(topW-nhw)|0,2,nhw); }   // jagged torn crown
    var nch=4+(Ww>>2);
    for(var dc=0; dc<nch; dc++){ var dhw=((b.seed*151+dc*2654435761)>>>0);                          // blasted debris (ballistic, always lands)
      var dvx=((dhw%100)/100-0.5)*2.4, dvy=0.8+((dhw>>7)%100)/100*1.4, dsy=gy-2-((dhw>>3)%Math.max(1,Hw));
      var driseH=dvy*Hw*0.5, ddropH=(dsy-gy)*-1+driseH+Hw*1.3+4;
      var dxp=bx+(dhw%Math.max(1,Ww))+dvx*pw*Ww*1.3, dyp=dsy-driseH*pw+ddropH*pw*pw;
      if(dyp>gy||dxp<-4||dxp>SW+4) continue;
      g.fillStyle=(dc&1)?"#171320":"#231b29"; g.fillRect(dxp|0,dyp|0,2,2);
      if((dhw&3)===0){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba("+beamR+",0.6)"; g.fillRect(dxp|0,dyp|0,1,1); g.globalCompositeOperation="source-over"; } }
    g.globalCompositeOperation="lighter";                       // coloured energy-fire off the wreckage
    for(var fw=bx; fw<bx+Ww; fw+=2){ if(((fw+Math.floor(now/70))%3)!==2){ var fhw=3+((fw*7+Math.floor(now/60))%6);
      g.fillStyle=fc?"rgba(120,220,255,0.7)":"rgba(255,130,60,0.7)"; g.fillRect(fw,(topW-fhw)|0,2,fhw); } }
    g.globalCompositeOperation="source-over";
    for(var smw=0;smw<3;smw++){ var smtw=((now*0.03+smw*150+b.seed)%120);                           // smoke
      g.fillStyle="rgba(46,40,44,"+(0.5*(1-smtw/120))+")"; g.fillRect((bx+(Ww>>1)-2+Math.sin(now*0.002+smw)*3)|0,(topW-6-smtw*0.5)|0,3,3); }
    g.fillStyle="rgba(50,44,50,"+(0.3+0.3*cl)+")"; g.fillRect(bx-2,gy-3,Ww+4,3);
    if(cl>=0.9){ g.fillStyle="#100b12"; for(var rw=0;rw<Ww;rw+=2){ var rhw=1+((rw*7+b.seed)%3); g.fillRect(bx+rw,gy-rhw,2,rhw); } }   // smouldering wreckage rubble
    return;
  }
  if(curDeath==="frost"){                                       // FROZEN — frost creeps over it, ice glazes it, snow buries it from the base
    var Hf=b.h, Wf=b.w, topF=gy-Hf;
    g.fillStyle="#223247"; g.fillRect(bx,topF,Wf,Hf);           // the building goes frozen-dark
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(150,200,245,"+(0.25+0.45*cl)+")"; g.fillRect(bx,topF,Wf,Hf); g.globalCompositeOperation="source-over";   // ice glaze
    var frostH=Math.round(Hf*Math.min(1,cl*1.5));               // white rime creeping DOWN from the top
    for(var fx3=bx;fx3<bx+Wf;fx3++){ var fhh=frostH-((fx3*7+b.seed)%4); if(fhh>0){ g.fillStyle="rgba(228,242,255,0.9)"; g.fillRect(fx3,topF,1,Math.min(fhh,Hf)); } }
    if(cl>0.4){ for(var ic=bx+1;ic<bx+Wf-1;ic+=3){ var icl=1+((ic*5+b.seed)%3); g.fillStyle="rgba(210,236,255,0.85)"; g.fillRect(ic,(topF+frostH)|0,1,icl); } }   // icicles at the rime edge
    var buryH=Math.round(Hf*0.15+Hf*0.5*cl);                    // a snow drift burying it from the base
    g.fillStyle="rgba(238,247,255,0.96)"; g.fillRect(bx-2,gy-buryH,Wf+4,buryH+1);
    g.fillStyle="rgba(206,226,246,0.7)"; g.fillRect(bx-2,gy-buryH,Wf+4,1);
    return;
  }
  if(curDeath==="kaiju"){                                        // SMASHED — the monster stomps it flat; it buckles & crumbles into rubble
    var Hk=b.h, Wk=b.w;
    if(cl<0.12){ var kf=1-cl/0.12;                              // the stomp — a burst of pulverized concrete dust
      g.fillStyle="#2a2620"; g.fillRect(bx,gy-Hk,Wk,Hk);
      g.globalCompositeOperation="lighter"; g.fillStyle="rgba(214,204,184,"+(0.7*kf)+")"; g.fillRect(bx-2,gy-Hk-2,Wk+4,Hk+2); g.globalCompositeOperation="source-over"; return; }
    var pk=(cl-0.12)/0.88, keepK=Math.max(2,Math.round(Hk*(1-pk*0.9))), topK=gy-keepK, lean=(b.seed&1?1:-1)*pk*Wk*0.4;
    var seg=Math.max(2,(keepK/4)|0);
    for(var s2=0;s2<seg;s2++){ var sy0=topK+(keepK/seg)*s2, tn=1-s2/Math.max(1,seg-1);   // the crumpling body, top buckling to one side
      g.fillStyle=(s2&1)?"#221d22":"#2b242b"; g.fillRect((bx+lean*tn)|0,sy0|0,Wk,Math.ceil(keepK/seg)+1); }
    var nk=4+(Wk>>2);
    for(var dk=0;dk<nk;dk++){ var dhk=((b.seed*167+dk*2654435761)>>>0);                    // chunks flung out
      var kvx=((dhk%100)/100-0.5)*2.6, kvy=0.6+((dhk>>7)%100)/100*1.1, ksy=gy-2-((dhk>>3)%Math.max(1,Hk));
      var kriseH=kvy*Hk*0.4, kdropH=(ksy-gy)*-1+kriseH+Hk*1.2+4;
      var kxp=bx+(dhk%Math.max(1,Wk))+kvx*pk*Wk*1.4, kyp=ksy-kriseH*pk+kdropH*pk*pk;
      if(kyp>gy||kxp<-4||kxp>SW+4) continue;
      g.fillStyle=(dk&1)?"#20242a":"#2c3038"; g.fillRect(kxp|0,kyp|0,2,2); }
    g.globalCompositeOperation="lighter";                                                   // dust boiling up
    for(var kd=0;kd<3;kd++){ var kdp=((now*0.03+kd*130+b.seed)%140)/140; g.fillStyle="rgba(180,172,158,"+(0.38*(1-kdp))+")"; g.fillRect((bx+(Wk>>1)-3+Math.sin(now*0.003+kd)*4)|0,(gy-4-kdp*Hk*0.7)|0,4,3); }
    g.globalCompositeOperation="source-over";
    g.fillStyle="rgba(66,60,56,"+(0.3+0.4*pk)+")"; g.fillRect(bx-2,gy-3,Wk+4,3);
    if(pk>0.5){ g.fillStyle="#1d1a20"; for(var kr=0;kr<Wk;kr+=2){ var krh=1+((kr*7+b.seed)%4); g.fillRect(bx+kr+((b.seed&1)?2:-2),gy-krh,2,krh); } }   // rubble spill
    return;
  }
  if(curDeath==="flood"){                                        // UNDERMINED — the waterlogged building leans, breaks, and slides into the sea
    var Hfl=b.h, Wfl=b.w, lean=(b.seed&1?1:-1)*cl*Hfl*0.5, sink=cl*8;
    var seg2=Math.max(3,(Hfl/4)|0);
    for(var s3=0;s3<seg2;s3++){ var fr3=s3/(seg2-1), sy3=gy-Hfl*fr3+sink, sxo=bx+lean*fr3;   // sheared/leaning slabs (top leans most)
      g.fillStyle=(s3&1)?"#2b3037":"#232830"; g.fillRect(sxo|0,(sy3-Hfl/seg2)|0,Wfl,Math.ceil(Hfl/seg2)+1); }
    g.globalCompositeOperation="lighter"; g.fillStyle="rgba(90,150,190,"+(0.12+0.18*cl)+")"; g.fillRect((bx+lean*0.5)|0,(gy-Hfl+sink)|0,Wfl,Hfl); g.globalCompositeOperation="source-over";   // waterlogged sheen
    if(cl>0.5){ var waterY=gy-floodLevel();                     // debris breaking off and bobbing on the water
      for(var fd=0;fd<3+(Wfl>>3);fd++){ var fdh=((b.seed*97+fd*40503)>>>0), fdx=bx+(fdh%Math.max(1,Wfl))+lean*0.5;
        g.fillStyle=(fd&1)?"#39414a":"#2b3138"; g.fillRect(fdx|0,(waterY-1+Math.sin(now*0.005+fd)*1)|0,3,2); } }
    return;
  }
  g.fillStyle="#1b1620"; g.fillRect(bx+wob,top,b.w,keep);       // the dying husk
  for(var nx=bx; nx<bx+b.w; nx+=2){ var nh=1+((nx*13+b.seed)%4);           // jagged broken crown
    g.fillStyle="#120e18"; g.fillRect(nx+wob,top-nh,2,nh); }
  for(var cr=0;cr<3;cr++){ var cx2=bx+2+((b.seed>>cr)%Math.max(1,b.w-4));  // cracks running down the face
    g.fillStyle="rgba(0,0,0,0.55)"; g.fillRect(cx2,top+2+cr*3,1,Math.max(2,keep>>1)); }
  g.globalCompositeOperation="source-over";                     // fire along the break line — shared licking-flame idiom
  drawFlame(g,bx+(b.w>>1),top+1,Math.min(22,b.w),8,now,(b.seed|0)+7,0.8);
  if(b.w>12) drawFlame(g,bx+(b.w>>2),top+2,Math.min(10,b.w>>1),5,now,(b.seed|0)+41,0.55);
  g.globalCompositeOperation="lighter";
  for(var sm2=0;sm2<3;sm2++){ var smt=((now*0.03+sm2*160+b.seed)%120);                       // smoke columns
    g.fillStyle="rgba(50,46,52,"+(0.5*(1-smt/120))+")";
    g.fillRect((bx+(b.w>>1)-2+Math.sin(now*0.002+sm2)*3)|0,(top-6-smt*0.5)|0,3,3); }
  g.globalCompositeOperation="source-over";
  for(var db=0;db<3;db++){ var dph=((now*0.25+db*333+b.seed)%700)/700;     // debris raining off
    g.fillStyle="rgba(40,34,40,0.8)"; g.fillRect((bx+((b.seed>>db)%b.w))|0,(top+dph*keep)|0,1,2); }
  g.fillStyle="rgba(60,56,60,"+(0.3+0.3*cl)+")"; g.fillRect(bx-2,gy-3,b.w+4,3);   // dust at the base
  if(cl>=1){ g.fillStyle="#17131c"; for(var rb2=0;rb2<b.w;rb2+=2){          // …down to a rubble mound
    var rh3=2+((rb2*7+b.seed)%4); g.fillRect(bx+rb2,gy-rh3,2,rh3); } }
}
// shared doom banner
function drawDoomHud(g,ap,now,early,late){
  var msg=ap<0.55?early:late, col="rgba(255,45,32,";
  var tw=textW(msg), tx=Math.round(WW*0.5-tw/2), ty=notifLane(1), blink=(Math.floor(now/200))%2;   // lane 2 (pref): war / apocalypse alerts
  for(var wp=-1;wp<=1;wp++){ var px=tx-3-WOFF+wp*WW; if(px+tw+6<-2||px>SW+2) continue;
    g.fillStyle="rgba(10,4,4,0.78)"; g.fillRect(px|0,ty-2,tw+6,9);
    g.fillStyle=col+"0.85)"; g.fillRect(px|0,ty-3,tw+6,1); g.fillRect(px|0,ty+6,tw+6,1); }
  drawPixText(g,msg,tx,ty,col+(0.6+0.4*blink)+")",1);
}

function draw(g,pass){
  // pass: undefined = classic single-canvas · "bg" = slow backdrop (sky/stars/mountains/still
  // terrain, ~2fps) · "fg" = everything that moves (12fps, painted over the bg canvas)
  g.setTransform(ZOOM,0,0,ZOOM,0,0);          // world px -> canvas px (identity when ZOOM=1)
  if(!near||!near.blds) return;   // paint loop can fire before setup() has built the world
  resetNotifLanes();              // fresh alert-row bookings each frame (see notifLane) so banners never overprint
  var now=(NOWOVR!=null?NOWOVR:Date.now()), dt=Math.max(0,Math.min(50, now-tPrev));
  if(pass!=="bg") tPrev=now;
  var lifeI=lifeIndexOf(now); if(lifeI!==curLife) buildWorld(lifeI);   // REBIRTH: roll a brand-new city (masked by the ash veil)
  maybeFetchWeather();          // all monitors fetch on the same 10-min wall-clock window → identical weather
  maybeFetchAirq();             // and the same 30-min window for air quality (wildfire smoke)
  var nd=nowDate();
  var ph=dayPhase(nd), fx=wfx(), hol=holidays(nd);
  var L=ph.light, night=1-L;
  // ---- weather mood: how the street reacts (crowd size, umbrellas, bundling, shade) ----
  var temp=(weather.temp==null?60:weather.temp);
  var feels=(weather.feels==null?temp:weather.feels);          // "feels-like" — what actually drives coats & sun-shades
  var wmood={ wet:(fx.rain||fx.drizzle||fx.thunder), snow:fx.snow,
    cold:(feels<34&&!fx.rain&&!fx.drizzle), hot:(feels>86&&L>0.55&&!fx.rain&&!fx.snow&&!fx.drizzle&&!fx.cloudy),
    harsh:(fx.thunder||(fx.snow&&(weather.wind||0)>16)) };
  wmood.pedFactor = wmood.harsh?0.32 : wmood.wet?0.6 : wmood.snow?0.55 : wmood.cold?0.62 : wmood.hot?0.66 : 1;
  wmood.speedK    = wmood.hot?0.68 : (wmood.wet||wmood.snow||wmood.cold)?1.32 : 1;   // hurry in bad weather, dawdle in heat
  // WHERE IN ITS LIFE IS THE CITY? — computed up here so the apoc state (esp. the fast nuke clock) is
  // fresh BEFORE anything downstream reacts to it (traffic suppression, crowds, movers this same frame).
  var cg=cityGrowth(now); cityG=cg.g; cityPhase=cg.phase;
  cityEra=cityEraOf(now);                                    // which architectural age is this life rebuilt in?
  curSpace = cityPhase==="apoc" ? 1 : Math.max(0,Math.min(1,(cg.cy-(0.80-EDUB))/0.13));   // the space age dawns in the city's final days
  cityApoc=(cityPhase==="apoc")?cg.apoc:0;                   // the grand cataclysm progress (0..1)
  apocMs=cityApoc*0.045*GROW_CYCLE;                          // REAL ms since detonation (drives the fast bang/heat-wave/vaporize)
  curDeath=FORCEDEATH||deathOf(lifeI);                       // how this civilization is fated to end
  if(DEMO_APOC_SEC>0){ cityPhase="apoc"; cityG=1; curSpace=1;   // TEST: play the apocalypse live on a short repeating loop
    apocMs=Date.now()%(DEMO_APOC_SEC*1000); cityApoc=Math.min(1,apocMs/(DEMO_APOC_SEC*1000)); curDeath=FORCEDEATH||"nuke"; }
  blastMs = (curDeath==="nuke") ? Math.max(0, apocMs-NUKE_FALL_MS) : apocMs;   // ms since DETONATION — 0 while the warhead is still falling, so nothing dies until impact
  apocKill = (cityPhase!=="apoc") ? cityApoc                                                 // the "everything stops/empties" clock:
    : (curDeath==="nuke")    ? Math.min(1,blastMs/4000)                                       //   nuke: within ~4s of impact
    : (curDeath==="meteors") ? (apocMs<METEOR_IMPACT_MS ? Math.min(0.32,apocMs/METEOR_IMPACT_MS*0.5)   //   meteors: panic/evac builds during the approach…
                                                        : Math.min(1,0.32+(apocMs-METEOR_IMPACT_MS)/3500))  //   …then the impact empties the city fast
    : (curDeath==="sunburst") ? (apocMs<SUN_IGNITE_MS ? Math.min(0.35,apocMs/SUN_IGNITE_MS*0.5)   //   sunburst: panic builds as the sun swells & bakes…
                                                      : Math.min(1,0.35+(apocMs-SUN_IGNITE_MS)/2500))  //   …then the ground ignites and everything perishes fast
    : (curDeath==="ai") ? (apocMs<AI_WAKE_MS ? Math.min(0.25,apocMs/AI_WAKE_MS*0.25)          //   ai: panic as the factories boot…
                                             : Math.min(1,0.25+(apocMs-AI_WAKE_MS)/AI_WIPE_MS))    //   …then the assimilation front empties it as it spreads
    : (curDeath==="bh") ? (apocMs<BH_FORM_MS ? Math.min(0.25,apocMs/BH_FORM_MS*0.25)           //   black hole: dread as the singularity forms…
                                             : Math.min(1,0.25+(apocMs-BH_FORM_MS)/BH_WIPE_MS))    //   …then the pull drags the city in as it grows
    : (curDeath==="alienwar") ? (apocMs<WAR_ONSET_MS ? Math.min(0.3,apocMs/WAR_ONSET_MS*0.3)   //   alien war: panic as the fleets open fire overhead…
                                                     : Math.min(1,0.3+(apocMs-WAR_ONSET_MS)/6000))    //   …then the crossfire empties the city
    : (curDeath==="frost") ? (apocMs<FROST_ONSET_MS ? Math.min(0.3,apocMs/FROST_ONSET_MS*0.3)   //   deep freeze: people flee the plummeting cold…
                                                    : Math.min(1,0.3+(apocMs-FROST_ONSET_MS)/6000))   //   …then the freeze takes everyone
    : (curDeath==="kaiju") ? (apocMs<KAIJU_ARRIVE_MS ? Math.min(0.28,apocMs/KAIJU_ARRIVE_MS*0.28)   //   kaiju: terror as the beast emerges…
                                                     : Math.min(1,0.28+(apocMs-KAIJU_ARRIVE_MS)/KAIJU_WIPE_MS))   //   …then the rampage empties the city
    : (curDeath==="flood") ? (apocMs<FLOOD_ONSET_MS ? Math.min(0.3,apocMs/FLOOD_ONSET_MS*0.3)   //   flood: people run for high ground as the waters rise…
                                                    : Math.min(1,0.3+(apocMs-FLOOD_ONSET_MS)/9000))   //   …then the sea drowns the city
    : (curDeath==="kaijuwar") ? (apocMs<KW_ARRIVE_MS ? Math.min(0.3,apocMs/KW_ARRIVE_MS*0.3)   //   kaiju war: terror as the two titans rise…
                                                     : Math.min(1,0.3+(apocMs-KW_ARRIVE_MS)/(KW_APPROACH_MS+KW_CLASH_MS)))   //   …then the battle empties the city as it spreads
    : cityApoc;                                                                               //   (any future non-positional death — incl. pollution's slow fade)
  var rhythm=dayRhythm(nd);           // the city's daily pulse (rush-hour vs 3am)
  if(cityPhase==="apoc" && !apocPositional()){ rhythm.carPresence*=Math.max(0,1-apocKill*1.6); }   // traffic flees as the world ends, on the FAST clock (positional deaths handle each car as the wave/impact reaches it)
  curSeason=seasonInfo(nd);           // foliage colour for the trees
  curLit=eveLit(nd.getHours()+nd.getMinutes()/60);            // the city wakes & sleeps by the hour
  curEcon=econOf(now);                                        // boom or bust?
  if(curEcon<0.35) curLit*=0.82;                              // recessions dim the town
  curEvents=cityEvents(nd);           // calendar-driven special days (market, parade, marathon, movie)
  curMishap=blimpMishapNow(now);      // …and the rare blimp mishap (suppresses the ad blimp)
  curBlk=blackoutNow(now,fx);         // storm blackout state (L1)
  computeFireZones(now,fx);           // wildfire lifecycle (burn → char → regrow)
  curOutbreak=outbreakNow(now);       // disease outbreak state (N5)
  curCruise=cruiseNow(now);           // cruise-ship call (N6)
  computeIce(nd);                     // does the bay freeze today?
  if(rhythm.rush) rhythm.carSpeed*=1-0.16*POPK;   // N9: big cities gridlock harder at rush hour
  // ash-out veil: only masks the death→rebirth WRAP itself (~last hour rising, ~first hour fading).
  // (was 0.955/0.04 of the cycle = a 70% black overlay for ~29 REAL HOURS after every rebirth — far too long)
  apocVeil = cg.cy>=0.9985 ? Math.min(1,(cg.cy-0.9985)/0.0012) : (cg.cy<0.0015 ? 1-cg.cy/0.0015 : 0);
  growPop=Math.max(0,Math.min(1,(cityG-0.15)/0.45));         // traffic/crowds/infra scale up as it matures
  laborK=1.5-0.95*Math.min(1,cityG/0.55);                    // few hands in the village build SLOW; the boomtown workforce builds FAST (1.5×→0.55× duration)
  computeLmFoot();                                           // clear plazas where the civic landmarks stand
  curMayor=mayorState(now);                                  // who runs city hall right now?
  curBuilds=passedBuilds(now);                               // permanent landmarks the city voted to build this life
  curPolicies=curPoliciesOf(now);                            // soft policy-measures in force this term
  curCorps=corpState(now);                                   // the corporate landscape (rising/juggernaut/fading firms) this life
  if(curMayor&&curMayor.party.k==="BUILDERS") curEcon=Math.min(1,curEcon+0.15);   // builders juice the economy
  if(cityHasBuild("casino")) curEcon=Math.min(1,curEcon+0.06);                    // CASINO nightlife brings tourist money (but also crime — see crimeNow)
  if(curPolicies.heightcap) curEcon=Math.max(0,curEcon-0.08);                     // a HEIGHT CAP throttles development → softer economy, more empty storefronts (see FOR LEASE at ~9248)
  if(curEcon<0.35) curLit*=0.9;                                                    // a mandate-driven slump also dims the town a touch more
  curWar=(cityG>0.5)?warState(now):null;                     // is this the life the enemy comes?
  curDis=disasterNow(now);            // is a disaster striking right now?
  if(curWar&&curWar.f>=0&&curWar.f<1) curDis=null;           // a war eclipses lesser troubles
  curRebuilt=rebuiltZones(now);       // blocks wearing their post-disaster (rebuilt) tower
  curRuins=ruinZones(now);            // blocks a rare lost CAT-5 left permanently ruined this life
  if(cityG<0.22||cityPhase==="apoc"){ curDis=null; curRebuilt=[]; curRuins=[]; }  // disasters start earlier now (young town), but not in raw wilderness or the apocalypse
  // overcast pull: how far the sky greys over. By DAY it greys toward a BRIGHT overcast (stays light, just
  // cloudy); by NIGHT toward a dark storm grey. This keeps a rainy afternoon bright, not gloomy-dark.
  var isDay=L>0.5;
  // how heavily overcast — scales with the REAL cloud cover so a broken sky (~60%) stays mostly blue
  // but a fully socked-in day (100%) greys right over. (Was a flat 0.45 → 100% cloud looked the same
  // mild blue as 65%; now it reads as a proper overcast.)
  var cloudF=Math.max(0,Math.min(1,((weather.cloud||0)-45)/55));
  var ocMix=fx.thunder?(isDay?0.92:0.62):(fx.rain||fx.snow||fx.drizzle)?(isDay?0.85:0.5):fx.cloudy?(isDay?(0.32+0.6*cloudF):(0.24+0.4*cloudF)):0;
  var ocTop=isDay?(fx.thunder?[118,126,144]:[178,185,197]):[40,40,50],
      ocBot=isDay?(fx.thunder?[148,154,168]:[203,207,214]):[60,60,70];

  if(pass==="fg"){ g.clearRect(0,0,SW,SH); }   // the fg canvas is transparent glass over the backdrop
  if(pass!=="fg"){
  // sky
  var cA=mixc(SKY[ph.a][0],SKY[ph.b][0],ph.t), cB=mixc(SKY[ph.a][1],SKY[ph.b][1],ph.t);
  var grd=g.createLinearGradient(0,0,0,SH);
  grd.addColorStop(0,css(mixc(cA,ocTop,ocMix)));
  grd.addColorStop(1,css(mixc(cB,ocBot,ocMix)));
  g.fillStyle=grd; g.fillRect(0,0,SW,SH);

  // GOLDEN HOUR: one warm additive gradient hugging the horizon — kills the hard twilight
  // band edge AND bathes the low sky in dawn/dusk color (single fill, budget-friendly)
  if(goldenK>0.04){
    var ggo=g.createLinearGradient(0,HORIZON*0.35,0,HORIZON+4);
    ggo.addColorStop(0,   rgba(goldC,0));
    ggo.addColorStop(0.6, rgba(goldC,0.16*goldenK));
    ggo.addColorStop(1,   rgba(goldC,0.30*goldenK));
    g.globalCompositeOperation="lighter";
    g.fillStyle=ggo; g.fillRect(0,(HORIZON*0.35)|0,SW,(HORIZON*0.65)|0+5);
    g.globalCompositeOperation="source-over";
  }

  // NIGHT RADIANCE: light-pollution dome glowing up from the skyline (a subtle bloom, tinted by this life's lights)
  if(night>0.15){
    var gh4=Math.round(SH*0.36), neonE=cityEra.neon, gc4=cityEra.glow||[224,80,192];
    var gg=g.createLinearGradient(0,HORIZON-gh4,0,HORIZON+4);
    gg.addColorStop(0,    rgba(gc4,0));
    gg.addColorStop(0.55, rgba(neonE?[210,70,180]:gc4, 0.055*night));
    gg.addColorStop(1,    rgba(neonE?[80,190,255]:gc4, 0.18*night));
    g.fillStyle=gg; g.fillRect(0,HORIZON-gh4,SW,gh4+4);
  }

  var i,s,c;
  // the real Norwich night sky (stars + moon) — draws only when dark & clear
  drawSky(g,now,nd,L,fx);

  // sun / moon — travels across the whole world so all screens agree
  var st=sunTimes(nd);
  if(st.rise){ var dfx=(nd-st.rise)/(st.set-st.rise); if(dfx>0&&dfx<1) curSunDf=dfx; }   // track the sun for directional light
  goldenK=Math.max(0,1-Math.abs(L-0.5)*2.4);                                             // golden hour strength (same law the mountains/clouds used locally)
  goldC=curSunDf<0.5?[255,196,140]:[255,158,96];                                          // rose-gold dawn · amber dusk
  solarEclDim=0;
  var sunHidden=fx.rain||fx.drizzle||fx.snow||fx.thunder||fx.fog||(fx.cloudy&&(weather.cloud||0)>85);   // no sun disk through rain/fog/thick overcast
  if(st.rise){
    var df=(nd-st.rise)/(st.set-st.rise);
    if(df>0&&df<1&&sunHidden){ var shx=df*WW-WOFF, shy=HORIZON*0.9-Math.sin(df*Math.PI)*HORIZON*0.75;
      if(shx>-10&&shx<SW+10&&!fx.thunder){                   // just a pale bright patch behind the cloud deck
        g.fillStyle="rgba(235,238,244,0.14)"; g.fillRect((shx-5)|0,(shy-4)|0,11,9);
        g.fillStyle="rgba(240,242,247,0.10)"; g.fillRect((shx-8)|0,(shy-6)|0,17,13); } }
    if(df>0&&df<1&&!sunHidden){ var sx2=df*WW-WOFF, sy=HORIZON*0.9-Math.sin(df*Math.PI)*HORIZON*0.75;
      if(sx2>-6&&sx2<SW+6){
        var T=(weather.temp==null?60:weather.temp), sOut, sCore, sHalo;
        if(T>90){ sOut=[255,70,38]; sCore=[255,158,80]; sHalo=[255,80,40]; }             // scorching → red sun
        else if(T<30){ sOut=[130,185,255]; sCore=[205,232,255]; sHalo=[120,180,255]; }   // frigid → blue sun
        else { sOut=[255,215,94]; sCore=[255,236,158]; sHalo=[255,210,120]; }            // temperate → warm
        var ext=T>90?Math.min(1,(T-90)/20):T<30?Math.min(1,(30-T)/25):0;                 // extremeness 0..1
        g.globalCompositeOperation="lighter";
        g.fillStyle=rgba(sHalo,0.10+0.18*ext); g.fillRect((sx2-6)|0,(sy-6)|0,13,13);
        g.fillStyle=rgba(sHalo,0.07+0.13*ext); g.fillRect((sx2-9)|0,(sy-9)|0,19,19);
        g.globalCompositeOperation="source-over";
        var RW=[3,5,7,7,7,5,3];                                                  // a proper round disc
        for(var sr=0;sr<7;sr++){ g.fillStyle=css(sOut); g.fillRect((sx2-(RW[sr]>>1))|0,(sy-3+sr)|0,RW[sr],1); }
        var RC=[3,5,5,5,3];
        for(sr=0;sr<5;sr++){ g.fillStyle=css(sCore); g.fillRect((sx2-(RC[sr]>>1))|0,(sy-2+sr)|0,RC[sr],1); }
        var lowSun=Math.min(df,1-df)<0.14;                                       // long dawn/dusk rays
        if(lowSun){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(sHalo,0.16);
          g.fillRect((sx2-14)|0,sy|0,29,1); g.fillRect(sx2|0,(sy-10)|0,1,21);
          g.fillStyle=rgba(sHalo,0.09); g.fillRect((sx2-9)|0,(sy-9)|0,1,1);
          for(var gr5=0;gr5<4;gr5++){ var ga5=-0.35-gr5*0.55+(df>0.5?Math.PI+0.7+gr5*0:0);   // GOD-RAYS fan upward
            var gdx=Math.cos(ga5)*(df>0.5?-1:1), gdy=-Math.abs(Math.sin(ga5));
            for(var st5=4;st5<30;st5+=2){
              g.fillStyle=rgba(sHalo,(0.07*(1-st5/30)).toFixed(3)*1);
              g.fillRect((sx2+gdx*st5)|0,(sy+gdy*st5)|0,2+(st5>>3),1); } }
          g.globalCompositeOperation="source-over"; }
        if(T>90 && (Math.floor(now/160))%2===0){ g.fillStyle=rgba([255,120,60],0.5); g.fillRect((sx2-1)|0,(sy+4)|0,3,1); }  // heat ripple
        // ---- SOLAR ECLIPSE: the Moon slides across the sun near midday; totality goes eerie-dark with a corona ----
        if(SOLAR_ECLIPSES.indexOf(ymd(nd))>=0){
          var ep=(df-0.42)/0.17;                                        // -1..+1 as the moon transits (window ~3h around late morning)
          if(ep>-1&&ep<1){ var cov=1-Math.abs(ep); solarEclDim=cov;      // coverage 0..1 (1 = totality)
            var lox=sx2+ep*7, loy=sy-ep*1.2;                            // occluding disk slides across the sun
            if(cov>0.45){ g.globalCompositeOperation="lighter";         // corona blooms as the disk closes in
              g.fillStyle="rgba(245,248,255,"+(0.30*cov)+")"; g.fillRect((sx2-8)|0,(sy-8)|0,17,17);
              g.fillStyle="rgba(255,252,240,"+(0.22*cov)+")"; g.fillRect((sx2-6)|0,sy|0,13,1); g.fillRect(sx2|0,(sy-6)|0,1,13);
              g.globalCompositeOperation="source-over"; }
            g.fillStyle="#080810";                                      // the dark lunar disk (radius ~4, rounded)
            g.fillRect((lox-2)|0,(loy-4)|0,5,9); g.fillRect((lox-4)|0,(loy-2)|0,9,5); g.fillRect((lox-3)|0,(loy-3)|0,7,7);
            if(cov>0.70){ g.globalCompositeOperation="lighter";         // thin corona ring hugging the dark disk at/near totality
              g.fillStyle="rgba(255,253,246,"+(0.6*(cov-0.7)/0.3)+")";
              g.fillRect((sx2-5)|0,sy|0,11,1); g.fillRect(sx2|0,(sy-5)|0,1,11);
              g.globalCompositeOperation="source-over"; }
            if(cov>0.80&&cov<0.97){ g.globalCompositeOperation="lighter";   // "diamond ring" bead on the emerging limb
              var bead=ep<0?-1:1; g.fillStyle="rgba(255,255,250,0.95)"; g.fillRect((sx2+bead*3)|0,sy|0,2,2);
              g.globalCompositeOperation="source-over"; }
          }
        }
      } }
  }
  // (the Moon is drawn in drawSky() at its real Norwich position/phase)

  drawMountains(g,L,now,nd);      // the distant range — behind the clouds, the city, everything
  drawClimbers(g,L,now,nd,fx);    // tiny mountaineers roping up the tallest peaks (fair-weather days)
  }                                                          // end of the backdrop stack
  if(pass==="bg"){ if(cityG<0.985) drawTerrain(g,cityG,L,now,nd,"bg"); return; }
  if(curSpace>0.35 && !nukeFull()) drawOrbitals(g,L,now,fx);   // the orbital station + shuttle re-entries
  drawAurora(g,nd,L,now,fx);                    // rare frigid-night light show
  drawShower(g,nd,L,now,fx);                    // real-date meteor showers
  drawSatellite(g,L,now);                       // a satellite/ISS ghosting steadily across the dark sky
  drawShootingStar(g,L,now);                    // the occasional wish-worthy shooting star
  drawRainbow(g,L,fx);                          // an arc when a shower clears under a low sun

  // clouds (deterministic drift)
  var windPush=0.6+(weather.wind||5)*0.06;
  var cloudA=fx.cloudy?0.85:(fx.rain||fx.snow)?0.9:0.5;
  for(i=0;i<clouds.length;i++){ c=clouds[i];
    var cwx=wrapW(c.x0+c.sp*windPush*now), cx=cwx-WOFF;
    if(cx>SW+10&&cx-WW>-70) cx-=WW; if(cx<-70&&cx+WW<SW+70) cx+=WW;
    if(cx<-70||cx>SW+10) continue;
    var shade=L>0.5?200:70, sunsetK=goldenK;   // shared golden-hour global
    var cc0=[shade,shade,shade+10];
    if(sunsetK>0.02) cc0=mixc(cc0,(i&1)?[255,150,175]:[255,170,115],sunsetK*0.8);   // cotton-candy twilight
    var CX0=cx|0, CY0=c.y|0, CW0=c.w|0, CH0=c.h|0;
    g.fillStyle=rgba(cc0,cloudA*c.d);
    if(c.t===1){                                                                    // cumulus: flat base + 3 rounded lobes
      g.fillRect(CX0,CY0,CW0,CH0);
      fillEllipse(g,CX0+(CW0*0.25|0),CY0,Math.max(2,(CW0*0.22)|0),3);
      fillEllipse(g,CX0+(CW0*0.55|0),CY0-1,Math.max(2,(CW0*0.24)|0),5);              // middle lobe tallest
      fillEllipse(g,CX0+(CW0*0.8|0),CY0,Math.max(2,(CW0*0.2)|0),4);
      g.fillStyle=rgba([255,255,255],cloudA*c.d*0.5);
      fillEllipse(g,CX0+(CW0*0.55|0),CY0-3,Math.max(1,(CW0*0.16)|0),2);              // top-light
      g.fillStyle=rgba(mixc(cc0,[40,50,80],0.5),cloudA*c.d*0.5);
      g.fillRect(CX0+1,CY0+CH0-1,CW0-2,1);                                          // flat shaded base
      if(sunsetK>0.3){ g.fillStyle=rgba([255,205,160],0.35*sunsetK*c.d);            // sunlit underside
        g.fillRect((cx+2)|0,(c.y+c.h-1)|0,(c.w*0.8)|0,1); }
    } else if(c.t===0){                                                             // wisp: two offset rects + a soft feather
      g.fillRect(CX0,CY0,CW0,Math.max(1,(CH0*0.5)|0));
      g.fillRect(CX0-(CW0*0.18|0),CY0+1,(CW0*1.15|0),Math.max(1,(CH0*0.3)|0));
      g.fillStyle=rgba(cc0,cloudA*c.d*0.5);
      g.fillRect(CX0-(CW0*0.18|0),CY0+2,(CW0*1.3|0),1);
    } else {                                                                        // high-streak: thin wide band up high + feather
      g.fillStyle=rgba(cc0,cloudA*c.d*0.6);
      var stH=CH0>7?2:1; g.fillRect(CX0-(CW0*0.2|0),CY0,(CW0*1.4|0),stH);
      g.fillStyle=rgba(cc0,cloudA*c.d*0.3);
      g.fillRect(CX0-(CW0*0.2|0),CY0+stH,(CW0*1.4|0),1);
    }
  }
  // heavy overcast: when it's raining/snowing/cloudy, a second denser deck of cloud masses rolls in
  if(fx.rain||fx.snow||fx.thunder||fx.cloudy){
    var ov=fx.thunder?0.5:(fx.rain||fx.snow)?0.4:(0.12+0.26*cloudF), oshade=L>0.5?188:56;   // denser deck the more overcast it is
    var onc=Math.round(WW/44)+4, ospd=0.0032*windPush;
    for(var oc=0;oc<onc;oc++){ var oseed=(oc*2654435761)>>>0, ohash=oseed/4294967296;
      var owx=wrapW(ohash*WW + ospd*now*(0.7+ (oseed%50)/90)), ocx=owx-WOFF;
      var oy=2+((oseed>>7)%Math.max(1,(HORIZON*0.4)|0)), ow=40+((oseed>>3)%54), oh=7+((oseed>>5)%8);
      for(var owp=-1;owp<=1;owp++){ var OX=ocx+owp*WW; if(OX<-90||OX>SW+10) continue;
        g.fillStyle="rgba("+oshade+","+oshade+","+(oshade+8)+","+ov+")";
        g.fillRect(OX|0,oy|0,ow,oh); g.fillRect((OX+8)|0,(oy-3)|0,(ow*0.6)|0,4); g.fillRect((OX+ow*0.3)|0,(oy+oh-1)|0,(ow*0.5)|0,3); }
    }
  }

  // high plane on a schedule
  var pl=crosser(now, 120000, 0.02, 6, 0.6);
  if(pl){ var px=pl.x-WOFF, py=12+((pl.idx*37)%28);
    if(px>-8&&px<SW+8){ g.globalAlpha=L>0.5?0.55:0.9; g.fillStyle=L>0.5?"#3a3f4a":"#181820";
      g.fillRect(px|0,py|0,5,1); g.fillRect((px+(pl.dir>0?0:4))|0,(py-1)|0,1,1);
      g.fillStyle=((Math.floor(now/450))%2===0)?"#ff4444":"#44ff66"; g.fillRect((px+(pl.dir>0?-1:5))|0,py|0,1,1);
      if(L<0.4){ g.fillStyle="rgba(255,240,200,0.8)"; g.fillRect((px+2)|0,py|0,1,1); }
      g.globalAlpha=1; }
  }

  // birds riding the same sky (behind the towers): ambient crossers + the seasonal migration V
  if(!nukeStruck()) drawSkyBirds(g,L,now,fx);        // the thermal flash kills every bird in the sky
  if(!nukeStruck()) drawMigration(g,now,nd,L);

  // sky attractions: hot-air balloons on calm days, an ad-blimp on a schedule
  if(cityG>0.35 && !nukeStruck()) drawBalloons(g,L,now,fx);   // the flash pops the hot-air balloons
  if(cityG>0.5 && !nukeFull()) drawBlimp(g,L,now,night,nd);

  // the wilderness the city grows out of (hills, grass, river, trees, the first cabin) — recedes as it matures
  if(cityG<0.985) drawTerrain(g,cityG,L,now,nd,pass==="fg"?"fg":undefined);

  drawLayer(g,far,L,now,fx,hol,0.42);
  // dystopian smog band (only once there's a city to be smoggy) — one gradient, magenta→teal, feathered at both ends
  var smA=(0.10+0.06*Math.sin(now*0.00008))*night*Math.min(1,cityG*1.5);
  if(smA>0.002){
    var smY0=(HORIZON*0.42+Math.sin(now*0.00006)*6)|0, smY1=(HORIZON*0.78+Math.cos(now*0.00005)*5)|0;
    var smg=g.createLinearGradient(0,smY0,0,smY1);
    smg.addColorStop(0,    rgba([150,60,130],0));
    smg.addColorStop(0.35, rgba([150,60,130],smA));
    smg.addColorStop(0.65, rgba([60,120,140],smA*0.8));
    smg.addColorStop(1,    rgba([60,120,140],0));
    g.fillStyle=smg; g.fillRect(0,smY0,SW,smY1-smY0);
  }
  drawLayer(g,mid,L,now,fx,hol,0.20);
  // waterfront harbour fills the industrial edges (behind the near shoreline)
  if(hasOcean) drawHarbor(g,L,now,night,nd);   // the coast is there from day one — the city grows out to meet it
  if(hasOcean) drawOpenSea(g,L,now,night);     // …and beyond the harbour, the OPEN sea
  if(hasOcean&&cityG>0.004&&roadFNow()<0.85&&!iceNow&&!nukeFull()) drawFerry(g,L,now);   // no causeway yet → the raft ferry runs
  if(!nukeFull()) drawIce(g,L,now);                            // deep winter: the bay is a skating rink (skaters gone with the blast)
  if(hasOcean && !nukeFull()) drawRival(g,L,now);              // the rival city, growing across the bay (also gone in the exchange)
  drawLayer(g,near,L,now,fx,hol,0);

  // construction sites — towers rising floor-by-floor over real days, with tower cranes
  if(cityG>0.35 && !nukeStruck()) for(var siI=0;siI<sites.length;siI++) drawSite(g,sites[siI],L,now,nd);   // NO new construction once the bomb drops — the cranes are gone
  // airport control tower + beacon (only once the city is big enough to have one)
  if(!nukeHit(airportX)) drawAirport(g,L,now,night);   // (self-gated: rises under a crane; obliterated when the blast front arrives)
  // the launch complex — the space-faring era's crown jewel (falls silent during the endtimes)
  if(curSpace>0.05 && cityPhase!=="apoc") drawSpaceport(g,L,now,night);
  // civic landmarks — stadium, cathedral, ferris wheel (rise with the maturing city)
  drawLandmarks(g,L,now,night,nd);   // civic landmarks rip away individually as the blast front reaches each (see drawLandmarks)
  drawBuilds(g,L,now,night);         // permanent VOTED landmarks (stadium/park/casino/…) the city built via ballot measures — near layer, traffic passes in front
  // big LED news screens on the downtown towers — run local news, cut to BREAKING coverage as events happen
  // (deliberately NOT gated by nukeFull: they keep reporting the disaster right up until each tower is hit)
  if(cityG>0.5) drawNewsScreens(g,L,now,night);
  // window washers riding suspended platforms down the facades (daytime)
  if(cityG>0.5 && !nukeFull()){ drawWashers(g,mid,L,now); drawWashers(g,near,L,now); }
  // space-age retrofits: holo rings, uplink beams, the space elevator
  if(curSpace>0.12 && !nukeFull()) drawSpaceRetrofit(g,L,now,night);
  if(cityG>0.6 && !nukeFull()) drawRoofParties(g,L,now,nd,hol);   // weekend rooftops come alive

  // cables (need built rooftops to string between)
  if(cityG>0.55){ g.strokeStyle=L>0.5?"rgba(20,20,28,0.55)":"rgba(5,5,10,0.8)"; g.beginPath();
  for(i=0;i<cables.length;i++){ var cb=cables[i];
    if(cityG < 0.55+(((cb.x1*13)%97)/97)*0.18) continue;
    var x1=cb.x1-WOFF, x2=cb.x2-WOFF; if((x1<-4&&x2<-4)||(x1>SW+4&&x2>SW+4)) continue;
    var mxp=(x1+x2)/2, myp=Math.max(cb.y1,cb.y2)+cb.sag;
    g.moveTo(x1,cb.y1); g.lineTo(mxp|0,myp|0); g.lineTo(x2,cb.y2); }
  g.stroke(); }

  // searchlights sweeping the smog (on the tallest towers — only in the mature metropolis)
  if(L<0.4 && cityG>0.82){ g.globalAlpha=gstage(0.82,0.95); for(i=0;i<searchlights.length;i++){ var sl=searchlights[i];
      var slx=sl.x-WOFF; if(slx<-120||slx>SW+120) continue;
      var ang=Math.sin(now*sl.sp+sl.ph)*0.7, tipx=slx+ang*110, spread=10+4*Math.sin(now*0.0007);
      g.fillStyle="rgba(190,215,255,0.05)";
      g.beginPath(); g.moveTo(slx,sl.y); g.lineTo((tipx-spread)|0,sl.y-115); g.lineTo((tipx+spread)|0,sl.y-115); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(slx,sl.y); g.lineTo((tipx-spread*0.4)|0,sl.y-115); g.lineTo((tipx+spread*0.4)|0,sl.y-115); g.closePath(); g.fill();
  } g.globalAlpha=1; }

  // airport traffic: a plane taking off or coming in to land (needs the airport)
  if(cityG>0.68){ var fl=flightNow(now); if(fl && !nukeHit(fl.x)) drawPlane(g,fl,L,now);            // the blast wave takes the aircraft down as it reaches them
    var chop=chopperNow(now); if(chop && !nukeHit(chop.x)) drawChopper(g,chop.x,chop.y,chop.dir,chop.rotor,L,now); }  // rooftop helipad chopper

  // elevated train line + scheduled train (mass transit arrives with the city)
  drawTrainLine(g,L,now,fx);   // (self-gated: builds itself pillar by pillar)

  // drones (deterministic world paths) — only over a developed city
  if(cityG>0.42) for(i=0;i<drones.length;i++){ var dr=drones[i];
    if(cityG < 0.42+(i%7)*0.035) continue;   // the fleet grows one drone at a time
    var dwx=wrapW(dr.x0+dr.vx*now), dx=dwx-WOFF;
    if(dx>SW+6&&dx-WW>-6) dx-=WW; if(dx<-6&&dx+WW<SW+6) dx+=WW;
    if(dx<-6||dx>SW+6) continue;
    var dy=dr.y+Math.sin(now*dr.wy+dr.ph)*dr.ay*0.3;
    g.fillStyle=L>0.5?"#2a2e38":"#101018"; g.fillRect(dx|0,dy|0,2,1);
    if((Math.floor(now/120))%2===0){ g.fillStyle="rgba(120,130,150,0.6)"; g.fillRect((dx-1)|0,(dy-1)|0,1,1); g.fillRect((dx+2)|0,(dy-1)|0,1,1); }
    if(((now/700+dr.ph*100)|0)%2===0){ g.fillStyle=dr.led?"#05d9e8":"#ff3355"; g.fillRect((dx+(dr.led?0:1))|0,(dy+1)|0,1,1); }
  }

  // hover-car sky lanes weaving between the towers (the space age's commuters)
  if(curSpace>0.25 && !nukeFull()) drawHoverTraffic(g,L,now,night);
  if(curSpace>0.1){                                                // G1: sky-bridges link the transformed towers
    for(var sbd=0;sbd<skybridges.length;sbd++){ var SB=skybridges[sbd];
      var t1=near.blds[SB.i], t2=near.blds[SB.j];
      if(curSpace<t1.spAge+0.045||curSpace<t2.spAge+0.045) continue;
      var by3=(HORIZON-Math.min(t1.h,t2.h)*SB.f)|0, ax2=t1.x+t1.w-WOFF, bx3=t2.x-WOFF;
      for(var wq=-1;wq<=1;wq++){ var A3=(ax2+wq*WW)|0, B3=(bx3+wq*WW)|0; if(B3<-4||A3>SW+4) continue;
        g.fillStyle=css(mixc([60,68,86],[120,132,158],L>0.5?1:0)); g.fillRect(A3,by3,B3-A3,2);
        g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(122,245,255,"+(night>0.4?0.5:0.2)+")"; g.fillRect(A3,by3+1,B3-A3,1);
        var pd3=((now*0.01+sbd*31)|0)%Math.max(2,(B3-A3)); g.fillStyle="#eafcff"; g.fillRect(A3+pd3,by3+1,1,1);   // a traveller in the tube
        g.globalCompositeOperation="source-over"; }
    }
  }

  // ---- street ---- the road is BUILT, not merely faded in: a paving front (roller + fresh-tar strip + cones)
  // sweeps the world W→E, laying finished asphalt behind it over a graded dirt bed ahead. paveFrac completes by
  // cityG≈0.30, LEADING the population (cars open at 0.42, street folk at 0.30) so nobody stands on unpaved ground.
  // World-anchored (paved band = world-x [0, WW*paveFrac]) → the front is continuous across every monitor.
  // Freeze-safe: bounded loops, ≤3-rect clip, the machinery vanishes once paved.
  var roadY=HORIZON+3, roadF=Math.max(0,Math.min(1,(cityG-0.1)/0.4));
  var paveFrac=Math.max(0,Math.min(1,(cityG-0.05)/0.25)), frontW=WW*paveFrac, roadPaved=paveFrac>=1;
  if(paveFrac>0.001){
    if(!roadPaved){                                                          // graded earth roadbed ahead of the paver
      g.fillStyle=L>0.5?"#6e5c46":"#332a20"; g.fillRect(0,HORIZON+1,SW,SH-HORIZON-1);
      g.fillStyle=L>0.5?"rgba(0,0,0,0.14)":"rgba(0,0,0,0.22)";               // gravel/rut speckle on the raw bed
      for(var pvGb=((-WOFF%7)+7)%7; pvGb<SW; pvGb+=7) g.fillRect(pvGb,roadY+2+((pvGb*5+WOFF)%13),2,1);
    }
    g.save(); g.beginPath();                                                 // clip the finished road to the PAVED world-band
    if(roadPaved){ g.rect(0,HORIZON,SW,SH-HORIZON); }
    else for(var pvWr=-1;pvWr<=1;pvWr++){ var pvA=Math.max(0,(0-WOFF+pvWr*WW)), pvB=Math.min(SW,(frontW-WOFF+pvWr*WW)); if(pvB>pvA) g.rect(pvA|0,HORIZON,(pvB-pvA)|0,SH-HORIZON); }
    g.clip();
    g.fillStyle=L>0.5?"#666b78":"#3c4254"; g.fillRect(0,HORIZON,SW,3);        // sidewalk
    g.fillStyle=L>0.5?"#474c56":"#2a2f3e"; g.fillRect(0,HORIZON+2,SW,1);      // curb
    g.fillStyle=L>0.5?"#3a3f4c":"#272c39"; g.fillRect(0,roadY,SW,SH-roadY);   // asphalt
    g.fillStyle=L>0.5?"rgba(0,0,0,0.10)":"rgba(0,0,0,0.16)";                   // asphalt patina
    for(var ap2=((-WOFF%9)+9)%9; ap2<SW; ap2+=9) g.fillRect(ap2,roadY+2+((ap2*7+WOFF)%18),2,1);
    g.fillStyle="rgba(255,255,255,0.06)";
    for(var ap3=((-WOFF%13)+13)%13; ap3<SW; ap3+=13) g.fillRect(ap3,roadY+4+((ap3*5+WOFF)%16),1,1);
    g.fillStyle=L>0.5?"rgba(255,255,255,0.10)":"rgba(160,175,205,0.08)";       // sidewalk expansion seams
    for(var sw2=((-WOFF%8)+8)%8; sw2<SW; sw2+=8) g.fillRect(sw2,HORIZON,1,3);
    g.fillStyle=L>0.5?"rgba(255,255,255,0.16)":"rgba(150,165,195,0.12)"; g.fillRect(0,HORIZON+3,SW,1);   // curb highlight
    if(L<0.5){                                                                // night: the city's own glow keeps the street readable
      var ng=g.createLinearGradient(0,HORIZON,0,SH);
      ng.addColorStop(0,"rgba(150,160,205,"+(0.13*(1-L)*roadF)+")");
      ng.addColorStop(1,"rgba(90,100,150,"+(0.04*(1-L)*roadF)+")");
      g.fillStyle=ng; g.fillRect(0,HORIZON,SW,SH-HORIZON); }
    g.globalAlpha=1;
    g.restore();                                                             // end paved-band clip
    if(!roadPaved){                                                          // the paving FRONT: fresh-tar strip + road roller + cones
      var pfx=disX(frontW);
      if(pfx>-20&&pfx<SW+10){ var pj=L>0.5;
        g.fillStyle=pj?"#33373f":"#191d25"; g.fillRect((pfx-15)|0,roadY,15,SH-roadY);            // freshly-laid (darker) tar behind the drum
        g.fillStyle="#e0b040"; g.fillRect((pfx-2)|0,roadY+1,7,6);                                // roller body, hi-vis
        g.fillStyle=pj?"#2a2e38":"#14181f"; g.fillRect((pfx-4)|0,roadY+5,5,3);                    // the heavy compaction drum
        g.fillStyle=pj?"#e8edf3":"#8fb0d0"; g.fillRect((pfx+1)|0,roadY+2,2,2);                    // cab glass
        if(((Math.floor(now/380))&1)){ g.globalCompositeOperation="lighter"; g.fillStyle="#ffe680"; g.fillRect((pfx+2)|0,roadY-1,1,1); g.globalCompositeOperation="source-over"; }  // amber beacon
        g.fillStyle="#ff7422"; for(var pvCn=0;pvCn<3;pvCn++){ var pvCnx=(pfx+9+pvCn*6)|0; if(pvCnx<SW+2){ g.fillRect(pvCnx,roadY+4,2,3); g.fillStyle="#f4f4f4"; g.fillRect(pvCnx,roadY+5,2,1); g.fillStyle="#ff7422"; } }
      }
    }
  }
  // wet-street neon reflections (district-coloured) — only from buildings that actually exist yet, on a paved road
  if(L<0.5 && roadF>0.5){ for(i=0;i<near.blds.length;i++){ var rb=near.blds[i];
      if(rb.bAge!==undefined && cityG-rb.bAge<=bandOf(rb)) continue;    // building not built (or still rising) → no reflection
      if(rb.sign&&rb.h>22&&rb.w>=14){ var rx=(rb.x+rb.w-5)-WOFF; if(rx<-4||rx>SW+4) continue;
        g.fillStyle=NEON[rb.signC]; g.globalAlpha=(0.06+0.03*Math.sin(now*0.001+i))*roadF;
        g.fillRect(rx|0,roadY,4,SH-roadY); } }
    g.globalAlpha=1; }
  if(snowpack>0){ g.fillStyle="rgba(240,244,255,"+Math.min(0.92,snowpack)+")"; g.fillRect(0,HORIZON,SW,1+Math.round(snowpack*3)); }
  // lane markings + crosswalks — only once the city has proper paved multi-lane roads
  if(cityG>0.38){
  g.globalAlpha=gstage(0.38,0.52);                                   // fresh road paint fades in
  g.fillStyle="rgba(230,235,245,"+(0.4*(1-curSpace*0.8)).toFixed(2)+")";
  for(var dw=Math.floor(WOFF/10)*10; dw<WOFF+SW+10; dw+=10){ var dsx=dw-WOFF;
    g.fillRect(dsx|0,HORIZON+8,5,1); g.fillRect(dsx|0,HORIZON+19,5,1); }   // lane dividers
  if(curSpace>0.35){ g.globalCompositeOperation="lighter";                  // G1: the road becomes a lit guideway
    g.fillStyle="rgba(122,245,255,"+(0.30*curSpace).toFixed(2)+")";
    g.fillRect(0,HORIZON+8,SW,1); g.fillRect(0,HORIZON+19,SW,1);
    g.globalCompositeOperation="source-over"; }
  g.fillStyle="rgba(255,205,60,0.5)"; g.fillRect(0,HORIZON+13,SW,1); g.fillRect(0,HORIZON+14,SW,1);  // double-yellow centre
  for(i=0;i<crosswalks.length;i++){ var xw=crosswalks[i], xwx=xw.x-WOFF;
    if(!cwInst(xw)) continue;
    if(nukeHit(xw.x)) continue;                          // the road markings are gone in the blast zone
    for(var wrp=-1;wrp<=1;wrp++){ var CX=xwx+wrp*WW; if(CX<-8||CX>SW+8) continue;
      g.fillStyle=L>0.5?"rgba(238,241,248,0.9)":"rgba(206,212,228,0.72)";
      for(var zb=HORIZON+4; zb<HORIZON+24; zb+=2) g.fillRect((CX-4)|0, zb, 9, 1); } }
  }
  g.globalAlpha=1;
  // rain leaves PUDDLES that mirror the lights, then slowly dry
  if(wetness>0.04&&roadF>0.5){
    for(var pu=0;pu<36;pu++){ var puh=((pu*2654435761+17)>>>0), psx2=(puh%WW)-WOFF;
      if(psx2>SW+8&&psx2-WW>-8) psx2-=WW; if(psx2<-8&&psx2+WW<SW+8) psx2+=WW;
      if(psx2<-8||psx2>SW+8) continue;
      var pyy=HORIZON+5+((puh>>>8)%Math.max(2,GROUND-9)), pw3=3+((puh>>>5)%5);
      g.fillStyle="rgba(130,160,205,"+(0.20*wetness)+")"; g.fillRect(psx2|0,pyy,pw3,1);
      if(L<0.5){ g.globalCompositeOperation="lighter";
        g.fillStyle="rgba(200,225,255,"+(0.16*wetness)+")";
        g.fillRect((psx2+((Math.floor(now/700)+pu)%pw3))|0,pyy,1,1);
        g.globalCompositeOperation="source-over"; }
    } }
  // coastal causeway: railing where the highway crosses the open water
  if(hasOcean&&seaW>0&&roadF>0.8){ var rlz=[[0,WW*seaW],[WW*(1-seaW),WW]];
    for(var ri2=0;ri2<rlz.length;ri2++){ for(var w3=-1;w3<=1;w3++){
      var ra=Math.max(0,(rlz[ri2][0]-WOFF+w3*WW)|0), rb=Math.min(SW,(rlz[ri2][1]-WOFF+w3*WW)|0);
      if(rb<=ra) continue;
      g.fillStyle=L>0.5?"#aeb6c2":"#4a5468"; g.fillRect(ra,HORIZON-1,rb-ra,1);
      for(var px2=ra;px2<rb;px2+=4) g.fillRect(px2,HORIZON,1,2);
    } } }

  // a GREENS administration plants trees along the boulevard
  if(curMayor&&curMayor.party.k==="GREENS"&&roadF>0.8&&!nukeFull()){
    for(var gt2=0;gt2<24;gt2++){ var gh2=((gt2*2654435761+91)>>>0), gsx=(gh2%WW)-WOFF;
      if(gsx>SW+6&&gsx-WW>-6) gsx-=WW; if(gsx<-6&&gsx+WW<SW+6) gsx+=WW;
      if(gsx<-5||gsx>SW+5||inSea(gsx+WOFF)||nukeHit(gh2%WW)) continue;
      drawTree(g,gsx|0,HORIZON+1,L>0.5,now,gt2); } }
  if(!nukeFull()) drawCivicPolicy(g,L,now);              // the winning party's visible policies (solar/cameras/cranes/yard signs)
  // street furniture + the people using it (lamps, benches, bus stops, carts…) — on the sidewalk
  if(cityG>0.3 && !nukeFull()) drawStreetProps(g,L,now,night);   // street furniture + the people at them — gone
  if(!nukeFull()) drawGreenery(g,L,now);                 // base street trees, ivy on brick, curb weeds — nature softening the grid
  if(!nukeFull()) drawStreetSigns(g,L,now);              // corner street/stop signs + hanging shop signs
  // snowmen the neighbourhood builds while the snow lies on the ground
  if(fx.snow && cityG>0.3){ for(var swi=0;swi<6;swi++){ var swh=((swi*2654435761+4113)>>>0), swwx=swh%WW, swx=swwx-WOFF;
    if(swx>SW+4&&swx-WW>-4) swx-=WW; if(swx<-4&&swx+WW<SW+4) swx+=WW;
    if(swx<-4||swx>SW+4||inSea(swwx)) continue; drawSnowman(g,swx,HORIZON); } }
  if(cityG>0.3 && !nukeFull()){ drawWindowVignettes(g,L,now); drawRoofCat(g,L,now); }   // after-dark rooftop life & lit windows
  if(cityG>0.42 && !nukeFull()) drawSubways(g,L,now,night);                    // subway kiosks join the streetscape
  if(cityG>0.3 && hasOcean && !nukeFull()) drawDocks(g,L,now,night);   // dock hardware accumulates as trade grows (needs a waterfront)

  // rare traffic incident (deterministic → identical on every screen; needs real traffic)
  var crash=(cityG>0.52)?crashNow(now):null, qn=0, jamLen=0;
  if(crash){
    var clearing=crash.tp>(crash.arrive+crash.work);
    var jamProg=Math.min(1, crash.tp/Math.max(4000,crash.arrive*0.8));
    if(clearing) jamProg=Math.max(0, 1-(crash.tp-(crash.arrive+crash.work))/5000);
    qn=Math.round(jamProg*7); jamLen=8+qn*13;
  }

  // FOUNDERS' TRAVEL: horses & wagons work the dirt trail until the road is paved —
  // and everything is routed onto DRY LAND (nobody rides over the open sea)
  if(cityG>=ARRIVE && cityG<0.46){ var nHrs=1+Math.round(2*Math.min(1,cityG/0.2));
    var hFade=cityG>0.38?1-(cityG-0.38)/0.08:1;                    // horses retire as pavement arrives
    for(var hfi=0;hfi<nHrs;hfi++){ if(hFade<((hfi+0.5)/nHrs)) continue;
      var hv=crosser(now+hfi*9241, 42000+hfi*8000, 0.006+hfi*0.0016, 8, 0.72);
      if(hv && !nukeHit(hv.x)) drawHorse(g, landRoute(hv.x), HORIZON+5+((hfi*5)%12), hv.dir, L, now, hfi%3); } }
  // once real building starts, motor rigs join the horses on the open ground
  if(cityG>0.26 && cityG<0.55){ var nOff=1+Math.round(2*gstage(0.26,0.42));
    for(var ofi=0;ofi<nOff;ofi++){ var ov=crosser(now+ofi*8123, 34000+ofi*7000, 0.011+ofi*0.0025, 10, 0.7);
      if(ov && !nukeHit(ov.x)) drawOffroad(g, landRoute(ov.x), HORIZON+5+((ofi*4)%12), ov.dir, L, now, ofi%3); } }

  // cross-screen cars — 4 lanes, small, and they STOP & queue at red signals (deterministic)
  var STOPZ=24, CARM=100, CARLEN=11;   // CARM: off-screen cull margin; CARLEN: car body length (drawCar draws left-anchored)
  function carWX(cc){ return wrapW(cc.x0+LANE[cc.lane].d*cc.sp*KSP*now*rhythm.carSpeed*(fx.snow?0.5:1)); }
  // world-x of a car's LEADING edge. drawCar always draws CARLEN px to the RIGHT of the anchor,
  // regardless of heading, so a rightbound car's nose is anchor+CARLEN and a leftbound car's nose is the anchor.
  function noseWX(leftWX,dir){ return leftWX+(dir>0?CARLEN:0); }
  // precompute every car's world-x ONCE (was recomputed O(n²) inside the queue-rank loop)
  var cwxAll=[]; for(i=0;i<cars.length;i++) cwxAll[i]=carWX(cars[i]);
  // precompute which crosswalks are red THIS frame (was re-tested per car × crosswalk)
  var redCW=[]; for(var rci=0;rci<crosswalks.length;rci++) if(cwInst(crosswalks[rci])&&sig(now,crosswalks[rci].ph)===2) redCW.push(crosswalks[rci]);
  for(i=0;i<cars.length;i++){ c=cars[i];
    var laneOn=(cars[i].lane<2)?gstage(0.42,0.50):gstage(0.50,0.58);   // a lane only carries traffic once it's PAVED (outer lanes open first)
    if((((i*2246822519+1)>>>0)/4294967296) > rhythm.carPresence*growPop*laneOn) continue;
    var dir=LANE[c.lane].d, cwx=cwxAll[i];
    if(nukeHit(cwx)) continue;                                         // the heat wave has reached this car — vaporized (until then it keeps driving)
    // EARLY CULL: if this car can't reach this screen's slice even after queueing, skip the queue math
    var cxr=cwx-WOFF; if(cxr>SW+CARM&&cxr-WW>-CARM) cxr-=WW; if(cxr<-CARM&&cxr+WW<SW+CARM) cxr+=WW;
    if(cxr<-CARM||cxr>SW+CARM) continue;
    var drawx=cwx;
    for(var k=0;k<redCW.length;k++){ var cwK=redCW[k];
      // stop line: 2px in front of the 9px zebra (centre ±4), on the side the car approaches from
      var stopLine=cwK.x-dir*6;
      // gap from this car's NOSE to the stop line. >0 → still approaching (queue). ≤0 → nose already at/past
      // the line, i.e. the car is IN the box → let it clear instead of freezing mid-intersection.
      var gap=(((stopLine-noseWX(cwx,dir)+WW*1.5)%WW)-WW*0.5)*dir;
      if(gap>0 && gap<STOPZ){                                          // approaching a red — queue up short of the zebra
        var rank=0;
        for(var j=0;j<cars.length;j++){ if(j===i||cars[j].lane!==c.lane) continue;
          var oa=(((stopLine-noseWX(cwxAll[j],dir)+WW*1.5)%WW)-WW*0.5)*dir;
          if(oa>0 && oa<gap) rank++; }
        // park the NOSE at the stop line (each car behind backs off one body length), then nose→left-anchor
        drawx=wrapW(stopLine-(dir>0?CARLEN:0)-dir*rank*(CARLEN+2)); break; }
    }
    if(crash && c.lane===crash.lane){ var rel=(drawx-crash.x)*crash.dir;
      if(rel<7 && rel>-jamLen) continue; }                             // absorbed into the wreck/queue
    // DISASTER blocks the road: the blast zone is cleared (fled/wrecked) and cars pile up on the approaches
    if(curDis && disDestroys(curDis.type) && curDis.f>=0.06 && curDis.f<0.55){
      var dzone=(curDis.w>>1)+8, appr=(((curDis.x-noseWX(cwx,dir)+WW*1.5)%WW)-WW*0.5)*dir;   // >0: impact ahead
      if(appr>-dzone && appr<dzone) continue;                          // inside the impact → gone
      if(appr>=dzone && appr<dzone+34){ var jr=0;                      // approaching → jam up behind the cordon
        for(var dj=0;dj<cars.length;dj++){ if(dj===i||cars[dj].lane!==c.lane) continue;
          var oaj=(((curDis.x-noseWX(cwxAll[dj],dir)+WW*1.5)%WW)-WW*0.5)*dir;
          if(oaj>=dzone && oaj<appr) jr++; }
        drawx=wrapW(curDis.x-dir*dzone-(dir>0?CARLEN:0)-dir*jr*(CARLEN+2)); }
    }
    if(curWar&&curWar.f>=0.18&&curWar.f<1){ var wcx=drawx-curWar.x; if(wcx>WW/2)wcx-=WW; if(wcx<-WW/2)wcx+=WW;
      if(Math.abs(wcx)<70) continue; }                                 // streets are cleared through the battle front
    var cx=drawx-WOFF;
    if(cx>SW+12&&cx-WW>-12) cx-=WW; if(cx<-12&&cx+WW<SW+12) cx+=WW;
    if(cx<-11||cx>SW+11) continue;
    if(curPolicies.carfree) continue;                                 // CAR-FREE STREETS (voted): private cars are gone this term
    drawCar(g, cx, HORIZON+LANE[c.lane].o, c.c, dir, L, c.kind);
  }

  // a city bus on a schedule (long, lit windows) — public transit crossing the whole world
  // bus ROUTES — each line has its own livery + timetable, added one by one as the city grows
  var BUSR=[["#3f7fbf","#2b5f95",26000,0.030,0],["#3aa864","#277a46",31000,0.028,9000],["#e0883a","#a05f24",37000,0.032,17000]];
  for(var brt=0;brt<BUSR.length;brt++){ var RB=BUSR[brt];
    if(cityG<0.45+brt*0.08 || (!apocPositional() && apocKill>0.3)) continue;   // non-positional deaths suspend service; nuke/meteors take each bus as the wave/impact reaches it
    var bus=crosser(now+RB[4], (curMayor&&curMayor.party.k==="TRANSIT")?(RB[2]*0.65)|0:RB[2], RB[3], 20, 0.86);
    if(bus && !nukeHit(bus.x)) drawBus(g, bus.x, bus.dir, L, now, RB[0], RB[1]);
  }
  // two-wheelers weave through the traffic once the town has real roads (motos, scooters, bicycles)
  if(cityG>0.4 && (apocPositional() || apocKill<0.4)){
    var BIKES=[["moto",21000,0.052,0],["bicycle",27000,0.030,6000],["scooter",24000,0.040,12000],
      ["bicycle",31000,0.028,18000],["moto",29000,0.056,24000],["scooter",34000,0.038,30000]];
    for(var bki=0;bki<BIKES.length;bki++){ var BK=BIKES[bki];
      if(fx.snow||fx.thunder) continue;                                  // fair-weather riders
      var bk=crosser(now+BK[3], BK[1], BK[2], 8, 0.8);
      if(bk && !nukeHit(bk.x)) drawBike(g, bk.x, bk.dir, L, now, BK[0]);
    }
  }
  if(curPolicies.carfree && cityG>0.35 && (apocPositional()||apocKill<0.4)){   // CAR-FREE: a light-rail tram glides through + people reclaim the asphalt
    var tram=crosser(now, 30000, 0.03, 26, 0.82);
    if(tram && !nukeHit(tram.x)) drawBus(g, tram.x, tram.dir, L, now, "#3aa864", "#1f6b3e");   // green light-rail livery reads as a tram
    for(var pf=0;pf<9;pf++){ var phh=((pf*2654435761+97)>>>0), plane=(phh&1)?1:2;
      var prx=((phh%WW)+Math.floor(now/900)*LANE[plane].d*3), psx=((((prx%WW)+WW)%WW)-WOFF);
      if(psx>SW+4&&psx-WW>-4)psx-=WW; if(psx<-4&&psx+WW<SW+4)psx+=WW; if(psx<-2||psx>SW+2) continue;
      drawPerson(g,psx|0,HORIZON+LANE[plane].o,PEDC[pf%PEDC.length],SKINC[(pf*3)%SKINC.length],(Math.floor(now/300)+pf)&1); }
  }

  // ambient emergency vehicle on a loose schedule (races the road, siren strobing)
  var em=(cityG>0.5)?crosser(now, curOutbreak?42000:95000, 0.019, 11, 0.55):null;   // sirens double during the outbreak
  if(em && !nukeHit(em.x)) drawEmv(g, em.x, EMV_TYPES[em.idx%EMV_TYPES.length], em.dir, em.dir>0?1:2, L, now);

  // ---- traffic incident: wreck + growing jam + smoke, then EMS responds & clears ----
  if(crash && !nukeHit(crash.x)){
    var cyL=HORIZON+LANE[crash.lane].o, wX=crash.x-WOFF;
    var vis=[wX]; if(wX-WW>-60) vis.push(wX-WW); if(wX+WW<SW+60) vis.push(wX+WW);
    for(var vi=0;vi<vis.length;vi++){ var WX=vis[vi]; if(WX<-60||WX>SW+60) continue;
      g.fillStyle="rgba(12,12,16,0.5)"; g.fillRect((WX-crash.dir*9)|0,cyL+1,11,1);        // skid marks
      for(var qi=1;qi<=qn;qi++){ var qx=WX-crash.dir*(8+qi*13); if(qx<-12||qx>SW+12) continue;  // queued cars
        drawCar(g, qx, cyL, ["#8a8f9a","#b0553f","#4a70b0","#c9b24a","#7a5aa0","#cfd6e0"][qi%6], crash.dir, L); }
      var aX=WX, bX=WX+crash.dir*7;                                                        // the two crumpled cars
      drawCar(g, aX, cyL, crash.col, -crash.dir, L);                                       // nose-to-nose into the wreck
      drawCar(g, bX, cyL, "#c85030", crash.dir, L);
      g.fillStyle="rgba(30,30,38,0.92)"; g.fillRect((WX+(crash.dir>0?7:1))|0,cyL-1,2,3);   // crumple
      if(crash.tp<600){ g.globalCompositeOperation="lighter"; var fa=1-crash.tp/600;       // impact flash
        g.fillStyle=rgba([255,232,150],0.85*fa); g.fillRect((WX-3)|0,cyL-3,13,6); g.globalCompositeOperation="source-over"; }
      if((Math.floor(now/350))%2===0){ g.fillStyle="#ff9a2a"; g.fillRect(aX|0,cyL-2,1,1); g.fillRect((bX+6)|0,cyL-2,1,1); }  // hazards
      if(crash.tp>800 && crash.tp<crash.arrive+crash.work){                                // smoke while unattended
        for(var sm=0;sm<3;sm++){ var st2=(now*0.02+sm*130+crash.idx*30)%64, sy2=cyL-1-st2*0.45;
          g.fillStyle="rgba(66,68,76,"+(0.4*(1-st2/64))+")"; g.fillRect((WX+2+Math.sin(now*0.003+sm)*2)|0,sy2|0,2,2); } }
    }
    var leave=crash.arrive+crash.work, emsWX;
    if(crash.tp<crash.arrive) emsWX=crash.x-crash.dir*(12+(crash.arrive-crash.tp)*0.05);  // en route from behind
    else if(crash.tp<=leave)  emsWX=crash.x-crash.dir*9;                                   // parked, working
    else                      emsWX=crash.x+crash.dir*((crash.tp-leave)*0.045);            // departing
    drawEmv(g, emsWX, crash.et, crash.dir, crash.lane, L, now);
  }

  // steam curling up from the manholes (drifts over the road)
  if(cityG>0.4 && !nukeFull()) drawSteam(g,now,night,L);

  // everyday emergencies — and the city ANSWERS them
  if(cityG>0.55&&cityPhase!=="apoc"&&!curDis){
    var crime=crimeNow(now); if(crime) drawCrime(g,crime,L,now);
    var fire=fireNow(now);   if(fire)  drawFireIncident(g,fire,L,now);
  }

  // ---- pedestrian signals at each crosswalk ---- (only once there are paved roads to signal)
  var SLC=[[255,51,68],[255,204,51],[51,221,85]];   // red, yellow, green
  if(cityG>0.38) for(i=0;i<crosswalks.length;i++){ var cs=crosswalks[i], csx=cs.x-WOFF;
    if(!cwInst(cs)) continue;
    if(nukeHit(cs.x)) continue;                          // the blast takes out the traffic signals too
    for(var wrp=-1;wrp<=1;wrp++){ var CX=(csx+wrp*WW)|0; if(CX<-6||CX>SW+6) continue;
      var stt=sig(now,cs.ph), litIdx=(stt===2?0:stt===1?1:2), pole=CX+6;
      g.fillStyle=L>0.5?"#2a2d36":"#0c0d14"; g.fillRect(pole,HORIZON-7,1,9);              // pole
      g.fillStyle=L>0.5?"#1c1e26":"#07070d"; g.fillRect(pole-1,HORIZON-8,3,4);            // housing
      g.fillStyle=css(SLC[litIdx]); g.fillRect(pole,HORIZON-7+litIdx,1,1);               // lit lamp
      if(L<0.62){ g.globalCompositeOperation="lighter"; g.fillStyle=rgba(SLC[litIdx],0.5*night+0.2);
        g.fillRect(pole-1,HORIZON-8+litIdx,3,3); g.globalCompositeOperation="source-over"; }
    }
  }

  // ---- pedestrians strolling the sidewalk (crowd size varies by district, hour & weather) ----
  for(i=0;i<peds.length;i++){ var pd=peds[i];
    var jog=((i%9)===4 && !wmood.wet && !wmood.snow);          // ~1 in 9 is a jogger — faster & athletic (not in the rain)
    var pwx=wrapW(pd.x0+pd.dir*pd.sp*(jog?2.1:1)*KSP*wmood.speedK*now), pdist=districtAt(pwx).name;
    if(inSea(pwx)&&roadFNow()<0.85) continue;                  // nobody strolls over open water before the causeway
    var fleeing=false;
    if(curDis){ var fdx=pwx-curDis.x; if(fdx>WW/2)fdx-=WW; if(fdx<-WW/2)fdx+=WW;
      if(Math.abs(fdx)<90){ fleeing=true;                        // PANIC: run AWAY from the disaster, fast
        pwx=wrapW(pwx + (fdx>=0?1:-1)*(now%4000)*0.03); } }
    else if(cityPhase==="apoc"){
      if(curDeath==="nuke"){                                     // the nuke: run from ground zero, then vaporize as the heat wave hits
        var gzP=nukeGZX(now), dP=nukeDist(pwx,gzP), frP=nukeFrontR();
        if(frP>=dP){ var vsx=pwx-WOFF; if(vsx>SW+4&&vsx-WW>-4)vsx-=WW; if(vsx<-4&&vsx+WW<SW+4)vsx+=WW;   // the wave reached them → gone in a flash
          var vpt=(frP-dP)/(WW*0.03);
          if(vpt<1&&vsx>-3&&vsx<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,240,200,"+(1-vpt)+")"; g.fillRect(vsx|0,HORIZON-3,2,3); g.globalCompositeOperation="source-over"; }
          continue; }
        fleeing=true; var awayD=((((pwx-gzP)%WW+WW*1.5)%WW)-WW*0.5)>=0?1:-1;
        pwx=wrapW(pwx+awayD*(now%4000)*0.045); }
      else if(curDeath==="meteors"){                            // meteors: panic through the streets, vaporize in a flash when a strike/front reaches them
        var mcp=meteorCollapse(pwx,now);
        if(mcp.cl>=0){ var vsx2=pwx-WOFF; if(vsx2>SW+4&&vsx2-WW>-4)vsx2-=WW; if(vsx2<-4&&vsx2+WW<SW+4)vsx2+=WW;
          var vpt2=mcp.cl;
          if(vpt2<0.6&&vsx2>-3&&vsx2<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,208,150,"+(1-vpt2/0.6)+")"; g.fillRect(vsx2|0,HORIZON-3,2,3); g.globalCompositeOperation="source-over"; }
          continue; }                                            // struck → gone
        fleeing=true; pwx=wrapW(pwx + pd.dir*(now%4000)*0.045); }   // still alive → run
      else if(curDeath==="sunburst"){                           // sunburst: flee the baking heat, then combust when the solar firestorm ignites them
        var scp=sunCl(pwx);
        if(scp>=0){ var vsx3=pwx-WOFF; if(vsx3>SW+4&&vsx3-WW>-4)vsx3-=WW; if(vsx3<-4&&vsx3+WW<SW+4)vsx3+=WW;
          if(scp<0.6&&vsx3>-3&&vsx3<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(255,150,60,"+(1-scp/0.6)+")"; g.fillRect(vsx3|0,HORIZON-3,2,3); g.globalCompositeOperation="source-over"; }
          continue; }                                            // ignited → gone in a flash
        fleeing=true; pwx=wrapW(pwx + pd.dir*(now%4000)*0.04); }   // still alive → flee the heat
      else if(curDeath==="ai"){                                 // AI: flee the takeover, then get DIGITIZED (uploaded) when the assimilation front converts them
        var acp=frontCollapse(pwx,aiFrontR());
        if(acp>=0){ var vsx4=pwx-WOFF; if(vsx4>SW+4&&vsx4-WW>-4)vsx4-=WW; if(vsx4<-4&&vsx4+WW<SW+4)vsx4+=WW;
          if(acp<0.6&&vsx4>-3&&vsx4<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle=(Math.floor(now/80)&1)?"rgba(255,60,90,"+(1-acp/0.6)+")":"rgba(120,200,255,"+(1-acp/0.6)+")"; g.fillRect(vsx4|0,HORIZON-3,2,3); g.globalCompositeOperation="source-over"; }
          continue; }                                            // converted → gone
        fleeing=true; var awayA=((((pwx-apocEpiX(now))%WW+WW*1.5)%WW)-WW*0.5)>=0?1:-1; pwx=wrapW(pwx+awayA*(now%4000)*0.04); }
      else if(curDeath==="bh"){                                 // BLACK HOLE: no escape — helplessly dragged toward the singularity, then stretched & sucked in
        var bcp=frontCollapse(pwx,bhFrontR());
        var toH=((((apocEpiX(now)-pwx)%WW+WW*1.5)%WW)-WW*0.5);   // signed vector toward the hole's ground point
        if(bcp>=0){ var vsx5=pwx-WOFF; if(vsx5>SW+4&&vsx5-WW>-4)vsx5-=WW; if(vsx5<-4&&vsx5+WW<SW+4)vsx5+=WW;
          if(bcp<0.7&&vsx5>-3&&vsx5<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(180,150,255,"+(1-bcp/0.7)+")"; g.fillRect(vsx5|0,(HORIZON-3-bcp*6)|0,1,(4+bcp*6)|0); g.globalCompositeOperation="source-over"; }   // stretched streak lifting toward the hole
          continue; }                                            // sucked in → gone
        fleeing=true; pwx=wrapW(pwx + (toH>=0?1:-1)*(now%4000)*0.03); }   // sliding toward it
      else if(curDeath==="alienwar"){                            // alien war: flee the crossfire, then vaporize in an energy flash when a stray strike rakes them
        var wcp=alienCl(pwx);
        if(wcp>=0){ var vsx6=pwx-WOFF; if(vsx6>SW+4&&vsx6-WW>-4)vsx6-=WW; if(vsx6<-4&&vsx6+WW<SW+4)vsx6+=WW;
          if(wcp<0.6&&vsx6>-3&&vsx6<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle=(pwx&1)?"rgba(120,220,255,"+(1-wcp/0.6)+")":"rgba(255,130,60,"+(1-wcp/0.6)+")"; g.fillRect(vsx6|0,HORIZON-3,2,3); g.globalCompositeOperation="source-over"; }
          continue; }                                            // struck → gone
        fleeing=true; pwx=wrapW(pwx + pd.dir*(now%4000)*0.04); }
      else if(curDeath==="frost"){                               // deep freeze: flee the cold, then freeze SOLID (an ice-blue statue) where the freeze catches them
        var frp=frostCl(pwx);
        if(frp>=0){ var vsx7=pwx-WOFF; if(vsx7>SW+4&&vsx7-WW>-4)vsx7-=WW; if(vsx7<-4&&vsx7+WW<SW+4)vsx7+=WW;
          if(vsx7>-3&&vsx7<SW+3){ g.fillStyle="rgba("+(150+80*frp)+","+(190+50*frp)+",255,"+(0.5+0.5*Math.min(1,frp))+")"; g.fillRect(vsx7|0,HORIZON-4,2,4); }   // frozen where they stood
          continue; }
        fleeing=true; pwx=wrapW(pwx + pd.dir*(now%4000)*0.038); }
      else if(curDeath==="kaiju"){                               // kaiju: flee the rampage, then get stomped/swept when the beast reaches them
        var gzK=apocEpiX(now), dK=nukeDist(pwx,gzK), frK=kaijuFrontR();
        if(frK>=dK){ continue; }                                 // the rampage reached them → gone
        fleeing=true; var awayK=((((pwx-gzK)%WW+WW*1.5)%WW)-WW*0.5)>=0?1:-1; pwx=wrapW(pwx+awayK*(now%4000)*0.045); }   // run from the monster
      else if(curDeath==="flood"){                               // flood: run for high ground, then be swept away when the water reaches them
        if(floodGroundHit(pwx)){ var vsx8=pwx-WOFF; if(vsx8>SW+4&&vsx8-WW>-4)vsx8-=WW; if(vsx8<-4&&vsx8+WW<SW+4)vsx8+=WW;
          if(vsx8>-3&&vsx8<SW+3){ g.globalCompositeOperation="lighter"; g.fillStyle="rgba(120,170,210,0.6)"; g.fillRect(vsx8|0,(HORIZON-floodLevel())|0,2,2); g.globalCompositeOperation="source-over"; }   // a splash at the waterline
          continue; }                                            // swept under → gone
        fleeing=true; pwx=wrapW(pwx + pd.dir*(now%4000)*0.04); }
      else if(curDeath==="kaijuwar"){                            // kaiju war: flee whichever titan is closer; gone once the battle reaches them
        if(kwCl(pwx,now)>=0){ continue; }                        // trampled / caught in the melee → gone
        var tA=kwTitanX(now,0), tB=kwTitanX(now,1);
        var nearT=(nukeDist(pwx,tA)<=nukeDist(pwx,tB))?tA:tB;
        fleeing=true; var awayW=((((pwx-nearT)%WW+WW*1.5)%WW)-WW*0.5)>=0?1:-1; pwx=wrapW(pwx+awayW*(now%4000)*0.045); }
      else if(curDeath==="pollution"){                           // pollution: no running from the air — masked residents shuffle, ever fewer
        if((((i*40503+13)>>>0)%1000)/1000 < apocKill) continue;  // this one has succumbed / stayed inside
        var psx=pwx-WOFF; if(psx>SW+4&&psx-WW>-4)psx-=WW; if(psx<-4&&psx+WW<SW+4)psx+=WW;
        if(psx>-3&&psx<SW+3){ var pbb=(psx+((now*0.0016)|0))&1;                     // slow, heavy steps
          drawPerson(g, psx, HORIZON-1+pd.row, "#5a564e", pd.sk, pbb);              // drab, dust-caked clothes
          g.fillStyle="#e8e4da"; g.fillRect(psx|0,(HORIZON-1+pd.row-pbb-3)|0,2,1); }  // breathing mask
        continue; }
      else if(cityApoc>0.08){ fleeing=true;                      // any other (future) endtimes: EVERYONE runs
        pwx=wrapW(pwx + pd.dir*(now%4000)*0.03); } }
    else if(curWar&&curWar.f>=0.2&&curWar.f<1){ var wdx=pwx-curWar.x; if(wdx>WW/2)wdx-=WW; if(wdx<-WW/2)wdx+=WW;
      if(Math.abs(wdx)<110){ fleeing=true; pwx=wrapW(pwx+(wdx>=0?1:-1)*(now%4000)*0.03); } }
    var keep=wmood.pedFactor*districtBusy(pdist,rhythm.hour)*growPop;     // fewer in quiet districts/hours + a young city
    if(curOutbreak) keep*=0.6;                                            // N5: people stay home
    if((((i*2654435761+977)>>>0)/4294967296) >= keep) continue;           // >= so keep=0 really means NOBODY (hash of i=0 is 0)
    var px=pwx-WOFF;
    if(px>SW+4&&px-WW>-4) px-=WW; if(px<-4&&px+WW<SW+4) px+=WW;
    if(px<-3||px>SW+3) continue;
    var bob=fleeing?((Math.floor(now/90)+i)&1):((px+((now*0.004)|0))&1), prow=HORIZON-1+pd.row, cloth=pd.c;
    var hh6=nowDate().getHours();
    if(gameNight(nowDate())&&hh6>=17&&hh6<23&&(i%4)===0) cloth=teamCols[i%2];   // fans heading to the game
    if(fleeing){ drawPerson(g, px, prow, cloth, pd.sk, bob);
      g.fillStyle=pd.sk; g.fillRect((px-2)|0,(prow-bob-3)|0,1,1); g.fillRect((px+3)|0,(prow-bob-3)|0,1,1);   // arms thrown up
      continue; }
    if(wmood.cold) cloth=["#3a4a5a","#5a3a3a","#3a3a44","#4a4a3a","#4a3a2a"][i%5];   // winter coats
    if(jog){ cloth=["#ff5a5a","#4affc0","#ffd23a","#5aa8ff"][i%4]; bob=(Math.floor(now/90)+i)&1; }   // bright athletic wear, fast stride
    drawPerson(g, px, prow, cloth, pd.sk, bob);
    if(jog){ g.fillStyle=["#ff2a6a","#2affc0","#ffe23a","#2a8aff"][i%4]; g.fillRect((px+(pd.dir>0?0:1))|0,(prow-bob-4)|0,1,1);   // sweatband
      g.fillStyle=pd.sk; g.fillRect((px+(pd.dir>0?3:-2))|0,(prow-bob-1)|0,1,1); }                                              // arm pumping forward
    if(curOutbreak&&(i&1)){ g.fillStyle="#eef2f6"; g.fillRect(px|0,(prow-bob-3)|0,2,1); }   // N5: masked up
    if(wmood.cold){ g.fillStyle=["#d23","#38c","#dd3","#eee","#c05a8a"][i%5]; g.fillRect(px|0,(prow-bob-5)|0,2,1); }   // knit hat
    else if((i%11)===3){ g.fillStyle=["#5a4028","#2a2c34","#c9b284"][i%3]; g.fillRect((px-1)|0,(prow-bob-5)|0,4,1); } // brimmed hat
    if((i%13)===5){ g.fillStyle=["#6a4a2a","#2a3c5c","#7a2e2e"][i%3]; g.fillRect((px+(pd.dir>0?2:-2))|0,(prow-bob+1)|0,1,2); }   // bag/case
    if(wmood.wet||wmood.snow) drawUmbrella(g, px, prow-bob-4, UMB[i%UMB.length]);       // umbrella up
    else if(wmood.hot && (i%5)<2) drawSunShade(g, px, prow-bob-4);                      // ~40% shield from the sun
    if(pdist==="residential" && (i%6)===2){                              // a parent pushing a stroller
      var stx=(px+pd.dir*3)|0, sty=HORIZON+pd.row;
      g.fillStyle="#d2d2dc"; g.fillRect(stx,sty-2,3,2);
      g.fillStyle=["#e88a8a","#8ab8e8","#e8c88a"][i%3]; g.fillRect(stx,sty-3,3,1);    // canopy
      g.fillStyle="#222"; g.fillRect(stx,sty,1,1); g.fillRect(stx+2,sty,1,1);         // wheels
    }
    if((i%7)===0){                                       // ~1 in 7 is walking a little dog on a leash
      var dxp=(px+pd.dir*3)|0, dyp=HORIZON+1+pd.row, wag=((now*0.006+i)|0)&1;
      g.fillStyle="rgba(150,150,160,0.5)"; g.fillRect((px+pd.dir)|0,HORIZON+pd.row,1,1); g.fillRect((px+pd.dir*2)|0,HORIZON+pd.row,1,1);  // leash
      g.fillStyle=["#8a6a4a","#c9c9d2","#3a3a44","#b5824a"][i%4];
      g.fillRect(dxp,dyp,2,1); g.fillRect(dxp+(pd.dir>0?2:-1),dyp-1,1,1);          // body + head
      g.fillRect(dxp+(pd.dir>0?-1:2),dyp-wag,1,1);                                  // wagging tail
    }
  }

  drawTicker(g,L,now,night);                   // the downtown LED news band
  // (newspaper flurry removed 2026-07-12 — user found the sky papers weird/unclear; the LED ticker still narrates events)
  // the mature city drips with extra shopfront neon (neon-family eras only)
  if(cityEra.neon&&L<0.5&&cityG>0.85){ var nDrawn=0;
    for(var nz=0;nz<near.blds.length&&nDrawn<14;nz++){ var zb2=near.blds[nz];
      if(zb2.type==="park"||zb2.awning<0||((zb2.seed>>>3)%3)===0) continue;
      if(zb2.bAge!==undefined && cityG-zb2.bAge<=bandOf(zb2)) continue;
      var zbx=(zb2.x-WOFF)|0; if(zbx>SW+4||zbx+zb2.w<-4) continue; nDrawn++;
      var znc=NEON[zb2.awning%NEON.length], zdx=zbx+(zb2.w>>1);
      g.fillStyle=znc; g.fillRect(zdx-2,HORIZON-9,5,2);
      g.globalCompositeOperation="lighter"; g.fillStyle=rgba(hex2rgb(znc),0.25);
      g.fillRect(zdx-3,HORIZON-10,7,4); g.globalCompositeOperation="source-over";
    } }
  // buskers + gathered crowds on the neon strip (evenings, once there's an entertainment district)
  if(cityG>0.55 && !nukeFull()) drawBuskers(g,L,now,districtBusy("neon",rhythm.hour));

  // pigeons pecking on the sidewalk / perched on the wires
  if(!nukeFull()) drawPigeons(g,now,L);
  // === all the ambient LIFE / animals / spectacles below are wiped out once the blast wave has swept the city — no survivors ===
  if(!nukeFull()){
  drawPowerPlant(g,L,now,night);
  drawSeaFog(g,L,now,nd,fx);
  drawLanternFest(g,L,now);
  drawRegatta(g,L,now,nd);
  drawSongbirds(g,L,now);
  drawVignettes(g,L,now,nd);
  drawFamily(g,L,now,nd);
  drawFamilyLegacy(g,L,now,nd);
  drawSideShows(g,L,now,nd);
  drawLighthouse(g,L,now,fx);
  if(!nukeFull()) drawFishingFleet(g,L,now,nd);   // fishermen + boats + gulls — gone once the wave sweeps the harbour
  drawNightMarket(g,L,now,nd);
  drawPerformers(g,L,now,nd);
  drawFestivals(g,L,now,nd);
  drawAftermath(g,L,now,nd);
  drawPets2(g,L,now,nd);
  drawSportsDay(g,L,now,nd);
  drawHail(g,L,now,fx);
  if(wmood.hot) drawShimmer(g,L,now);
  drawCruise(g,L,now,night);
  drawBlkCrew(g,L,now);
  if(!nukeStruck()) drawGulls(g,L,now);          // K/J/M batch: coast, meadow & street spectacles (gulls killed by the flash)
  drawFlora(g,L,now,nd);
  drawFauna(g,L,now,nd);
  drawCows(g,L,now,nd);
  drawWhale(g,L,now);
  drawUFO(g,L,now,nd);
  drawProfessions(g,L,now,nd);
  drawIceCream(g,L,now,nd);
  drawCats(g,L,now,nd);
  drawSax(g,L,now,nd);
  drawPremiere(g,L,now,nd);
  drawCapsule(g,L,now);
  drawBlimpMishap(g,L,now);
  drawFireflies(g,nd,L,now);   // warm summer nights: fireflies drift low over the parks & fields
  }   // end blast-wipe of ambient life/spectacles

  // ---- pedestrians walking to/from building entrances (deterministic per building) ----
  // a lobby's foot-traffic: someone approaches the door and fades inside, or emerges & walks off.
  for(i=0;i<near.blds.length;i++){ var eb=near.blds[i];
    if(eb.type==="park"||!eb.entr||eb.w<10) continue;
    if(nukeHit(eb.x)) continue;                                // the lobby's foot-traffic is gone when the front hits this building
    if(eb.bAge!==undefined && cityG-eb.bAge<0.06) continue;    // only occupied once the building is built
    var eedw=Math.min(eb.w-4,3+((eb.w/6)|0)), doorX=eb.x+((eb.w-eedw)>>1)+((eedw/2)|0);
    var NWK=1+Math.min(3,((eb.w*eb.h)/900)|0);       // bigger buildings breathe more people
    for(var wk2=0;wk2<NWK;wk2++){
      var EPER=15000, tW2=now+wk2*521, ecyc=Math.floor(tW2/EPER), er=rng(((i+7)*2654435761 ^ (ecyc+wk2*104729))>>>0);
      if(curEcon<0.35 && ((i%4)===0)) break;         // recession: this lobby's gone dark (FOR LEASE)
      if(er()<(hol.decor?0.15:0.40)) continue;       // busier lobbies on holidays (people out decorating)
      var goingIn=er()<0.5, eside=er()<0.5?1:-1;
      var epc=PEDC[(er()*PEDC.length)|0], esk=SKINC[(er()*SKINC.length)|0];
      var etph=tW2-ecyc*EPER, EWALK=2800; if(etph>EWALK) continue;
      var eprog=etph/EWALK, farX=doorX+eside*(9+wk2*3), epx, ealpha;
      if(goingIn){ epx=lerp(farX,doorX,eprog); ealpha=eprog>0.82?Math.max(0,1-(eprog-0.82)/0.18):1; }
      else       { epx=lerp(doorX,farX,eprog); ealpha=eprog<0.18?eprog/0.18:1; }
      var ebob=((etph>>8)&1);
      for(var ew2=-1;ew2<=1;ew2++){ var EPX=epx-WOFF+ew2*WW; if(EPX<-3||EPX>SW+3) continue;
        g.globalAlpha=ealpha; drawPerson(g, EPX, HORIZON-1, epc, esk, ebob); g.globalAlpha=1; }
    }
  }

  // ---- pedestrians crossing during the walk phase (cars are stopped, so it's clear) ----
  // (needs real crosswalks — before the town paves its roads there is nobody to cross them)
  if(cityG>0.38) for(i=0;i<crosswalks.length;i++){ var cw2=crosswalks[i];
    if(!cwInst(cw2)) continue;
    if(nukeHit(cw2.x)) continue;                               // these walkers are gone once the front reaches their crossing
    var tt=(now+cw2.ph)%12000;
    if(tt<9000){                                              // green for cars — but a brave few jaywalk when it's clear
      var jcyc=Math.floor((now+cw2.ph)/12000);
      if(((((cw2.seed^jcyc)*2654435761)>>>0)%100)<18 && tt>3200 && tt<4700){
        var clear=true;
        for(var jc=0;jc<cars.length;jc++){ var dxj=cwxAll[jc]-cw2.x; if(dxj<0)dxj=-dxj; if(dxj>WW/2)dxj=WW-dxj;
          if(dxj<26){ clear=false; break; } }
        if(clear){ var jp=(tt-3200)/1500, jdir=(cw2.seed&1)?1:-1;
          var jy=jdir>0?lerp(HORIZON-1,HORIZON+23,jp):lerp(HORIZON+23,HORIZON-1,jp);
          for(var jw=-1;jw<=1;jw++){ var JX=cw2.x-WOFF+jw*WW+2; if(JX<-3||JX>SW+3) continue;
            drawPerson(g,JX,jy,PEDC[cw2.seed%PEDC.length],SKINC[cw2.seed%SKINC.length],(Math.floor(tt/120))&1); } }   // running
      }
      continue; }
    var cyc=Math.floor((now+cw2.ph)/12000), rr=rng((cw2.seed+cyc*7919)>>>0);
    var nP=(rr()<0.9)?(1+((rr()*3)|0)):0;                                  // 0–3 people cross this cycle
    for(var pp=0;pp<nP;pp++){
      var off=150+rr()*500, upDir=rr()<0.5?1:-1, lo=((rr()*7)|0)-3,
          pc=PEDC[(cw2.seed+pp*5)%PEDC.length], sk=SKINC[(cw2.seed+pp)%SKINC.length];
      var wt=tt-9000-off; if(wt<0||wt>1800) continue;
      var prog=wt/1800, py=upDir>0?lerp(HORIZON-1,HORIZON+23,prog):lerp(HORIZON+23,HORIZON-1,prog);
      var bob=(((prog*8)|0)&1), c2x=cw2.x-WOFF+lo;
      for(var wp3=-1;wp3<=1;wp3++){ var CX2=c2x+wp3*WW; if(CX2<-3||CX2>SW+3) continue;
        drawPerson(g, CX2, py, pc, sk, bob); }
    }
  }

  // ---- calendar events (special days) — need a town to hold them ----
  if(curEvents && cityG>0.45 && !nukeFull()){
    if(curEvents.movie)    drawMovie(g,L,now,night);      // outdoor cinema in the plaza
    if(curEvents.market)   drawMarket(g,L,now);           // weekend farmers' market stalls
    if(curEvents.marathon) drawMarathon(g,L,now);         // a river of runners
    if(curEvents.parade)   drawParade(g,L,now);           // floats + marching band + confetti
    if(curEvents.protest)  drawProtest(g,L,now);          // a day-of-action march with placards
    if(curEvents.film)     drawFilmShoot(g,L,now);        // a film crew shooting downtown
  }
  // ---- invented CITY holidays (whimsical spectacles unique to this world) ----
  if(cityG>0.4 && !nukeFull()){
    if(hol.lantern)  drawLanterns(g,L,now);               // Lantern Night — paper lanterns rise into the dark
    if(hol.kite)     drawKites(g,L,now);                  // Kite Festival — kites bob over the daytime city
    if(hol.founders) drawParade(g,L,now);                 // Founders' Day — a parade down the boulevard
    if(hol.harvest)  drawMarket(g,L,now);                 // Harvest Fair — the market in full swing
  }

  // ---- DISASTER overlay: the threat + the city's military/emergency response + alert HUD ----
  // (the destruction/rubble/rebuild of the buildings themselves is handled in drawLayer)
  if(curDis){ drawDisaster(g,curDis,L,now); drawDisasterHud(g,curDis,now); }
  if(curWar) drawWar(g,L,now,night);                         // the war for the city plays out on top
  if(cityG>0.5) drawElections(g,L,now,night);                // democracy in the streets
  if(cityG>0.45) drawCorpAds(g,L,now,night);                 // street billboards for the current companies (corporate ad presence)

  // ---- THE GRAND CATACLYSM ends the city's life every ~month, then it's reborn as wilderness ----
  if(cityApoc>0) drawApocalypse(g,cityApoc,L,now);

  // weather + holidays (local to each screen — no need to line up)
  if(fx.rain||fx.drizzle||fx.thunder){
    var groundY=(HORIZON+GROUND)|0;
    // wet sheet over the scene: a bright grey haze by DAY (stays light, just wet/overcast),
    // a dark cool gloom by NIGHT — so a rainy afternoon doesn't turn pitch-dark
    if(L>0.5){ g.fillStyle="rgba(150,162,182,"+(fx.thunder?0.16:0.10)+")"; g.fillRect(0,0,SW,SH); }
    else     { g.fillStyle="rgba(40,52,74,"+(fx.thunder?0.14:0.09)+")"; g.fillRect(0,0,SW,HORIZON); }  // night: cool mist on the sky only — never darken the street further
    g.fillStyle=fx.freezing?"rgba(170,205,240,0.13)":"rgba(120,150,190,0.08)"; g.fillRect(0,HORIZON+3,SW,GROUND-3);   // puddle sheen (icier when freezing)
    if(fx.freezing){                                                                        // FREEZING rain/drizzle: everything glazes over
      g.fillStyle="rgba(190,220,250,0.07)"; g.fillRect(0,0,SW,SH);                          // cold glassy cast over the whole scene
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(210,235,255,0.10)"; g.fillRect(0,HORIZON+3,SW,2);                    // hard glint line where the ice sheet starts
      var gl=Math.floor(now/700);                                                            // slow sparkle: stray glints on the glazed road
      for(var gi=0;gi<Math.round(SW/26);gi++){ var gh=((gi*2654435761+gl)>>>0);
        if(gh%5===0){ g.fillStyle="rgba(235,248,255,0.7)"; g.fillRect(gh%SW,HORIZON+3+((gh>>>9)%Math.max(2,GROUND-4)),1,1); } }
      g.globalCompositeOperation="source-over";
    }
    if(L<0.5){ g.globalCompositeOperation="lighter";                                      // night: the wet road MIRRORS the city light
      g.fillStyle="rgba(90,110,160,0.10)"; g.fillRect(0,HORIZON+3,SW,GROUND-3);
      g.fillStyle="rgba(140,160,210,0.07)"; g.fillRect(0,HORIZON+3,SW,((GROUND-3)/2)|0);
      g.globalCompositeOperation="source-over"; }
    if(!fx.drizzle){ g.fillStyle=(L>0.5?"rgba(198,206,218,":"rgba(150,170,205,")+(fx.thunder?0.11:0.08)+")";
      g.fillRect(0,(HORIZON-6)|0,SW,GROUND+6); }
    // REAL RAIN: wind-slanted streaks in three depth layers. Far rain is short/faint/slow,
    // near rain is long/bright/fast, and the whole field leans with the wind (with slow gusts),
    // so it reads as falling water, not drifting dots. Pure function of the clock per layer →
    // no per-drop state; deterministic on every screen.
    var windK=Math.min(1,(weather.wind||8)/38);                          // 0..1 how windy it is
    var gustK=(weather.gust!=null)?Math.min(1,Math.max(0,weather.gust-(weather.wind||0))/25):0.3;   // how gusty vs steady (real gust − mean)
    var gust=(Math.sin(now*0.00042)*0.5+Math.sin(now*0.00117)*0.25)*(0.7+0.9*gustK);   // gustier air → the rain sways harder
    var lean=(0.28+0.85*windK)*(1+0.35*gust);                            // x-drift per px of fall (wind from the west)
    var precipK=(weather.precip!=null&&weather.precip>0)?Math.max(0.6,Math.min(1.9,0.6+weather.precip/3)):1;   // real precip mm → drop density
    var mult=(fx.drizzle?0.5:(fx.thunder?1.5:1))*precipK;                // a drizzle is sparse; a downpour is dense — matched to reality
    if(fx.violent) mult=Math.max(mult,1.4);                              // code 82 "violent showers" must read harder than steady heavy rain
    // depth layers: [share of SW as drop count, fall px/ms, streak len, alpha scale]
    var RL=[[0.55,0.16,3,0.42],[0.5,0.24,5,0.65],[0.4,0.34,8,1.0]];      // far, mid, near
    if(L<0.4) g.globalCompositeOperation="lighter";                      // at night the rain catches the city light
    for(var rl=0;rl<3;rl++){
      var lay=RL[rl], N=Math.max(10,(SW*lay[0]*mult)|0), spd=lay[1]*(fx.drizzle?0.55:1), dl=lay[2];
      var fall=(now*spd)%groundY, drift=now*spd*lean;                    // this layer's shared descent + wind drift
      var aa1=(fx.thunder?0.4:0.32)*lay[3], aa2=(fx.thunder?0.78:0.62)*lay[3];
      if(L<0.4){ aa1*=0.8; aa2*=0.85; }
      var tailC=L>0.5?"rgba(112,132,168,":"rgba(174,196,232,",     // day: darker streaks against the bright sky
          headC=L>0.5?"rgba(180,198,225,":"rgba(226,240,255,";
      if(L>0.5){ aa1*=1.25; aa2*=1.15; }
      for(i=0;i<N;i++){
        // well-mixed hashes of (layer,i) → scattered positions, not a lattice
        var h=((i*2654435761+rl*40503+12345)>>>0); h^=h>>>15; h=(h*2246822519)>>>0; h^=h>>>13; h=(h*3266489917)>>>0; h^=h>>>16;
        var hx=(h>>>0)/4294967296, h2=(h*668265263+0x9e3779b9)>>>0; h2^=h2>>>15; h2=(h2*2246822519)>>>0; h2^=h2>>>13;
        var hy=(h2>>>0)/4294967296;
        // each drop lands at its own depth on the street (front drops land low, far drops high)
        var land=HORIZON+2+((h>>>7)%Math.max(2,(GROUND-3)|0));
        var yy=(hy*land+fall)%land;
        var bx=(hx*(SW+60)-30+drift)%(SW+60); if(bx<0)bx+=SW+60; bx-=30;  // drops also travel sideways with the wind
        // slanted streak, drawn as pixel steps from the head back up along the wind angle
        g.fillStyle=tailC+aa1+")";
        for(var sgm=1;sgm<=dl;sgm+=2){ var sx3=(bx-lean*sgm)|0, sy3=(yy-sgm)|0; if(sy3<0) break; g.fillRect(sx3,sy3-1,1,2); }
        g.fillStyle=headC+aa2+")"; g.fillRect(bx|0,yy|0,1,1);            // bright leading head
        if(rl>0 && yy>=land-2 && splashes.length<110 && ((i+(Math.floor(now/90)))%5===0))   // splash where it strikes the road
          splashes.push({x:bx|0,y:land-1,t:0,big:rl===2});
      }
    }
    g.globalCompositeOperation="source-over";
    // splash ripples on the wet ground (little expanding ticks)
    for(i=splashes.length-1;i>=0;i--){ var s=splashes[i]; s.t+=dt*0.02;
      if(s.t>=1){ splashes.splice(i,1); continue; }
      var rr=(s.big?3:2)*s.t, aa=0.5*(1-s.t);
      g.strokeStyle="rgba(198,220,248,"+aa+")"; g.lineWidth=1; g.beginPath();
      g.moveTo((s.x-rr)|0,s.y|0); g.lineTo((s.x-rr*0.4)|0,(s.y-1)|0);
      g.moveTo((s.x+rr)|0,s.y|0); g.lineTo((s.x+rr*0.4)|0,(s.y-1)|0); g.stroke();
      if(s.t<0.35){ g.fillStyle="rgba(220,235,255,"+(0.7*(1-s.t/0.35))+")"; g.fillRect(s.x|0,(s.y-1)|0,1,1); }
    }
    wetness=Math.min(1,wetness+dt*0.00004);
  } else { if(splashes.length) splashes.length=0; wetness=Math.max(0,wetness-dt*0.000008); }

  if(fx.snow){
    var flkN=fx.grains?140:230, flkV=fx.grains?0.55:1;                   // code 77 snow grains: fine, slow, sparse — never a blizzard
    while(flakes.length<flkN) flakes.push({x:Math.random()*SW,y:Math.random()*SH,v:(0.3+Math.random()*0.6)*flkV,ph:Math.random()*6,s:fx.grains?1:(Math.random()<0.3?2:1)});
    if(flakes.length>flkN) flakes.length=flkN;
    g.fillStyle="rgba(170,196,232,0.10)"; g.fillRect(0,0,SW,SH);       // cold blue cast
    for(i=0;i<flakes.length;i++){ var f=flakes[i]; f.y+=f.v*dt*0.06; f.x+=Math.sin(now*0.001+f.ph)*0.4-dt*0.004*(weather.wind||5)*0.2;
      if(f.y>HORIZON+2){f.y=-3;f.x=Math.random()*SW;}
      g.fillStyle=f.s>1?"rgba(250,252,255,0.95)":"rgba(238,244,255,0.85)"; g.fillRect(f.x|0,f.y|0,f.s,f.s); }
    snowpack=Math.min(1,snowpack+dt*0.000008);
  } else { if(flakes.length) flakes.length=0; snowpack=Math.max(0,snowpack-dt*0.0000015); }

  var fogTarget=fx.fog?0.92:0; fog.t+=(fogTarget-fog.t)*0.002*dt;
  if(fog.t>0.01){ for(i=0;i<4;i++){ var fy=HORIZON*0.6+i*18, drift=Math.sin(now*0.0001*(i+1))*24;
      var fbA=fog.t*(0.30-i*0.05), fbY=(fy+drift*0.2)|0;
      g.fillStyle="rgba(198,204,214,"+fbA+")"; g.fillRect(0,fbY,SW,36);
      g.fillStyle="rgba(198,204,214,"+(fbA*0.5)+")"; g.fillRect(0,fbY-1,SW,1); g.fillRect(0,fbY+36,SW,1); }  // 2px alpha-feathered top+bottom edges
    var fogPeak=fog.t*0.45, fogG=g.createLinearGradient(0,HORIZON*0.85,0,SH);
    fogG.addColorStop(0,"rgba(188,194,208,0)"); fogG.addColorStop(0.5,"rgba(188,194,208,"+fogPeak+")"); fogG.addColorStop(1,"rgba(188,194,208,0)");
    g.fillStyle=fogG; g.fillRect(0,(HORIZON*0.85)|0,SW,SH*0.5); }

  // ---- WILDFIRE SMOKE (real air quality): a warm grey-amber veil driven by live PM2.5.
  // Ambience, not a disaster: no HUD alert, coexists with any weather. ≤20 µg/m³ = nothing;
  // ~35 light haze; ~100 heavy; ≥200 the sky goes apocalyptic orange (2023-Canada style).
  // Pure function of the shared fetched value + clock → identical on every screen.
  var smokeF=(airq.pm25!=null)?Math.max(0,Math.min(1,(airq.pm25-20)/180)):0;
  if(curDis&&curDis.type==="smog") smokeF*=0.3;              // the smog DISASTER owns the look locally — don't stack to mud
  if(smokeF>0.01){
    var smDay=L>0.5;
    // full-sky wash: warm smoke grey by day, sodium-brown by night (borrowed from the smog palette)
    g.fillStyle=smDay?("rgba(168,132,72,"+(0.10+0.34*smokeF)+")"):("rgba(84,64,38,"+(0.10+0.30*smokeF)+")");
    g.fillRect(0,0,SW,SH);
    // thicker band hugging the skyline — smoke settles low (gradient: builds from nothing up top to full low down)
    var wfA=smDay?(0.10+0.26*smokeF):(0.10+0.22*smokeF), wfCol=smDay?[150,112,60]:[66,50,30];
    var wfY0=HORIZON*0.4, wfY1=HORIZON+GROUND, wfG=g.createLinearGradient(0,wfY0,0,wfY1);
    wfG.addColorStop(0,rgba(wfCol,0)); wfG.addColorStop(1,rgba(wfCol,wfA));
    g.fillStyle=wfG; g.fillRect(0,wfY0|0,SW,(wfY1-wfY0)|0);
    if(smokeF>0.55){                                          // heavy smoke: an extra hot-orange cast up high
      g.globalCompositeOperation="lighter";
      g.fillStyle="rgba(230,120,30,"+(0.05+0.14*(smokeF-0.55)/0.45)+")"; g.fillRect(0,0,SW,(HORIZON*0.6)|0);
      g.globalCompositeOperation="source-over";
    }
    // drifting soot motes (hash-deterministic, clock-driven; count scales with quality tier)
    var moteN=Math.round((QUAL===0?12:24)*smokeF);
    g.fillStyle=smDay?"rgba(120,96,60,0.5)":"rgba(48,38,24,0.6)";
    for(var smi=0;smi<moteN;smi++){ var smh=((smi*2654435761+77)>>>0);
      var smx=((smh%(SW+40))+now*(0.004+((smh>>>8)%10)*0.0008))%(SW+40)-20;
      var smy=((smh>>>12)%(HORIZON+GROUND))+Math.sin(now*0.0006+smi)*3;
      g.fillRect(smx|0,smy|0,1,1); }
  }

  if(fx.thunder){ if(now>lightNext){ lightning=1; lightNext=now+2000+Math.random()*7000; lboltX=Math.random()*SW; }
    if(lightning>0){ g.fillStyle="rgba(240,245,255,"+(lightning*0.7)+")"; g.fillRect(0,0,SW,SH);
      if(lightning>0.7){ g.strokeStyle="rgba(255,255,255,0.9)"; g.beginPath();
        var bx3=lboltX, by3=0; g.moveTo(bx3,by3);
        for(var seg=0;seg<6;seg++){ bx3+=(Math.random()-0.5)*10; by3+=HORIZON/6; g.lineTo(bx3|0,by3|0); }
        g.stroke(); }
      lightning-=dt*0.008; } }

  // festive overlays celebrate at EVERY life stage (wilderness→metropolis) but fall silent while the city is dying
  var festive=(cityPhase!=="apoc");
  if(festive && hol.halloween&&L<0.5){ g.fillStyle="#0a0a12";
    for(i=0;i<bats.length;i++){ var b2=bats[i]; var bwx=wrapW(b2.x0+b2.sp*now), b2x=bwx-WOFF;
      if(b2x<-6&&b2x+WW<SW+6) b2x+=WW; if(b2x>SW+6&&b2x-WW>-6) b2x-=WW; if(b2x<-6||b2x>SW+6) continue;
      var fl2=Math.sin(b2.ph+now*0.02)>0?1:0;
      g.fillRect(b2x|0,b2.y|0,1,1); g.fillRect((b2x-2)|0,(b2.y-fl2)|0,2,1); g.fillRect((b2x+1)|0,(b2.y-fl2)|0,2,1); } }

  // birthday: banner over the city + celebratory fireworks and floating hearts
  if(festive && hol.bday){
    drawBanner(g, hol.bday, now, night, hol.bdayPink);
    if(L<0.4 && Math.random()<0.02) spawnFirework();
    if(Math.random()<0.03) fwx.push({parts:[{x:Math.random()*WW,y:SH*0.82,vx:0,vy:-0.24,
      c:hol.bdayPink?"#ff5aa0":"#5ac8ff",life:4200,heart:true}]});
  }

  if(festive) drawFireworksShow(g,now,nd,L);           // the timetable show: July 3-5 + NYE, finale waves included
  if(festive && hol.valentine&&L<0.6&&Math.random()<0.02)
    fwx.push({parts:[{x:Math.random()*WW,y:SH*0.8,vx:0,vy:-0.25,c:"#ff5aa0",life:4000,heart:true}]});
  stepFireworks(g,dt);

  // solar-eclipse twilight: an unnatural cool dusk falls over the whole city at totality, then lifts
  if(solarEclDim>0.01){ var ev=Math.pow(solarEclDim,1.7)*0.74; g.fillStyle="rgba(18,20,40,"+ev+")"; g.fillRect(0,0,SW,SH); }

  // ash-out veil: whites/greys everything at the height of the cataclysm and as wilderness re-emerges,
  // masking the hard wrap from a fallen city back to the newborn wilderness of the next life
  if(apocVeil>0.01){ g.fillStyle="rgba(34,28,26,"+(0.96*apocVeil)+")"; g.fillRect(0,0,SW,SH);
    for(var af=0;af<48;af++){ var ax=((af*97+now*0.03)%SW), ay=((af*53+now*0.05)%SH);
      g.fillStyle="rgba(140,128,120,"+(0.55*apocVeil)+")"; g.fillRect(ax|0,ay|0,1,1); } }   // drifting ash

  drawSkyClock(g,nd,L);   // local time & date in the sky, top-centre of every monitor
  drawCivicHud(g,now,night);   // who runs the city + approval + mandates + next-vote countdown, top-right
}
