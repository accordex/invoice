import type { Request, Response, NextFunction } from 'express';
import { maskValue } from '@invoice/shared/privilege';
import { resolveOne, resolveForRecord } from '../services/privilege/resolver.js';
import { prisma } from '../lib/prisma.js';
import { paramId } from '../lib/params.js';

export const requireAction = (actionCode: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'ACTION', actionCode);
    if (mode === 'ALLOW') return next();
    if (mode === 'ALLOW_WITH_APPROVAL') {
      return res.status(202).json({
        status: 'PENDING_APPROVAL',
        message: 'Action queued for approval',
      });
    }
    return res.status(403).json({ error: 'Forbidden', actionCode });
  };

export const requireModule =
  (moduleCode: string, minMode: 'VIEW' | 'EDIT' = 'VIEW') =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'MODULE', moduleCode);
    const allowed =
      minMode === 'VIEW'
        ? ['VIEW', 'EDIT'].includes(mode)
        : mode === 'EDIT';
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden', moduleCode });
    }
    next();
  };

export const requireTransition = (transitionCode: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'STATUS_TRANSITION', transitionCode);
    if (mode === 'ALLOW') return next();
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
      return res.status(202).json({
        status: 'PENDING_APPROVAL',
        approvalId: approval.id,
        message: 'Transition queued for approval',
      });
    }
    return res.status(403).json({ error: 'Forbidden', transitionCode });
  };

export const requireBulkAction = (bulkActionCode: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'BULK_ACTION', bulkActionCode);
    if (mode === 'ALLOW') return next();
    if (mode === 'ALLOW_WITH_APPROVAL') {
      return res.status(202).json({
        status: 'PENDING_APPROVAL',
        message: 'Bulk action queued for approval',
      });
    }
    return res.status(403).json({ error: 'Forbidden', bulkActionCode });
  };

export const requireReport =
  (reportCode: string, minMode: 'VIEW' | 'EXPORT' = 'VIEW') =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'REPORT', reportCode);
    const allowed =
      minMode === 'EXPORT' ? mode === 'EXPORT' : ['VIEW', 'EXPORT'].includes(mode);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden', reportCode });
    }
    next();
  };

export const applyRecordScope = (moduleCode: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'RECORD_SCOPE', moduleCode);
    req.recordScope = {
      mode,
      userId: req.auth.userId,
      teamId: req.auth.teamId,
      branchId: req.auth.branchId,
      departmentId: req.auth.departmentId,
    };
    next();
  };

export function buildScopeWhere(scope: NonNullable<Request['recordScope']>) {
  switch (scope.mode) {
    case 'ALL':
      return {};
    case 'DEPARTMENT':
      return scope.departmentId ? { departmentId: scope.departmentId } : { createdById: scope.userId };
    case 'BRANCH':
      return scope.branchId ? { branchId: scope.branchId } : { createdById: scope.userId };
    case 'TEAM':
      return scope.teamId ? { teamId: scope.teamId } : { createdById: scope.userId };
    case 'OWN':
    default:
      return { createdById: scope.userId };
  }
}

export function scrubResponseFields(formCode?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (!body || typeof body !== 'object') return originalJson(body);

      const scrub = async (data: Record<string, unknown>) => {
        const fields = formCode
          ? await prisma.field.findMany({
              where: { section: { form: { code: formCode } } },
              select: { code: true },
            })
          : [];

        const result = { ...data };
        for (const field of fields) {
          const { mode, maskPattern } = await resolveOne(
            req.auth.userId,
            'FIELD',
            field.code
          );
          const key = fieldCodeToKey(field.code);
          if (mode === 'HIDDEN' && key in result) delete result[key];
          if (mode === 'MASKED' && key in result && typeof result[key] === 'string') {
            result[key] = maskValue(result[key] as string, maskPattern);
          }
          if (mode === 'VIEW' && key in result) {
            // read-only on client; server still returns value
          }
        }
        return result;
      };

      if (Array.isArray(body)) {
        Promise.all(body.map((item) => scrub(item as Record<string, unknown>))).then((items) =>
          originalJson(items)
        );
        return res;
      }

      scrub(body as Record<string, unknown>).then((item) => originalJson(item));
      return res;
    };
    next();
  };
}

function fieldCodeToKey(code: string): string {
  const map: Record<string, string> = {
    CUSTOMER_EMAIL: 'email',
    CUSTOMER_PHONE: 'phone',
    CUSTOMER_GSTIN: 'gstin',
    COMPANY_EMAIL: 'email',
    COMPANY_PHONE: 'phone',
    COMPANY_GSTIN: 'gstin',
    COMPANY_PAN: 'pan',
    COMPANY_ACCOUNT_NO: 'accountNumber',
  };
  return map[code] ?? code.toLowerCase().replace(/^[a-z]+_/, '');
}

export function scrubRequestFields(formCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.auth.isSuperAdmin) return next();

    const fields = await prisma.field.findMany({
      where: { section: { form: { code: formCode } } },
      select: { code: true },
    });

    for (const field of fields) {
      const { mode } = await resolveOne(req.auth.userId, 'FIELD', field.code);
      if (!['EDIT', 'REQUIRED', 'OPTIONAL'].includes(mode)) {
        const key = fieldCodeToKey(field.code);
        if (key in (req.body as object)) {
          delete (req.body as Record<string, unknown>)[key];
        }
      }
    }
    next();
  };
}
