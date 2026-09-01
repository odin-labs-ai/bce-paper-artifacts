# Transcript Provenance

Every transcript in this directory was fetched from the GitHub API against the real (private) source
repositories on **2026-08-02** by the artifact maintainer. The source repositories are private; these recorded
transcripts exist precisely so a reviewer without org access can inspect the cited runs. Naming the real
organization, repositories, and run IDs here is a **deliberate, reviewed disclosure** (the paper cites these
runs); it is not leakage.

## Excerpt policy (applies to `job-log-excerpt.txt` files)

Raw CI job logs are conversation-shaped, not hash-chained records, so they ship as **declared excerpts**:

- ANSI color codes stripped.
- Git-fetch **branch/tag enumeration lines removed** (each log's header states the count). These lines name
  unrelated internal work branches and contribute nothing to the gate verdict.
- Registry-auth boilerplate lines (`.npmrc` token wiring; the token value itself was already masked by CI)
  replaced by an inline marker.
- In `jobs-summary.json`, one CI secret **name** (not value — values never appear) is masked as
  `[secret-name redacted]`.
- **Nothing from the gate/probe/sweep execution or its verdict was removed.** Full raw logs are available to
  reviewers on request.

## behavioral-gate/ (repository: `odin-labs-ai/odin-suite`, workflow `blueprint-behavioral-gate-odin-agent.yml`)

The behavioral gate runs the served-runtime probe and fail-closed reader over the agent TUI cockpit seam.

| Run | Conclusion | Head branch | Head SHA | Created |
|---|---|---|---|---|
| `30586345158` (GREEN) | success | `feat/attach-interactive-proof-clean` | `cd7779e6` | 2026-07-30T22:13:02Z |
| `30588771822` (GREEN) | success | `feat/c7-attach-one-flow-structural` | `3929cbcd` | 2026-07-30T22:54:40Z |
| `30584805213` (RED proof) | failure | `proof/behavioral-gate-red-fixture-1785121400` | `e575feff` | 2026-07-30T21:48:01Z |
| `30584274320` (RED proof) | failure | `proof/behavioral-gate-red-fixture-1785121400` | `99450d5a` | 2026-07-30T21:39:46Z |

**Only ONE of these four runs is a RED gate verdict, and only one is a GREEN one.** Read the shipped
`jobs-summary.json` for each before citing it — step conclusions, not run conclusions, are what make a run
evidence:

| run | run conclusion | gate actually executed? | what it is |
|---|---|---|---|
| `30588771822` | success | **YES** — install, probe and grading all ran and passed | the GREEN gate verdict |
| `30584805213` | failure | **YES** — install passed, probe failed via `[probe FAILED SELF-GUARD]` | the RED gate verdict |
| `30586345158` | success | **NO** — install/probe/grading all `skipped` | a **skip-green**: the workflow determined the PR touched no probed seam. Correct path-scoping, shipped because it demonstrates scoping — but it is NOT a gate green |
| `30584274320` | failure | **NO** — engine install `failure` against the registry; probe/grading `skipped` | a tooling/registry failure, NOT a gate verdict |

The RED proof (`30584805213`) is a **deliberately planted regression** on a fixture branch named as such: the
probe's self-guard refuses to emit a sidecar that would not honestly pass the reader (`[probe FAILED
SELF-GUARD]` → exit 1 → run failure). It demonstrates the gate CAN go red — a gate that cannot fail is not a
gate.

**Why this table exists.** An earlier revision of this file described all four as "two GREEN runs and two RED
planted-regression proofs", which counted a skip-green and an npm install crash as gate verdicts. Presenting a
tooling failure as a gate verdict, in a package supporting a paper about fail-closed gating, is the worst
error category available here — and it was contradicted by data this package already shipped
(`grep -c 'SELF-GUARD'` returns 1 for `30584805213` and 0 for `30584274320`). The data was always honest; the
narration was not. Corrected 2026-08-14.

Fetch commands:

```bash
gh api repos/odin-labs-ai/odin-suite/actions/runs/<RUN_ID>            # → run.json
gh api repos/odin-labs-ai/odin-suite/actions/runs/<RUN_ID>/jobs       # → jobs-summary.json (projected)
gh api repos/odin-labs-ai/odin-suite/actions/jobs/<JOB_ID>/logs      # → job-log-excerpt.txt (excerpted)
```

## pin-drift/ (repository: `odin-labs-ai/odin-labs`, workflow `blueprint-drift-monitor.yml`)

A recorded red-to-green pair of the standing engine-pin drift monitor:

| Run | Conclusion | Verdict | Trigger | Created |
|---|---|---|---|---|
| `30690870648` (RED) | failure | `VERDICT: DRIFT` — a fleet blueprint using a constraint type the *published-pin* engine does not know (`forbiddenPattern` → `invalid_enum_value`, blueprint fails to parse, score 0) | schedule | 2026-08-01T08:00:18Z |
| `30721163116` (GREEN) | success | `VERDICT: CONFORMANT` on the published pin | workflow_dispatch | 2026-08-01T22:23:44Z |

This pair is the version-skew honesty surface observed in production: an unknown constraint fails closed and
loudly, never as a silent pass.

## portfolio-sweep/ (repository: `odin-labs-ai/odin-labs`, workflow `portfolio-conformance-sweep.yml`)

| Run | Conclusion | Portfolio verdict | Created |
|---|---|---|---|
| `30690098892` | cancelled (one member gate job cancelled → reconcile step failure) | `NON-PASS`, `evaluable: 0`, `denominator: 5` — recorded honestly in the fleet score series | 2026-08-01T07:37:13Z |
| `30722371060` | success | `PASS`, `evaluable: 5`, `denominator: 5` | 2026-08-01T22:57:42Z |

Both runs also appear as rows in `evidence/score-series/portfolio-fleet-score-series.jsonl` (the committed fleet
sink), keyed by the same `runId` — a cross-check between the API transcript and the committed series.

## recall-e2e/ (repository: `odin-labs-ai/local-agents`, workflow `ci.yml`)

`pr345-ci-engineering-blueprint-test-block.txt` is the `@odinlabs-ai/engineering-blueprint:test` group of the
`Test & Build (22.x)` job (job `91484629564`) of CI run **`30743364529`** on PR **#345**
("test(engineering-blueprint): corpus expansion N=9 -> N=25", head `9cae1560`, merged 2026-08-02T10:33:07Z,
merge commit `f8d6a900`). It records, among the package's 42 files / 564 tests, the corpus-expansion recall
proof: `tests/recall-e2e-proof.test.ts (52 tests)` and `tests/corpus.test.ts (13 tests)` — all green.

```bash
gh api repos/odin-labs-ai/local-agents/actions/jobs/91484629564/logs   # full job log
# excerpt = the ##[group]@odinlabs-ai/engineering-blueprint:test … ##[endgroup] block, ANSI-stripped
```

## branch-protection/

Live branch-protection API reads (fetched 2026-08-02), showing the blueprint gates wired as required checks
where configured:

```bash
gh api repos/odin-labs-ai/odin-suite/branches/main/protection      > odin-suite-main-protection.json
gh api repos/odin-labs-ai/odin-labs/branches/main/protection       > odin-labs-main-protection.json
gh api repos/odin-labs-ai/local-agents/branches/main/protection    > local-agents-main-protection.json
```

These are honest snapshots of the live configuration at fetch time, including any weaknesses they disclose
(e.g. `enforce_admins` state) — disclosed, not hidden.
