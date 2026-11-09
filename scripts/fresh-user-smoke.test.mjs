// Offline checks for scripts/fresh-user-smoke.mjs: what it extracts from the real
// docs, and that a drifted doc fails loudly instead of smoking nothing.
//   node --test scripts/fresh-user-smoke.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DOCS, loadDoc, extractSection, expectationsFrom, scriptFor, cloneDir, checkManifest } from './fresh-user-smoke.mjs';

test('every quickstart extracts: a clone, a cd into it, a node verify line, and checkable expectations', () => {
  for (const d of DOCS.map((x) => loadDoc(x))) {
    const clone = d.commands.find((l) => /^git clone /.test(l));
    assert.ok(clone, `${d.file}: no git clone line`);
    assert.ok(d.commands.includes(`cd ${cloneDir(clone)}`), `${d.file}: no cd into the clone dir`);
    assert.ok(d.commands.some((l) => /^node verify\/verify-chain\.mjs /.test(l)), `${d.file}: no node verify line`);
    assert.equal(d.expect.exitCode, 0);
    assert.ok(d.expect.output.some((s) => s.startsWith('35 records in 4 chains')), `${d.file}: counts not stated`);
  }
});

test('the quickstart blocks paste into every shell the docs name: no comments, no &&', () => {
  for (const d of DOCS.map((x) => loadDoc(x))) {
    for (const l of d.commands) {
      assert.doesNotMatch(l, /&&/, `${d.file}: "${l}" uses && (Windows PowerShell 5.1 has none)`);
      assert.doesNotMatch(l, /(^|\s)#/, `${d.file}: "${l}" has a comment (cmd has no # comments)`);
    }
  }
});

test('a renamed heading, a missing block or unstated expectations are drift, not a silent pass', () => {
  assert.throws(() => extractSection('# x\n\n## Other\n```bash\ngit clone u\n```\n', '## Quickstart'), /not found/);
  assert.throws(() => extractSection('## Quickstart\n\nno block here\n', '## Quickstart'), /no fenced block/);
  assert.throws(() => expectationsFrom('It works, trust us.'), /no exit code/);
  assert.throws(() => expectationsFrom('Both verifier commands must exit 0.'), /no output/);
});

test('cloneDir follows git: basename of the URL minus .git, or the explicit dir', () => {
  assert.equal(cloneDir('git clone --depth 1 https://github.com/o/r.git'), 'r');
  assert.equal(cloneDir('git clone --depth 1 --branch v1 https://github.com/o/r.git custom'), 'custom');
});

test('generated scripts carry each documented line verbatim', () => {
  const lines = ['git clone --depth 1 https://example.invalid/r.git', 'cd r', 'node verify/verify-chain.mjs evidence'];
  for (const sh of ['bash', 'pwsh', 'cmd']) {
    const body = scriptFor(sh, lines).body.split(/\r?\n/);
    for (const l of lines) assert.ok(body.includes(l), `${sh}: "${l}" not verbatim`);
  }
});

test('checkManifest is sha256sum -c: an LF file passes, the same file rewritten to CRLF fails, a missing file fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-test-'));
  try {
    const lf = 'line one\nline two\n';
    const sha = (s) => createHash('sha256').update(s).digest('hex');
    writeFileSync(join(dir, 'a.md'), lf);
    writeFileSync(join(dir, 'CHECKSUMS.txt'), `${sha(lf)}  ./a.md\n`);
    assert.deepEqual(checkManifest(dir), { total: 1, bad: [] });
    writeFileSync(join(dir, 'a.md'), lf.replace(/\n/g, '\r\n'));
    assert.deepEqual(checkManifest(dir), { total: 1, bad: ['./a.md'] });
    writeFileSync(join(dir, 'CHECKSUMS.txt'), `${sha(lf)}  ./gone.md\n`);
    assert.deepEqual(checkManifest(dir), { total: 1, bad: ['./gone.md'] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the real CHECKSUMS.txt in this checkout verifies', () => {
  const m = checkManifest(fileURLToPath(new URL('..', import.meta.url)));
  assert.ok(m.total > 100, `only ${m.total} entries`);
  assert.deepEqual(m.bad, []);
});
