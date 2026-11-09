// verify-chain.test.mjs — negative controls for the chain verifier.
//
// Run from anywhere (node >= 18, no install):  node --test verify/verify-chain.test.mjs
//
// The verifier used to exit 0 on a chain with records cut off the end, on an empty chain
// file, and on a directory that holds no records at all ("0 checks, 0 failures"). Each case
// below must now exit NON-ZERO, and the real evidence must still exit 0 with the counts the
// README states (35 records in 4 chains). Every damaged case runs on a throwaway copy; the
// repository is never mutated.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(repoRoot, 'verify', 'verify-chain.mjs');
const bornPublic = path.join(repoRoot, 'evidence', 'born-public');

const made = [];
function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-chain-test-'));
  made.push(d);
  return d;
}
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

function run(...args) {
  const r = spawnSync(process.execPath, [verifier, ...args], { cwd: repoRoot, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A throwaway copy of evidence/born-public that a case may damage. */
function copyBornPublic() {
  const dir = tmpDir();
  fs.cpSync(bornPublic, dir, { recursive: true });
  return dir;
}

const chainLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());

// ---- positive controls: the real evidence still passes, with the stated counts ----

test('real born-public evidence exits 0 and reports 35 records in 4 chains', () => {
  const r = run('evidence/born-public');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^35 records in 4 chains, 0 standalone records$/m);
  assert.match(r.out, /\d+ checks, 0 failures/);
  assert.doesNotMatch(r.out, /NOT anchored/);
});

test('real born-public evidence passes the pinned counts (--expect-records 35 --expect-chains 4)', () => {
  const r = run('--expect-records', '35', '--expect-chains', '4', 'evidence/born-public');
  assert.equal(r.code, 0, r.out);
});

test('real production samples exit 0 (4 standalone records)', () => {
  const r = run('evidence/production-samples');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /0 records in 0 chains, 4 standalone records/);
});

test('the whole evidence dir exits 0', () => {
  const r = run('evidence');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /35 records in 4 chains, 4 standalone records/);
});

// ---- negative controls: each must exit non-zero ----

test('truncated chain (records cut off the end, manifest kept) exits non-zero', () => {
  const dir = copyBornPublic();
  const f = path.join(dir, 'luna-chat-extension.chain.jsonl');
  const lines = chainLines(f);
  assert.ok(lines.length > 4, 'fixture precondition: luna chain has more than 4 records');
  fs.writeFileSync(f, `${lines.slice(0, 4).join('\n')}\n`);
  const r = run(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+manifest length/);
});

test('truncated chain with its manifest truncated to match is caught by --expect-records', () => {
  const dir = copyBornPublic();
  const f = path.join(dir, 'luna-chat-extension.chain.jsonl');
  const m = path.join(dir, 'luna-chat-extension.chain-manifest.json');
  fs.writeFileSync(f, `${chainLines(f).slice(0, 4).join('\n')}\n`);
  fs.writeFileSync(m, JSON.stringify(JSON.parse(fs.readFileSync(m, 'utf8')).slice(0, 4), null, 2));
  assert.equal(run(dir).code, 0, 'without a pinned count this forgery is internally consistent');
  const r = run('--expect-records', '35', dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+expected record count/);
});

test('reordered chain exits non-zero', () => {
  const dir = copyBornPublic();
  const f = path.join(dir, 'route-guard.chain.jsonl');
  const lines = chainLines(f);
  [lines[1], lines[2]] = [lines[2], lines[1]];
  fs.writeFileSync(f, `${lines.join('\n')}\n`);
  const r = run(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+\[1\] link/);
  assert.match(r.out, /FAIL\s+manifest record ids, in order/);
});

test('empty chain file exits non-zero', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'x.chain.jsonl'), '');
  const r = run(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+chain non-empty/);
  assert.doesNotMatch(r.out, /anchored at genesis sentinel/);
});

test('empty directory exits non-zero', () => {
  const dir = tmpDir();
  const r = run(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /nothing verified/);
});

test('wrong directory (one with no evidence records) exits non-zero', () => {
  const r = run('fixtures');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /nothing verified/);
});

test('a chain manifest whose chain is missing exits non-zero', () => {
  const dir = copyBornPublic();
  fs.rmSync(path.join(dir, 'served-behavior.chain.jsonl'));
  const r = run(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+chain present/);
});

test('a wrong --expect-chains count exits non-zero', () => {
  const r = run('--expect-chains', '5', 'evidence/born-public');
  assert.equal(r.code, 1, r.out);
});

test('a path that does not exist exits 2 with a hint instead of a stack trace', () => {
  const r = run('no/such/dir');
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /not found: no\/such\/dir \(run from the repository root/);
  assert.doesNotMatch(r.out, /ENOENT|at Object\./);
});
