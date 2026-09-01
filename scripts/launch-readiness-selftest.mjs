#!/usr/bin/env node
/**
 * launch-readiness-selftest.mjs — prove EVERY detector can fire, not just one.
 *
 * The in-workflow self-test plants one false status line and requires a refusal.
 * That proves exactly one of four detectors. The rest are regexes over prose, and
 * a regex with a typo does not throw — it silently matches nothing and its claim
 * reports TRUE forever. A gate whose detectors are unverified vouches for a page
 * it never actually read, which is the failure this gate exists to prevent.
 *
 * STRIP-THEN-PLANT, not plant-alone. Every claim here is already false today, so
 * planting into the real tree would show each detector firing without proving the
 * plant caused it — "fired on the plant" and "was red anyway" are the same
 * observation. So each case first REMOVES the real claim (the detector must go
 * quiet), then plants a targeted breakage (the detector must fire). That catches
 * both useless shapes: one that never fires, and one that never goes quiet.
 *
 * `docs/engine-availability` is exercised too, by pointing the probe at a package
 * that IS published — otherwise that branch never runs while bce-engine is still
 * the 0.0.0 stub, and its detector would ship completely untested.
 *
 * Exit codes:
 *   0 — every detector went quiet when stripped and fired on its plant.
 *   1 — at least one detector failed to fire, or never went quiet.
 *   2 — harness failure.
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error(`selftest: ${m}`); process.exit(2); };

/**
 * `env` lets a case force the probe branch it needs. `docs/engine-availability`
 * only registers when the engine reads as published, so it is probed against a
 * package that genuinely is — the detector under test is the PROSE scan, not the
 * package name.
 */
const CASES = [
  {
    id: 'readme/status-private', file: 'README.md',
    strip: /\*\*Status\*\*:\s*private/i,
    add: '\n**Status**: private during paper preparation and review.\n',
  },
  {
    id: 'citation/archival-doi', file: 'CITATION.cff',
    // The "fixed" state is a real doi: line; strip the commented TBD and add one.
    strip: /#\s*doi:|zenodo\.TBD/i,
    fix: (s) => `${s}\ndoi: "10.5281/zenodo.1234567"\n`,
    add: '\n# doi: 10.5281/zenodo.TBD\n',
  },
  {
    id: 'docs/engine-release-date', file: 'README.md',
    strip: /late\s+Oct(ober)?\.?\s*2026/i,
    also: ['EXCLUSIONS.md'],
    add: '\nA public release is planned for approximately late October 2026.\n',
  },
  {
    id: 'docs/engine-availability', file: 'README.md',
    strip: /access-restricted registry|not\*{0,2}\s*publicly available|on request until the open-core|engine itself.*on request/i,
    also: ['EXCLUSIONS.md'],
    add: '\nThe engine is **not** publicly available today.\n',
    env: { ENGINE_PKG_OVERRIDE: 'typescript' },
  },
];

const stripLines = (f, re) => {
  if (!existsSync(f)) return;
  writeFileSync(f, readFileSync(f, 'utf8').split('\n').filter((l) => !re.test(l)).join('\n'));
};

function runIn(dir, extraEnv = {}) {
  const script = path.join(dir, 'scripts/launch-readiness-check.mjs');
  try {
    const out = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, LAUNCH_READINESS_FORCE_PUBLIC: '1', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { out, code: 0 };
  } catch (e) {
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: typeof e.status === 'number' ? e.status : 1 };
  }
}

const skipGit = (s) => !s.includes(`${path.sep}.git${path.sep}`) && !s.endsWith(`${path.sep}.git`);
const tmpBase = mkdtempSync(path.join(os.tmpdir(), 'lr-artifacts-selftest-'));
const clean = path.join(tmpBase, 'clean');
cpSync(repoRoot, clean, { recursive: true, filter: skipGit });
if (!existsSync(path.join(clean, 'scripts/launch-readiness-check.mjs'))) die('copy did not include the check script');

// The check script reads ENGINE_PKG as a const; make it overridable in the COPY
// only, so a case can exercise the published branch without changing shipped code.
const chk = path.join(clean, 'scripts/launch-readiness-check.mjs');
const src = readFileSync(chk, 'utf8');
const patched = src.replace(
  /^const ENGINE_PKG = 'bce-engine';$/m,
  "const ENGINE_PKG = process.env.ENGINE_PKG_OVERRIDE || 'bce-engine';"
);
if (patched === src) die("could not make ENGINE_PKG overridable in the copy — the const's shape changed");
writeFileSync(chk, patched);

const brokenIn = (text, id) =>
  new RegExp(`^\\s*(BROKEN|FALSE)\\s+${id.replace(/[/*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'm').test(text);

let failures = 0, discriminating = 0;
console.log(`selftest: ${CASES.length} detector(s), strip-then-plant\n`);

for (const c of CASES) {
  const dir = path.join(tmpBase, c.id.replace(/[^a-z0-9]/gi, '_'));
  cpSync(clean, dir, { recursive: true });
  const target = path.join(dir, c.file);
  if (!existsSync(target)) { console.log(`  SKIP  ${c.id} (${c.file} absent)`); continue; }

  // 1. STRIP so the claim becomes TRUE — the detector must go quiet.
  stripLines(target, c.strip);
  for (const extra of c.also ?? []) stripLines(path.join(dir, extra), c.strip);
  if (c.fix) writeFileSync(target, c.fix(readFileSync(target, 'utf8')));
  const quiet = !brokenIn(runIn(dir, c.env).out, c.id);

  // 2. PLANT it back — the detector must fire.
  writeFileSync(target, readFileSync(target, 'utf8') + c.add);
  const fired = brokenIn(runIn(dir, c.env).out, c.id);

  if (!fired) {
    console.log(`  FAIL  ${c.id} — planted a breakage in ${c.file} and the detector did NOT fire`);
    failures++; continue;
  }
  if (!quiet) {
    console.log(`  FAIL  ${c.id} — fired on the plant, but ALSO fired after the claim was stripped`);
    console.log('          (a detector that never goes quiet is as useless as one that never fires)');
    failures++; continue;
  }
  console.log(`  OK    ${c.id} — quiet when stripped, fired on the plant`);
  discriminating++;
}

console.log(`\n${discriminating} of ${CASES.length} case(s) fully discriminating.`);
if (failures) {
  console.error(`\n::error::selftest: ${failures} detector(s) failed.`);
  console.error('A claim whose detector cannot fire reports TRUE forever and vouches for nothing.');
  process.exit(1);
}
console.log('\nselftest: PASS — every detector went quiet when stripped and fired on its plant.');
