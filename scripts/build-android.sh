#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME to the installed SDK path}"
python3 scripts/configure-native.py
cd third_party/android
bash gradlew :app:assembleDebug :app:bundleDebug :tinodesdk:testDebugUnitTest :app:testDebugUnitTest --no-daemon --max-workers=2
