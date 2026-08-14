/**
 * Auth Routes Tests
 * Tests for /api/auth endpoints
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import authRouter from '../../routes/auth';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    superAdmin: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const prisma = new PrismaClient();

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistration = {
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      const mockOrg = { id: 'org-1', name: 'Test Org' };
      const mockUser = {
        id: 'user-1',
        ...validRegistration,
        role: 'VOTER',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token', 'mock-jwt-token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(validRegistration.email);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password must be at least 8 characters');
    });

    it('should return 409 when email already exists', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already registered');
    });

    it('should create default organization if none exists', async () => {
      const mockUser = { id: 'user-1', ...validRegistration, role: 'VOTER' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue({ id: 'new-org' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(201);
      expect(prisma.organization.create).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (prisma.organization.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Registration failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with email successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed',
        role: 'VOTER',
        isActive: true,
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
      };

      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.message).toBe('Login successful');
    });

    it('should login user with username successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed',
        role: 'VOTER',
        isActive: true,
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
      };

      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 400 when credentials missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Username/email and password are required');
    });

    it('should login super admin successfully', async () => {
      const mockSuperAdmin = {
        id: 'super-1',
        username: 'admin',
        passwordHash: 'hashed',
      };

      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue(mockSuperAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'correct-password' });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('SUPER_ADMIN');
    });

    it('should reject super admin login with wrong password', async () => {
      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue({
        id: 'super-1',
        username: 'admin',
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(prisma.superAdmin.create).not.toHaveBeenCalled();
    });

    it('should not auto-create a super admin account on login', async () => {
      (prisma.superAdmin.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1', name: 'Public Organization', slug: 'public-org' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'admin' });

      expect(response.status).toBe(401);
      expect(prisma.superAdmin.create).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 403 for inactive account', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: false,
        organization: {},
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Account is inactive');
    });

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        isActive: true,
        organization: {},
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should handle database errors gracefully', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Login failed');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return logout success message', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'VOTER',
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
      };

      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should return 404 if user not found', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 401 for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });
  });
});
