// CityLive — performance telemetry.
//
// 🔑 WHY THIS EXISTS: the target machine is a cheap Windows laptop, and the machine this project is
// developed on is a 28-thread i7-14700K. Every performance number in this repo's history was taken on
// the i7, where 40% of ONE core is 1.4% of the machine. On a 4-core Surface the same build is ~10% of
// the whole CPU, continuously, forever. A number from the dev box — or from the win11 VM, which runs
// ON the dev box — says nothing about the Surface.
//
// 🔑 SO THE INSTRUMENT SHIPS INSIDE THE APP. Rather than hand-driving perfmon on a machine we may only
// briefly have, the app self-reports over a long window and we read the file afterwards. This is the
// same reason `CITYLIVE_WP_TESTRECT` exists: a harness that cannot express the case cannot verify the
// fix, and a machine we cannot sit in front of cannot be measured by sitting in front of it.
//
// ⚠⚠ WHAT `percentCPUUsage` ACTUALLY MEANS — MEASURED, BECAUSE THE OBVIOUS READING IS WRONG.
// Electron's docs and most of the internet describe it as a percentage of ONE core. On this build
// (Electron 33.4.11, Linux) it is NOT: measured against /proc over the same window, the app reported
// 0.27 while /proc said 7.55% of one core on a 28-core box — 7.55/28 = 0.27. It is already a
// percentage of the WHOLE CPU. Had that gone unchecked, dividing by the core count "to be safe" would
// have made a Surface read 4x worse than reality, and taking it at face value as one-core would have
// made it read 4x better. Both wrong, in opposite directions, and neither visible without a second
// opinion.
// 🔑 SO EVERY SAMPLE CARRIES A SECOND OPINION. `raw` is exactly what Electron said, `cores` is the
// divisor in play, and `mainCpuPct` is the main process's cost computed independently from Node's own
// `process.cpuUsage()` (microseconds of CPU, unambiguous, cross-platform). The reader can then check
// the raw number against a known-good one ON THE MACHINE THAT PRODUCED IT, rather than trusting a
// semantics guess made on a different OS. This matters because the finding above is a LINUX finding
// and the target is Windows.
//
// Off unless asked for: `--perflog`, `CITYLIVE_PERFLOG=1`, or config `perfLog: true`.

const fs = require('fs');
const os = require('os');
const path = require('path');

let timer = null;
let stream = null;
let filePath = null;
let started = 0;
let sampleCount = 0;
let stateFn = null;          // supplied by main.js: returns {quality, windows, suspended, ...}

const SAMPLE_MS = 5000;      // 5 s — fine enough to see a tier change, coarse enough to cost nothing
const MAX_BYTES = 8 * 1024 * 1024;   // never let diagnostics fill a small laptop's disk

function enabled(argv, env, cfg) {
  if (argv && argv.includes('--perflog')) return true;
  if (env && (env.CITYLIVE_PERFLOG === '1' || env.CITYLIVE_PERFLOG === 'true')) return true;
  if (cfg && cfg.perfLog === true) return true;
  return false;
}

// One-time facts about the machine. Without these a row of CPU percentages is unreadable: 6% means
// something completely different on 4 cores than on 28, and that ambiguity is the whole reason the
// existing notes cannot answer "does this run on a laptop".
function machineInfo(app, screenMod) {
  const cpus = os.cpus() || [];
  const info = {
    kind: 'machine',
    at: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    cpuModel: (cpus[0] && cpus[0].model) || 'unknown',
    cpuCount: cpus.length || 1,
    cpuSpeedMHz: (cpus[0] && cpus[0].speed) || 0,
    totalMemMB: Math.round(os.totalmem() / 1048576),
    freeMemMB: Math.round(os.freemem() / 1048576),
    appVersion: (() => { try { return app.getVersion(); } catch (e) { return '?'; } })(),
    electron: process.versions.electron || '?',
    chrome: process.versions.chrome || '?'
  };
  try {
    info.displays = screenMod.getAllDisplays().map((d) => ({
      id: d.id, w: d.bounds.width, h: d.bounds.height,
      workW: d.workArea.width, workH: d.workArea.height,
      scale: d.scaleFactor, primary: d.id === screenMod.getPrimaryDisplay().id
    }));
  } catch (e) { info.displays = []; }
  return info;
}

// A single sample. `getAppMetrics()` is the only cross-platform way to get per-process CPU and memory
// for an Electron app from inside itself, and it attributes cost to the GPU process separately — which
// matters here, because most of a wallpaper's cost is raster/upload/composite, not our JavaScript.
// Independent CPU accounting for THIS (main) process, from Node rather than Chromium. Microseconds
// of CPU time, so there is no percentage convention to get wrong — the only interpretation is
// "CPU-seconds per wall-second", which divided by the core count is unambiguously % of the whole CPU.
let lastCpuUsage = null, lastCpuAt = 0;
function mainCpuPct(cores) {
  try {
    const now = Date.now();
    const cur = process.cpuUsage();
    if (!lastCpuUsage) { lastCpuUsage = cur; lastCpuAt = now; return null; }
    const elapsedMs = now - lastCpuAt;
    if (elapsedMs <= 0) return null;
    const usedMs = ((cur.user - lastCpuUsage.user) + (cur.system - lastCpuUsage.system)) / 1000;
    lastCpuUsage = cur; lastCpuAt = now;
    return Math.round((usedMs / elapsedMs / cores) * 10000) / 100;   // % of the whole CPU
  } catch (e) { return null; }
}

// True combined footprint, where the OS will tell us. `smaps_rollup` gives PSS — each shared page
// charged proportionally to the processes sharing it — which is the only sum of Chromium processes
// that means anything. Linux only; returns null elsewhere, where the Windows equivalent (private
// working set, via `Get-Counter '\Process(CityLive*)\Working Set - Private'`) has to be read from
// outside the app.
function pssTotal(procs) {
  if (process.platform !== 'linux') return null;
  let total = 0, got = 0;
  for (const p of procs) {
    try {
      const txt = fs.readFileSync('/proc/' + p.pid + '/smaps_rollup', 'utf8');
      const m = /^Pss:\s+(\d+)\s*kB/m.exec(txt);
      if (m) { total += parseInt(m[1], 10); got++; }
    } catch (e) { /* process gone mid-sample */ }
  }
  return got ? Math.round(total / 1024) : null;
}

function sample(app) {
  let metrics = [];
  try { metrics = app.getAppMetrics() || []; } catch (e) { metrics = []; }
  const cores = (os.cpus() || []).length || 1;
  const procs = metrics.map((m) => ({
    type: m.type,
    pid: m.pid,
    // EXACTLY what Electron said. Not scaled, not reinterpreted — see the header note.
    raw: Math.round(((m.cpu && m.cpu.percentCPUUsage) || 0) * 100) / 100,
    // working set is the number that matters against an 8 GB budget
    wsMB: Math.round(((m.memory && m.memory.workingSetSize) || 0) / 1024),
    peakMB: Math.round(((m.memory && m.memory.peakWorkingSetSize) || 0) / 1024)
  }));
  const rawSum = procs.reduce((a, p) => a + p.raw, 0);
  const mainPct = mainCpuPct(cores);
  const mainRaw = (procs.find((p) => p.type === 'Browser') || {}).raw;
  const row = {
    kind: 'sample',
    t: Math.round((Date.now() - started) / 1000),
    at: new Date().toISOString(),
    cores: cores,
    // 🔑 RAW, PLUS THE MEANS TO CHECK IT. `rawSum` is Electron's number summed over every process.
    // On Linux/Electron 33 that is already % of the whole CPU, verified against /proc. `mainPct` is
    // the same quantity for the main process alone, computed from process.cpuUsage() — so
    // `mainPct` vs `mainRaw` calibrates the convention on whatever machine wrote the file.
    rawSum: Math.round(rawSum * 100) / 100,
    mainPct: mainPct,
    mainRaw: mainRaw == null ? null : mainRaw,
    // ⚠⚠ THIS NUMBER OVER-COUNTS AND IT NEARLY PRODUCED A FALSE ALARM. Summing per-process working
    // sets counts every page Chromium's processes SHARE once per process — the executable, the ICU
    // tables, the shared V8 snapshot. Measured both ways on Linux: the sum of working sets was 578 MB
    // while the true footprint (PSS, which splits shared pages between their sharers) was 168 MB.
    // An empty Electron window with nothing in it measures 502 MB by the same bad method and 111 MB
    // by the good one. Quoting the sum would have declared the app 2.3x over a budget it actually
    // passes. It is kept because it is the only figure available on every platform — but `pssMB`
    // below is the one to believe wherever it is present.
    wsSumMB: procs.reduce((a, p) => a + p.wsMB, 0),
    pssMB: pssTotal(procs),
    freeMemMB: Math.round(os.freemem() / 1048576),
    load1: Math.round((os.loadavg()[0] || 0) * 100) / 100,
    procs: procs
  };
  if (stateFn) { try { Object.assign(row, stateFn() || {}); } catch (e) { /* state must never break the log */ } }
  return row;
}

function write(obj) {
  if (!stream) return;
  try {
    stream.write(JSON.stringify(obj) + '\n');
    if (stream.bytesWritten > MAX_BYTES) stop();     // diagnostics must not fill a small disk
  } catch (e) { /* best effort */ }
}

// `getState` lets main.js stamp every sample with what the app was DOING — which quality tier, how many
// wallpaper windows, how many of them suspended. Without it a drop in CPU is unattributable, and the
// whole point is to prove WHICH change bought the saving.
function start(app, opts) {
  const o = opts || {};
  if (timer) return filePath;
  try {
    const dir = o.dir || app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    filePath = path.join(dir, 'perflog.ndjson');
    stream = fs.createWriteStream(filePath, { flags: 'a' });
  } catch (e) { stream = null; return null; }
  started = Date.now();
  sampleCount = 0;
  stateFn = o.getState || null;
  write({ kind: 'session', at: new Date().toISOString(), note: o.note || '', argv: process.argv.slice(1) });
  try { write(machineInfo(app, require('electron').screen)); } catch (e) { /* headless */ }
  // The first sample is discarded by the reader anyway (Electron's CPU percentages are cumulative
  // averages that need one interval to mean anything), but log it so the file starts at t=0.
  timer = setInterval(() => { sampleCount++; write(sample(app)); }, o.intervalMs || SAMPLE_MS);
  if (timer.unref) timer.unref();      // never hold the app open just to log
  console.log('[citylive] perflog → ' + filePath);
  return filePath;
}

function mark(label, extra) {
  write(Object.assign({ kind: 'mark', at: new Date().toISOString(), label: String(label || '') }, extra || {}));
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (stream) { try { stream.end(); } catch (e) {} stream = null; }
}

function currentPath() { return filePath; }

module.exports = { enabled, start, stop, mark, currentPath, sample, machineInfo };
