# Evidence Provenance

## born-public/ (primary tier — leakage-free by construction)

Generated at artifact-build time (2026-08-02) by running the real engine (a local build of
`@odinlabs-ai/engineering-blueprint@0.12.1` at source `main` HEAD `1a3c40c9`) over **this repository's public
fixtures**: for each of the four subsystem blueprints, one run per fixture directory in sorted order, each run's
`ComplianceReport` folded into an evidence record chained onto the previous record's hash (genesis sentinel
first). One chain per subsystem:

| Chain | Records |
|---|---|
| `luna-chat-extension.chain.jsonl` | 16 |
| `egress-reader.chain.jsonl` | 7 |
| `route-guard.chain.jsonl` | 9 |
| `served-behavior.chain.jsonl` | 3 |

`*.chain-manifest.json` maps each record index to the fixture directory it was run over; `score-series.jsonl`
carries the per-run score/verdict rows (conformant fixtures pass at 100; drift fixtures fail at their real
scores). **These chains are demonstrations of the evidence-chain mechanics over public fixtures. They witness
nothing about any production system**, and the drift records in a chain do not represent a witnessed
regression-and-fix episode on real code — they are fixture runs in directory-sort order.

Re-generation at engine release: `bce run --emit` (or the exported `toEvidenceRecord`) over the same fixtures
reproduces byte-identical records — the record shape is deterministic and wall-clock-free.

## production-samples/ (existence proof tier — byte-intact)

Four evidence records from the live fleet, fetched byte-intact from the `odin-labs` fleet repository at `main`
commit `616fd80b26c0446ace8c6786932b58d426492e58` (2026-08-02):

```bash
git show <main>:.ai/blueprint-reports/evidence-record-<subsystem>.json
```

Redaction policy: **whole-record inclusion or whole-record exclusion — never field editing** (an edited record
no longer hash-verifies, which would defeat the artifact's purpose). All four records shipped verify their
content hash (`node verify/verify-chain.mjs evidence/production-samples`).

Honest scope statements:

- Each file is the **latest link** of its subsystem's live chain; the fleet repository stores the current
  record in place, so predecessor records are not shipped and each record's `previousHash` link is stated as
  unverifiable by the verifier rather than silently passed.
- All four sampled records happen to be `pass` verdicts at score 100 — that is what the live fleet mains looked
  like at fetch time, not a curated selection. The recorded RED evidence in this artifact is in `transcripts/`
  (planted-regression gate runs and the pin-drift DRIFT run), not in the production evidence samples. No
  RED→fix→GREEN production chain round-trip is claimed or implied.

## score-series/

Two committed fleet series, fetched byte-intact from the same `odin-labs` main commit:

- `fleet-subsystem-score-series.jsonl` ← `.ai/blueprint-reports/score-series.jsonl` — per-revision,
  per-subsystem score rows (append-only sink written by the fleet's conformance runs).
- `portfolio-fleet-score-series.jsonl` ← `.ai/blueprint-reports/portfolio/fleet-score-series.jsonl` — the
  daily portfolio sweep's honest roll-up (note the `NON-PASS` rows with named exclusions and even a
  `fleetScore: null / evaluable: 0` row: the series records bad days as bad days). Rows `30690098892` and
  `30722371060` cross-check against `transcripts/portfolio-sweep/`.

## c-auth-02-teeth-derisk-proof.SANITIZED.md

A sanitized derivative of the committed C-AUTH-02 proof artifact — see the header of that file for the exact
original path, commit, and the three replaced strings.
