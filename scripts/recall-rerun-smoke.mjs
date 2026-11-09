#!/usr/bin/env node
// =============================================================================
// recall re-run smoke: run the README's "pinned recall re-run" block LITERALLY.
//
// The block lives in README.md under "## Re-derivation commands": the fenced
// block whose `git clone` line fetches the engine repository (bce) at a pinned
// tag, then `cd`, `npm ci` and the `npx vitest run ...` recall/corpus tests.
// scripts/fresh-user-smoke.mjs covers only the first block there (the verifier);
// this script covers that second one.
//
// As in fresh-user-smoke, nothing is copied: the commands are read out of the
// README at run time and the expected exit code and vitest summary are read out
// of the sentence after the block. Drop or reword that sentence so it states
// nothing checkable and this smoke fails (docs drift is a failure, not a skip).
//
// Each documented line runs verbatim in the named shell, in a brand-new empty
// directory outside the checkout; the only thing added between lines is an
// exit-code check (scriptFor in fresh-user-smoke.mjs). No harness step is
// inserted: the block clones a pinned tag of another repository, so the commit
// under test here only changes which README text is run. After the run the harness
// checks the engine clone's core.autocrlf against SMOKE_EXPECT_AUTOCRLF (the Windows
// legs clone with true, the Git for Windows default).
//
//   node scripts/recall-rerun-smoke.mjs --shell bash        (bash | zsh | pwsh | powershell | cmd)
//   node scripts/recall-rerun-smoke.mjs --list              print what would run, run nothing
//
// This is heavy (npm ci of ~290 packages + an engine build + the test run). It
// is meant for CI runners, not a laptop.
// =============================================================================
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLines, cloneDir, checkAutocrlf } from './fresh-user-smoke.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DOC = { file: 'README.md', heading: '## Re-derivation commands' };

/** A line that clones the engine repository (blueprint-conformance/bce). */
const ENGINE_CLONE = /^\s*git\s+clone\b.*\/bce(\.git)?(\s|$)/;

/** All fenced blocks under `heading`, each with the prose that follows it. */
export function extractBlocks(text, heading, file = '<doc>') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`${file}: heading "${heading}" not found`);
  let end = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end);
  const blocks = [];
  for (let i = 0; i < body.length; i++) {
    if (!/^```/.test(body[i])) continue;
    const close = body.findIndex((l, j) => j > i && /^```\s*$/.test(l));
    if (close < 0) throw new Error(`${file}: unterminated fenced block under "${heading}"`);
    const commands = body.slice(i + 1, close).filter((l) => l.trim() !== '');
    let next = body.findIndex((l, j) => j > close && /^```/.test(l));
    if (next < 0) next = body.length;
    const prose = body.slice(close + 1, next).join(' ').replace(/\s+/g, ' ').trim();
    blocks.push({ commands, prose });
    i = close;
  }
  return blocks;
}

/** The block whose clone line fetches the engine. Throws if there is none or more than one. */
export function extractRecallBlock(text, file = '<doc>') {
  const hits = extractBlocks(text, DOC.heading, file).filter((b) => b.commands.some((l) => ENGINE_CLONE.test(l)));
  if (hits.length === 0) throw new Error(`${file}: no fenced block under "${DOC.heading}" clones the engine (bce)`);
  if (hits.length > 1) throw new Error(`${file}: ${hits.length} blocks under "${DOC.heading}" clone the engine; expected one`);
  return hits[0];
}

/** Collapse runs of whitespace and drop ANSI colour codes, so vitest's column padding does not matter. */
export const norm = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();

/** The sentence after the block → an exit code and the vitest summary it promises. */
export function recallExpectationsFrom(prose, file = '<doc>') {
  const exp = { exitCode: null, output: [] };
  let m;
  if ((m = prose.match(/must (?:all )?exit (\d+)/))) exp.exitCode = Number(m[1]);
  for (const mm of prose.matchAll(/summary line reads `([^`]+)`/g)) exp.output.push(norm(mm[1]));
  if (exp.exitCode === null) throw new Error(`${file}: the prose after the recall re-run block states no exit code this smoke can check`);
  if (exp.output.length === 0) throw new Error(`${file}: the prose after the recall re-run block states no vitest summary this smoke can check`);
  return exp;
}

export function loadRecall(root = ROOT) {
  const text = readFileSync(join(root, DOC.file), 'utf8');
  const blk = extractRecallBlock(text, DOC.file);
  return { ...DOC, commands: blk.commands, expect: recallExpectationsFrom(blk.prose, DOC.file) };
}

function smoke(doc, shell) {
  const failures = [];
  const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
  const pass = (msg) => console.log(`  PASS  ${msg}`);
  const scratch = mkdtempSync(join(tmpdir(), 'smoke-scripts-'));
  const fresh = mkdtempSync(join(tmpdir(), 'fresh-user-'));
  try {
    console.log(`\n== ${doc.file} "${doc.heading}" (recall re-run block) in ${shell}, fresh dir ${fresh}`);
    const t0 = Date.now();
    const r = runLines(shell, doc.commands, fresh, scratch, 'recall');
    console.log(`  (${Math.round((Date.now() - t0) / 1000)}s)`);
    const out = norm(r.output);
    const engineDir = join(fresh, cloneDir(doc.commands.find((l) => ENGINE_CLONE.test(l))));
    checkAutocrlf(engineDir, pass, fail);
    if (r.status === doc.expect.exitCode) pass(`exit code ${r.status} (documented: ${doc.expect.exitCode})`);
    else fail(`exit code ${r.status}, documented ${doc.expect.exitCode}`);
    for (const s of doc.expect.output) {
      if (out.includes(s)) pass(`output contains "${s}"`);
      else fail(`output lacks the documented "${s}"`);
    }
    // Full log: it is the record of what the documented commands did on this OS.
    process.stdout.write(r.output.split(/\r?\n/).map((l) => `    | ${l}`).join('\n') + '\n');
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
  let doc;
  try { doc = loadRecall(); } catch (e) { console.error(`DOCS DRIFT: ${e.message}`); return 1; }
  if (list) { console.log(JSON.stringify(doc, null, 2)); return 0; }
  if (shells.length === 0) { console.error('usage: recall-rerun-smoke.mjs --shell bash|zsh|pwsh|powershell|cmd[,...] | --list'); return 2; }
  const failures = [];
  for (const shell of shells) failures.push(...smoke(doc, shell).map((f) => `[${shell}] ${doc.file}: ${f}`));
  console.log('');
  if (failures.length) {
    console.log(`recall re-run smoke: ${failures.length} failure(s)`);
    for (const f of failures) console.log(`::error::${f}`);
    return 1;
  }
  console.log(`recall re-run smoke: PASS (${shells.join(', ')})`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
