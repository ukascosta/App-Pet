#!/usr/bin/env bash
# Gera a prévia web do app (modo demonstração) em preview/app.
set -euo pipefail
cd "$(dirname "$0")/../apps/mobile"
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web --output-dir /tmp/vagari-app-export >/tmp/vagari-export.log 2>&1 || { tail -30 /tmp/vagari-export.log; exit 1; }
cd ../..
node scripts/prepare-app-preview.mjs /tmp/vagari-app-export preview/app
