import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveOne } from '../services/privilege/resolver.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/widgets', async (req, res) => {
  const widgets = await prisma.dashboardWidgetDef.findMany();
  const visible = [];

  for (const widget of widgets) {
    if (req.auth.isSuperAdmin) {
      visible.push(widget);
      continue;
    }
    const { mode } = await resolveOne(req.auth.userId, 'DASHBOARD_WIDGET', widget.code);
    if (mode === 'VISIBLE') visible.push(widget);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fyStart =
    now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

  const [revenueMtd, revenueYtd, outstanding, overdue, recentInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: 'PAID', invoiceDate: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { status: 'PAID', invoiceDate: { gte: fyStart } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { status: 'SENT' },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.count({
      where: { status: 'SENT', dueDate: { lt: now } },
    }),
    prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  res.json({
    widgets: visible,
    data: {
      revenueMtd: revenueMtd._sum.grandTotal ?? 0,
      revenueYtd: revenueYtd._sum.grandTotal ?? 0,
      outstanding: outstanding._sum.grandTotal ?? 0,
      overdueCount: overdue,
      recentInvoices,
    },
  });
});
