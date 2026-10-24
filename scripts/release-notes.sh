#!/usr/bin/env bash
# Release notes for a version: its CHANGELOG.md section, then the download
# table from .github/release-notes.md. Fails if the version has no section,
# so a release can't go out undocumented.
# Usage: scripts/release-notes.sh 1.4.0 > notes.md
set -euo pipefail
version="$1"
section=$(awk -v v="$version" '
  $0 ~ "^## \\[" v "\\]" { found = 1; next }
  found && /^## \[/ { exit }
  found && /^\[[^]]+\]: / { exit }
  found { print }
' CHANGELOG.md)
if [ -z "$(echo "$section" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no section for $version" >&2
  exit 1
fi
printf '%s\n\n' "$(echo "$section" | sed -e '/./,$!d')"
sed "s/{{VERSION}}/${version}/g" .github/release-notes.md
