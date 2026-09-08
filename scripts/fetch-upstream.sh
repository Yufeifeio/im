#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for name in tinode webapp android ios; do
    source="third_party/$name.version"
    repo=$(sed -n 's/^repository=//p' "$source")
    ref=$(sed -n 's/^ref=//p' "$source")
    commit=$(sed -n 's/^commit=//p' "$source")
    if [ ! -d "third_party/$name" ]; then
        git clone --depth 1 --branch "$ref" "$repo" "third_party/$name"
    fi
    test "$(git -C "third_party/$name" rev-parse HEAD)" = "$commit"
done
