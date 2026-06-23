import { Router } from 'express';
import { companySchema } from '@invoice/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAction, requireModule } from '../middleware/withPrivilege.js';

export const companyRouter = Router();

companyRouter.use(authenticate);

companyRouter.get('/', requireModule('COMPANY_PROFILE', 'VIEW'), async (_req, res) => {
  const company = await prisma.company.findFirst();
  res.json(company);
});

companyRouter.put('/', requireAction('COMPANY.EDIT'), async (req, res) => {
  const parsed = companySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.company.findFirst();
  const company = existing
    ? await prisma.company.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.company.create({ data: parsed.data });

  res.json(company);
});
