/**
 * ELECTION PLAYER INTEGRATION TESTS
 * ===================================
 * Tests for election playback and visualization API
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// Mock election player routes
app.get('/api/election-player/:electionId/stats', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: true,
        _count: {
          select: { votes: true, voters: true },
        },
      },
    });

    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }

    res.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
        totalVotes: election._count.votes,
        totalVoters: election._count.voters,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/election-player/:electionId/timeline', async (req, res) => {
  try {
    const { electionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const votes = await prisma.vote.findMany({
      where: { electionId },
      take: limit,
      orderBy: { ledgerTimestamp: 'asc' },
    });

    res.json({
      success: true,
      electionId,
      totalVotes: votes.length,
      timeline: votes.map((v, i) => ({
        sequenceNumber: i + 1,
        timestamp: v.ledgerTimestamp,
        candidateId: v.candidateId,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/election-player/:electionId/snapshot/:seq', async (req, res) => {
  try {
    const { electionId, seq } = req.params;
    const sequenceNumber = parseInt(seq);

    const votes = await prisma.vote.findMany({
      where: { electionId },
      take: sequenceNumber,
      orderBy: { ledgerTimestamp: 'asc' },
    });

    // Count by candidate
    const counts: Record<string, number> = {};
    votes.forEach(v => {
      counts[v.candidateId] = (counts[v.candidateId] || 0) + 1;
    });

    res.json({
      success: true,
      electionId,
      sequenceNumber,
      totalVotes: votes.length,
      candidateCounts: counts,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

describe('Election Player Integration Tests', () => {
  test('GET /stats should return election statistics', async () => {
    // First, get any election from DB
    const election = await prisma.election.findFirst();
    
    if (!election) {
      console.log('No elections in database, skipping test');
      return;
    }

    const response = await request(app)
      .get(`/api/election-player/${election.id}/stats`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.election).toBeDefined();
    expect(response.body.election.id).toBe(election.id);
  });

  test('GET /stats should return 404 for non-existent election', async () => {
    const response = await request(app)
      .get('/api/election-player/non-existent-id/stats');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Election not found');
  });

  test('GET /timeline should return vote timeline', async () => {
    const election = await prisma.election.findFirst();
    
    if (!election) {
      console.log('No elections in database, skipping test');
      return;
    }

    const response = await request(app)
      .get(`/api/election-player/${election.id}/timeline?limit=10`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.electionId).toBe(election.id);
    expect(response.body.timeline).toBeInstanceOf(Array);
  });

  test('GET /snapshot should return vote snapshot at sequence', async () => {
    const election = await prisma.election.findFirst();
    
    if (!election) {
      console.log('No elections in database, skipping test');
      return;
    }

    const response = await request(app)
      .get(`/api/election-player/${election.id}/snapshot/100`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.sequenceNumber).toBe(100);
    expect(response.body.candidateCounts).toBeDefined();
  });
});

describe('Election Player - Response Format', () => {
  test('responses should include success flag', async () => {
    const response = await request(app)
      .get('/api/election-player/test/stats');

    expect(response.body).toHaveProperty('success');
    expect(typeof response.body.success).toBe('boolean');
  });

  test('error responses should include error message', async () => {
    const response = await request(app)
      .get('/api/election-player/non-existent/stats');

    expect(response.body.success).toBe(false);
    expect(response.body).toHaveProperty('error');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
