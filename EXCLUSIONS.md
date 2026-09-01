# EXCLUSIONS — what was withheld or transformed, and why

The governing rule for hash-chained evidence is **whole-record inclusion or whole-record exclusion, never
field editing** (an edited record no longer hash-verifies). For non-hashed materials (CI logs, prose), this
repository ships **declared excerpts/derivatives**: every removal or replacement is marked inline or in a
provenance header, and nothing verdict-bearing was removed.

## 1. Excluded whole (not in this repository)

| Item | Reason class |
|---|---|
| The engine itself — schema, extractors, evaluator, gate, CLI, built bundles, tests | Open-core release-timing gate: the verifier publishes ~late Oct 2026 as its own repository; shipping engine bytes here would bypass that decision. Available to reviewers on request. |
| The steward/self-revision loop, fleet wiring, served-runtime probe, approval spine, attestation/signing, hosted surfaces | Closed surface per the open-core decision record — commercially closed, not required for any paper result. |
| `fixtures/portfolio/` + `control-tower-ontology.engineering-blueprint.json` (from the source fixture tree) | Name real private repositories throughout; not referenced by the seeded corpus. |
| `fixtures/gateway-refusals-synthetic.jsonl` | Belongs to the closed harvest surface. |
| `docs/D5-prod-fail-closed-digest-tier.md` (engine package doc) | Sole carrier of production-tenant names — the standing must-drop. Never fetched into the build tree. |
| Engine `CHANGELOG.md` | Dense internal work-cycle/reference lore. |
| Predecessor evidence records of the four production samples | The fleet repository commits only the latest link of each chain in place; predecessors are not on its main. The verifier reports the missing-link state explicitly (`LINK-UNVERIFIED`). |
| `ODIN-PUBLIC-MAPPING.md` (steward-internal crosswalk) | Withheld at the public flip (2026-09-01). It is the steward's internal→public identifier crosswalk, written for a repository that was private by assumption ("this PRIVATE artifacts repository intentionally carries odin-internal identifiers"), and it enumerates internal naming, rename maps and host classes that exist for steward planning rather than for referee inspection. **Nothing in it is load-bearing for any paper claim**: no gate reads it, no verifier consumes it, and the identifiers a referee actually needs — the real org, repo names, run IDs and commit SHAs — remain in `transcripts/`, the `PROVENANCE.md` files and §3 below. Available on request. |
| Any git history from the source monorepos, **and this repository's own pre-flip history** | Fresh-history repository only (leak surface). The pre-flip history of this repository is retained privately in `odin-labs-ai/bce-paper-artifacts-attic-2026-09-01` (steward-controlled, never public): it carried a staging-tenant slug, the internal package registry hostname and internal workflow ids in deleted-line diffs across all refs, none of which are present in the shipped tree. |

## 2. Shipped as declared derivatives/excerpts

| Item | Transformation (all declared inline) |
|---|---|
| `fixtures/**` | String genericization only (module names, hostnames, env var, policy refs, one contributor first name) — enumerated in `fixtures/PROVENANCE.md`, with a 65/65 engine-test verdict-preservation validation. Structure, ids, constraint ids, severities, and defect content untouched. |
| `corpus/MANIFEST.json` | `description` fields genericized (one profile-name substitution); all id/mapping fields verbatim from the frozen corpus constant. |
| `transcripts/**/job-log-excerpt.txt` | ANSI stripped; git-fetch branch/tag enumeration removed (counts in each header — those lines name unrelated internal work branches, several of which embed customer-tenant or contributor names, which are zero-tolerance strings); registry-auth and registry-config boilerplate replaced by inline markers. No gate/probe/sweep execution or verdict content removed. |
| `transcripts/**/jobs-summary.json` | Projection of the jobs API response; one CI secret NAME masked as `[secret-name redacted]` (the secret VALUE never appears in any API response). |
| `evidence/c-auth-02-teeth-derisk-proof.SANITIZED.md` | Three strings replaced (staging-tenant name, staging-host label, tenant project slug/blueprint filename); original path + commit cited in its header; all numbers/commands/verdicts verbatim. |

## 3. Reviewed disclosures (deliberate, not leakage)

- The real GitHub organization, repository names, run IDs, job IDs, and commit SHAs appear in `transcripts/`,
  the `PROVENANCE.md` files, `README.md`, and this file — the paper cites these runs, and the transcripts
  exist so a reviewer without org access can inspect them.
- The four production evidence records carry fleet blueprint identifiers (e.g.
  `odin-estate--odin-labs-ai-odin-labs@1.0.0`) inside their hashed bodies. Byte-intact wins: editing them
  would destroy hash-verifiability. Reviewed and assessed as organization-name-flavored only (no tenant,
  credential, host, or person data).
- The committed fleet score series name the five member repositories and sweep run IDs — same class.
- `odin.ai/v1alpha1` (`apiVersion`) and the `odin-extension` profile / `odinExtension` component type are
  deliberately KEPT in fixtures per the open-core decision record (behavior-bearing names; the public engine
  will dual-accept a generic alias).

## 4. Leak-audit record (run at build, before push)

Zero-tolerance classes (tenant/person names, production hosts/IPs, credential patterns) were grepped with
`grep -a` (binary-safe — some source fixtures contain NUL-byte traps) over the entire assembled tree with **no
exemptions**; org-internal-flavor classes were grepped over the non-transcript zone with the §3 disclosures as
the only allowed hits. The recorded audit transcript follows (also the gate for every future re-push):

```
LEAK AUDIT — bce-paper-artifacts — 2026-08-02T20:04:43Z
tree: 118 files. All greps use grep -a (binary-safe).

## A1 tenant names + payingProdFloor markers — whole tree, NO exemptions (must be 0)
hits: 0
## A1b person/tenant short names, word-boundary — whole tree, NO exemptions (must be 0)
hits: 0
## A2 production hosts / IPs — whole tree, NO exemptions (must be 0)
hits: 0
## A3 credential patterns + registry hostname — whole tree, NO exemptions (must be 0)
hits: 0
## A4 doctrine refs — fixtures/ corpus/ verify/ evidence data files (must be 0; PROVENANCE prose exempt as reviewed disclosure)
hits: 0
## A5 org-internal names — fixture/corpus/verify/born-public CONTENT (must be 0; PROVENANCE files are the declared A6 zone; odin.ai/v1alpha1 + odin-extension deliberately kept per the release ADR)
hits: 0
## A6 reviewed-disclosure census (org name in transcripts/, PROVENANCE files, README, EXCLUSIONS, production evidence bodies — expected NONZERO, itemized in EXCLUSIONS §3)
org-name occurrences (reviewed disclosure): 130

## H6 evidence byte-integrity (verifier must exit 0)
74 checks, 0 failures
## H7 corpus N assertions
seeded: 25 | clean: 12 | counts block: {'seeded': 25, 'seededFixtureDirs': 23, 'cleanFixtureDirs': 12, 'surfaces': 4}
## H9 LOCKED-phrasing lint over all prose (must be 0)
hits: 0

VERDICT: CLEAN (all must-be-0 classes at 0; A6 disclosures itemized in EXCLUSIONS.md §3)
```
