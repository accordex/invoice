import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { calcInvoice, calcLine, getNextInvoiceNumber } from '@invoice/shared/calc';
import { invoiceSchema } from '@invoice/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { paramId } from '../lib/params.js';
import {
  applyRecordScope,
  buildScopeWhere,
  requireAction,
  requireBulkAction,
  requireTransition,
} from '../middleware/withPrivilege.js';

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

async function buildInvoiceData(
  input: ReturnType<typeof invoiceSchema.parse>,
  userId: string,
  teamId?: string | null,
  branchId?: string | null,
  departmentId?: string | null
) {
  const company = await prisma.company.findFirst();
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error('Customer not found');

  const lineCalcs = input.lineItems.map((line, idx) => {
    const calc = calcLine(line.quantity, line.rate, line.discountPct, line.taxPct);
    return {
      ...line,
      ...calc,
      sortOrder: line.sortOrder ?? idx,
    };
  });

  const totals = calcInvoice(
    input.lineItems.map((l) => ({
      quantity: l.quantity,
      rate: l.rate,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
    })),
    {
      customerState: customer.state,
      companyState: company?.state ?? 'Karnataka',
      shipping: input.shippingCharges,
      roundOff: input.roundOff,
    }
  );

  return {
    invoiceNumber: input.invoiceNumber,
    invoiceDate: new Date(input.invoiceDate),
    dueDate: new Date(input.dueDate),
    referenceNo: input.referenceNo,
    paymentTerms: input.paymentTerms,
    customerId: input.customerId,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingAddress,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableAmount: totals.taxableAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    shippingCharges: input.shippingCharges,
    roundOff: input.roundOff,
    grandTotal: totals.grandTotal,
    amountInWords: totals.amountInWords,
    notes: input.notes,
    terms: input.terms,
    status: input.status,
    attachmentUrl: input.attachmentUrl,
    createdById: userId,
    teamId,
    branchId,
    departmentId,
    lineItems: {
      create: lineCalcs.map((l) => ({
        productId: l.productId,
        itemName: l.itemName,
        description: l.description,
        hsnSac: l.hsnSac,
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        gross: l.gross,
        discountAmt: l.discountAmt,
        taxableValue: l.taxableValue,
        taxAmt: l.taxAmt,
        lineTotal: l.lineTotal,
        sortOrder: l.sortOrder,
      })),
    },
  };
}

invoicesRouter.get(
  '/next-number',
  requireAction('INVOICE.CREATE'),
  async (_req, res) => {
    const latest = await prisma.invoice.findFirst({
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    res.json({ invoiceNumber: getNextInvoiceNumber(latest?.invoiceNumber ?? null) });
  }
);

invoicesRouter.get(
  '/',
  requireAction('INVOICE.LIST'),
  applyRecordScope('INVOICES'),
  async (req, res) => {
    const {
      status,
      customerId,
      search,
      page = '1',
      limit = '25',
      sortBy = 'invoiceDate',
      sortDir = 'desc',
    } = req.query;

    const where: Record<string, unknown> = {
      ...buildScopeWhere(req.recordScope!),
    };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const take = Math.min(parseInt(String(limit), 10) || 25, 100);
    const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;
    const orderBy = { [String(sortBy)]: sortDir === 'asc' ? 'asc' : 'desc' };

    const [items, total, aggregates] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy,
        skip,
        take,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _count: true,
        _sum: { grandTotal: true },
      }),
    ]);

    res.json({
      items,
      total,
      metrics: {
        count: aggregates._count,
        totalAmount: aggregates._sum.grandTotal ?? 0,
      },
    });
  }
);

invoicesRouter.post('/', requireAction('INVOICE.CREATE'), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const data = await buildInvoiceData(
      parsed.data,
      req.auth.userId,
      req.auth.teamId,
      req.auth.branchId,
      req.auth.departmentId
    );

    const invoice = await prisma.invoice.create({
      data,
      include: { lineItems: true, customer: true },
    });
    res.status(201).json(invoice);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

invoicesRouter.get('/:id', requireAction('INVOICE.VIEW'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: paramId(req.params.id) },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } }, customer: true },
  });
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  res.json(invoice);
});

invoicesRouter.patch('/:id', requireAction('INVOICE.EDIT'), async (req, res) => {
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.invoice.findUnique({
    where: { id: paramId(req.params.id) },
    include: { lineItems: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  if (parsed.data.lineItems) {
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: paramId(req.params.id) } });
    const fullInput = invoiceSchema.parse({ ...existing, ...parsed.data, lineItems: parsed.data.lineItems });
    const data = await buildInvoiceData(
      fullInput,
      existing.createdById,
      existing.teamId,
      existing.branchId,
      existing.departmentId
    );
    const { lineItems, ...invoiceData } = data;
    const invoice = await prisma.invoice.update({
      where: { id: paramId(req.params.id) },
      data: { ...invoiceData, lineItems },
      include: { lineItems: true, customer: true },
    });
    return res.json(invoice);
  }

  const { customerId: _customerId, lineItems: _lineItems, ...updateFields } = parsed.data;
  const invoice = await prisma.invoice.update({
    where: { id: paramId(req.params.id) },
    data: {
      ...updateFields,
      invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : undefined,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    } as Prisma.InvoiceUpdateInput,
    include: { lineItems: true, customer: true },
  });
  res.json(invoice);
});

invoicesRouter.delete('/:id', requireAction('INVOICE.DELETE'), async (req, res) => {
  await prisma.invoice.delete({ where: { id: paramId(req.params.id) } });
  res.status(204).send();
});

invoicesRouter.post('/:id/duplicate', requireAction('INVOICE.DUPLICATE'), async (req, res) => {
  const source = await prisma.invoice.findUnique({
    where: { id: paramId(req.params.id) },
    include: { lineItems: true },
  });
  if (!source) return res.status(404).json({ error: 'Not found' });

  const latest = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  const { id: _id, createdAt: _c, updatedAt: _u, lineItems, ...rest } = source;
  const invoice = await prisma.invoice.create({
    data: {
      ...rest,
      invoiceNumber: getNextInvoiceNumber(latest?.invoiceNumber ?? null),
      status: 'DRAFT',
      createdById: req.auth.userId,
      teamId: req.auth.teamId,
      branchId: req.auth.branchId,
      departmentId: req.auth.departmentId,
      lineItems: {
        create: lineItems.map(({ id: _lid, invoiceId: _iid, ...line }) => line),
      },
    },
    include: { lineItems: true, customer: true },
  });
  res.status(201).json(invoice);
});

invoicesRouter.post('/:id/transition', async (req, res) => {
    const { transitionCode } = req.body;
    if (!req.auth.isSuperAdmin) {
      const { resolveOne } = await import('../services/privilege/resolver.js');
      const { mode } = await resolveOne(req.auth.userId, 'STATUS_TRANSITION', transitionCode);
      if (mode === 'DENY') return res.status(403).json({ error: 'Forbidden', transitionCode });
      if (mode === 'ALLOW_WITH_APPROVAL') {
        const approval = await prisma.approvalRequest.create({
          data: {
            requesterId: req.auth.userId,
            targetLevel: 'STATUS_TRANSITION',
            targetId: transitionCode,
            recordType: 'INVOICE',
            recordId: paramId(req.params.id),
            payload: req.body,
          },
        });
        return res.status(202).json({ status: 'PENDING_APPROVAL', approvalId: approval.id });
      }
      if (mode !== 'ALLOW') return res.status(403).json({ error: 'Forbidden', transitionCode });
    }
    const transition = await prisma.statusTransitionDef.findFirst({
      where: { code: transitionCode },
    });
    if (!transition) return res.status(400).json({ error: 'Invalid transition' });

    const invoice = await prisma.invoice.findUnique({ where: { id: paramId(req.params.id) } });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    if (invoice.status !== transition.fromStatus) {
      return res.status(400).json({ error: 'Invalid status for transition' });
    }

    const updated = await prisma.invoice.update({
      where: { id: paramId(req.params.id) },
      data: { status: transition.toStatus },
      include: { lineItems: true, customer: true },
    });
    res.json(updated);
});

invoicesRouter.get('/:id/pdf', requireAction('INVOICE.DOWNLOAD_PDF'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: paramId(req.params.id) },
    include: { lineItems: true, customer: true },
  });
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  const company = await prisma.company.findFirst();
  res.json({ invoice, company, pdfReady: true });
});

invoicesRouter.post('/bulk/send', requireBulkAction('INVOICE.BULK_SEND'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  const result = await prisma.invoice.updateMany({
    where: { id: { in: ids }, status: 'DRAFT' },
    data: { status: 'SENT' },
  });
  res.json({ updated: result.count });
});

invoicesRouter.post('/bulk/mark-paid', requireBulkAction('INVOICE.BULK_MARK_PAID'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  const result = await prisma.invoice.updateMany({
    where: { id: { in: ids }, status: 'SENT' },
    data: { status: 'PAID' },
  });
  res.json({ updated: result.count });
});

invoicesRouter.post('/bulk/export', requireBulkAction('INVOICE.BULK_EXPORT'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  const items = await prisma.invoice.findMany({
    where: ids.length ? { id: { in: ids } } : undefined,
    include: { customer: true, lineItems: true },
  });
  res.json({ items });
});

invoicesRouter.post('/bulk/delete', requireBulkAction('INVOICE.BULK_DELETE'), async (req, res) => {
  const ids: string[] = req.body.ids ?? [];
  await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
  res.json({ deleted: ids.length });
});
