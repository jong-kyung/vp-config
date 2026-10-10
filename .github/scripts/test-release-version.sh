#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

[ "$(bash release-version.sh 1.2.3)" = latest ]
[ "$(bash release-version.sh 1.2.3-alpha.0)" = next ]
[ "$(bash release-version.sh 1.2.3 1.2.3-rc.1)" = latest ]
[ "$(bash release-version.sh 1.2.3-alpha.2 1.2.3-alpha.1)" = next ]

for version in v1.2.3 01.2.3 1.2 1.2.3-alpha..1 1.2.3-alpha.01 1.2.3+build-1 ''; do
  if bash release-version.sh "$version" >/dev/null 2>&1; then
    echo "Accepted invalid version: $version" >&2
    exit 1
  fi
done

for version in 1.2.3 1.2.2 1.2.3-rc.1; do
  if bash release-version.sh "$version" 1.2.3 >/dev/null 2>&1; then
    echo "Accepted non-increasing version: $version" >&2
    exit 1
  fi
done

echo 'Release version checks passed.'
