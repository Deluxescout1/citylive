#!/usr/bin/env node
// Read a machine's perflog (and, on Windows, the Get-Counter CSV beside it) and say plainly whether
// it met the budget: ≤5% of TOTAL CPU, ≤250 MB.
//
// ⚠⚠ THE WHOLE REASON THIS IS A TOOL AND NOT A GLANCE AT THE FILE: `percentCPUUsage` is a percentage
// of ALL CORES on Linux and a percentage of ONE CORE on Windows. Same Electron, same field. Reading
// the Windows file with the Linux convention turned a real ~3.1% of total CPU into "5.36%" — the
// difference between passing and failing. So the convention is applied per-platform here, once, with
// the reasoning written down, instead of being re-derived by eye every time.
//
// ⚠ And memory has the same shape of trap: summing per-process working sets counts shared pages once
// per process. On Linux the honest figure is PSS; on Windows it is `Working Set - Private`, which
// only Get-Counter can supply. The sum is reported too, clearly labelled, because it is the only
// figure available everywhere — never as the headline.
//
// Usage:  node tools/surface-report.js <perflog.ndjson> [getcounter.csv]

const fs = require('fs');

const BUDGET_CPU_TOTAL_PCT = 5;
const BUDGET_MEM_MB = 250;

function readNdjson(p) {
  return fs.readFileSync(p, 'utf8').trim().split('\n')
    .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean);
}

function readCounterCsv(p) {
  if (!p || !fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map((s) => s.replace(/"/g, '').trim());
  const iCpu = head.findIndex((h) => /cpu/i.test(h));
  const iMem = head.findIndex((h) => /priv/i.test(h));
  const iAt = head.findIndex((h) => /^at$|time/i.test(h));
  return lines.slice(1).map((l) => {
    const c = l.split(',').map((s) => s.replace(/"/g, '').trim());
    return { at: iAt >= 0 ? new Date(c[iAt]) : null, cpuOneCore: parseFloat(c[iCpu]), privMB: parseFloat(c[iMem]) };
  }).filter((r) => isFinite(r.cpuOneCore));
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// The one piece of platform knowledge in this file, isolated so it is impossible to apply by accident.
function toTotalCpuPct(rawSum, cores, platform) {
  if (platform === 'win32') return rawSum / cores;   // raw is % of ONE core
  return rawSum;                                     // raw is already % of ALL cores (verified on Linux)
}

function main() {
  const [logPath, csvPath] = process.argv.slice(2);
  if (!logPath) { console.error('usage: surface-report.js <perflog.ndjson> [getcounter.csv]'); process.exit(2); }
  const rows = readNdjson(logPath);
  const machine = rows.find((r) => r.kind === 'machine');
  const samples = rows.filter((r) => r.kind === 'sample').slice(1);   // drop the first: needs an interval to mean anything
  const marks = rows.filter((r) => r.kind === 'mark');
  if (!machine || !samples.length) { console.error('no usable samples in ' + logPath); process.exit(2); }

  const cores = machine.cpuCount || 1;
  const platform = machine.platform;
  const counter = readCounterCsv(csvPath);

  console.log('MACHINE');
  console.log('  ' + machine.cpuModel);
  console.log('  ' + cores + ' logical cores · ' + machine.totalMemMB + ' MB RAM · ' + platform + ' ' + machine.release);
  console.log('  CityLive ' + machine.appVersion + ' · Electron ' + machine.electron);
  for (const d of machine.displays || []) {
    console.log('  display ' + d.w + 'x' + d.h + ' @ ' + d.scale + 'x  (work area ' + d.workW + 'x' + d.workH + ')' + (d.primary ? ' primary' : ''));
  }

  const drawing = samples.filter((r) => !r.suspended);
  const covered = samples.filter((r) => r.suspended > 0);

  console.log('\nCPU  (raw is % of ' + (platform === 'win32' ? 'ONE core on Windows' : 'ALL cores on Linux') + ' — see the header)');
  const show = (label, set) => {
    if (!set.length) { console.log('  ' + label.padEnd(22) + 'no samples'); return null; }
    const raw = avg(set.map((r) => r.rawSum));
    const total = toTotalCpuPct(raw, cores, platform);
    console.log('  ' + label.padEnd(22) + 'raw ' + raw.toFixed(2).padStart(6) +
                '   → ' + total.toFixed(2).padStart(6) + '% of TOTAL CPU   (n=' + set.length + ')');
    return total;
  };
  const drawTotal = show('drawing', drawing);
  const covTotal = show('desktop covered', covered);

  // The independent instrument. If this and the app disagree by more than a little, believe neither
  // until you know why — that disagreement is exactly what caught the platform difference.
  if (counter.length) {
    const cOneCore = avg(counter.map((r) => r.cpuOneCore));
    const cTotal = cOneCore / cores;
    console.log('\n  cross-check (Get-Counter, Windows\' own accounting, whole run):');
    console.log('    ' + cOneCore.toFixed(2) + '% of one core → ' + cTotal.toFixed(2) + '% of TOTAL CPU');
    if (isFinite(drawTotal)) {
      const ratio = drawTotal / cTotal;
      const agree = ratio > 0.6 && ratio < 1.6;
      console.log('    app/counter ratio ' + ratio.toFixed(2) + (agree ? '  ✓ the two instruments agree' :
        '  ✗ THEY DISAGREE — do not trust either number until you know why'));
      if (!agree) {
        const alt = (platform === 'win32' ? drawTotal * cores : drawTotal / cores) / cTotal;
        console.log('    (with the OTHER convention the ratio would be ' + alt.toFixed(2) + ')');
      }
    }
  } else if (platform === 'win32') {
    console.log('\n  ⚠ no Get-Counter CSV supplied — the CPU figure above rests on ONE instrument.');
  }

  console.log('\nMEMORY');
  const pss = samples.map((r) => r.pssMB).filter((v) => v != null);
  const wsSum = avg(samples.map((r) => r.wsSumMB));
  if (counter.length) {
    const priv = avg(counter.map((r) => r.privMB));
    console.log('  private working set   ' + priv.toFixed(1).padStart(7) + ' MB   ← the honest Windows figure');
  }
  if (pss.length) console.log('  PSS                   ' + avg(pss).toFixed(1).padStart(7) + ' MB   ← the honest Linux figure');
  console.log('  sum of working sets   ' + wsSum.toFixed(1).padStart(7) + ' MB   ← OVER-COUNTS shared pages, never the headline');

  const memHeadline = counter.length ? avg(counter.map((r) => r.privMB)) : (pss.length ? avg(pss) : wsSum);
  const memSource = counter.length ? 'private working set' : (pss.length ? 'PSS' : 'sum of working sets (over-counts!)');

  console.log('\nGUARD EVENTS');
  if (!marks.length) console.log('  none recorded');
  for (const m of marks) {
    if (m.label === 'tier') console.log('  ' + m.at + '  tier → ' + m.tier + ' (' + m.reason + '; ' + m.why + ')');
    if (m.label === 'suspend') console.log('  ' + m.at + '  display ' + m.display + ' → ' + (m.suspended ? 'SUSPENDED' : 'resumed'));
  }

  console.log('\nVERDICT  (budget: ≤' + BUDGET_CPU_TOTAL_PCT + '% of TOTAL CPU, ≤' + BUDGET_MEM_MB + ' MB)');
  const cpuPass = isFinite(drawTotal) && drawTotal <= BUDGET_CPU_TOTAL_PCT;
  const memPass = isFinite(memHeadline) && memHeadline <= BUDGET_MEM_MB;
  console.log('  CPU while DRAWING     ' + (isFinite(drawTotal) ? drawTotal.toFixed(2) + '%' : '?').padStart(8) + '   ' + (cpuPass ? 'PASS' : 'FAIL'));
  if (isFinite(covTotal)) console.log('  CPU while covered     ' + (covTotal.toFixed(2) + '%').padStart(8) + '   ' + (covTotal <= BUDGET_CPU_TOTAL_PCT ? 'PASS' : 'FAIL'));
  console.log('  memory (' + memSource + ') ' + (isFinite(memHeadline) ? memHeadline.toFixed(1) + ' MB' : '?').padStart(6) + '   ' + (memPass ? 'PASS' : 'FAIL'));
  if (!covered.length) {
    console.log('\n  ⚠ NO COVERED SAMPLES — the guard never fired during this run, so the single biggest');
    console.log('    saving is UNVERIFIED on this machine. Re-run and maximise a window for a few minutes.');
  }
  console.log('\n  overall: ' + (cpuPass && memPass && covered.length ? 'PASS' : 'NOT PROVEN'));
}

main();
