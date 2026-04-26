<!--
SPDX-License-Identifier: LicenseRef-Proprietary
Copyright (c) 2026 blockchain-voting-system.
Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
-->

# blockchain-voting-system

Cryptographically verifiable, tamper-evident election platform with a TypeScript API, React frontend, and multi-tenant governance workflows.

This repository currently contains two product surfaces:
- Core trustless voting and audit functionality.
- blockchain-voting-system governance workflows built on the same backend.

## Why this exists

The goal is a verifiable voting system where:
- Votes and election events can be independently audited.
- Administrative actions are signed and logged.
- Organizations can run isolated elections under a shared platform.

## Tech stack

- Backend: Node.js, TypeScript, Express, Prisma
- Frontend: React, TypeScript, Vite, MUI
- Database: PostgreSQL (docker-compose), Prisma ORM
- Cryptography libraries in use: tweetnacl, elliptic, sha3, snarkjs
- Deployment: Docker, Docker Compose, Nginx (frontend reverse proxy)

## Repository layout

- backend: API, crypto and audit endpoints, Prisma schema, seed scripts, tests
- frontend: React app, election visualizations, admin and governance flows
- GOVERNANCE.md: blockchain-voting-system product/API notes
- docker-compose.yml: local multi-service stack (db + backend + frontend)
- docs/DEVELOPER_GUIDE.md: engineering-focused documentation
- QUICKINSTALL.md: short setup flow
- scripts/install.ps1 and scripts/install.sh: bootstrap installer scripts

## Quick start

Option A: Docker (recommended first run)

1. From repository root:
	docker compose up --build
2. Open:
	http://localhost:5173
3. API health checks:
	http://localhost:3000/health
	http://localhost:3000/api/health

Option B: Local Node development

1. Backend:
	cd backend
	npm install
	copy .env.example .env   (Windows) or cp .env.example .env (macOS/Linux)
2. Frontend:
	cd ../frontend
	npm install
	copy .env.example .env   (Windows) or cp .env.example .env (macOS/Linux)
3. Start backend (new terminal):
	cd backend
	npm run dev
4. Start frontend (new terminal):
	cd frontend
	npm run dev

## Environment configuration

Backend variables (from backend/.env.example):
- Required for API boot:
  - DATABASE_URL
  - JWT_SECRET
  - COOKIE_SECRET
- Common:
  - PORT (default 3000)
  - NODE_ENV
  - JWT_EXPIRES_IN
  - CORS_ORIGIN (comma-separated supported)
  - RATE_LIMIT_WINDOW_MS
  - RATE_LIMIT_MAX_REQUESTS
	- GOVERNANCE_APP_URL
- Optional:
  - PROOF_PACK_SIGNING_PRIVATE_KEY
  - PROOF_PACK_SIGNING_PUBLIC_KEY

Frontend variables:
- VITE_API_URL (defaults to /api in frontend/src/services/api.ts)

## API surfaces (high level)

Mounted in backend/src/index.ts:
- /api/auth
- /api/election-player
- /api/election-data
- /api/crypto-audit
- /api/superadmin
- /api/governance
- /api/election and /api/election/:id (inline routes)

For governance-specific examples, see GOVERNANCE.md.

## Testing

Backend:
- npm run test prints a guard message.
- Use npm run test:real for Jest coverage.
- Granular suites exist via test:unit:real, test:integration:real, test:e2e:real, test:crypto:real.

Frontend:
- npm run test prints a guard message.
- Use npm run test:real or npm run test:run:real for Vitest.

## Security and production caution

This repository includes serious security-oriented building blocks, but production election deployment requires formal threat modeling, external audits, key management hardening, and legal/regulatory controls before real-world use.
