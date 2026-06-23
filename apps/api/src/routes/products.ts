import { Router } from 'express';
import { productSchema } from '@invoice/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { paramId } from '../lib/params.js';
import {
  applyRecordScope,
  buildScopeWhere,
  requireAction,
} from '../middleware/withPrivilege.js';

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requireAction('PRODUCT.LIST'),
  applyRecordScope('PRODUCTS'),
  async (req, res) => {
    const { type, category, active, search, page = '1', limit = '25' } = req.query;
    const where: Record<string, unknown> = {
      ...buildScopeWhere(req.recordScope!),
    };

    if (type) where.type = type;
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { sku: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(parseInt(String(limit), 10) || 25, 100);
    const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.product.count({ where }),
    ]);

    res.json({ items, total });
  }
);

productsRouter.post('/', requireAction('PRODUCT.CREATE'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      sellingPrice: parsed.data.sellingPrice,
      createdById: req.auth.userId,
    },
  });
  res.status(201).json(product);
});

productsRouter.get('/:id', requireAction('PRODUCT.VIEW'), async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: paramId(req.params.id) } });
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

productsRouter.patch('/:id', requireAction('PRODUCT.EDIT'), async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const product = await prisma.product.update({
    where: { id: paramId(req.params.id) },
    data: parsed.data,
  });
  res.json(product);
});

productsRouter.delete('/:id', requireAction('PRODUCT.DELETE'), async (req, res) => {
  await prisma.product.delete({ where: { id: paramId(req.params.id) } });
  res.status(204).send();
});

productsRouter.post('/bulk/delete', requireAction('PRODUCT.BULK_DELETE'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
  res.json({ deleted: ids.length });
});

productsRouter.post('/bulk/export', requireAction('PRODUCT.BULK_EXPORT'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  const items = await prisma.product.findMany({
    where: ids.length ? { id: { in: ids } } : undefined,
  });
  res.json({ items });
});
