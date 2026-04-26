#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-Proprietary
# Copyright (c) 2026 blockchain-voting-system.
# Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.

set -euo pipefail

DOCKER_MODE=0
SKIP_INSTALL=0
RUN_MIGRATIONS=0
START_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)
      DOCKER_MODE=1
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --run-migrations)
      RUN_MIGRATIONS=1
      shift
      ;;
    --start)
      START_MODE=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/install.sh [--docker] [--skip-install] [--run-migrations] [--start]"
      exit 1
      ;;
  esac
done

log() {
  echo "[install] $1"
}

require_cmd() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name. $hint" >&2
    exit 1
  fi
}

ensure_env_file() {
  local example_path="$1"
  local target_path="$2"
  if [[ ! -f "$target_path" ]]; then
    cp "$example_path" "$target_path"
    log "Created $target_path from template."
  else
    log "Using existing $target_path"
  fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

log "Repository root: $REPO_ROOT"

require_cmd node "Install Node.js 20+."
require_cmd npm "npm is required for dependency installation."

if [[ "$DOCKER_MODE" -eq 1 ]]; then
  require_cmd docker "Install Docker Desktop or Docker Engine."
  log "Starting Docker stack..."
  (
    cd "$REPO_ROOT"
    docker compose up --build -d
  )
  echo
  echo "Docker services started."
  echo "Frontend: http://localhost:5173"
  echo "Backend:  http://localhost:3000"
  exit 0
fi

log "Ensuring environment files exist..."
ensure_env_file "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
ensure_env_file "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Installing backend dependencies..."
  (
    cd "$BACKEND_DIR"
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  )

  log "Installing frontend dependencies..."
  (
    cd "$FRONTEND_DIR"
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  )
else
  log "Skipping npm install by request."
fi

if [[ "$RUN_MIGRATIONS" -eq 1 ]]; then
  log "Running Prisma generate/migration commands..."
  (
    cd "$BACKEND_DIR"
    npx prisma generate
    npx prisma migrate deploy
    npx prisma db push
  )
fi

if [[ "$START_MODE" -eq 1 ]]; then
  log "Starting backend and frontend dev servers..."
  (
    cd "$BACKEND_DIR"
    npm run dev
  ) &
  BACKEND_PID=$!

  (
    cd "$FRONTEND_DIR"
    npm run dev
  ) &
  FRONTEND_PID=$!

  echo
  echo "Dev servers started."
  echo "Frontend: http://localhost:5173"
  echo "Backend API: http://localhost:3000"
  echo "Press Ctrl+C to stop."

  trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true' INT TERM
  wait "$BACKEND_PID" "$FRONTEND_PID"
else
  echo
  echo "Install completed."
  echo "Next:"
  echo "  cd backend && npm run dev"
  echo "  cd frontend && npm run dev"
fi
