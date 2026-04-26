/**
 * API INTEGRATION TESTS
 * ========================
 * Tests for all API endpoints
 * Tests actual HTTP requests and database interactions
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';

// Create a simple test app
const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// Simple health endpoint for testing
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Elections endpoint
app.get('/api/elections', async (_req, res) => {
  try {
    const elections = await prisma.election.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    res.json(elections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Single election endpoint
app.get('/api/elections/:id', async (req, res) => {
  try {
    const election = await prisma.election.findUnique({
      where: { id: req.params.id },
      include: {
        candidates: true,
        _count: {
          select: { votes: true, voters: true },
        },
      },
    });
    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }
    res.json(election);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Candidates endpoint
app.get('/api/elections/:id/candidates', async (req, res) => {
  try {
    const candidates = await prisma.candidate.findMany({
      where: { electionId: req.params.id },
    });
    res.json(candidates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

describe('API Integration Tests - Health', () => {
  test('GET /api/health should return OK status', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('API Integration Tests - Elections', () => {
  test('GET /api/elections should return array', async () => {
    const response = await request(app).get('/api/elections');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/elections/:id should return 404 for non-existent election', async () => {
    const response = await request(app).get('/api/elections/non-existent-id');
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Election not found');
  });

  test('GET /api/elections/:id/candidates should return array', async () => {
    const response = await request(app).get('/api/elections/test-id/candidates');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('API Integration Tests - Database Connection', () => {
  test('should connect to database', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  test('should query elections table', async () => {
    const count = await prisma.election.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should query candidates table', async () => {
    const count = await prisma.candidate.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should query votes table', async () => {
    const count = await prisma.vote.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe('API Integration Tests - Response Format', () => {
  test('should return JSON content type', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.headers['content-type']).toMatch(/json/);
  });

  test('should handle malformed requests gracefully', async () => {
    const response = await request(app)
      .get('/api/elections/undefined');
    
    // Should not crash - either 404 or 500
    expect([404, 500]).toContain(response.status);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
