# verify/ — the zero-dependency chain verifier

`verify-chain.mjs` re-derives the integrity of every hash-chained evidence record in this repository using
**node alone** — no `npm install`, no engine, no network. It is an exact replica of the engine's
canonicalization (recursive key-sort, 2-space `JSON.stringify`, trailing newline, SHA-256), small enough to
audit by eye.

## Run it

```bash
# the born-public chains (35 records, 4 genesis-anchored chains over the public fixtures):
node verify/verify-chain.mjs evidence/born-public

# the production samples (4 records from the live fleet, byte-intact):
node verify/verify-chain.mjs evidence/production-samples

# everything at once:
node verify/verify-chain.mjs evidence
```

Exit code `0` means every record's content hash re-derived and every chain linked from the genesis sentinel.
Any edit to any field of any record makes it fail (try it: change one digit of a `score` and re-run — this is
why the artifact's redaction rule is whole-record exclusion, never field editing).

## What each mode verifies

| Target | Verified property |
|---|---|
| `*.chain.jsonl` | Record integrity for every line AND chain linkage: record 0 anchors at the 64-zero genesis sentinel; every `previousHash` equals the prior record's `hash`. |
| standalone `*.json` record | Record integrity (hash re-derives from the canonicalized body). For the production samples the `previousHash` points at a predecessor record that is not shipped (only the latest link of each live chain is committed on the fleet repository) — the verifier says so explicitly (`LINK-UNVERIFIED (predecessor-not-shipped)`) instead of silently passing. |

## What this does and does not prove

- **Proves**: the shipped records are exactly the bytes the engine emitted (tamper-evidence), and the
  born-public chains are internally consistent hash chains.
- **Does not prove**: that the engine's verdicts are CORRECT — that is what the seeded-defect corpus and the
  recorded recall transcript address, and full public re-execution of those requires the engine package
  (public release planned; see the root README's capability-scope table).
