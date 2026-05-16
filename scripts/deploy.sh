#!/usr/bin/env bash
set -euo pipefail

# Install dependencies (clean install)
npm ci

# Build the app using Vite
npm run build

# Stage any changes
git add .

# Commit if there are changes
if ! git diff-index --quiet HEAD --; then
  git commit -m "chore: update build script with image fallback, metadata, and parallelism"
fi

# Push to GitHub
git push origin main

# Deploy to Railway (requires Railway CLI to be logged in)
if command -v railway >/dev/null 2>&1; then
  railway up
else
  echo "Railway CLI not found. Install it with 'npm i -g railway' and run 'railway login' first."
  exit 1
fi
