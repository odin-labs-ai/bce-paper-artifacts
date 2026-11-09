# bce-paper-artifacts

Paper-artifacts package for:

> **bce: Fail-Closed Blueprint-Conformance Gating with Re-Derivable Evidence for AI-Built Systems**

This repository carries the **evidence a reviewer can inspect and verify without the engine**: the complete
seeded-defect corpus and fixture trees, the corpus manifest, recorded CI transcripts of the cited red and green
gate runs, sample hash-chained evidence records, and a zero-dependency chain verifier.

**Status**: public, released alongside the preprint. An archival deposit (Zenodo, version DOI) is minted at
the posting-day deposit; until that deposit lands, `CITATION.cff` carries no resolvable archival DOI and
this repository's own launch-readiness gate lists that one item as declared, expected-pending (it still prints
it, and fails on any other false claim).

---

## What is (and is not) here

**The engine is not in this repository.** The verifier engine (`bce` — schema, extractors, evaluator, gate,
CLI) is public under Apache-2.0: source at [blueprint-conformance/bce](https://github.com/blueprint-conformance/bce),
package [`bce-engine`](https://www.npmjs.com/package/bce-engine) on npm (check the current version with
`npm view bce-engine version dist.integrity`). The paper's runs used the engine's earlier private
lineage, published as `@odinlabs-ai/engineering-blueprint` 0.2.0–0.17.1 on a private registry; the public
`bce-engine` restarted the version line at 0.1.0. Nothing in this repository contains engine source or
built engine code.

**Try the engine itself** (Node 22+), in any directory:

```bash
npx --yes --package=bce-engine@0.6.2 -- bce demo --recipe module-layering   # one clean and one planted-drift fixture: GREEN, then RED
```

## Capability scope — what re-derives with this repo alone vs with the public engine

| Claim surface | With this repo + node alone | With the public engine |
|---|---|---|
| Evidence-chain integrity (tamper-evidence of records) | **YES** — `node verify/verify-chain.mjs evidence/born-public` and `…/production-samples` | unchanged |
| The gate can go RED (planted regression fails CI) | **YES (inspectable)** — recorded run transcripts + API metadata in `transcripts/behavioral-gate/` (the planted-regression branch) with the exact fetch commands | re-executable against the public engine's own CI |
| Engine-pin drift fails closed (version-skew honesty) | **YES (inspectable)** — the recorded DRIFT→CONFORMANT pair in `transcripts/pin-drift/` | re-executable |
| Gates are wired as required checks | **YES (inspectable)** — live branch-protection API reads in `transcripts/branch-protection/` (including the honest `enforce_admins: false` disclosure) | unchanged |
| Corpus spec (what was seeded, where, what counts as a catch) | **YES** — `corpus/MANIFEST.json` + the full fixture trees in `fixtures/` | unchanged |
| Recall / false-positive measurement (the headline validation) | **Inspectable, not re-executable**: the recorded CI transcript (`transcripts/recall-e2e/`, 52 e2e + 13 corpus tests green) + the corpus + fixtures are here, but re-RUNNING the measurement requires the engine | **YES, as a protocol re-run** over the public engine's genericized corpus, not the paper's run — commands below |
| Production evidence provenance | **Partial** — 4 byte-intact fleet records content-verify; chain predecessors are not shipped (stated, not hidden) | unchanged |

## Re-derivation commands

Publicly runnable **today** (Node 18+, git, no install). Run the commands one per line; this works in bash, zsh,
Git Bash, cmd and Windows PowerShell alike (the block has no comments and no `&&`, so every line pastes as-is):

```bash
git clone --depth 1 https://github.com/odin-labs-ai/bce-paper-artifacts.git
cd bce-paper-artifacts
node verify/verify-chain.mjs --expect-records 35 --expect-chains 4 evidence/born-public
node verify/verify-chain.mjs evidence/production-samples
```

Both verifier commands must exit 0. The first checks the counts itself: it exits 1 unless exactly 35 records in
4 chains verify, and it prints `35 records in 4 chains` on the summary line. The second content-verifies the 4
fleet records.

The paper's availability section names two commands in the private monorepo
(`pnpm --filter @odinlabs-ai/engineering-blueprint test recall-e2e-proof` and `… test corpus`). Their public
descendants live in the engine repository, pinned here to a released tag (Node 22+). One command per line, so it
also works in Windows PowerShell 5.1, which has no `&&`:

```bash
git clone --depth 1 --branch v0.6.2 https://github.com/blueprint-conformance/bce.git
cd bce
npm ci   # installs ~390 packages, then builds the engine via its `prepare` script
npx vitest run tests/recall-e2e-proof.test.ts tests/corpus.test.ts tests/corpus-manifest.test.ts
```

This re-executes the recall **protocol** over the public engine's genericized corpus, not a byte-identical
replay of the paper's run: suite-v2 rows 1–25 map to the frozen corpus in `corpus/` here, and rows 26–35 postdate
the paper. The engine's [`corpus/CORPUS-MAP.md`](https://github.com/blueprint-conformance/bce/blob/v0.6.2/corpus/CORPUS-MAP.md)
states exactly what is identical, what was genericized, and the claim the mapping supports.

## Layout

```
fixtures/       23 seeded-drift + 12 clean fixture dirs across 4 surfaces + 4 subsystem blueprints
                (strings genericized; verdict-preservation validated — see fixtures/PROVENANCE.md)
corpus/         MANIFEST.json — the 25 seeded defects ↔ fixtures ↔ constraintIds ↔ expected severities
transcripts/    recorded proofs, fetched via the GitHub API with exact commands (PROVENANCE.md):
                  behavioral-gate/   1 executed GREEN + 1 executed RED (planted regression)
                                     + 1 skip-green (no probed seam) + 1 engine-install failure
                                     -- see transcripts/PROVENANCE.md; only 2 of 4 are gate verdicts
                  pin-drift/         the DRIFT → CONFORMANT monitor pair
                  portfolio-sweep/   an honest non-pass day + a full-pass day
                  recall-e2e/        the corpus-expansion CI test block (52+13 tests green)
                  branch-protection/ live required-check configuration reads
evidence/       born-public/         35 fresh hash-chained records generated over the public fixtures
                production-samples/  4 byte-intact fleet records (whole-record-exclusion redaction policy)
                score-series/        committed fleet score series (including its honest NON-PASS rows)
                c-auth-02-…SANITIZED.md  the 75-violation teeth-derisk proof (sanitized derivative)
verify/         verify-chain.mjs — the zero-dependency verifier + its README
EXCLUSIONS.md   what was withheld or excerpted, why, and the recorded leak-audit output
```

## Honesty notes (claims governance)

Every sentence in this repository is bound to the paper's claims table at its recorded tier. In particular:

- The engine is public (see above), but its released line is not the private build the paper measured; the
  mapping between the two corpora is stated in the engine's `corpus/CORPUS-MAP.md`. This repository is the
  paper-artifacts subset only.
- The born-public evidence chains demonstrate chain **mechanics** over public fixtures; they witness nothing
  about production. The production samples are latest-link records; no production RED→fix→GREEN chain
  round-trip is claimed.
- The recorded RED gate runs are **deliberately planted regression proofs** (branch-named as such) — that is
  their point: a gate that cannot fail is not a gate.
- The branch-protection reads include their own weaknesses (e.g. `enforce_admins: false`) — disclosed, not
  hidden.
- No claim of external adoption is made.

## Provenance summary

| Source | Pin |
|---|---|
| Engine package source (fixtures, corpus constant) | `odin-labs-ai/local-agents` `main` @ `1a3c40c97412d493772f569a0390183101bdef73` (2026-08-02, post PR #345) |
| Fleet evidence records + score series | `odin-labs-ai/odin-labs` `main` @ `616fd80b26c0446ace8c6786932b58d426492e58` (2026-08-02) |
| Behavioral-gate runs | `odin-labs-ai/odin-suite` Actions runs `30586345158`, `30588771822`, `30584805213`, `30584274320` |
| Pin-drift + portfolio-sweep runs | `odin-labs-ai/odin-labs` Actions runs `30690870648`, `30721163116`, `30690098892`, `30722371060` |
| Registry state | `@odinlabs-ai/engineering-blueprint`: 15 versions, `0.14.0` latest (checked 2026-08-14) |

The source repositories are private; the transcripts exist so their cited runs are inspectable without org
access. Full raw materials are available to reviewers on request.

## License and citation

Code and data in this repository: **Apache-2.0** (see `LICENSE`, `NOTICE`). Cite via `CITATION.cff` (the
archival DOI is added at deposit time).
