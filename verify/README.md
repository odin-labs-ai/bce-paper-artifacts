# verify/ — the zero-dependency chain verifier

`verify-chain.mjs` re-derives the integrity of every hash-chained evidence record in this repository using
**node alone** — no `npm install`, no engine, no network. It is an exact replica of the engine's
canonicalization (recursive key-sort, 2-space `JSON.stringify`, trailing newline, SHA-256), small enough to
audit by eye.

## Quickstart

Needs Node 18+ and git, nothing else (no `npm install`). Run the commands one per line; this works in bash, zsh,
Git Bash, cmd and Windows PowerShell alike. The paths are relative to the repository root, so `cd` into the clone
first.

```bash
git clone --depth 1 https://github.com/odin-labs-ai/bce-paper-artifacts.git
cd bce-paper-artifacts
node verify/verify-chain.mjs --expect-records 35 --expect-chains 4 evidence/born-public
```

Expected: the summary ends with `35 records in 4 chains, 0 standalone records` and `… checks, 0 failures`, exit
code `0`. Skip the `cd` (run it from the directory you cloned into) and node itself cannot find the script: it
says `Cannot find module … verify-chain.mjs` and exits `1`. Run from the repository root with a target path that
does not exist and the verifier says `not found: … (run from the repository root)` and exits `2`.

## Run it

```bash
# the born-public chains (35 records, 4 genesis-anchored chains over the public fixtures);
# --expect-* make the counts part of the check:
node verify/verify-chain.mjs --expect-records 35 --expect-chains 4 evidence/born-public

# the production samples (4 records from the live fleet, byte-intact):
node verify/verify-chain.mjs evidence/production-samples

# everything at once:
node verify/verify-chain.mjs evidence
```

Exit code `0` means every record's content hash re-derived, every chain linked from the genesis sentinel, every
chain matched its `*.chain-manifest.json` (same length, same record ids in the same order), and at least one
record was verified. An empty chain file, a directory with no records, or a chain with records cut off the end
exits `1`. Editing any field of a record without recomputing the hashes makes it fail (try it: change one digit of
a `score` and re-run — this is why the artifact's redaction rule is whole-record exclusion, never field editing).

The tamper-evidence is relative to the committed bytes. The hashes are self-derived, so someone who edits a record
and then recomputes every hash after it (and the manifest) produces a chain this script accepts. Pin the commit SHA
and check `CHECKSUMS.txt` to rule that out: `shasum -a 256 -c CHECKSUMS.txt` (macOS, Linux) or
`sha256sum -c CHECKSUMS.txt` (Linux, Git Bash on Windows). Windows PowerShell and cmd have no `-c` checker; use
Git Bash there, or in PowerShell compare each line against `(Get-FileHash -Algorithm SHA256 <path>).Hash`
(case-insensitive). `--expect-records` additionally pins the record count.

## What each mode verifies

| Target | Verified property |
|---|---|
| `*.chain.jsonl` | Record integrity for every line AND chain linkage: record 0 anchors at the 64-zero genesis sentinel; every `previousHash` equals the prior record's `hash`. A 0-record chain fails. |
| `<name>.chain-manifest.json` beside `<name>.chain.jsonl` | Chain length equals the manifest length, and record `i`'s `id` equals the manifest's `recordId` at index `i`. A manifest whose chain is missing fails. |
| `--expect-records N` / `--expect-chains M` | Exactly N chained records in M chains were verified. |
| standalone `*.json` record | Record integrity (hash re-derives from the canonicalized body). For the production samples the `previousHash` points at a predecessor record that is not shipped (only the latest link of each live chain is committed on the fleet repository) — the verifier says so explicitly (`LINK-UNVERIFIED (predecessor-not-shipped)`) instead of silently passing. |

## What this does and does not prove

- **Proves**: the shipped records are internally consistent with the bytes the engine emitted (any edit that does
  not recompute the hashes is caught), the born-public chains are complete, internally consistent hash chains
  that match their manifests, and — with `--expect-*` — that the stated counts were verified.
- **Does not prove**: that the engine's verdicts are CORRECT — that is what the seeded-defect corpus and the
  recorded recall transcript address, and full public re-execution of those requires the public engine (npm
  `bce-engine`; see the root README's capability-scope table and re-derivation commands).
