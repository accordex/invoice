import type { Mode, ResolvedPrivilege, TargetLevel } from '@invoice/shared/privilege';
import { prisma } from '../../lib/prisma.js';

const SCOPE_ORDER: Mode[] = ['OWN', 'TEAM', 'BRANCH', 'DEPARTMENT', 'ALL'];

const PERMISSIVE_RANK: Record<string, number> = {
  NO_ACCESS: 0,
  HIDDEN: 1,
  COLLAPSED: 2,
  DISABLED: 3,
  DENY: 4,
  MASKED: 5,
  VIEW: 6,
  VISIBLE: 6,
  OPTIONAL: 7,
  REQUIRED: 8,
  EDIT: 9,
  ALLOW: 9,
  ALLOW_WITH_APPROVAL: 8,
  EXPORT: 10,
  OWN: 1,
  TEAM: 2,
  BRANCH: 3,
  DEPARTMENT: 4,
  ALL: 5,
};

function isGrantActive(validFrom?: Date | null, validUntil?: Date | null): boolean {
  const now = new Date();
  if (validFrom && validFrom > now) return false;
  if (validUntil && validUntil < now) return false;
  return true;
}

export function merge(current: Mode, incoming: Mode): Mode {
  if (incoming === 'DENY' || current === 'DENY') return 'DENY';
  if (SCOPE_ORDER.includes(current) && SCOPE_ORDER.includes(incoming)) {
    return SCOPE_ORDER.indexOf(incoming) > SCOPE_ORDER.indexOf(current) ? incoming : current;
  }
  const curRank = PERMISSIVE_RANK[current] ?? 0;
  const incRank = PERMISSIVE_RANK[incoming] ?? 0;
  return incRank >= curRank ? incoming : current;
}

function registryDefault(level: TargetLevel): Mode {
  switch (level) {
    case 'MENU_ITEM':
    case 'LIST_FILTER':
    case 'DASHBOARD_WIDGET':
      return 'HIDDEN';
    case 'MODULE':
    case 'FORM':
      return 'NO_ACCESS';
    case 'TAB':
    case 'SECTION':
    case 'FIELD':
    case 'LIST_COLUMN':
    case 'REPORT':
      return 'HIDDEN';
    case 'BUTTON':
      return 'HIDDEN';
    case 'BULK_ACTION':
    case 'ACTION':
    case 'STATUS_TRANSITION':
      return 'DENY';
    case 'RECORD_SCOPE':
      return 'OWN';
    default:
      return 'NO_ACCESS';
  }
}

function superAdminMode(level: TargetLevel): Mode {
  switch (level) {
    case 'MENU_ITEM':
    case 'LIST_FILTER':
    case 'BUTTON':
    case 'LIST_COLUMN':
    case 'DASHBOARD_WIDGET':
      return 'VISIBLE';
    case 'MODULE':
    case 'FORM':
    case 'TAB':
    case 'SECTION':
    case 'FIELD':
      return 'EDIT';
    case 'BULK_ACTION':
    case 'ACTION':
    case 'STATUS_TRANSITION':
      return 'ALLOW';
    case 'RECORD_SCOPE':
      return 'ALL';
    case 'REPORT':
      return 'EXPORT';
    default:
      return 'EDIT';
  }
}

async function collectRoleGrants(roleId: string, visited = new Set<string>()) {
  if (visited.has(roleId)) return [];
  visited.add(roleId);

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { grants: true, parentRole: true },
  });
  if (!role) return [];

  const grants = role.grants.filter((g) => isGrantActive(g.validFrom, g.validUntil));
  if (role.parentRoleId) {
    const parentGrants = await collectRoleGrants(role.parentRoleId, visited);
    return [...parentGrants, ...grants];
  }
  return grants;
}

async function loadAllTargets(): Promise<Array<{ level: TargetLevel; targetId: string }>> {
  const [
    menuItems,
    modules,
    forms,
    tabs,
    sections,
    fields,
    buttons,
    columns,
    filters,
    bulkActions,
    actions,
    transitions,
    scopes,
    reports,
    widgets,
  ] = await Promise.all([
    prisma.menuItem.findMany({ select: { code: true } }),
    prisma.module.findMany({ select: { code: true } }),
    prisma.form.findMany({ select: { code: true } }),
    prisma.tab.findMany({ select: { code: true } }),
    prisma.section.findMany({ select: { code: true } }),
    prisma.field.findMany({ select: { code: true } }),
    prisma.button.findMany({ select: { code: true } }),
    prisma.listColumnDef.findMany({ select: { code: true } }),
    prisma.listFilterDef.findMany({ select: { code: true } }),
    prisma.bulkActionDef.findMany({ select: { code: true } }),
    prisma.actionDef.findMany({ select: { code: true } }),
    prisma.statusTransitionDef.findMany({ select: { code: true } }),
    prisma.recordScopeDef.findMany({ select: { module: { select: { code: true } } } }),
    prisma.reportDef.findMany({ select: { code: true } }),
    prisma.dashboardWidgetDef.findMany({ select: { code: true } }),
  ]);

  return [
    ...menuItems.map((m) => ({ level: 'MENU_ITEM' as TargetLevel, targetId: m.code })),
    ...modules.map((m) => ({ level: 'MODULE' as TargetLevel, targetId: m.code })),
    ...forms.map((f) => ({ level: 'FORM' as TargetLevel, targetId: f.code })),
    ...tabs.map((t) => ({ level: 'TAB' as TargetLevel, targetId: t.code })),
    ...sections.map((s) => ({ level: 'SECTION' as TargetLevel, targetId: s.code })),
    ...fields.map((f) => ({ level: 'FIELD' as TargetLevel, targetId: f.code })),
    ...buttons.map((b) => ({ level: 'BUTTON' as TargetLevel, targetId: b.code })),
    ...columns.map((c) => ({ level: 'LIST_COLUMN' as TargetLevel, targetId: c.code })),
    ...filters.map((f) => ({ level: 'LIST_FILTER' as TargetLevel, targetId: f.code })),
    ...bulkActions.map((b) => ({ level: 'BULK_ACTION' as TargetLevel, targetId: b.code })),
    ...actions.map((a) => ({ level: 'ACTION' as TargetLevel, targetId: a.code })),
    ...transitions.map((t) => ({ level: 'STATUS_TRANSITION' as TargetLevel, targetId: t.code })),
    ...scopes.map((s) => ({
      level: 'RECORD_SCOPE' as TargetLevel,
      targetId: s.module.code,
    })),
    ...reports.map((r) => ({ level: 'REPORT' as TargetLevel, targetId: r.code })),
    ...widgets.map((w) => ({ level: 'DASHBOARD_WIDGET' as TargetLevel, targetId: w.code })),
  ];
}

export async function resolveAllForUser(userId: string): Promise<ResolvedPrivilege[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: { role: true },
      },
      overrides: true,
    },
  });

  if (!user) return [];

  const targets = await loadAllTargets();
  if (user.isSuperAdmin) {
    const resolved = targets.map((t) => ({
      level: t.level,
      targetId: t.targetId,
      mode: superAdminMode(t.level),
    }));
    await persistEffective(userId, resolved);
    return resolved;
  }

  const activeRoles = user.roles.filter((ur) => isGrantActive(ur.validFrom, ur.validUntil));
  const allGrants = (
    await Promise.all(activeRoles.map((ur) => collectRoleGrants(ur.roleId)))
  ).flat();

  const activeOverrides = user.overrides.filter((o) => isGrantActive(o.validFrom, o.validUntil));

  const resolved: ResolvedPrivilege[] = [];

  for (const target of targets) {
    let mode = registryDefault(target.level);
    let maskPattern: string | undefined;

    for (const grant of allGrants) {
      if (grant.targetLevel === target.level && grant.targetId === target.targetId) {
        mode = merge(mode, grant.mode as Mode);
        if (grant.maskPattern) maskPattern = grant.maskPattern;
      }
    }

    for (const override of activeOverrides) {
      if (override.targetLevel === target.level && override.targetId === target.targetId) {
        mode = override.mode as Mode;
        if (override.maskPattern) maskPattern = override.maskPattern;
      }
    }

    resolved.push({
      level: target.level,
      targetId: target.targetId,
      mode,
      maskPattern,
      requiresApproval: mode === 'ALLOW_WITH_APPROVAL',
    });
  }

  await persistEffective(userId, resolved);
  return resolved;
}

async function persistEffective(
  userId: string,
  privileges: Array<{ level: TargetLevel; targetId: string; mode: Mode; maskPattern?: string }>
) {
  await prisma.effectivePrivilege.deleteMany({ where: { userId } });
  if (privileges.length === 0) return;

  await prisma.effectivePrivilege.createMany({
    data: privileges.map((p) => ({
      userId,
      targetLevel: p.level,
      targetId: p.targetId,
      mode: p.mode,
      maskPattern: p.maskPattern,
    })),
  });
}

export async function resolveOne(
  userId: string,
  level: TargetLevel,
  targetId: string
): Promise<{ mode: Mode; maskPattern?: string }> {
  const cached = await prisma.effectivePrivilege.findUnique({
    where: {
      userId_targetLevel_targetId: { userId, targetLevel: level, targetId },
    },
  });

  if (cached) {
    return { mode: cached.mode as Mode, maskPattern: cached.maskPattern ?? undefined };
  }

  await resolveAllForUser(userId);
  const refreshed = await prisma.effectivePrivilege.findUnique({
    where: {
      userId_targetLevel_targetId: { userId, targetLevel: level, targetId },
    },
  });

  return {
    mode: (refreshed?.mode as Mode) ?? registryDefault(level),
    maskPattern: refreshed?.maskPattern ?? undefined,
  };
}

export function evaluateCondition(expr: string, record: Record<string, unknown>): boolean {
  try {
    const fn = new Function('record', `return (${expr})`);
    return Boolean(fn(record));
  } catch {
    return true;
  }
}

export async function resolveForRecord(
  userId: string,
  level: TargetLevel,
  targetId: string,
  record: Record<string, unknown>
): Promise<Mode> {
  const base = await resolveOne(userId, level, targetId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { grants: true } } } },
      overrides: true,
    },
  });
  if (!user) return base.mode;

  const conditionalGrants = user.roles
    .flatMap((ur) => ur.role.grants)
    .filter(
      (g) =>
        g.targetLevel === level &&
        g.targetId === targetId &&
        g.conditionExpr &&
        isGrantActive(g.validFrom, g.validUntil)
    );

  let mode = base.mode;
  for (const grant of conditionalGrants) {
    if (evaluateCondition(grant.conditionExpr!, record)) {
      mode = merge(mode, grant.mode as Mode);
    }
  }

  return mode;
}

export async function invalidateUserPrivileges(userIds: string[]) {
  await Promise.all(userIds.map((id) => resolveAllForUser(id)));
}
