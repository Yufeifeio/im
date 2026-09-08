#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != Darwin ]; then
    echo "iOS build requires macOS with Xcode." >&2
    exit 1
fi
python3 scripts/configure-native.py
cd third_party/ios
pod install --deployment
xcodebuild -workspace Tinodios.xcworkspace -scheme Tinodios -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
