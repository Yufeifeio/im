#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME}"
tools="$ANDROID_HOME/build-tools/35.0.0"
apk=third_party/android/app/build/outputs/apk/debug/app-debug.apk
aab=third_party/android/app/build/outputs/bundle/debug/app-debug.aab
test -s "$apk"
test -s "$aab"
"$tools/apksigner" verify --verbose "$apk"
"$tools/aapt" dump badging "$apk" | grep -E '^(package:|sdkVersion:|targetSdkVersion:|application-label:|launchable-activity:)'
unzip -tq "$aab"
sha256sum "$apk" "$aab"
echo 'Package checks passed. Device installation, UI and push tests are separate acceptance items.'
