#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  🌀 SPiRAL MiND WiKi — Full Deploy Script"
echo "============================================"

cd "$(dirname "$0")"

# 1. Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# 2. Build the wiki data (fetch images, generate cross-links)
echo ""
echo "🔧 Building wiki data..."
npm run sync-data || echo "⚠️  Wiki data build skipped (knowledge base not found or error)"

# 3. Build the Vite production bundle
echo ""
echo "🏗️  Building production bundle..."
npm run build

# 4. Git commit & push
echo ""
echo "📤 Pushing to GitHub..."
git add .
if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "   No changes to commit."
else
  git commit -m "chore: auto-deploy $(date +%Y-%m-%d_%H:%M)"
fi
git push origin main

# 5. Deploy to Railway
echo ""
echo "🚂 Deploying to Railway..."
if command -v railway &>/dev/null; then
  railway up --detach
  echo ""
  echo "✅ Deployment triggered! Check Railway dashboard for status."
else
  echo "⚠️  Railway CLI not found. Push completed to GitHub."
  echo "   If Railway is connected to the GitHub repo, it will auto-deploy."
fi

echo ""
echo "============================================"
echo "  ✨ Deploy complete!"
echo "============================================"
