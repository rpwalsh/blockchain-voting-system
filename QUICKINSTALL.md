<!--
SPDX-License-Identifier: LicenseRef-Proprietary
Copyright (c) 2026 blockchain-voting-system.
Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
-->

# Quick Install

## Fastest path (Docker)

From repository root:
1. docker compose up --build
2. Open http://localhost:5173

Health checks:
- http://localhost:3000/health
- http://localhost:3000/api/ready

## Fastest path (Local dev)

### Windows (PowerShell)

From repository root:
- ./scripts/install.ps1 -Start

### macOS/Linux (bash)

From repository root:
- bash ./scripts/install.sh --start

## What the installer does

- Verifies required tooling (node/npm, optional docker)
- Creates backend/.env and frontend/.env from .env.example if missing
- Installs backend and frontend dependencies
- Optionally starts app stack

## Manual fallback

1. Install dependencies:
   - cd backend && npm install
   - cd ../frontend && npm install
2. Start backend:
   - cd backend && npm run dev
3. Start frontend:
   - cd frontend && npm run dev

## Useful flags

PowerShell:
- -Docker: bootstrap and launch docker-compose stack
- -RunMigrations: run Prisma generate + migrate deploy + db push
- -Start: launch dev servers after install

bash:
- --docker
- --run-migrations
- --start
