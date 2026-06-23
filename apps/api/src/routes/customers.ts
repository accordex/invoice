import { Router } from 'express';
import { customerSchema } from '@invoice/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import {
  applyRecordScope,
  buildScopeWhere,
  requireAction,
  scrubRequestFields,
  scrubResponseFields,
} from '../middleware/withPrivilege.js';

export const customersRouter = Router();

customersRouter.use(authenticate);

customersRouter.get(
  '/',
  requireAction('CUSTOMER.LIST'),
  applyRecordScope('CUSTOMERS'),
  async (req, res) => {
    const { type, city, state, active, search, page = '1', limit = '25' } = req.query;
    const where: Record<string, unknown> = {
      ...buildScopeWhere(req.recordScope!),
    };

    if (type) where.type = type;
    if (city) where.city = city;
    if (state) where.state = state;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(parseInt(String(limit), 10) || 25, 100);
    const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.customer.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(String(page), 10) || 1, limit: take });
  }
);

customersRouter.post(
  '/',
  requireAction('CUSTOMER.CREATE'),
  scrubRequestFields('CUSTOMER_FORM'),
  async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const customer = await prisma.customer.create({
      data: {
        ...parsed.data,
        createdById: req.auth.userId,
        teamId: req.auth.teamId,
        branchId: req.auth.branchId,
        departmentId: req.auth.departmentId,
      },
    });
    res.status(201).json(customer);
  }
);

customersRouter.get(
  '/:id',
  requireAction('CUSTOMER.VIEW'),
  scrubResponseFields('CUSTOMER_FORM'),
  async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer);
  }
);

customersRouter.patch(
  '/:id',
  requireAction('CUSTOMER.EDIT'),
  scrubRequestFields('CUSTOMER_FORM'),
  async (req, res) => {
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(customer);
  }
);

customersRouter.delete('/:id', requireAction('CUSTOMER.DELETE'), async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

customersRouter.post('/bulk/delete', requireAction('CUSTOMER.BULK_DELETE'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  res.json({ deleted: ids.length });
});

customersRouter.post('/bulk/export', requireAction('CUSTOMER.BULK_EXPORT'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  const items = await prisma.customer.findMany({
    where: ids.length ? { id: { in: ids } } : undefined,
  });
  res.json({ items });
});
