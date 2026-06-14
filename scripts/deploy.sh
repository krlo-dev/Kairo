#!/usr/bin/env bash
# Deploy script — Kairo v.1
# Requiere SSH configurado a Hostinger en ~/.ssh/config como host "kairo-prod".
# Se completa en Fase 9 con valores reales del servidor.

set -euo pipefail

REMOTE_HOST="${KAIRO_DEPLOY_HOST:-kairo-prod}"
REMOTE_PATH="${KAIRO_DEPLOY_PATH:-/home/user/public_html/kairo}"
BRANCH="${KAIRO_DEPLOY_BRANCH:-main}"

echo "→ Pushing local branch..."
git push origin "$BRANCH"

echo "→ Deploying to $REMOTE_HOST:$REMOTE_PATH..."
ssh "$REMOTE_HOST" bash -se <<EOF
  set -euo pipefail
  cd "$REMOTE_PATH"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"

  cd backend
  npm ci --omit=dev
  npx prisma generate
  npx prisma migrate deploy
  npm run build

  cd ../frontend
  npm ci
  npm run build

  # Restart Passenger (Hostinger Managed Node.js)
  mkdir -p ../tmp
  touch ../tmp/restart.txt

  echo "→ Deploy complete on \$(hostname)"
EOF

echo "→ Smoke test..."
curl -fsSL "https://kairo.com.co/api/health" | head -c 200
echo ""
echo "✓ Deploy completed successfully"
