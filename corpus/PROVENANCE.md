# Corpus Provenance

`MANIFEST.json` is generated from the frozen `SEEDED_CORPUS` constant in the engine source
(`packages/engineering-blueprint/src/corpus.ts`) at the source repository's `main` HEAD
`1a3c40c97412d493772f569a0390183101bdef73` (repository `odin-labs-ai/local-agents`, private; fetched
2026-08-02). The corpus was expanded from N=9 to N=25 by PR #345 (merged 2026-08-02T10:33:07Z, merge commit
`f8d6a900`); the first 9 entries are the byte-frozen set cited by the paper's original recall measurement, and
the expansion is append-only.

**Verbatim fields**: `id`, `blueprintRef`, `fixture`, `constraintId`, `expectedSeverity` — these are the
paper's Table ids and must match the engine's frozen constant exactly.
**Genericized field**: `description` only (the internal extension-profile name is replaced by "the extension",
per the release-boundary scrub rules; no other change).

Counts (assertable against `MANIFEST.json` and `fixtures/`):

- 25 seeded defects over 23 distinct drift fixture directories (one directory carries a tri-seed: three
  distinct consequences of one planted defect).
- 12 clean control directories (zero seeded defects; any violation on them counts as a false positive in the
  recall gate's cried-wolf rule).
- 4 surfaces: `extension-surface` (16 dirs), `egress-surface` (7), `route-surface` (9), `behavior-surface` (3).

Semantics: `recall = |caught| / |seeded|`. A defect is caught only if the engine's report for the blueprint it
was planted under carries a violation with the defect's `constraintId` at or above `expectedSeverity` — same
constraint at a lower severity is an honest miss, and a catch under a different blueprint does not count.
