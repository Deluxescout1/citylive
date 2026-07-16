// Scaling + battle-bars verification harness.
// Env: CLW/CLH = window size, CLOUT = output png, CLDIS = force a monster disaster,
// CLERA = force a named era (engine ERAS[].name; unrecognized name → guarded no-op,
// stays live), CLDISF = disaster frequency (not renderable in a single static
// capture — accepted for symmetry with the app's settings but intentionally skipped),
// CLWEATHER = force a weather code (pins FORCEWX, see wfx() in city.js for the code
// table), CLAQ = force a PM2.5 air-quality value (pins FORCEAQ; drives drawSmokeVeil),
// CLNOW = force the render clock to a specific ms-since-epoch (pins NOWOVR, for
// deterministic renders). All four compose with CLDIS/CLERA above.
// (Env, not argv: Electron main's process.argv contains Chromium switches.)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
const W = parseInt(process.env.CLW || '1280', 10);
const H = parseInt(process.env.CLH || '720', 10);
const OUT = process.env.CLOUT || path.join(__dirname, 'scale.png');
const DIS = process.env.CLDIS || '';
const ERA = process.env.CLERA || '';
const AGE = (process.env.CLAGE && isFinite(+process.env.CLAGE)) ? +process.env.CLAGE : 1;  // city maturity 0..1 (village ~0.12)
const WEATHER = process.env.CLWEATHER || '';
const AQ = process.env.CLAQ || '';
const NOW = process.env.CLNOW || '';
// CLDISF (disaster frequency) is intentionally not wired to any renderable effect here —
// it only affects how OFTEN disasters occur over real time, which a single-frame static
// capture can't demonstrate. Read (so it doesn't silently no-op if someone sets it) and skipped.
if (process.env.CLDISF) console.log('CLDISF set (' + process.env.CLDISF + ') — skipped, not renderable in a static capture');

// Frozen-precip weather codes (drizzle/rain-freeze, snow grains, snow showers, hail) get a
// below-freezing temp so wfx() derives its freezing/hail/grains/violent flags consistently
// with the forced code; everything else gets a mild default.
const FROZEN_WX_CODES = ['56', '57', '66', '67', '71', '73', '75', '77', '85', '86'];

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, useContentSize: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.once('did-finish-load', () => {
    const eraJs = ERA
      ? `try{ var _i=ERAS.findIndex(function(e){return e.name==='${ERA}';}); if(_i>=0) FORCEERA=_i; }catch(e){}; `
      : '';
    const wxCode = WEATHER ? parseInt(WEATHER, 10) : NaN;
    const weatherJs = isFinite(wxCode)
      ? `FORCEWX={code:${wxCode},cloud:90,wind:18,temp:${FROZEN_WX_CODES.indexOf(String(wxCode)) >= 0 ? 28 : 62},precip:2.5,feels:null,gust:30}; `
      : '';
    const aqPm25 = AQ ? parseFloat(AQ) : NaN;
    const aqJs = isFinite(aqPm25) ? `FORCEAQ={pm25:${aqPm25},aqi:${aqPm25 * 2}}; ` : '';
    const nowMs = NOW ? parseInt(NOW, 10) : NaN;
    const nowJs = isFinite(nowMs) ? `NOWOVR=${nowMs}; ` : '';
    const overrideJs = eraJs + weatherJs + aqJs + nowJs;
    const js = DIS
      ? `${overrideJs}FORCEDIS={type:'${DIS}',intensity:4,xf:0.5,w:60,seed:77,f:0.25}; FORCEAGE=${AGE}; 'ok'`
      : `${overrideJs}FORCEAGE=${AGE}; 'ok'`;
    win.webContents.executeJavaScript(js).then(() => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(OUT, img.toPNG());
          console.log('CAPTURE_OK ' + OUT);
        } catch (e) { console.log('CAPTURE_FAIL ' + e); }
        app.quit();
      }, 2000);
    }).catch((e) => { console.log('JS_FAIL ' + e); app.quit(); });
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 20000);
