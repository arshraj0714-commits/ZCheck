#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "[start] Working directory: $(pwd)"

# Ensure mongodb is installed
if [ ! -d "node_modules/mongodb" ]; then
  echo "[start] node_modules/mongodb is MISSING — running clean install..."
  rm -rf node_modules package-lock.json
  npm install --omit=dev --no-audit --no-fund
  if [ ! -d "node_modules/mongodb" ]; then
    echo "FATAL: mongodb STILL not installed after npm install."
    exit 1
  fi
  echo "[start] mongodb package installed successfully."
else
  echo "[start] node_modules/mongodb is present — skipping install."
fi

echo "[start] Launching ZCheck bot..."
exec node src/index.js
