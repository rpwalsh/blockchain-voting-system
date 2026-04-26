/**
 * Election Data Routes Tests
 * Real 2024 election data API tests
 */

import request from 'supertest';
import express from 'express';

// Create mock functions at module level
const mockNationalFindFirst = jest.fn();
const mockStateFindMany = jest.fn();
const mockStateFindUnique = jest.fn();
const mockCountyFindMany = jest.fn();
const mockCountyFindUnique = jest.fn();
const mockCountyCount = jest.fn();
const mockCountyAggregate = jest.fn();

// Mock Prisma before importing routes
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    nationalElection: {
      findFirst: mockNationalFindFirst,
    },
    state: {
      findMany: mockStateFindMany,
      findUnique: mockStateFindUnique,
    },
    county: {
      findMany: mockCountyFindMany,
      findUnique: mockCountyFindUnique,
      count: mockCountyCount,
      aggregate: mockCountyAggregate,
    },
  })),
}));

// Import after mock setup
import electionDataRoutes from '../../routes/election-data';

const app = express();
app.use(express.json());
app.use('/api/election-data', electionDataRoutes);

describe('Election Data Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/election-data/national', () => {
    it('should return 404 when no election data', async () => {
      mockNationalFindFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/election-data/national');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No 2024 election data found');
    });

    it('should return national election data', async () => {
      mockNationalFindFirst.mockResolvedValue({
        year: 2024,
        type: 'PRESIDENTIAL',
        gopCandidate: 'Donald Trump',
        demCandidate: 'Joe Biden',
        totalVotes: 150000000,
        votesGop: 77000000,
        votesDem: 73000000,
        votesOther: 0,
        electoralGop: 312,
        electoralDem: 226,
        electoralNeeded: 270,
        winner: 'GOP',
        winnerName: 'Donald Trump',
        dataSource: 'Official Results',
        lastUpdated: new Date(),
      });

      const response = await request(app)
        .get('/api/election-data/national');

      expect(response.status).toBe(200);
      expect(response.body.year).toBe(2024);
      expect(response.body.candidates.gop.name).toBe('Donald Trump');
      expect(response.body.electoral.winner).toBe('GOP');
    });

    it('should calculate vote percentages', async () => {
      mockNationalFindFirst.mockResolvedValue({
        year: 2024,
        type: 'PRESIDENTIAL',
        gopCandidate: 'Trump',
        demCandidate: 'Biden',
        totalVotes: 100,
        votesGop: 60,
        votesDem: 40,
        votesOther: 0,
        electoralGop: 312,
        electoralDem: 226,
        electoralNeeded: 270,
        winner: 'GOP',
        winnerName: 'Trump',
        dataSource: 'Test',
        lastUpdated: new Date(),
      });

      const response = await request(app)
        .get('/api/election-data/national');

      expect(response.body.votes.gopPercent).toBe('60.0');
      expect(response.body.votes.demPercent).toBe('40.0');
    });
  });

  describe('GET /api/election-data/states', () => {
    it('should return all states', async () => {
      mockStateFindMany.mockResolvedValue([
        {
          id: 'alabama',
          name: 'Alabama',
          abbreviation: 'AL',
          totalVotes: 2000000,
          votesGop: 1200000,
          votesDem: 800000,
          electoralVotes: 9,
          winner: 'GOP',
        },
        {
          id: 'california',
          name: 'California',
          abbreviation: 'CA',
          totalVotes: 15000000,
          votesGop: 5000000,
          votesDem: 10000000,
          electoralVotes: 54,
          winner: 'DEM',
        },
      ]);

      const response = await request(app)
        .get('/api/election-data/states');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Alabama');
      expect(response.body[1].winner).toBe('DEM');
    });

    it('should handle zero votes state', async () => {
      mockStateFindMany.mockResolvedValue([
        {
          id: 'test',
          name: 'Test State',
          abbreviation: 'TS',
          totalVotes: 0,
          votesGop: 0,
          votesDem: 0,
          electoralVotes: 3,
          winner: null,
        },
      ]);

      const response = await request(app)
        .get('/api/election-data/states');

      expect(response.status).toBe(200);
      expect(response.body[0].votes.gopPercent).toBe('0');
    });
  });

  describe('GET /api/election-data/states/:stateId', () => {
    it('should return 404 for non-existent state', async () => {
      mockStateFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/election-data/states/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('State not found');
    });

    it('should return state with counties', async () => {
      mockStateFindUnique.mockResolvedValue({
        id: 'florida',
        name: 'Florida',
        abbreviation: 'FL',
        totalVotes: 10000000,
        votesGop: 5200000,
        votesDem: 4800000,
        electoralVotes: 30,
        winner: 'GOP',
        counties: [
          {
            id: 'miami-dade',
            name: 'Miami-Dade',
            totalVotes: 1000000,
            votesGop: 400000,
            votesDem: 600000,
            percentGop: 40.0,
            percentDem: 60.0,
            winner: 'DEM',
            percentDiff: -20.0,
          },
        ],
      });

      const response = await request(app)
        .get('/api/election-data/states/florida');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Florida');
      expect(response.body.counties).toHaveLength(1);
      expect(response.body.counties[0].name).toBe('Miami-Dade');
    });
  });

  describe('GET /api/election-data/counties', () => {
    it('should return paginated counties', async () => {
      mockCountyFindMany.mockResolvedValue([
        {
          id: 'la-county',
          name: 'Los Angeles',
          totalVotes: 4000000,
          votesGop: 1200000,
          votesDem: 2800000,
          percentGop: 30.0,
          percentDem: 70.0,
          winner: 'DEM',
          percentDiff: -40.0,
          state: { name: 'California', abbreviation: 'CA' },
        },
      ]);
      mockCountyCount.mockResolvedValue(3143);

      const response = await request(app)
        .get('/api/election-data/counties');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(3143);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should filter by state', async () => {
      mockCountyFindMany.mockResolvedValue([]);
      mockCountyCount.mockResolvedValue(0);

      await request(app)
        .get('/api/election-data/counties?state=florida');

      expect(mockCountyFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stateId: 'florida',
          }),
        })
      );
    });

    it('should filter by winner', async () => {
      mockCountyFindMany.mockResolvedValue([]);
      mockCountyCount.mockResolvedValue(0);

      await request(app)
        .get('/api/election-data/counties?winner=gop');

      expect(mockCountyFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            winner: 'GOP',
          }),
        })
      );
    });

    it('should limit results to max 500', async () => {
      mockCountyFindMany.mockResolvedValue([]);
      mockCountyCount.mockResolvedValue(0);

      await request(app)
        .get('/api/election-data/counties?limit=1000');

      expect(mockCountyFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        })
      );
    });
  });

  describe('GET /api/election-data/counties/:countyId', () => {
    it('should return 404 for non-existent county', async () => {
      mockCountyFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/election-data/counties/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('County not found');
    });

    it('should return county details', async () => {
      mockCountyFindUnique.mockResolvedValue({
        id: 'cook-county',
        name: 'Cook County',
        totalVotes: 2000000,
        votesGop: 600000,
        votesDem: 1400000,
        percentGop: 30.0,
        percentDem: 70.0,
        winner: 'DEM',
        percentDiff: -40.0,
        reportedAt: new Date('2024-11-05'),
        state: {
          id: 'illinois',
          name: 'Illinois',
          abbreviation: 'IL',
        },
      });

      const response = await request(app)
        .get('/api/election-data/counties/cook-county');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Cook County');
      expect(response.body.state.name).toBe('Illinois');
      expect(response.body.winner).toBe('DEM');
    });
  });

  describe('GET /api/election-data/map', () => {
    it('should return optimized map data', async () => {
      mockCountyFindMany.mockResolvedValue([
        {
          id: 'county1',
          name: 'County 1',
          stateId: 'state1',
          winner: 'GOP',
          percentGop: 60,
          percentDem: 40,
          totalVotes: 10000,
          votesGop: 6000,
          votesDem: 4000,
        },
      ]);
      mockStateFindMany.mockResolvedValue([
        {
          id: 'state1',
          name: 'State 1',
          abbreviation: 'S1',
          winner: 'GOP',
          electoralVotes: 10,
          totalVotes: 1000000,
          votesGop: 600000,
          votesDem: 400000,
        },
      ]);

      const response = await request(app)
        .get('/api/election-data/map');

      expect(response.status).toBe(200);
      expect(response.body.counties).toBeDefined();
      expect(response.body.states).toBeDefined();
      expect(response.body.meta.countyCount).toBe(1);
      expect(response.body.meta.stateCount).toBe(1);
    });
  });

  describe('GET /api/election-data/timeline', () => {
    it('should return timeline data', async () => {
      mockCountyFindMany.mockResolvedValue([
        {
          id: 'county1',
          name: 'County 1',
          votesGop: 5000,
          votesDem: 4000,
          totalVotes: 9000,
          winner: 'GOP',
          percentGop: 55.5,
          percentDem: 44.5,
          state: { name: 'State 1', abbreviation: 'S1' },
        },
      ]);
      mockCountyAggregate.mockResolvedValue({
        _sum: {
          totalVotes: 9000,
          votesGop: 5000,
          votesDem: 4000,
        },
      });
      mockCountyCount
        .mockResolvedValueOnce(3143)  // total
        .mockResolvedValueOnce(50);   // reported

      const response = await request(app)
        .get('/api/election-data/timeline');

      expect(response.status).toBe(200);
      expect(response.body.step).toBe(0);
      expect(response.body.counties).toBeInstanceOf(Array);
      expect(response.body.totals).toBeDefined();
      expect(response.body.progress).toBeDefined();
    });

    it('should handle step parameter', async () => {
      mockCountyFindMany.mockResolvedValue([]);
      mockCountyAggregate.mockResolvedValue({
        _sum: { totalVotes: 0, votesGop: 0, votesDem: 0 },
      });
      mockCountyCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/election-data/timeline?step=5&batchSize=100');

      expect(response.body.step).toBe(5);
      expect(response.body.batchSize).toBe(100);
    });
  });

  describe('GET /api/election-data/search', () => {
    it('should return empty for short query', async () => {
      const response = await request(app)
        .get('/api/election-data/search?q=a');

      expect(response.status).toBe(200);
      expect(response.body.states).toEqual([]);
      expect(response.body.counties).toEqual([]);
    });

    it('should search states and counties', async () => {
      mockStateFindMany.mockResolvedValue([
        { id: 'texas', name: 'Texas', abbreviation: 'TX', winner: 'GOP' },
      ]);
      mockCountyFindMany.mockResolvedValue([
        { id: 'travis', name: 'Travis County', winner: 'DEM', state: { abbreviation: 'TX' } },
      ]);

      const response = await request(app)
        .get('/api/election-data/search?q=texas');

      expect(response.status).toBe(200);
      expect(response.body.states).toHaveLength(1);
      expect(response.body.counties).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('GET /national should handle database errors', async () => {
      mockNationalFindFirst.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/election-data/national');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch national election data');
    });

    it('GET /states should handle database errors', async () => {
      mockStateFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/states');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch state data');
    });

    it('GET /states/:stateId should handle database errors', async () => {
      mockStateFindUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/states/CA');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch state data');
    });

    it('GET /counties should handle database errors', async () => {
      mockCountyFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/counties');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch county data');
    });

    it('GET /counties/:countyId should handle database errors', async () => {
      mockCountyFindUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/counties/los-angeles');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch county data');
    });

    it('GET /map should handle database errors', async () => {
      mockCountyFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/map');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch map data');
    });

    it('GET /timeline should handle database errors', async () => {
      mockCountyFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/timeline');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch timeline data');
    });

    it('GET /search should handle database errors', async () => {
      mockStateFindMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/election-data/search?q=test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Search failed');
    });
  });
});
