/**
 * AUTHENTICATION ROUTES
 * Login, Register, Logout, Token Refresh
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { loadConfig } from '../config';
import crypto from '../crypto/engine';
import { prisma } from '../db';

const router = Router();

const config = loadConfig();
const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = config.jwtExpiresIn as any;

async function resolveOrganization(orgSlug?: string) {
  const slug = orgSlug || process.env.DEFAULT_ORG_SLUG || 'public-org';
  let org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    // Create default org if none exists
    org = await prisma.organization.create({
      data: {
        name: slug === 'public-org' ? 'Public Organization' : slug,
        slug,
        type: 'MUNICIPAL',
        primaryContact: 'Admin',
        email: 'admin@example.com',
        publicKey: crypto.generateKeyPair().publicKey,
        apiKey: crypto.generateVotingToken(),
      },
    });
  }
  return org;
}

// POST /api/auth/register - Create new user account
router.post('/register', async (req, res) => {
  try {
    const { email, username, firstName, lastName, password, orgSlug } = req.body;

    // Validation
    if (!email || !username || !firstName || !lastName || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const org = await resolveOrganization(orgSlug);

    // Check if user exists (within org)
    const existing = await prisma.user.findFirst({ where: { organizationId: org.id, email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        username,
        firstName,
        lastName,
        passwordHash,
        role: 'VOTER', // Default role
        isActive: true
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// POST /api/auth/login - Authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password, username, orgSlug } = req.body;

    // Support both email and username login
    const loginId = email || username;

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    // Super admin accounts are provisioned out-of-band via
    // scripts/bootstrap-superadmin.ts; login only checks bcrypt against a
    // stored hash, never auto-creates.
    const superAdminCandidate = await prisma.superAdmin.findUnique({ where: { username: loginId } });
    if (superAdminCandidate) {
      const validSuperAdminPassword = await bcrypt.compare(password, superAdminCandidate.passwordHash);
      if (!validSuperAdminPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          superAdminId: superAdminCandidate.id,
          username: superAdminCandidate.username,
          role: 'SUPER_ADMIN',
          level: 12
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.json({
        message: 'Super Admin login successful',
        token,
        user: {
          id: superAdminCandidate.id,
          username: superAdminCandidate.username,
          role: 'SUPER_ADMIN',
          level: 12
        }
      });
    }

    const org = await resolveOrganization(orgSlug);

    // Regular user login - try email first, then username (within org)
    let user = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: org.id, email: loginId } },
      include: { organization: true }
    });
    
    if (!user) {
      // Try finding by username within org
      user = await prisma.user.findFirst({
        where: { organizationId: org.id, username: loginId },
        include: { organization: true }
      });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    if (!user.passwordHash) {
      return res.status(403).json({ message: 'This account is SSO-only. Use your organization login.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, orgId: user.organizationId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug
        }
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// POST /api/auth/logout - Logout user (client-side token deletion)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded: any = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug
      }
    });
  } catch (error: any) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
