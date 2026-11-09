#!/usr/bin/env node
// =============================================================================
// fresh-user smoke: run the documented quickstarts LITERALLY, as a new user would.
//
// The commands are NOT copied into this file or into the workflow. They are read,
// at run time, out of the fenced block under the named heading of each doc, and
// the expected exit codes and counts are read out of the prose next to the block.
// So when a README changes, this smoke runs the new text; when the prose stops
// stating an expectation this script knows how to check, the smoke fails (docs
// drift is a failure, not a skip).
//
// Each documented line is written verbatim into a script for the named shell and
// executed in a brand-new empty directory outside the checkout. The only thing
// added between lines is an exit-code check. One harness step is inserted after
// the documented `git clone` when SMOKE_CHECKOUT_SHA is set: it moves the fresh
// clone to the commit under test (a PR's head), so a PR is smoked against its own
// docs and tree rather than against main. It is logged as a harness step.
//
//   node scripts/fresh-user-smoke.mjs --shell bash          (bash | zsh | pwsh | powershell | cmd)
//   node scripts/fresh-user-smoke.mjs --list                print what would run, run nothing
//
// No install, no dependencies: node 18+ built-ins only.
// =============================================================================
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Which docs carry a quickstart, and under which heading. Everything else comes
// from the doc itself.
export const DOCS = [
  { file: 'README.md', heading: '## Re-derivation commands' },
  { file: 'verify/README.md', heading: '## Quickstart' },
];

// --- extraction -------------------------------------------------------------

/** The section under `heading`: its first fenced block, and the prose after it. */
export function extractSection(text, heading, file = '<doc>') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`${file}: heading "${heading}" not found`);
  let end = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end);
  const open = body.findIndex((l) => /^```/.test(l));
  if (open < 0) throw new Error(`${file}: no fenced block under "${heading}"`);
  const close = body.findIndex((l, i) => i > open && /^```\s*$/.test(l));
  if (close < 0) throw new Error(`${file}: unterminated fenced block under "${heading}"`);
  const commands = body.slice(open + 1, close).filter((l) => l.trim() !== '');
  if (commands.length === 0) throw new Error(`${file}: empty fenced block under "${heading}"`);
  // Prose = the paragraph(s) after the block, up to the next fenced block.
  const rest = body.slice(close + 1);
  const nextFence = rest.findIndex((l) => /^```/.test(l));
  const before = body.slice(0, open).join(' ');
  const after = (nextFence < 0 ? rest : rest.slice(0, nextFence)).join(' ');
  return { commands, before, prose: after.replace(/\s+/g, ' ') };
}

/** A backticked expectation like `not found: … (x)` → the literal pieces around the ellipsis. */
const pieces = (s) => s.split('…').map((p) => p.trim()).filter(Boolean);

/** Turn the prose next to the block into checks. Throws if it states nothing checkable. */
export function expectationsFrom(prose, file = '<doc>') {
  const exp = { exitCode: null, output: [], skipCd: null };
  let m;
  if ((m = prose.match(/must (?:all )?exit (\d+)/)) || (m = prose.match(/exit code `(\d+)`/))) {
    exp.exitCode = Number(m[1]);
  }
  // `35 records in 4 chains` (root README) / `35 records in 4 chains, 0 standalone records` (verify README)
  for (const re of [/prints `([^`]+)` on the summary line/g, /summary ends with `([^`]+)`(?: and `([^`]+)`)?/g]) {
    for (const mm of prose.matchAll(re)) for (const g of mm.slice(1)) if (g) exp.output.push(...pieces(g));
  }
  // "content-verifies the 4 fleet records" → the standalone-record count.
  if ((m = prose.match(/content-verifies the (\d+) fleet records/))) exp.output.push(`${m[1]} standalone records`);
  // "Skip the `cd` (…) and node itself cannot find the script: it says `Cannot find module …` and exits `1`."
  if ((m = prose.match(/Skip the `cd`.*? it says `([^`]+)` and exits `(\d+)`/))) {
    exp.skipCd = { output: pieces(m[1]), exitCode: Number(m[2]) };
  }
  if (exp.exitCode === null) throw new Error(`${file}: the prose after the quickstart states no exit code this smoke can check`);
  if (exp.output.length === 0) throw new Error(`${file}: the prose after the quickstart states no output/count this smoke can check`);
  return exp;
}

export function loadDoc(doc, root = ROOT) {
  const text = readFileSync(join(root, doc.file), 'utf8');
  const sec = extractSection(text, doc.heading, doc.file);
  return { ...doc, commands: sec.commands, expect: expectationsFrom(sec.prose, doc.file) };
}

// --- shells -----------------------------------------------------------------

const isWin = process.platform === 'win32';

/** A script for `shell` that runs `lines` verbatim, stopping on the first non-zero exit. */
export function scriptFor(shell, lines) {
  const out = [];
  const mark = (i, l) => `SMOKE ${i + 1}/${lines.length}: ${l}`.replace(/[^\x20-\x7e]/g, '?');
  if (shell === 'bash' || shell === 'zsh') {
    lines.forEach((l, i) => {
      out.push(`echo '${mark(i, l).replace(/'/g, `'\\''`)}'`, l,
        `rc=$?; if [ "$rc" -ne 0 ]; then echo "SMOKE: line ${i + 1} exited $rc" >&2; exit "$rc"; fi`);
    });
    return { ext: '.sh', body: out.join('\n') + '\n' };
  }
  if (shell === 'pwsh' || shell === 'powershell') {
    // Interactive defaults ($ErrorActionPreference = Continue); only exit codes decide.
    lines.forEach((l, i) => {
      const builtin = /^\s*(cd|Set-Location|sl|chdir)\b/i.test(l);
      out.push(`Write-Host '${mark(i, l).replace(/'/g, "''")}'`, `$global:LASTEXITCODE = 0`, l,
        builtin
          ? `if (-not $?) { Write-Host 'SMOKE: line ${i + 1} failed'; exit 1 }`
          : `if ($LASTEXITCODE -ne 0) { Write-Host "SMOKE: line ${i + 1} exited $LASTEXITCODE"; exit $LASTEXITCODE }`);
    });
    out.push('exit 0');
    return { ext: '.ps1', body: out.join('\r\n') + '\r\n' };
  }
  if (shell === 'cmd') {
    out.push('@echo off');
    lines.forEach((l, i) => {
      out.push(`echo ${mark(i, l).replace(/[&|<>^%]/g, '^$&')}`, l,
        `if errorlevel 1 ( echo SMOKE: line ${i + 1} exited %errorlevel% & exit /b %errorlevel% )`);
    });
    out.push('exit /b 0');
    return { ext: '.cmd', body: out.join('\r\n') + '\r\n' };
  }
  throw new Error(`unknown shell ${shell}`);
}

export function shellCommand(shell, file) {
  switch (shell) {
    case 'bash': {
      // On Windows the bare `bash` on PATH can be WSL's launcher; the docs mean Git Bash.
      const gitBash = isWin ? join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe') : null;
      return [gitBash && existsSync(gitBash) ? gitBash : 'bash', [file]];
    }
    case 'zsh': return ['zsh', ['-f', file]];
    case 'pwsh': return ['pwsh', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file]];
    case 'powershell': return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file]];
    case 'cmd': return ['cmd.exe', ['/d', '/c', file]];
    default: throw new Error(`unknown shell ${shell}`);
  }
}

export function runLines(shell, lines, cwd, scratch, tag) {
  const { ext, body } = scriptFor(shell, lines);
  const file = join(scratch, `${tag}${ext}`);
  writeFileSync(file, body);
  const [cmd, args] = shellCommand(shell, file);
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  return { status: r.status, output };
}

// The verifier prints one PASS line per check; keep the log to the lines a reader
// needs unless something failed, then show everything.
function show(output, all) {
  const lines = output.split(/\r?\n/);
  const keep = all ? lines : lines.filter((l) => /^SMOKE|^Cloning|records in .* chains|checks, \d+ failures|Cannot find module|not found:|FAIL/.test(l));
  process.stdout.write(keep.map((l) => `    | ${l}`).join('\n') + '\n');
}

// --- main -------------------------------------------------------------------

/** The directory a documented `git clone … URL [dir]` creates. */
export function cloneDir(line) {
  const toks = line.trim().split(/\s+/);
  const urlAt = toks.findIndex((t) => /^(https?:\/\/|git@)/.test(t));
  if (urlAt < 0) throw new Error(`cannot find the URL in: ${line}`);
  if (toks[urlAt + 1]) return toks[urlAt + 1];
  return toks[urlAt].replace(/\/+$/, '').split('/').pop().replace(/\.git$/, '');
}

function smoke(doc, shell) {
  const failures = [];
  const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
  const pass = (msg) => console.log(`  PASS  ${msg}`);
  const scratch = mkdtempSync(join(tmpdir(), 'smoke-scripts-'));
  const fresh = mkdtempSync(join(tmpdir(), 'fresh-user-'));
  try {
    console.log(`\n== ${doc.file} "${doc.heading}" in ${shell}, fresh dir ${fresh}`);
    const cloneAt = doc.commands.findIndex((l) => /^\s*git\s+clone\b/.test(l));
    if (cloneAt < 0) { fail(`${doc.file}: the quickstart has no git clone line`); return failures; }
    const sha = process.env.SMOKE_CHECKOUT_SHA;
    const phases = sha
      ? [doc.commands.slice(0, cloneAt + 1), doc.commands.slice(cloneAt + 1)]
      : [doc.commands];

    let combined = '';
    let status = 0;
    for (let p = 0; p < phases.length && status === 0; p++) {
      if (phases[p].length === 0) continue;
      const r = runLines(shell, phases[p], fresh, scratch, `phase${p}`);
      combined += r.output;
      status = r.status;
      if (p === 0 && sha && status === 0) {
        const dir = join(fresh, cloneDir(doc.commands[cloneAt]));
        console.log(`  (harness) moving the fresh clone to the commit under test, ${sha}`);
        for (const args of [['fetch', '--quiet', '--depth', '1', 'origin', sha], ['checkout', '--quiet', '--detach', 'FETCH_HEAD']]) {
          const g = spawnSync('git', ['-C', dir, ...args], { stdio: 'inherit' });
          if (g.status !== 0) { fail(`harness: git ${args[0]} ${sha} failed`); return failures; }
        }
      }
    }
    const before = failures.length;
    if (status === doc.expect.exitCode) pass(`exit code ${status} (documented: ${doc.expect.exitCode})`);
    else fail(`exit code ${status}, documented ${doc.expect.exitCode}`);
    for (const s of doc.expect.output) {
      if (combined.includes(s)) pass(`output contains "${s}"`);
      else fail(`output lacks the documented "${s}"`);
    }
    if (!/\b0 failures\b/.test(combined)) fail('no "0 failures" summary line in the output');
    show(combined, failures.length > before);

    if (doc.expect.skipCd) {
      const nodeLine = doc.commands.find((l) => /^\s*node\s/.test(l));
      console.log(`  -- documented skip-the-cd behaviour: "${nodeLine}" from ${fresh}`);
      const r = runLines(shell, [nodeLine], fresh, scratch, 'skipcd');
      const want = doc.expect.skipCd;
      const was = failures.length;
      if (r.status === want.exitCode) pass(`skip cd: exit code ${r.status} (documented: ${want.exitCode})`);
      else fail(`skip cd: exit code ${r.status}, documented ${want.exitCode}`);
      for (const s of want.output) {
        if (r.output.includes(s)) pass(`skip cd: output contains "${s}"`);
        else fail(`skip cd: output lacks the documented "${s}"`);
      }
      show(r.output, failures.length > was);
    }
  } finally {
    for (const d of [fresh, scratch]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  return failures;
}

function main(argv) {
  const shells = [];
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--shell') shells.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (argv[i] === '--list') list = true;
    else { console.error(`unknown argument ${argv[i]}`); return 2; }
  }
  let docs;
  try { docs = DOCS.map((d) => loadDoc(d)); } catch (e) { console.error(`DOCS DRIFT: ${e.message}`); return 1; }
  if (list) {
    for (const d of docs) console.log(JSON.stringify({ file: d.file, heading: d.heading, commands: d.commands, expect: d.expect }, null, 2));
    return 0;
  }
  if (shells.length === 0) { console.error('usage: fresh-user-smoke.mjs --shell bash|zsh|pwsh|powershell|cmd[,...] | --list'); return 2; }
  const failures = [];
  for (const shell of shells) for (const d of docs) failures.push(...smoke(d, shell).map((f) => `[${shell}] ${d.file}: ${f}`));
  console.log('');
  if (failures.length) {
    console.log(`fresh-user smoke: ${failures.length} failure(s)`);
    for (const f of failures) console.log(`::error::${f}`);
    return 1;
  }
  console.log(`fresh-user smoke: PASS (${shells.join(', ')} x ${docs.length} quickstarts)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
