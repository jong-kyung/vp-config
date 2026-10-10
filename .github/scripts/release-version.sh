#!/usr/bin/env bash
set -euo pipefail

version="${1:?Pass the version to release}"
current="${2:-}"
# npm exec in the checkout rejects its pnpm-only devEngines policy.
cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
normalised="$(npx --yes --package semver@7.7.2 semver "$version")"
if [ "$normalised" != "$version" ]; then
  echo 'Version must be bare semver without a leading v or build metadata.' >&2
  exit 1
fi

if [ -n "$current" ]; then
  npx --yes --package semver@7.7.2 semver "$version" --include-prerelease --range ">$current" >/dev/null || {
    echo "$version must be newer than $current." >&2
    exit 1
  }
fi

case "$version" in
  *-*) echo next ;;
  *) echo latest ;;
esac
