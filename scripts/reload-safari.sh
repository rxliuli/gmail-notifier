#!/usr/bin/env bash
# Rebuild the Safari extension end to end and relaunch the app so Safari
# picks up the new build - the same three manual steps (wxt zip -b safari,
# build in Xcode, quit + reopen the app) as one command.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Gmail Notifier"
PROJECT_DIR=".output/${APP_NAME}"
XCODEPROJ="${PROJECT_DIR}/${APP_NAME}.xcodeproj"

echo "==> pnpm build:safari"
pnpm build:safari

echo "==> xcodebuild"
xcodebuild -project "$XCODEPROJ" -scheme "$APP_NAME" -configuration Debug build | tail -20

BUILT_PRODUCTS_DIR=$(
  xcodebuild -project "$XCODEPROJ" -scheme "$APP_NAME" -configuration Debug -showBuildSettings 2>/dev/null \
    | grep -m1 'BUILT_PRODUCTS_DIR =' \
    | sed 's/.*= //'
)
APP_PATH="${BUILT_PRODUCTS_DIR}/${APP_NAME}.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Build succeeded but couldn't find the built app at: $APP_PATH"
  exit 1
fi

echo "==> Relaunching ${APP_PATH}"
osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
sleep 1
open "$APP_PATH"

echo "==> Done. If Safari doesn't pick up the new extension version, toggle it off/on in Safari > Settings > Extensions."
