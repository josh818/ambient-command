#!/usr/bin/env bash
# Vercel build for the Ambient Command web export.
# Handles the Vercel quirk where folders named "node_modules" are dropped
# from static output: rename + patch references in the bundles.
set -euo pipefail

npx expo export --platform web

if [ -d dist/assets/node_modules ]; then
  mv dist/assets/node_modules dist/assets/expo-modules
  grep -rl "assets/node_modules" dist --include="*.js" --include="*.html" | while read -r f; do
    sed -i "s#assets/node_modules#assets/expo-modules#g" "$f"
  done
fi

echo "Build complete."
