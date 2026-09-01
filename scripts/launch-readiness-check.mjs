#!/usr/bin/env node
/**
 * launch-readiness-check.mjs — the claims this repository makes that stop being
 * true when it goes public, enforced instead of remembered.
 *
 * This is a PROVENANCE package. Its whole value is that a referee can trust what
 * it says about itself. A provenance package that is publicly wrong about its own
 * status is worse than one that says nothing: the reader has no way to know which
 * other claims decayed the same way.
 *
 * Three claims here are written for a private repository and are falsified by the
 * flip itself, or by the sibling release that follows it:
 *
 *   README "Status: private during paper preparation"  — false the instant it is public
 *   CITATION.cff `# doi:` commented out as TBD         — the paper cites a DOI the
 *                                                        dataset does not carry
 *   README "public engine release planned ~late Oct"   — the engine ships in THIS
 *                                                        ceremony, not in October
 *
 * The third is the one that would have gone unnoticed longest. This repository is
 * flipped public EARLY in the sequence (it mints the DOI the citation gate needs),
 * several steps before the engine repository flips. So there is a real window in
 * which this public README announces a release date the project has already
 * abandoned — and after the engine flips, it is simply wrong.
 *
 * INERT while private (every claim reported as pending, exit 0 — none are due yet)
 * and blocking the instant the repository is public.
 *
 * LAUNCH_READINESS_FORCE_PUBLIC=1 forces the public branch so the teeth can be
 * PROVEN while the repository is still private. A gate that cannot go red is not a
 * gate, and this one would otherwise sit green until the day it matters.
 *
 * Zero dependencies, matching verify/verify-chain.mjs.
 *
 * Exit codes:
 *   0 — private (inert), or public and every claim true.
 *   1 — public (or forced) and at least one claim false.
 *   2 — harness failure (a file this gate reasons about is missing).
 */
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  if (!existsSync(p)) {
    console.error(`launch-readiness: FAIL(harness) — ${rel} is missing; this gate reasons about it.`);
    process.exit(2);
  }
  return readFileSync(p, 'utf8');
};

const forced = process.env.LAUNCH_READINESS_FORCE_PUBLIC === '1';
const isPublic = forced || process.env.REPO_IS_PRIVATE === 'false';

const claims = [];
const claim = (id, ok, detail, remedy) => claims.push({ id, ok, detail, remedy });

const readme = read('README.md');
const cff = read('CITATION.cff');

// ---------------------------------------------------------------------------
// 1. The status line. Line ~11 of the README, one of the first things a reader
//    sees. "private during paper preparation and review" is self-refuting on a
//    public page.
// ---------------------------------------------------------------------------
const statusHits = readme.split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /\*\*Status\*\*:\s*private/i.test(l));
claim(
  'readme/status-private',
  statusHits.length === 0,
  statusHits.length
    ? `README.md still declares itself private at line ${statusHits.map(([n]) => n).join(', ')}`
    : 'README status line does not claim to be private',
  'reword the Status line at the flip — it is self-refuting on a public page'
);

// ---------------------------------------------------------------------------
// 2. The archival DOI. The paper's data-availability section cites a version DOI;
//    a public dataset whose CITATION.cff carries only a commented `TBD` gives a
//    referee nothing to resolve.
// ---------------------------------------------------------------------------
const doiCommented = /^\s*#\s*doi:/m.test(cff);
const doiReal = /^\s*doi:\s*["']?10\.\d{4,9}\/[^\s"']+/m.test(cff) && !/zenodo\.TBD/i.test(cff);
claim(
  'citation/archival-doi',
  doiReal,
  doiReal
    ? 'CITATION.cff carries a resolvable archival DOI'
    : doiCommented
      ? 'CITATION.cff has the doi: line COMMENTED OUT (still zenodo.TBD)'
      : 'CITATION.cff carries no archival doi: field',
  'after the Zenodo deposit, uncomment doi: and set the real version DOI'
);

// ---------------------------------------------------------------------------
// 3. The engine-release date. This repository is flipped public EARLY (it mints
//    the DOI the sibling's citation gate needs), so this claim is publicly
//    visible while the engine release it postpones is already under way.
// ---------------------------------------------------------------------------
// Scanned across a DOC SET, not just the README. The first version of this check
// looked at README.md alone and missed EXCLUSIONS.md:12, which carries the same
// superseded date in different words ("~late Oct 2026" vs "approximately late
// October 2026") — so the pattern is on the DATE, not on one sentence's phrasing.
// A check written for one surface and not applied to its siblings is how the gap
// it was built to close reopens next door.
const DATE_DOCS = ['README.md', 'EXCLUSIONS.md'];
const STALE_DATE = /late\s+Oct(ober)?\.?\s*2026/i;
const dateHits = [];
for (const rel of DATE_DOCS) {
  const p = path.join(repoRoot, rel);
  if (!existsSync(p)) continue;
  readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    if (STALE_DATE.test(l)) dateHits.push(`${rel}:${i + 1}`);
  });
}
claim(
  'docs/engine-release-date',
  dateHits.length === 0,
  dateHits.length
    ? `superseded engine-release date ("late Oct 2026") still present at ${dateHits.join(', ')}`
    : 'no document carries the superseded engine-release date',
  'reconcile with the actual open-core release — this ceremony ships it, not October'
);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 4. Engine-availability claims — a DIFFERENT trigger from the three above.
//
// These are not falsified by THIS repository's flip. They are falsified by the
// SIBLING's publish, and the two happen at opposite ends of the sequence: this
// repository goes public early (it mints the DOI the sibling's citation gate
// needs), while the engine is published several steps later. So a
// visibility-only check passes happily through the exact window in which these
// sentences turn false.
//
// The trigger is therefore npm, not visibility: once bce-engine is live, a
// public artifacts package claiming the engine is unavailable is contradicting
// a fact any reader can check in one command.
//
// README:84 is the sharpest -- "The engine is **not** publicly available today"
// is not a stale hedge, it is a flat assertion that becomes untrue.
// ---------------------------------------------------------------------------
const ENGINE_PKG = 'bce-engine';
let enginePublished = false;
let engineVersion = '(not checked)';
// probeOk distinguishes "npm answered, and the answer is 0.0.0" from "npm did not
// answer at all". Collapsing those is a FAIL-OPEN: a registry outage or a rate
// limit would look exactly like not-yet-published, the availability claims would be
// skipped, and the gate would print "not yet due" while checking nothing. That is
// the same shape as a gate reporting on a precondition it never verified — the
// defect this whole gate exists to prevent, reproduced inside the gate.
let probeOk = false;
try {
  const { execFileSync } = await import('node:child_process');
  engineVersion = execFileSync('npm', ['view', ENGINE_PKG, 'version'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  probeOk = true;
  // 0.0.0 is the reservation stub, not the engine.
  enginePublished = Boolean(engineVersion) && engineVersion !== '0.0.0';
} catch (e) {
  engineVersion = `probe failed: ${String(e.stderr || e.message || e).trim().split('\n')[0]}`;
}

// Also scanned across a doc set. EXCLUSIONS.md's engine row says the engine is
// "Available to reviewers on request" — the same claim as the README's, in the
// table that tells a referee what was withheld and why.
//
// The EXCLUSIONS match is deliberately narrow: it requires the line to be ABOUT
// the engine. "available to reviewers on request" also appears in
// transcripts/PROVENANCE.md about RAW LOGS, which stays true after the engine is
// published, and in EXCLUSIONS' own other rows. Matching the phrase alone would
// red on sentences that are still correct — and a gate that cries wolf gets
// ignored on the day it is right.
const AVAILABILITY_DOCS = ['README.md', 'EXCLUSIONS.md'];
const availabilityHits = [];
for (const rel of AVAILABILITY_DOCS) {
  const p = path.join(repoRoot, rel);
  if (!existsSync(p)) continue;
  readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    const generic =
      /access-restricted registry/i.test(l) ||
      /not\*{0,2}\s*publicly available/i.test(l) ||
      /on request until the open-core/i.test(l);
    // engine-scoped: the row must name the engine AND defer availability
    const engineRow = /engine itself/i.test(l) && /on request/i.test(l);
    if (generic || engineRow) availabilityHits.push([`${rel}:${i + 1}`, l]);
  });
}

if (enginePublished) {
  claim(
    'docs/engine-availability',
    availabilityHits.length === 0,
    availabilityHits.length
      ? `npm serves ${ENGINE_PKG}@${engineVersion}, but the docs still call the engine unavailable at ${availabilityHits.map(([n]) => n).join(', ')}`
      : `engine availability described consistently with npm (${ENGINE_PKG}@${engineVersion})`,
    'reconcile the engine-availability prose — the package is public now, and a reader can check in one command'
  );
} else if (!probeOk) {
  // Fail CLOSED. We could not establish whether the engine is published, so we
  // cannot honestly say these claims are not yet due. Registered as a real claim
  // rather than skipped, so an unanswerable probe is visible instead of silent.
  claim(
    'docs/engine-availability',
    false,
    `could not determine whether ${ENGINE_PKG} is published (${engineVersion}); ${availabilityHits.length} availability claim(s) unverified`,
    'the npm probe failed — re-run once the registry is reachable; this is deliberately NOT treated as "not yet due"'
  );
} else {
  console.log(`  (engine-availability: not yet due — npm serves ${ENGINE_PKG} -> ${engineVersion}; ${availabilityHits.length} claim(s) will come due at publish)`);
}

const broken = claims.filter((c) => !c.ok);
const label = forced ? 'PUBLIC (forced — self-test)' : isPublic ? 'PUBLIC' : 'private';
console.log(`launch-readiness: repository is ${label}\n`);
for (const c of claims) {
  const mark = c.ok ? 'TRUE   ' : isPublic ? 'FALSE  ' : 'pending';
  console.log(`  ${mark} ${c.id.padEnd(28)} ${c.detail}`);
}

if (!isPublic) {
  console.log(`\nlaunch-readiness: INERT — the repository is private, so none of these are due yet.`);
  console.log(`${broken.length} claim(s) outstanding; they become blocking at the public flip.`);
  process.exit(0);
}

if (broken.length === 0) {
  console.log(`\nlaunch-readiness: PASS — the repository is public and says nothing untrue about itself.`);
  process.exit(0);
}

console.error(`\n::error::launch-readiness: FAIL — the repository is PUBLIC and makes ${broken.length} false claim(s) about itself.`);
for (const c of broken) {
  console.error(`  - ${c.id}: ${c.detail}`);
  console.error(`      remedy: ${c.remedy}`);
}
console.error('\nA provenance package that is publicly wrong about its own status gives a referee');
console.error('no way to know which other claims decayed the same way. Fix forward.');
process.exit(1);
