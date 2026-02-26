#!/usr/bin/env bash
set -euo pipefail

SRC="${1:-CLAUDE.md}"
DST="${2:-AGENTS.md}"

if [[ ! -f "$SRC" ]]; then
  echo "source file not found: $SRC" >&2
  exit 1
fi

cp "$SRC" "$DST"

if cmp -s "$SRC" "$DST"; then
  echo "synced: $SRC -> $DST"
else
  echo "sync failed: $SRC != $DST" >&2
  exit 1
fi
