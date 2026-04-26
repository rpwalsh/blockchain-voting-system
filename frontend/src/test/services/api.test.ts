import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { electionService, voterService, auditService } from '../../services/api';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      defaults: { baseURL: 'http://localhost:3000/api' },
    })),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('electionService', () => {
    describe('getElections', () => {
      it('calls GET /election endpoint', async () => {
        const mockResponse = {
          data: {
            elections: [
              { id: '1', name: 'Election 1', status: 'VOTING' },
              { id: '2', name: 'Election 2', status: 'COMPLETED' },
            ],
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await electionService.getElections();

        expect(api.get).toHaveBeenCalledWith('/election');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getElection', () => {
      it('calls GET /election/:id endpoint with correct ID', async () => {
        const mockResponse = {
          data: {
            election: { id: 'test-id', name: 'Test Election' },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await electionService.getElection('test-id');

        expect(api.get).toHaveBeenCalledWith('/election/test-id');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getResults', () => {
      it('calls GET /election/:id/results endpoint', async () => {
        const mockResponse = {
          data: {
            results: { totalVotes: 1000, winner: 'Candidate A' },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await electionService.getResults('election-123');

        expect(api.get).toHaveBeenCalledWith('/election/election-123/results');
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('voterService', () => {
    describe('register', () => {
      it('calls POST /voter/register with correct data', async () => {
        const mockResponse = {
          data: {
            votingToken: 'encrypted-token-123',
            message: 'Registration successful',
          },
        };

        vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

        const voterData = { firstName: 'John', lastName: 'Doe' };
        const result = await voterService.register('election-1', 'voter-123', voterData);

        expect(api.post).toHaveBeenCalledWith('/voter/register', {
          electionId: 'election-1',
          voterId: 'voter-123',
          voterData,
        });
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('vote', () => {
      it('calls POST /voter/vote with correct data', async () => {
        const mockResponse = {
          data: {
            receiptHash: 'receipt-hash',
            ledgerEntryHash: 'ledger-hash',
            merkleRoot: 'merkle-root',
            timestamp: '2024-01-01T00:00:00Z',
          },
        };

        vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

        const result = await voterService.vote('election-1', 'voting-token', 'candidate-1');

        expect(api.post).toHaveBeenCalledWith('/voter/vote', {
          electionId: 'election-1',
          votingToken: 'voting-token',
          candidateId: 'candidate-1',
        });
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('verifyVote', () => {
      it('calls GET /voter/verify/:receiptHash endpoint', async () => {
        const mockResponse = {
          data: {
            verified: true,
            message: 'Vote verified',
            vote: { ledgerEntryHash: 'hash' },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await voterService.verifyVote('receipt-hash-123');

        expect(api.get).toHaveBeenCalledWith('/voter/verify/receipt-hash-123');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getReceipt', () => {
      it('calls POST /voter/receipt with correct data', async () => {
        const mockResponse = {
          data: {
            receipt: { receiptHash: 'hash', timestamp: '2024-01-01T00:00:00Z' },
          },
        };

        vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

        const result = await voterService.getReceipt('voting-token', 'election-1');

        expect(api.post).toHaveBeenCalledWith('/voter/receipt', {
          votingToken: 'voting-token',
          electionId: 'election-1',
        });
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('auditService', () => {
    describe('getLedger', () => {
      it('calls GET /audit/ledger with default params', async () => {
        const mockResponse = {
          data: {
            entries: [{ id: '1', hash: 'hash1' }],
            total: 1,
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await auditService.getLedger();

        expect(api.get).toHaveBeenCalledWith('/audit/ledger', {
          params: { electionId: undefined, limit: 100, offset: 0 },
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('calls GET /audit/ledger with custom params', async () => {
        const mockResponse = { data: { entries: [], total: 0 } };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        await auditService.getLedger('election-1', 50, 100);

        expect(api.get).toHaveBeenCalledWith('/audit/ledger', {
          params: { electionId: 'election-1', limit: 50, offset: 100 },
        });
      });
    });

    describe('verifyEntry', () => {
      it('calls GET /audit/verify/:entryId endpoint', async () => {
        const mockResponse = {
          data: {
            valid: true,
            entry: { id: 'entry-1', hash: 'hash' },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await auditService.verifyEntry('entry-123');

        expect(api.get).toHaveBeenCalledWith('/audit/verify/entry-123');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getElectionIntegrity', () => {
      it('calls GET /audit/election/:id/integrity endpoint', async () => {
        const mockResponse = {
          data: {
            integrity: {
              totalVotes: 1000,
              validProofs: 1000,
              invalidProofs: 0,
              integrityScore: '100%',
            },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await auditService.getElectionIntegrity('election-1');

        expect(api.get).toHaveBeenCalledWith('/audit/election/election-1/integrity');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getStatistics', () => {
      it('calls GET /audit/election/:id/statistics endpoint', async () => {
        const mockResponse = {
          data: {
            statistics: {
              candidates: 5,
              registeredVoters: 10000,
              votesCast: 7500,
              turnoutRate: '75%',
            },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await auditService.getStatistics('election-1');

        expect(api.get).toHaveBeenCalledWith('/audit/election/election-1/statistics');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('exportAuditTrail', () => {
      it('calls GET /audit/export/:electionId endpoint', async () => {
        const mockResponse = {
          data: {
            export: { format: 'json', entries: [] },
          },
        };

        vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

        const result = await auditService.exportAuditTrail('election-1');

        expect(api.get).toHaveBeenCalledWith('/audit/export/election-1');
        expect(result).toEqual(mockResponse.data);
      });
    });
  });
});
