// Offline checks for scripts/recall-rerun-smoke.mjs: what it extracts from the real
// README, and that a drifted README fails loudly instead of smoking nothing.
//   node --test scripts/recall-rerun-smoke.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecall, extractRecallBlock, recallExpectationsFrom, norm } from './recall-rerun-smoke.mjs';
import { cloneDir } from './fresh-user-smoke.mjs';

test('the README recall block extracts: a pinned engine clone, a cd into it, npm ci, the vitest line, and checkable expectations', () => {
  const d = loadRecall();
  const clone = d.commands.find((l) => /^git clone /.test(l));
  assert.match(clone, /--branch v\d+\.\d+\.\d+ /, 'the engine clone is not pinned to a release tag');
  assert.ok(d.commands.includes(`cd ${cloneDir(clone)}`), 'no cd into the clone dir');
  assert.ok(d.commands.some((l) => /^npm ci\b/.test(l)), 'no npm ci line');
  assert.ok(d.commands.some((l) => /^npx vitest run .*recall-e2e-proof/.test(l)), 'no vitest recall line');
  assert.equal(d.expect.exitCode, 0);
  assert.deepEqual(d.expect.output, ['Test Files 3 passed (3)']);
});

test('the recall block has no &&, since the README says it works in Windows PowerShell 5.1', () => {
  for (const l of loadRecall().commands) assert.doesNotMatch(l, /&&/, `"${l}" uses &&`);
});

test('a missing engine block or unstated expectations are drift, not a silent pass', () => {
  const noEngine = '## Re-derivation commands\n\n```bash\ngit clone https://github.com/o/other.git\n```\n';
  assert.throws(() => extractRecallBlock(noEngine), /no fenced block .* clones the engine/);
  assert.throws(() => extractRecallBlock('## Elsewhere\n'), /not found/);
  assert.throws(() => recallExpectationsFrom('This re-executes the recall protocol.'), /no exit code/);
  assert.throws(() => recallExpectationsFrom('Every line must exit 0.'), /no vitest summary/);
});

test('picks the engine block, not the verifier block before it', () => {
  const md = [
    '## Re-derivation commands', '', '```bash', 'git clone --depth 1 https://github.com/o/bce-paper-artifacts.git', '```', '',
    'Both must exit 0.', '', '```bash', 'git clone --depth 1 --branch v1.2.3 https://github.com/o/bce.git', 'cd bce', '```', '',
    'Every line must exit 0, and vitest\'s summary line reads `Test Files 3 passed (3)`.', '', '## Layout', '',
  ].join('\n');
  const b = extractRecallBlock(md);
  assert.deepEqual(b.commands, ['git clone --depth 1 --branch v1.2.3 https://github.com/o/bce.git', 'cd bce']);
  assert.deepEqual(recallExpectationsFrom(b.prose).output, ['Test Files 3 passed (3)']);
});

test('vitest padding and colour do not matter to the summary match', () => {
  assert.ok(norm(' \x1b[2m Test Files \x1b[22m \x1b[1m\x1b[32m3 passed\x1b[39m\x1b[22m\x1b[90m (3)\x1b[39m').includes('Test Files 3 passed (3)'));
});
