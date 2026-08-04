#!/usr/bin/env bash

set -euo pipefail

tracked_files="$(git ls-files)"

if printf '%s\n' "$tracked_files" | rg -n '(^|/)(docs/internal|commercial|kaxu-commercial)(/|$)|\.(internal|private)\.md$'; then
  echo "error: internal or commercial material is tracked by the public repository" >&2
  exit 1
fi

if printf '%s\n' "$tracked_files" | rg -n '(^|/)\.env($|\.)|(^|/)(id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$'; then
  echo "error: a likely secret or private key file is tracked" >&2
  exit 1
fi

echo "public repository boundary check passed"
