# Trustless Voting Backend

Production-ready backend API for cryptographically secure elections.

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (optional for session management)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Set up database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Start development server:
```bash
npm run dev
```

The API will be available at http://localhost:3000

## API Endpoints

### Election Management
- POST /api/election/create - Create new election
- GET /api/election - List all elections
- GET /api/election/:id - Get election details
- PATCH /api/election/:id/status - Update election status
- POST /api/election/:id/tally - Tally votes
- GET /api/election/:id/results - Get election results

### Voter Operations
- POST /api/voter/register - Register to vote
- POST /api/voter/vote - Cast encrypted vote
- GET /api/voter/verify/:receipt - Verify vote was counted
- POST /api/voter/receipt - Retrieve vote receipt

### Public Audit
- GET /api/audit/ledger - Get public ledger of votes
- GET /api/audit/verify/:entryId - Verify specific entry
- GET /api/audit/merkle-proof/:entryId - Get Merkle proof
- GET /api/audit/election/:id/integrity - Verify election integrity
- GET /api/audit/election/:id/statistics - Get statistics
- GET /api/audit/export/:electionId - Export complete audit trail

### Admin (Protected)
- POST /api/admin/login - Admin login
- GET /api/admin/dashboard - Dashboard data

## Security Features

- End-to-end encryption for all votes
- Zero-knowledge proofs for voter eligibility
- Homomorphic encryption for tallying
- Digital signatures for all operations
- Merkle tree for efficient verification
- Immutable audit trail
- Rate limiting and DDoS protection

## Production Deployment

1. Set NODE_ENV=production
2. Configure production database
3. Set strong JWT_SECRET
4. Enable SSL/TLS
5. Configure CORS for production domain
6. Set up monitoring and logging
7. Enable database replication
8. Configure distributed consensus nodes

## License

Proprietary - All Rights Reserved
