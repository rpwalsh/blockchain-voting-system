/**
 * AUTHENTICATION ROUTES
 * Login, Register, Logout, Token Refresh
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-2024';
const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN as any) || '7d';

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
        publicKey: 'default-key',
        apiKey: 'default-api-key',
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

    console.log('Login attempt:', { email, username, hasPassword: !!password });

    // Support both email and username login
    const loginId = email || username;
    
    if (!loginId || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    // Check for super admin login first (username: admin, password: admin)
    if (loginId === 'admin' && password === 'admin') {
      console.log('Super admin login detected');
      // Super admin login
      let superAdmin = await prisma.superAdmin.findUnique({
        where: { username: 'admin' }
      });
      
      if (!superAdmin) {
        console.log('Creating new super admin');
        // Create super admin if doesn't exist
        const passwordHash = await bcrypt.hash('admin', 12);
        superAdmin = await prisma.superAdmin.create({
          data: {
            username: 'admin',
            passwordHash,
            totpSecret: 'not-configured',
            publicKey: 'super-admin-key'
          }
        });
      }
      
      console.log('Super admin found/created:', superAdmin.id);
      
      const token = jwt.sign(
        { 
          superAdminId: superAdmin.id, 
          username: superAdmin.username, 
          role: 'SUPER_ADMIN',
          level: 12 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      console.log('Token generated, sending response');
      
      return res.json({
        message: 'Super Admin login successful',
        token,
        user: {
          id: superAdmin.id,
          username: superAdmin.username,
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
