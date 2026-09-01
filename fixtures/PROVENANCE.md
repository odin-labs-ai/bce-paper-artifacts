# Fixture Provenance

The four surface trees (`extension-surface/`, `egress-surface/`, `route-surface/`, `behavior-surface/`) and the
four subsystem blueprints (`*.engineering-blueprint.json`) are derived from
`packages/engineering-blueprint/fixtures/` at the source repository's `main` HEAD
`1a3c40c97412d493772f569a0390183101bdef73` (repository `odin-labs-ai/local-agents`, private; fetched
2026-08-02, post PR #345).

## Genericization (string-level, semantics-preserving)

Per the open-core release boundary rules, internal-flavored strings were replaced **consistently across
blueprints and fixture sources** so every governed/forbidden relationship is preserved:

| Original class | Replacement |
|---|---|
| internal governed module specifiers (2) | `@example/agent-harness`, `@example/agent-runtime` |
| internal gateway service name | `agent-gateway` |
| internal staging/control hostnames (2) | `staging.example.com`, `control.example.com` |
| internal gateway env var | `AGENT_GATEWAY_URL` |
| internal policy/ADR references in `intentRefs`/`policyRef` and comments | generic `policy:*` / `adr:*` slugs and plain-language policy names |
| internal repository names in `scope.repositories` | `example-agent`, `example-app` |
| a contributor's first name in one comment | removed |

**Deliberately kept** (behavior-bearing, per the open-core decision record): the `odin.ai/v1alpha1`
`apiVersion`, the `odin-extension` extraction profile name and `odinExtension` component type (retained as the
accepted spelling until the public engine ships its dual-accept generic alias), the forbidden provider SDK
names (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai` — these ARE the defect content), and all fixture
directory names, guard symbols, and constraint ids.

## Verdict-preservation validation

At artifact-build time (2026-08-02) the maintainer ran the real engine's `tests/corpus.test.ts` +
`tests/recall-e2e-proof.test.ts` (vitest, node 22) twice in a local checkout: once against the pristine
fixtures, once with this repository's genericized fixtures grafted in. **Both runs: 2 files, 65 tests, all
passing** — every seeded defect still caught at its expected severity, every clean fixture still clean. The
genericization changed no verdict. (This validation ran locally against the private engine; a reviewer can
re-run it when the engine publishes, or on request.)

## Not included (see /EXCLUSIONS.md)

`portfolio/` fixtures, the `control-tower-ontology` blueprint, and `gateway-refusals-synthetic.jsonl` are
excluded from this artifact; none is referenced by the seeded corpus.
