<!--
SPDX-License-Identifier: LicenseRef-Proprietary
Copyright (c) 2026 blockchain-voting-system.
Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
-->

# Developer Guide

## Overview

blockchain-voting-system is a full-stack TypeScript project with:
- backend API in backend
- frontend app in frontend
- shared product story split between trustless voting flows and blockchain-voting-system governance workflows

## Local architecture

Runtime topology (Docker):
- frontend container serves static Vite build behind Nginx on port 5173
- backend container serves Express API on port 3000
- db container runs PostgreSQL 16 on port 5432

Runtime topology (local dev):
- frontend Vite dev server on 5173
- backend Express dev server on 3000
- frontend proxies /api to backend (frontend/vite.config.ts)

## Backend details

Main entrypoint:
- backend/src/index.ts

Configuration loader:
- backend/src/config.ts
- validates env values with Joi
- enforces stricter production checks for placeholder JWT and cookie secrets

Mounted route modules:
- /api/auth -> backend/src/routes/auth.ts
- /api/election-player -> backend/src/routes/election-player.ts
- /api/election-data -> backend/src/routes/election-data.ts
- /api/crypto-audit -> backend/src/routes/crypto-audit.ts
- /api/superadmin -> backend/src/routes/superadmin.ts
- /api/governance -> backend/src/routes/governance.ts
- /api/election and /api/election/:id inline in backend/src/index.ts

Operational endpoints:
- /health and /api/health
- /api/ready (DB readiness)

### Backend scripts

From backend:
- npm run dev
- npm run build
- npm run start
- npm run prisma:generate
- npm run prisma:migrate
- npm run lint
- npm run test:real

Test command behavior:
- npm run test and related default aliases are guarded and print instructions.
- use the *:real variants to execute actual test suites.

## Data model and persistence

Prisma schema:
- backend/prisma/schema.prisma

Important note:
- docker-compose is configured for PostgreSQL.
- current schema datasource provider is sqlite.

If you plan to run strictly against PostgreSQL, align the datasource provider and migrations strategy before production deployment.

Core domain groups in schema:
- Multi-tenant entities: Organization, User, OrganizationSettings, OrganizationAuthProvider
- Governance entities: Member, EligibilityRule, ElectorateSnapshot
- Election entities: Election, Candidate, Voter, Vote, LedgerEntry, TallyResult
- Platform and security entities: SuperAdmin, AuditLog, SecurityEvent

## Frontend details

Main entrypoint and router:
- frontend/src/App.tsx

API client:
- frontend/src/services/api.ts
- base URL defaults to /api and can be overridden by VITE_API_URL

Major product pages:
- Home, Elections, Vote, Verify, Audit
- CryptoDemo, CryptoWhitepaper, BlockchainBrowser, WhyTrustless
- governance flows via BlockchainVotingSystem, GovernanceVerify, SSOCallback
- SuperAdmin, AdminDebug, AdminConfig

## Security implementation notes

Observed in code:
- Helmet, CORS controls, signed cookies, JWT auth flow
- request rate limiting
- request logging and centralized error handling
- audit and crypto-related API surface in crypto-audit and governance routes

Needs hardening for real elections:
- formal key custody model and HSM/KMS-backed secrets
- external cryptographic and application security audit
- strict secrets management and rotation policy
- complete incident response and observability baselines

## Developer workflows

### Install dependencies

From root:
- cd backend && npm install
- cd ../frontend && npm install

Or use scripts/install.ps1 or scripts/install.sh.

### Start local development

Terminal 1:
- cd backend
- npm run dev

Terminal 2:
- cd frontend
- npm run dev

### Run tests

Backend:
- cd backend
- npm run test:real

Frontend:
- cd frontend
- npm run test:real

### Docker workflow

From root:
- docker compose up --build
- docker compose down

## Suggested cleanup backlog

1. Align Prisma provider with intended database backend.
2. Replace any remaining legacy naming and placeholder defaults.
3. Add CI pipeline that runs lint plus real test commands.
4. Add architecture decision records for cryptographic choices.
5. Add end-to-end deployment runbook with secrets management.
