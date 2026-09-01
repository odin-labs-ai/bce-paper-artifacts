# bce-paper-artifacts

Paper-artifacts package for:

> **bce: Fail-Closed Blueprint-Conformance Gating with Re-Derivable Evidence for AI-Built Systems**

This repository carries the **evidence a reviewer can inspect and verify without the engine**: the complete
seeded-defect corpus and fixture trees, the corpus manifest, recorded CI transcripts of the cited red and green
gate runs, sample hash-chained evidence records, and a zero-dependency chain verifier.

**Status**: private during paper preparation and review. It becomes public at paper posting; an archival
deposit (Zenodo, version DOI) is made at that time.

---

## What is (and is not) here

**The engine is not in this repository.** The verifier engine (`bce` — schema, extractors, evaluator, gate,
CLI) is a self-contained package (15 published versions, 0.2.0–0.14.0; 0.14.0 latest as of 2026-08-14) currently on a private,
access-restricted registry. A public open-core release of the verifier under Apache-2.0 is **planned for
approximately late October 2026, after the preprint**. Until then the engine is available to reviewers on
request. Nothing in this repository contains engine source or built engine code.

## Capability scope — what re-derives TODAY vs at engine release

| Claim surface | With this repo + node alone, today | At engine release (~Oct 2026) |
|---|---|---|
| Evidence-chain integrity (tamper-evidence of records) | **YES** — `node verify/verify-chain.mjs evidence/born-public` and `…/production-samples` | unchanged |
| The gate can go RED (planted regression fails CI) | **YES (inspectable)** — recorded run transcripts + API metadata in `transcripts/behavioral-gate/` (the planted-regression branch) with the exact fetch commands | re-executable against the public engine's own CI |
| Engine-pin drift fails closed (version-skew honesty) | **YES (inspectable)** — the recorded DRIFT→CONFORMANT pair in `transcripts/pin-drift/` | re-executable |
| Gates are wired as required checks | **YES (inspectable)** — live branch-protection API reads in `transcripts/branch-protection/` (including the honest `enforce_admins: false` disclosure) | unchanged |
| Corpus spec (what was seeded, where, what counts as a catch) | **YES** — `corpus/MANIFEST.json` + the full fixture trees in `fixtures/` | unchanged |
| Recall / false-positive measurement (the headline validation) | **Inspectable, not re-executable**: the recorded CI transcript (`transcripts/recall-e2e/`, 52 e2e + 13 corpus tests green) + the corpus + fixtures are here, but re-RUNNING the measurement requires the engine | **YES** — two commands, below |
| Production evidence provenance | **Partial** — 4 byte-intact fleet records content-verify; chain predecessors are not shipped (stated, not hidden) | unchanged |

## Re-derivation commands

Publicly runnable **today** (node ≥ 18, no install):

```bash
node verify/verify-chain.mjs evidence/born-public        # 35 records, 4 chains — must exit 0
node verify/verify-chain.mjs evidence/production-samples # 4 fleet records — content hashes must verify
```

Quoted from the paper's availability section — **engine package required** (on request until the open-core
release; a revised paper version will add the repository link):

```bash
pnpm --filter @odinlabs-ai/engineering-blueprint test recall-e2e-proof   # real extractor+evaluator over the
                                                                         # seeded fixtures, gate verdict at
                                                                         # pinned thresholds
pnpm --filter @odinlabs-ai/engineering-blueprint test corpus             # corpus integrity: every fixture resolves
```

Full re-execution of those two commands awaits the engine release; presenting them without that caveat would
overstate what a reader can do today, so: you cannot run them yet unless you request engine access.

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

- The engine is **not** publicly available today; its public release is planned (see above). This repository
  is the paper-artifacts subset only.
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
