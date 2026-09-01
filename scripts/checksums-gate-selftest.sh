#!/usr/bin/env bash
# checksums-gate-selftest.sh — prove all THREE legs can fail, not just the one
# that happened to be demonstrated.
#
# The manifest gate has three legs, and only leg 1 was ever shown to catch
# anything (a byte flipped in corpus/MANIFEST.json reddened it, restoring greened
# it). Leg 2 fired once by accident, against the commit that added this gate's own
# workflow file. Leg 3 has NEVER fired.
#
# Those are the two legs that matter most for the failure this gate exists to
# catch. Leg 1 only checks entries that are LISTED, so an omitted file passes it
# silently — that is precisely how ODIN-PUBLIC-MAPPING.md went ten days unhashed
# while `shasum -c` reported success. Leg 2 is the leg that catches that, and it
# had no negative control.
#
# Each case runs in a throwaway copy. The repository is never mutated.
#
# Exit codes:
#   0 — all three legs failed on their own planted breakage, and passed when clean.
#   1 — a leg did not fail when it should have.
#   2 — harness failure.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0

# The three legs, extracted so the self-test measures the SAME logic the workflow
# runs rather than a paraphrase of it. Keep in lock-step with checksums-gate.yml.
run_legs() {  # run_legs <dir> -> prints "leg1=<rc> leg2=<rc> leg3=<rc>"
  local d="$1" l1=0 l2=0 l3=0
  ( cd "$d" || exit 2
    out="$(shasum -a 256 -c CHECKSUMS.txt 2>&1)"; rc=$?
    bad="$(printf '%s\n' "$out" | grep -c ': FAILED' || true)"
    [ "$rc" -ne 0 ] || [ "$bad" -ne 0 ] && l1=1
    git ls-files | grep -v '^CHECKSUMS.txt$' | sort > "$TMP/t.txt"
    sed 's|^[a-f0-9]\{64\}  \./||' CHECKSUMS.txt | sort > "$TMP/m.txt"
    [ -n "$(comm -23 "$TMP/t.txt" "$TMP/m.txt")" ] && l2=1
    [ -n "$(comm -13 "$TMP/t.txt" "$TMP/m.txt")" ] && l3=1
    echo "leg1=$l1 leg2=$l2 leg3=$l3"
  )
}

fresh() {  # fresh <name> -> path to a clean copy WITH its git index
  local d="$TMP/$1"
  git -C "$REPO_ROOT" archive HEAD --prefix="$1/" | tar -x -C "$TMP"
  ( cd "$d" && git init -q . && git add -A && git -c user.email=s@s -c user.name=s commit -qm x )
  echo "$d"
}

check() {  # check <label> <dir> <leg-that-must-fail>
  local label="$1" dir="$2" want="$3"
  local res; res="$(run_legs "$dir")"
  local got; got="$(echo "$res" | grep -o "${want}=1" || true)"
  if [ -n "$got" ]; then
    echo "  OK    ${label} — ${want} caught it   [${res}]"
  else
    echo "  FAIL  ${label} — ${want} did NOT fire   [${res}]"
    fails=$((fails+1))
  fi
}

echo "checksums-gate selftest: three legs, each against its own planted breakage"
echo

# Baseline: a clean copy must pass all three, or every catch below is meaningless.
base="$(fresh baseline)"
base_res="$(run_legs "$base")"
if [ "$base_res" != "leg1=0 leg2=0 leg3=0" ]; then
  echo "::error::selftest: the CLEAN copy already fails [$base_res] — fix the real drift first."
  exit 2
fi
echo "  baseline: clean copy passes all three legs"
echo

# LEG 1 — content changed, manifest not regenerated.
d="$(fresh leg1)"; python3 - "$d" <<'PY'
import sys,pathlib
p=pathlib.Path(sys.argv[1])/'corpus/MANIFEST.json'
b=bytearray(p.read_bytes())
for i,c in enumerate(b):
    if 48 <= c <= 57:
        b[i]= c+1 if c<57 else 48
        break
p.write_bytes(bytes(b))
PY
check "leg 1 INTEGRITY (byte flipped)" "$d" leg1

# LEG 2 — a tracked file that is absent from the manifest. This is the leg that
# catches what leg 1 structurally cannot see: `shasum -c` only checks entries that
# are listed, so an unlisted file ships unverified and leg 1 still reports success.
d="$(fresh leg2)"
printf 'selftest\n' > "$d/UNMANIFESTED.md"
( cd "$d" && git add UNMANIFESTED.md && git -c user.email=s@s -c user.name=s commit -qm add )
check "leg 2 COVERAGE (tracked file unmanifested)" "$d" leg2

# LEG 3 — a manifest entry naming a file that is not in the tree. Never fired
# before this harness existed.
d="$(fresh leg3)"
printf '%064d  ./GHOST-FILE.md\n' 0 >> "$d/CHECKSUMS.txt"
check "leg 3 NO-ORPHANS (manifest names a vanished file)" "$d" leg3

echo
if [ "$fails" -ne 0 ]; then
  echo "::error::checksums-gate selftest: ${fails} leg(s) failed to fire on a targeted breakage."
  echo "A leg that cannot fail is a leg nobody has watched work."
  exit 1
fi
echo "checksums-gate selftest: PASS — all three legs caught their own planted breakage."
