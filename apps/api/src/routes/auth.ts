import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@invoice/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { resolveAllForUser } from '../services/privilege/resolver.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await resolveAllForUser(user.id);
  const token = signToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
    },
  });
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    include: {
      roles: { include: { role: true } },
    },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isSuperAdmin: user.isSuperAdmin,
    teamId: user.teamId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    roles: user.roles.map((r) => r.role),
    previewMode: !!req.auth.previewAsUserId,
  });
  })
);

authRouter.get(
  '/me/privileges',
  authenticate,
  asyncHandler(async (req, res) => {
  const privileges = await prisma.effectivePrivilege.findMany({
    where: { userId: req.auth.userId },
  });

  const map: Record<string, { mode: string; maskPattern?: string }> = {};
  for (const p of privileges) {
    map[`${p.targetLevel}:${p.targetId}`] = {
      mode: p.mode,
      maskPattern: p.maskPattern ?? undefined,
    };
  }

  const menuItems = await prisma.menuItem.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, code: true, name: true, route: true, icon: true, parentId: true, sortOrder: true },
  });
  res.json({ privileges: map, menuItems });
  })
);
