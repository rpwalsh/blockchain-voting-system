import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config';

// This is the middleware that gates every protected route (requireAuth,
// requireSuperAdmin, requireOrgRole). It uses the shared, validated
// JWT_SECRET from config.ts, which throws rather than falling back to a
// placeholder secret.
const JWT_SECRET = loadConfig().jwtSecret;

export type AuthActorType = 'USER' | 'SUPER_ADMIN';

export interface AuthContext {
  actorType: AuthActorType;
  userId?: string;
  superAdminId?: string;
  orgId?: string;
  role?: string;
  level?: number;
  email?: string;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Super admin tokens
    if (decoded?.superAdminId) {
      req.auth = {
        actorType: 'SUPER_ADMIN',
        superAdminId: decoded.superAdminId,
        role: decoded.role,
        level: decoded.level,
        email: decoded.email,
      };
      return next();
    }

    // Regular user tokens
    req.auth = {
      actorType: 'USER',
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role,
      email: decoded.email,
    };

    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.auth?.actorType === 'SUPER_ADMIN' && (req.auth.level || 0) >= 12) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Super admin required' });
}

export function requireOrgRole(allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.auth?.actorType !== 'USER' || !req.auth.userId || !req.auth.orgId) {
      return res.status(403).json({ success: false, error: 'Organization user required' });
    }

    const role = req.auth.role || 'VIEWER';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient role' });
    }

    return next();
  };
}
