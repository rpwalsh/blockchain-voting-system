<!--
SPDX-License-Identifier: LicenseRef-Proprietary
Copyright (c) 2026 blockchain-voting-system.
Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
-->

# blockchain-voting-system

blockchain-voting-system is the deploy-anywhere, white-boxable governance suite built on this repo's cryptographically verifiable voting core.

What you get out of the box:
- Multi-tenant orgs (locals / councils / boards)
- Membership import (CSV/JSON)
- Eligibility rules + electorate snapshots (locked at election creation)
- Receipt verification (Merkle inclusion proofs)
- Proof Pack export (auditor/court bundle as JSON; PDF can be layered later)
- Any auth provider via OIDC (Auth0 / Okta / Azure AD / Google / etc)

## Quick start (Docker)

From repo root:
- `docker compose up --build`

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Postgres: localhost:5432

## Environment knobs (backend)

Key env vars used by blockchain-voting-system:
- `DATABASE_URL` (Postgres)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `COOKIE_SECRET` (signs OIDC state/PKCE cookies)
- `CORS_ORIGIN` (comma-separated allowed origins)
- `GOVERNANCE_APP_URL` (where to redirect after SSO callback)

Optional Proof Pack signing:
- `PROOF_PACK_SIGNING_PRIVATE_KEY` (Ed25519 private key, base64)
- `PROOF_PACK_SIGNING_PUBLIC_KEY` (Ed25519 public key, base64)

## Core API

All routes are under `/api/governance`.

Org + config:
- `GET /api/governance/org` (auth required)
- `PUT /api/governance/org/settings` (ORG_ADMIN)
- `POST /api/governance/org/auth/oidc` (ORG_ADMIN)

Membership:
- `POST /api/governance/members/import` (ORG_ADMIN)
- `GET /api/governance/members` (ORG_ADMIN/ELECTION_OFFICER/AUDITOR)

Eligibility rules:
- `POST /api/governance/eligibility-rules` (ORG_ADMIN/ELECTION_OFFICER)
- `GET /api/governance/eligibility-rules` (ORG_ADMIN/ELECTION_OFFICER/AUDITOR)

Governance elections:
- `POST /api/governance/elections` (ORG_ADMIN/ELECTION_OFFICER)
- `GET /api/governance/elections/:electionId/proof-pack` (ORG_ADMIN/ELECTION_OFFICER/AUDITOR)

Verifier portal (public-friendly):
- `POST /api/governance/verifier/receipt` (no auth)

## Eligibility rule format

Rules are JSON and stored verbatim (portable / white-boxable). Supported operators today:
- `eq`, `neq`, `in`, `nin`, `exists`

Example (dues-current AND active AND unit in A/B):

```json
{
  "all": [
    { "field": "isActive", "op": "eq", "value": true },
    { "field": "duesCurrent", "op": "eq", "value": true },
    { "field": "unit", "op": "in", "value": ["A", "B"] }
  ]
}
```

## OIDC SSO flow

1) Configure provider for an org:
- `POST /api/governance/org/auth/oidc`

2) Start login:
- `GET /api/governance/sso/oidc/:orgSlug/:providerName/login`

3) Provider redirects back to:
- `GET /api/governance/sso/oidc/callback`

On success, backend issues a JWT and redirects to `GOVERNANCE_APP_URL/sso?token=...` (or returns JSON if not requesting HTML).
