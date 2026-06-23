import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  teamId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  previewAsUserId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthUser;
      recordScope?: {
        mode: string;
        userId: string;
        teamId?: string | null;
        branchId?: string | null;
        departmentId?: string | null;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as {
      userId: string;
      previewAsUserId?: string;
    };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const effectiveUserId = payload.previewAsUserId ?? user.id;
    const effectiveUser =
      effectiveUserId === user.id
        ? user
        : await prisma.user.findUnique({ where: { id: effectiveUserId } });

    if (!effectiveUser) {
      return res.status(401).json({ error: 'Preview user not found' });
    }

    req.auth = {
      userId: effectiveUser.id,
      email: effectiveUser.email,
      fullName: effectiveUser.fullName,
      isSuperAdmin: effectiveUser.isSuperAdmin,
      teamId: effectiveUser.teamId,
      branchId: effectiveUser.branchId,
      departmentId: effectiveUser.departmentId,
      previewAsUserId: payload.previewAsUserId,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(userId: string, previewAsUserId?: string): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  return jwt.sign({ userId, previewAsUserId }, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}
