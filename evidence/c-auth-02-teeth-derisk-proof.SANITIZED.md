# C-AUTH-02 Teeth De-Risk Proof — SANITIZED DERIVATIVE

> **SANITIZED COPY.** This is a derived, sanitized copy of an internal proof artifact. The original is
> committed byte-intact on the `odin-labs` fleet repository at commit `616fd80b26c0446ace8c6786932b58d426492e58`
> (path `.ai/verify/vp-blueprint-power-b2-teeth-derisk-proof-2026-07-27.md`, landed via PR #955, merge commit
> `ca099d47cd33f5042a3ec7e9322ddbc9b9b8bd26`, merged 2026-08-01T22:01:19Z) and is available to reviewers on
> request. Three strings were replaced in this copy (a tenant hostname, a staging host label, and the tenant
> project slug/blueprint filename); every number, command, and verdict below is verbatim from the original.
> Replacements are marked `[...]`.

---

# B2 De-Risk Proof — a teeth-blueprint catches the movie's C-AUTH-02 RED on the flagship's REAL code

**Date**: 2026-07-27 · `[staging tenant — name withheld]` (`[staging host]`) · project `[project slug withheld]`
**Purpose**: empirically validate B2's premise BEFORE editing blueprint-draft.yaml — that the engine (already shipped) produces the movie's C-AUTH-02 finding when the drafter authors a tenant-guard `requiredDependency` constraint (vs the toothless `requiredComponent` it authors today).

## The real defect (grounded)
- 60 `route.ts` handlers in the flagship project; **0 call requireTenantAccess** (grep-verified).

## The proof (scratch blueprint, /tmp, read-only to the tenant's real blueprints)
```
bce author --id b2-teeth-proof \
  --constraint "requiredDependency:apiRouteHandler:critical" \
  --extraction-profile next-route-handler \
  --scope-paths "**/route.ts" --guard-symbol requireTenantAccess --min-files 1
→ exit 0 (authored)

bce run --extractor ast → ComplianceReport b2-teeth-proof@0.1.0:
  verdict: FAIL · score 0 · 75 violations · coverage ast, 60 files scanned
  each violation = required-dependency-apiroutehandler / critical /
    expected: "requireTenantAccess | requireTenantWriteAccess call in the handler body"
    observed: "no guards edge from route:src:app:api:brain:context..."
```

## Verdict
**PROVEN.** This is exactly the movie's `C-AUTH-02: expected requireTenantAccess, observed requireAuth` — caught RED on the operator's real project. The engine + a teeth-constraint = the movie's power. B2's job is ONLY to make the drafter reliably AUTHOR this (a `requiredDependency:apiRouteHandler:critical` + guardSymbol headline) instead of the toothless `requiredComponent`. No engine change needed (consume-don't-duplicate).

Contrast — the current live toothless blueprint (`[project blueprint file withheld]`): 1 constraint `requiredComponent:apiRouteHandler` → score 100 / pass / 0 violations over the SAME 60 handlers. Same code, opposite verdict — the difference is ENTIRELY the authored constraint. That is the B2 gap, quantified.

---

*Corpus note: the seeded corpus in this repository carries this exact defect shape as `rg-missing-tenant-guard`
(`route-surface/drift-missing-guard`, constraint `d6-tenant-guard`, expected severity `critical`) — the unit-shape
reproduction of the 75-violation finding above, runnable against the engine at its public release.*
