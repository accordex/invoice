import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAction } from '../middleware/withPrivilege.js';
import { resolveAllForUser, invalidateUserPrivileges } from '../services/privilege/resolver.js';
import { syncRegistryFromManifest } from '../services/privilege/registry.js';
import { invoiceManifest } from '../seed/invoice-registry.js';
import { signToken } from '../middleware/auth.js';

export const privilegeRouter = Router();

privilegeRouter.use(authenticate);

async function requirePrivilegeManage(req: Request, res: Response, next: NextFunction) {
  if (req.auth.isSuperAdmin) return next();
  const middleware = requireAction('PRIVILEGE.MANAGE');
  return middleware(req, res, next);
}

privilegeRouter.use(requirePrivilegeManage);

privilegeRouter.get('/registry', async (_req, res) => {
  const [menuItems, modules, reports, widgets] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.module.findMany({
      include: {
        forms: { include: { sections: { include: { fields: true } }, buttons: true } },
        actions: true,
        bulkActions: true,
        transitions: true,
        listColumns: true,
        listFilters: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.reportDef.findMany(),
    prisma.dashboardWidgetDef.findMany(),
  ]);
  res.json({ menuItems, modules, reports, widgets });
});

privilegeRouter.post('/registry/sync', async (_req, res) => {
  await syncRegistryFromManifest(invoiceManifest);
  res.json({ synced: true });
});

privilegeRouter.get('/roles', async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { userRoles: true, grants: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(roles);
});

privilegeRouter.post('/roles', async (req, res) => {
  const { code, name, description, parentRoleId } = req.body;
  const role = await prisma.role.create({
    data: { code, name, description, parentRoleId },
  });
  await prisma.privilegeAuditLog.create({
    data: {
      actorUserId: req.auth.userId,
      action: 'ROLE.CREATE',
      affectedRoleId: role.id,
      newMode: name,
    },
  });
  res.status(201).json(role);
});

privilegeRouter.get('/roles/:id/grants', async (req, res) => {
  const grants = await prisma.rolePrivilegeGrant.findMany({
    where: { roleId: req.params.id },
  });
  res.json(grants);
});

privilegeRouter.put('/roles/:id/grants', async (req, res) => {
  const grants: Array<{
    targetLevel: string;
    targetId: string;
    mode: string;
    maskPattern?: string;
    validFrom?: string;
    validUntil?: string;
    conditionExpr?: string;
  }> = req.body.grants ?? [];

  await prisma.rolePrivilegeGrant.deleteMany({ where: { roleId: req.params.id } });
  await prisma.rolePrivilegeGrant.createMany({
    data: grants.map((g) => ({
      roleId: req.params.id,
      targetLevel: g.targetLevel,
      targetId: g.targetId,
      mode: g.mode,
      maskPattern: g.maskPattern,
      validFrom: g.validFrom ? new Date(g.validFrom) : undefined,
      validUntil: g.validUntil ? new Date(g.validUntil) : undefined,
      conditionExpr: g.conditionExpr,
      createdBy: req.auth.userId,
    })),
  });

  const userIds = (
    await prisma.userRole.findMany({
      where: { roleId: req.params.id },
      select: { userId: true },
    })
  ).map((u) => u.userId);
  await invalidateUserPrivileges(userIds);

  res.json({ updated: grants.length });
});

privilegeRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { fullName: 'asc' },
  });
  res.json(users);
});

privilegeRouter.get('/users/:id/effective', async (req, res) => {
  const privileges = await resolveAllForUser(req.params.id);
  res.json(privileges);
});

privilegeRouter.post('/users/:id/preview', async (req, res) => {
  const token = signToken(req.auth.userId, req.params.id);
  await prisma.privilegeAuditLog.create({
    data: {
      actorUserId: req.auth.userId,
      action: 'LOGIN.AS_USER',
      affectedUserId: req.params.id,
    },
  });
  res.json({ token });
});

privilegeRouter.get('/templates', async (_req, res) => {
  const templates = await prisma.privilegeTemplate.findMany({
    include: { items: true },
  });
  res.json(templates);
});

privilegeRouter.post('/templates/:id/apply', async (req, res) => {
  const { roleId, strategy = 'overwrite' } = req.body;
  const template = await prisma.privilegeTemplate.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!template) return res.status(404).json({ error: 'Not found' });

  const existing = await prisma.rolePrivilegeGrant.findMany({ where: { roleId } });

  if (strategy === 'overwrite') {
    await prisma.rolePrivilegeGrant.deleteMany({ where: { roleId } });
    await prisma.rolePrivilegeGrant.createMany({
      data: template.items.map((item) => ({
        roleId,
        targetLevel: item.targetLevel,
        targetId: item.targetId,
        mode: item.mode,
        maskPattern: item.maskPattern,
        createdBy: req.auth.userId,
      })),
    });
  } else if (strategy === 'merge') {
    const map = new Map(existing.map((g) => [`${g.targetLevel}:${g.targetId}`, g]));
    for (const item of template.items) {
      const key = `${item.targetLevel}:${item.targetId}`;
      if (!map.has(key)) {
        await prisma.rolePrivilegeGrant.create({
          data: {
            roleId,
            targetLevel: item.targetLevel,
            targetId: item.targetId,
            mode: item.mode,
            maskPattern: item.maskPattern,
            createdBy: req.auth.userId,
          },
        });
      }
    }
  }

  res.json({ applied: template.items.length });
});

privilegeRouter.get('/approvals', async (req, res) => {
  const status = String(req.query.status ?? 'PENDING');
  const approvals = await prisma.approvalRequest.findMany({
    where: { status },
    include: { requester: { select: { fullName: true, email: true } } },
    orderBy: { requestedAt: 'desc' },
  });
  res.json(approvals);
});

privilegeRouter.post('/approvals/:id/approve', async (req, res) => {
  const approval = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'APPROVED',
      approverId: req.auth.userId,
      approverNote: req.body.note,
      resolvedAt: new Date(),
    },
  });

  if (approval.recordType === 'INVOICE' && approval.recordId && approval.payload) {
    const transition = await prisma.statusTransitionDef.findFirst({
      where: { code: approval.targetId },
    });
    if (transition) {
      await prisma.invoice.update({
        where: { id: approval.recordId },
        data: { status: transition.toStatus },
      });
    }
  }

  res.json(approval);
});

privilegeRouter.post('/approvals/:id/reject', async (req, res) => {
  const approval = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'REJECTED',
      approverId: req.auth.userId,
      approverNote: req.body.note,
      resolvedAt: new Date(),
    },
  });
  res.json(approval);
});

privilegeRouter.get('/audit', async (req, res) => {
  const { actorUserId, affectedUserId, page = '1', limit = '50' } = req.query;
  const where: Record<string, unknown> = {};
  if (actorUserId) where.actorUserId = actorUserId;
  if (affectedUserId) where.affectedUserId = affectedUserId;

  const take = parseInt(String(limit), 10) || 50;
  const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.privilegeAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.privilegeAuditLog.count({ where }),
  ]);
  res.json({ items, total });
});

privilegeRouter.get('/roles/compare', async (req, res) => {
  const a = String(req.query.a);
  const b = String(req.query.b);
  const [grantsA, grantsB] = await Promise.all([
    prisma.rolePrivilegeGrant.findMany({ where: { roleId: a } }),
    prisma.rolePrivilegeGrant.findMany({ where: { roleId: b } }),
  ]);

  const mapA = new Map(grantsA.map((g) => [`${g.targetLevel}:${g.targetId}`, g]));
  const mapB = new Map(grantsB.map((g) => [`${g.targetLevel}:${g.targetId}`, g]));
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);

  const diff = [...keys].map((key) => ({
    key,
    a: mapA.get(key)?.mode ?? null,
    b: mapB.get(key)?.mode ?? null,
    same: mapA.get(key)?.mode === mapB.get(key)?.mode,
  }));

  res.json(diff);
});
