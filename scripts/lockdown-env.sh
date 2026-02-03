#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Usage: $0 /path/to/envfile"
  exit 1
fi

chmod 600 "$FILE"
chown root:root "$FILE" 2>/dev/null || true

echo "Locked down permissions for $FILE"
