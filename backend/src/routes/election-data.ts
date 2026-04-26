/**
 * REAL 2024 ELECTION DATA API
 * ============================
 * Serves actual county-level presidential election results
 * Data source: tonmcg/US_County_Level_Election_Results_08-24
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/election-data/national - National summary
router.get('/national', async (_req: Request, res: Response) => {
  try {
    const national = await prisma.nationalElection.findFirst({
      where: { year: 2024 }
    });

    if (!national) {
      return res.status(404).json({ error: 'No 2024 election data found' });
    }

    res.json({
      year: national.year,
      type: national.type,
      candidates: {
        gop: { name: national.gopCandidate, party: 'Republican' },
        dem: { name: national.demCandidate, party: 'Democrat' }
      },
      votes: {
        total: national.totalVotes,
        gop: national.votesGop,
        dem: national.votesDem,
        other: national.votesOther,
        gopPercent: (national.votesGop / national.totalVotes * 100).toFixed(1),
        demPercent: (national.votesDem / national.totalVotes * 100).toFixed(1)
      },
      electoral: {
        gop: national.electoralGop,
        dem: national.electoralDem,
        needed: national.electoralNeeded,
        winner: national.winner
      },
      winner: {
        party: national.winner,
        name: national.winnerName
      },
      dataSource: national.dataSource,
      lastUpdated: national.lastUpdated
    });
  } catch (error) {
    console.error('Error fetching national data:', error);
    res.status(500).json({ error: 'Failed to fetch national election data' });
  }
});

// GET /api/election-data/states - All states with results
router.get('/states', async (_req: Request, res: Response) => {
  try {
    const states = await prisma.state.findMany({
      orderBy: { name: 'asc' }
    });

    res.json(states.map(state => ({
      id: state.id,
      name: state.name,
      abbreviation: state.abbreviation,
      votes: {
        total: state.totalVotes,
        gop: state.votesGop,
        dem: state.votesDem,
        gopPercent: state.totalVotes > 0 ? (state.votesGop / state.totalVotes * 100).toFixed(1) : '0',
        demPercent: state.totalVotes > 0 ? (state.votesDem / state.totalVotes * 100).toFixed(1) : '0'
      },
      electoral: state.electoralVotes,
      winner: state.winner
    })));
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: 'Failed to fetch state data' });
  }
});

// GET /api/election-data/states/:stateId - Single state with counties
router.get('/states/:stateId', async (req: Request, res: Response) => {
  try {
    const { stateId } = req.params;
    
    const state = await prisma.state.findUnique({
      where: { id: stateId },
      include: {
        counties: {
          orderBy: { totalVotes: 'desc' }
        }
      }
    });

    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    res.json({
      id: state.id,
      name: state.name,
      abbreviation: state.abbreviation,
      votes: {
        total: state.totalVotes,
        gop: state.votesGop,
        dem: state.votesDem,
        gopPercent: state.totalVotes > 0 ? (state.votesGop / state.totalVotes * 100).toFixed(1) : '0',
        demPercent: state.totalVotes > 0 ? (state.votesDem / state.totalVotes * 100).toFixed(1) : '0'
      },
      electoral: state.electoralVotes,
      winner: state.winner,
      counties: state.counties.map(county => ({
        id: county.id,
        name: county.name,
        votes: {
          total: county.totalVotes,
          gop: county.votesGop,
          dem: county.votesDem,
          gopPercent: county.percentGop,
          demPercent: county.percentDem
        },
        winner: county.winner,
        margin: county.percentDiff
      }))
    });
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Failed to fetch state data' });
  }
});

// GET /api/election-data/counties - All counties (paginated for performance)
router.get('/counties', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const stateId = req.query.state as string;
    const winner = req.query.winner as string;

    const where: any = {};
    if (stateId) where.stateId = stateId;
    if (winner) where.winner = winner.toUpperCase();

    const [counties, total] = await Promise.all([
      prisma.county.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { totalVotes: 'desc' },
        include: {
          state: {
            select: { name: true, abbreviation: true }
          }
        }
      }),
      prisma.county.count({ where })
    ]);

    res.json({
      data: counties.map(county => ({
        id: county.id,
        name: county.name,
        state: county.state.name,
        stateAbbrev: county.state.abbreviation,
        votes: {
          total: county.totalVotes,
          gop: county.votesGop,
          dem: county.votesDem,
          gopPercent: county.percentGop,
          demPercent: county.percentDem
        },
        winner: county.winner,
        margin: county.percentDiff
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching counties:', error);
    res.status(500).json({ error: 'Failed to fetch county data' });
  }
});

// GET /api/election-data/counties/:countyId - Single county
router.get('/counties/:countyId', async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    
    const county = await prisma.county.findUnique({
      where: { id: countyId },
      include: {
        state: true
      }
    });

    if (!county) {
      return res.status(404).json({ error: 'County not found' });
    }

    res.json({
      id: county.id,
      name: county.name,
      state: {
        id: county.state.id,
        name: county.state.name,
        abbreviation: county.state.abbreviation
      },
      votes: {
        total: county.totalVotes,
        gop: county.votesGop,
        dem: county.votesDem,
        gopPercent: county.percentGop,
        demPercent: county.percentDem
      },
      winner: county.winner,
      margin: county.percentDiff,
      reportedAt: county.reportedAt
    });
  } catch (error) {
    console.error('Error fetching county:', error);
    res.status(500).json({ error: 'Failed to fetch county data' });
  }
});

// GET /api/election-data/map - Optimized data for map rendering
router.get('/map', async (_req: Request, res: Response) => {
  try {
    // Get all counties with minimal data for fast map rendering
    const counties = await prisma.county.findMany({
      select: {
        id: true,
        name: true,
        stateId: true,
        winner: true,
        percentGop: true,
        percentDem: true,
        totalVotes: true,
        votesGop: true,
        votesDem: true
      }
    });

    // Get states
    const states = await prisma.state.findMany({
      select: {
        id: true,
        name: true,
        abbreviation: true,
        winner: true,
        electoralVotes: true,
        totalVotes: true,
        votesGop: true,
        votesDem: true
      }
    });

    // Create lookup maps for fast frontend access
    const countyMap: Record<string, any> = {};
    counties.forEach(c => {
      countyMap[c.id] = {
        n: c.name,
        s: c.stateId,
        w: c.winner,
        pg: c.percentGop,
        pd: c.percentDem,
        t: c.totalVotes,
        g: c.votesGop,
        d: c.votesDem
      };
    });

    const stateMap: Record<string, any> = {};
    states.forEach(s => {
      stateMap[s.id] = {
        n: s.name,
        a: s.abbreviation,
        w: s.winner,
        e: s.electoralVotes,
        t: s.totalVotes,
        g: s.votesGop,
        d: s.votesDem
      };
    });

    res.json({
      counties: countyMap,
      states: stateMap,
      meta: {
        countyCount: counties.length,
        stateCount: states.length
      }
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// GET /api/election-data/timeline - Data for election night player
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const step = parseInt(req.query.step as string) || 0;
    const batchSize = parseInt(req.query.batchSize as string) || 50;

    // Get counties in reporting order
    const counties = await prisma.county.findMany({
      where: {
        reportOrder: {
          gt: step * batchSize,
          lte: (step + 1) * batchSize
        }
      },
      orderBy: { reportOrder: 'asc' },
      include: {
        state: {
          select: { name: true, abbreviation: true }
        }
      }
    });

    // Calculate running totals up to this point
    const totals = await prisma.county.aggregate({
      where: {
        reportOrder: {
          lte: (step + 1) * batchSize
        }
      },
      _sum: {
        totalVotes: true,
        votesGop: true,
        votesDem: true
      }
    });

    const totalCounties = await prisma.county.count();
    const reportedCounties = await prisma.county.count({
      where: { reportOrder: { lte: (step + 1) * batchSize } }
    });

    res.json({
      step,
      batchSize,
      counties: counties.map(c => ({
        id: c.id,
        name: c.name,
        state: c.state.abbreviation,
        winner: c.winner,
        gopVotes: c.votesGop,
        demVotes: c.votesDem,
        totalVotes: c.totalVotes,
        gopPercent: c.percentGop,
        demPercent: c.percentDem
      })),
      totals: {
        votes: totals._sum.totalVotes || 0,
        gop: totals._sum.votesGop || 0,
        dem: totals._sum.votesDem || 0
      },
      progress: {
        reported: reportedCounties,
        total: totalCounties,
        percent: ((reportedCounties / totalCounties) * 100).toFixed(1)
      },
      hasMore: reportedCounties < totalCounties
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline data' });
  }
});

// GET /api/election-data/search - Search counties/states
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').toLowerCase();
    if (q.length < 2) {
      return res.json({ states: [], counties: [] });
    }

    const [states, counties] = await Promise.all([
      prisma.state.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { abbreviation: { contains: q.toUpperCase() } }
          ]
        },
        take: 5
      }),
      prisma.county.findMany({
        where: {
          name: { contains: q }
        },
        include: {
          state: { select: { abbreviation: true } }
        },
        take: 10
      })
    ]);

    res.json({
      states: states.map(s => ({
        id: s.id,
        name: s.name,
        abbreviation: s.abbreviation,
        winner: s.winner
      })),
      counties: counties.map(c => ({
        id: c.id,
        name: c.name,
        state: c.state.abbreviation,
        winner: c.winner
      }))
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
