# Invoice Generator — Cursor Implementation Prompt
**Stack:** React.js (Vite + TypeScript) · Node.js (Express + TypeScript) · PostgreSQL · Prisma · TailwindCSS · shadcn/ui · React Hook Form + Zod · TanStack Query · jsPDF/html2pdf

> **Scope note:** This is a **single-installation build** — no multi-tenancy, no subscription plans, no tenant scoping. The privilege engine and the invoice product run as one application. Multi-tenancy can be layered on top later as an outer wrapper without touching this core.

This document has two parts:

- **PART A — UNIVERSAL PRIVILEGE SYSTEM** (15-level granularity; reusable across all future Accordex products)
- **PART B — INVOICE GENERATOR** (product-specific build)

> 🔁 **HOW TO REUSE PART A IN OTHER PRODUCTS**
> Every block of Part A is wrapped between the markers
> `<!-- ═══ COPY-START: PRIVILEGE ═══ -->` and `<!-- ═══ COPY-END: PRIVILEGE ═══ -->`.
> To use this privilege engine in another product:
> 1. Copy every block between those markers into the new product's Cursor prompt.
> 2. Replace the **Product Manifest** (see Part A §A.10) with the new product's modules, forms, sections, fields, buttons, list columns, status transitions, actions, etc.
> 3. Keep schema, resolver, middleware, hooks, and Admin UI identical — they are product-agnostic by design.

---

# PART A — UNIVERSAL PRIVILEGE SYSTEM (REUSABLE)

<!-- ═══ COPY-START: PRIVILEGE ═══ -->

## A.1 Design Goals

1. **Fifteen-level granularity.** Privileges apply at: menu item, module, form, tab, section, field, button, list column, list filter, bulk action, action, status transition, record scope, report, dashboard widget.
2. **Fully dynamic.** Every privilege is database-driven and editable in the Admin UI; no code changes, no redeploy.
3. **Deterministic resolver.** For any (user, target) pair the effective mode is a pure function of registry + role grants + user overrides.
4. **Audit-friendly.** Every grant/revoke logged with actor, target, before, after, reason.
5. **Reversible.** No destructive operations; everything has a rollback path.
6. **Templatable.** Common privilege bundles ("Front Desk", "Read-Only Auditor", "Finance Approver") saved as templates and applied in one click.
7. **Previewable.** Admin can "view the app as user X" before saving changes.

## A.2 Privilege Vocabulary

### A.2.1 Target Levels

| Level | What it controls | Modes that apply |
|---|---|---|
| `MENU_ITEM` | Sidebar/header nav links | `HIDDEN`, `VISIBLE` |
| `MODULE` | Top-level functional area | `NO_ACCESS`, `VIEW`, `EDIT` |
| `FORM` | Specific data entry / edit screen | `NO_ACCESS`, `VIEW`, `EDIT` |
| `TAB` | A tab within a tabbed form | `HIDDEN`, `VIEW`, `EDIT` |
| `SECTION` | A logical group of fields | `HIDDEN`, `COLLAPSED`, `VIEW`, `EDIT` |
| `FIELD` | A single input or display field | `HIDDEN`, `MASKED`, `VIEW`, `EDIT`, `REQUIRED`, `OPTIONAL` |
| `BUTTON` | A specific button | `HIDDEN`, `DISABLED`, `VISIBLE` |
| `LIST_COLUMN` | A column in a table/list view | `HIDDEN`, `MASKED`, `VISIBLE` |
| `LIST_FILTER` | A filter option in a list | `HIDDEN`, `VISIBLE` |
| `BULK_ACTION` | A bulk operation on selected rows | `ALLOW`, `DENY`, `ALLOW_WITH_APPROVAL` |
| `ACTION` | An imperative verb on a module/record | `ALLOW`, `DENY`, `ALLOW_WITH_APPROVAL` |
| `STATUS_TRANSITION` | Moving a record from status A to status B | `ALLOW`, `DENY`, `ALLOW_WITH_APPROVAL` |
| `RECORD_SCOPE` | Which records the user can see | `OWN`, `TEAM`, `BRANCH`, `DEPARTMENT`, `ALL` |
| `REPORT` | A specific report | `HIDDEN`, `VIEW`, `EXPORT` |
| `DASHBOARD_WIDGET` | A widget on the dashboard | `HIDDEN`, `VISIBLE` |

### A.2.2 Access Modes (full reference)

| Mode | Meaning |
|---|---|
| `NO_ACCESS` | Hidden from navigation; routes return 403 |
| `HIDDEN` | Not rendered |
| `COLLAPSED` | Visible but auto-collapsed (sections only) |
| `DISABLED` | Visible but greyed out (buttons only) |
| `VISIBLE` | Visible (menus, columns, widgets, filters) |
| `VIEW` | Visible but read-only |
| `EDIT` | Visible and writable |
| `MASKED` | Partial visibility per masking pattern |
| `REQUIRED` | Field must be filled (modifier) |
| `OPTIONAL` | Field can be empty (modifier) |
| `ALLOW` | Action permitted |
| `DENY` | Action explicitly blocked |
| `ALLOW_WITH_APPROVAL` | Action queued for approver |
| `OWN` / `TEAM` / `BRANCH` / `DEPARTMENT` / `ALL` | Record scope tiers |
| `EXPORT` | Report can be exported (in addition to view) |

### A.2.3 Field Masking Patterns

| Pattern | Example: `9876543210` → |
|---|---|
| `MASK_NONE` | `9876543210` |
| `MASK_LAST_4` | `******3210` |
| `MASK_FIRST_4` | `9876******` |
| `MASK_MIDDLE` | `j***@gmail.com` (for emails) |
| `MASK_FULL` | `**********` |
| `MASK_INITIAL` | `J. D.` (for names) |
| `MASK_CUSTOM:<regex>:<replace>` | Custom regex mask |

### A.2.4 Resolution Rules

1. If `user.isSuperAdmin` → return most permissive mode for every target.
2. Start with **registry default** for the target (most restrictive).
3. Walk role inheritance; collect grants from assigned role + all ancestor roles.
4. Apply grants with permissive union per level, EXCEPT `DENY` always wins.
5. Apply **User Overrides** as final word for that target.
6. For `RECORD_SCOPE`, broadest scope wins (`ALL` > `BRANCH` > `TEAM` > `OWN`) unless explicit override narrows it.
7. Time-bound grants with expired `validUntil` are ignored.
8. Conditional grants (`conditionExpr`) evaluate against record context at request time.

## A.3 Prisma Schema — Privilege Engine

```prisma
// =========================================================
// PRIVILEGE ENGINE — schema/privilege.prisma
// =========================================================

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  fullName       String
  passwordHash   String
  isActive       Boolean  @default(true)
  isSuperAdmin   Boolean  @default(false)
  teamId         String?
  branchId       String?
  departmentId   String?
  managerId      String?
  createdAt      DateTime @default(now())
  roles          UserRole[]
  overrides      UserPrivilegeOverride[]
  approvalsRaised ApprovalRequest[] @relation("Requester")
}

model Team       { id String @id @default(cuid()); name String; branchId String? }
model Branch     { id String @id @default(cuid()); name String }
model Department { id String @id @default(cuid()); name String }

// ----- REGISTRY (defined by product manifest, seeded) -----

model MenuItem {
  id        String  @id @default(cuid())
  code      String  @unique
  name      String
  icon      String?
  parentId  String?
  parent    MenuItem? @relation("MenuTree", fields: [parentId], references: [id])
  children  MenuItem[] @relation("MenuTree")
  route     String?
  sortOrder Int     @default(0)
}

model Module {
  id          String  @id @default(cuid())
  code        String  @unique
  name        String
  icon        String?
  sortOrder   Int     @default(0)
  forms       Form[]
  actions     ActionDef[]
  bulkActions BulkActionDef[]
  transitions StatusTransitionDef[]
  scopes      RecordScopeDef[]
  listColumns ListColumnDef[]
  listFilters ListFilterDef[]
}

model Form {
  id        String  @id @default(cuid())
  moduleId  String
  module    Module  @relation(fields: [moduleId], references: [id])
  code      String
  name      String
  sortOrder Int     @default(0)
  tabs      Tab[]
  sections  Section[]
  buttons   Button[]
  @@unique([moduleId, code])
}

model Tab {
  id        String  @id @default(cuid())
  formId    String
  form      Form    @relation(fields: [formId], references: [id])
  code      String
  name      String
  sortOrder Int     @default(0)
  sections  Section[]
  @@unique([formId, code])
}

model Section {
  id        String  @id @default(cuid())
  formId    String
  form      Form    @relation(fields: [formId], references: [id])
  tabId     String?
  tab       Tab?    @relation(fields: [tabId], references: [id])
  code      String
  name      String
  sortOrder Int     @default(0)
  fields    Field[]
  @@unique([formId, code])
}

model Field {
  id                 String  @id @default(cuid())
  sectionId          String
  section            Section @relation(fields: [sectionId], references: [id])
  code               String
  name               String
  dataType           String   // 'TEXT' | 'NUMBER' | 'DATE' | 'EMAIL' | 'PHONE' | 'SELECT' | 'TEXTAREA' | 'FILE' | 'CURRENCY' | 'RADIO'
  defaultRequired    Boolean  @default(false)
  defaultMaskPattern String?
  isPii              Boolean  @default(false) // DPDP/GDPR flag
  sortOrder          Int      @default(0)
  @@unique([sectionId, code])
}

model Button {
  id        String  @id @default(cuid())
  formId    String
  form      Form    @relation(fields: [formId], references: [id])
  code      String
  name      String
  variant   String  @default("default")
  sortOrder Int     @default(0)
  @@unique([formId, code])
}

model ActionDef {
  id         String @id @default(cuid())
  moduleId   String
  module     Module @relation(fields: [moduleId], references: [id])
  code       String
  name       String
  isHighRisk Boolean @default(false)
  @@unique([moduleId, code])
}

model BulkActionDef {
  id         String @id @default(cuid())
  moduleId   String
  module     Module @relation(fields: [moduleId], references: [id])
  code       String
  name       String
  isHighRisk Boolean @default(true)
  @@unique([moduleId, code])
}

model StatusTransitionDef {
  id         String @id @default(cuid())
  moduleId   String
  module     Module @relation(fields: [moduleId], references: [id])
  code       String
  name       String
  fromStatus String
  toStatus   String
  @@unique([moduleId, code])
}

model RecordScopeDef {
  id              String  @id @default(cuid())
  moduleId        String
  module          Module  @relation(fields: [moduleId], references: [id])
  code            String  @default("DEFAULT")
  name            String
  ownerField      String?
  teamField       String?
  branchField     String?
  departmentField String?
}

model ListColumnDef {
  id                 String  @id @default(cuid())
  moduleId           String
  module             Module  @relation(fields: [moduleId], references: [id])
  code               String
  name               String
  fieldCode          String?
  defaultMaskPattern String?
  sortOrder          Int     @default(0)
  @@unique([moduleId, code])
}

model ListFilterDef {
  id        String @id @default(cuid())
  moduleId  String
  module    Module @relation(fields: [moduleId], references: [id])
  code      String
  name      String
  sortOrder Int    @default(0)
  @@unique([moduleId, code])
}

model ReportDef {
  id          String  @id @default(cuid())
  code        String  @unique
  name        String
  description String?
  category    String?
}

model DashboardWidgetDef {
  id          String  @id @default(cuid())
  code        String  @unique
  name        String
  description String?
}

// ----- ROLES & GRANTS -----

model Role {
  id           String   @id @default(cuid())
  code         String   @unique
  name         String
  description  String?
  isSystem     Boolean  @default(false)
  parentRoleId String?
  parentRole   Role?    @relation("RoleHierarchy", fields: [parentRoleId], references: [id])
  childRoles   Role[]   @relation("RoleHierarchy")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  grants       RolePrivilegeGrant[]
  userRoles    UserRole[]
}

model RolePrivilegeGrant {
  id            String   @id @default(cuid())
  roleId        String
  role          Role     @relation(fields: [roleId], references: [id])
  targetLevel   String   // one of the 15 levels
  targetId      String
  mode          String
  maskPattern   String?
  validFrom     DateTime?
  validUntil    DateTime?
  conditionExpr String?  // e.g., "record.status == 'DRAFT'"
  createdAt     DateTime @default(now())
  createdBy     String
  @@unique([roleId, targetLevel, targetId])
  @@index([roleId, targetLevel])
}

model UserRole {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  roleId     String
  role       Role     @relation(fields: [roleId], references: [id])
  validFrom  DateTime?
  validUntil DateTime?
  assignedAt DateTime @default(now())
  assignedBy String
  @@unique([userId, roleId])
}

model UserPrivilegeOverride {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  targetLevel String
  targetId    String
  mode        String
  maskPattern String?
  validFrom   DateTime?
  validUntil  DateTime?
  reason      String   // mandatory
  createdAt   DateTime @default(now())
  createdBy   String
  @@index([userId, targetLevel])
}

// ----- TEMPLATES -----

model PrivilegeTemplate {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  category    String?
  isSystem    Boolean  @default(false)
  items       PrivilegeTemplateItem[]
  createdAt   DateTime @default(now())
}

model PrivilegeTemplateItem {
  id          String @id @default(cuid())
  templateId  String
  template    PrivilegeTemplate @relation(fields: [templateId], references: [id])
  targetLevel String
  targetId    String
  mode        String
  maskPattern String?
}

// ----- APPROVAL FLOW -----

model ApprovalRequest {
  id           String   @id @default(cuid())
  requesterId  String
  requester    User     @relation("Requester", fields: [requesterId], references: [id])
  targetLevel  String
  targetId     String
  recordType   String?
  recordId     String?
  payload      Json?
  status       String   @default("PENDING") // PENDING | APPROVED | REJECTED | EXPIRED
  approverId   String?
  approverNote String?
  requestedAt  DateTime @default(now())
  resolvedAt   DateTime?
}

// ----- AUDIT -----

model PrivilegeAuditLog {
  id             String   @id @default(cuid())
  actorUserId    String
  action         String   // ROLE.CREATE | GRANT.UPSERT | OVERRIDE.CREATE | TEMPLATE.APPLY | LOGIN.AS_USER | etc.
  affectedRoleId String?
  affectedUserId String?
  targetLevel    String?
  targetId       String?
  oldMode        String?
  newMode        String?
  oldMask        String?
  newMask        String?
  reason         String?
  metadata       Json?
  createdAt      DateTime @default(now())
  @@index([createdAt])
  @@index([actorUserId])
  @@index([affectedUserId])
}

// ----- RESOLVED CACHE -----

model EffectivePrivilege {
  id          String   @id @default(cuid())
  userId      String
  targetLevel String
  targetId    String
  mode        String
  maskPattern String?
  computedAt  DateTime @default(now())
  @@unique([userId, targetLevel, targetId])
  @@index([userId])
}
```

## A.4 Resolver Service

`src/services/privilege/resolver.ts`

```ts
export type TargetLevel =
  | 'MENU_ITEM' | 'MODULE' | 'FORM' | 'TAB' | 'SECTION' | 'FIELD' | 'BUTTON'
  | 'LIST_COLUMN' | 'LIST_FILTER' | 'BULK_ACTION' | 'ACTION'
  | 'STATUS_TRANSITION' | 'RECORD_SCOPE' | 'REPORT' | 'DASHBOARD_WIDGET';

export type Mode =
  | 'NO_ACCESS' | 'HIDDEN' | 'COLLAPSED' | 'DISABLED' | 'VISIBLE'
  | 'VIEW' | 'EDIT' | 'MASKED' | 'REQUIRED' | 'OPTIONAL'
  | 'ALLOW' | 'DENY' | 'ALLOW_WITH_APPROVAL'
  | 'OWN' | 'TEAM' | 'BRANCH' | 'DEPARTMENT' | 'ALL' | 'EXPORT';

export interface ResolvedPrivilege {
  level: TargetLevel;
  targetId: string;
  mode: Mode;
  maskPattern?: string;
  requiresApproval?: boolean;
}

export async function resolveAllForUser(userId: string): Promise<ResolvedPrivilege[]> {
  // 1. Load user; if isSuperAdmin → return EDIT/ALLOW/ALL for every registry target
  // 2. Load all role assignments (filter by validFrom/validUntil)
  // 3. Walk role inheritance — collect grants from role + ancestors
  // 4. Load user overrides (filter by validFrom/validUntil)
  // 5. For each registry target:
  //      mode = registryDefault(level)
  //      for each grant: mode = merge(mode, grant)   // permissive union, DENY wins
  //      for each override: mode = applyOverride(mode, override)
  // 6. Persist to EffectivePrivilege
  // 7. Return list
}

export async function resolveOne(
  userId: string, level: TargetLevel, targetId: string
): Promise<{ mode: Mode; maskPattern?: string; }> { /* ... */ }

export async function resolveForRecord(
  userId: string, level: TargetLevel, targetId: string, record: Record<string, any>
): Promise<Mode> { /* evaluates conditionExpr */ }

function merge(current: Mode, incoming: Mode): Mode { /* permissive; DENY wins; broadest scope wins */ }
```

**Cache invalidation:** rebuild `EffectivePrivilege` for affected users on every Role/Grant/UserRole/Override change, registry sync, and time-bound expiry (cron every 5 min).

## A.5 Express Middleware

```ts
// src/middleware/withPrivilege.ts

export const requireAction = (actionCode: string) =>
  async (req, res, next) => {
    if (req.auth.isSuperAdmin) return next();
    const { mode } = await resolveOne(req.auth.userId, 'ACTION', actionCode);
    if (mode === 'ALLOW') return next();
    if (mode === 'ALLOW_WITH_APPROVAL') {
      return res.status(202).json({ status: 'PENDING_APPROVAL', message: 'Action queued for approval' });
    }
    return res.status(403).json({ error: 'Forbidden', actionCode });
  };

export const requireModule = (moduleCode: string, minMode: 'VIEW' | 'EDIT' = 'VIEW') => /* ... */;
export const requireTransition = (transitionCode: string) => /* ... */;
export const requireBulkAction = (bulkActionCode: string) => /* ... */;

// Scopes list queries by user's RECORD_SCOPE for the module
export const applyRecordScope = (moduleCode: string) =>
  async (req, res, next) => {
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

// Applies masking/hiding to response based on FIELD and LIST_COLUMN modes
export const scrubResponseFields = (formCode?: string, listCode?: string) => /* ... */;

// Removes fields from request body that user doesn't have EDIT on
export const scrubRequestFields = (formCode: string) => /* ... */;
```

## A.6 React Hooks & Components

```ts
// src/lib/privilege/usePrivilege.ts

export function usePrivilegeMap(): PrivilegeMap;

export function useFieldMode(code: string): { mode: Mode; maskPattern?: string };
export function useSectionMode(code: string): Mode;
export function useTabMode(code: string): Mode;
export function useButtonMode(code: string): Mode;
export function useColumnMode(code: string): { mode: Mode; maskPattern?: string };
export function useFilterMode(code: string): Mode;
export function useMenuItemMode(code: string): Mode;
export function useReportMode(code: string): Mode;
export function useWidgetMode(code: string): Mode;
export function useRecordScope(moduleCode: string): Mode;

export function useCanDo(actionCode: string): { allowed: boolean; requiresApproval: boolean };
export function useCanTransition(code: string): { allowed: boolean; requiresApproval: boolean };
export function useCanBulk(code: string): { allowed: boolean; requiresApproval: boolean };
```

**Components:**

```tsx
<Guarded module="INVOICES" min="VIEW">...</Guarded>
<Guarded action="INVOICE.DELETE">...</Guarded>
<Guarded field="CUSTOMER_GSTIN">...</Guarded>

<PrivilegeField code="CUSTOMER_PHONE" defaultRequired>
  <Input ... />
</PrivilegeField>

<PrivilegeSection code="INVOICE_FOOTER">...</PrivilegeSection>
<PrivilegeTab code="CUSTOMER_TAX_TAB">...</PrivilegeTab>
<PrivilegeButton code="BTN_SAVE_DRAFT" onClick={...}>Save Draft</PrivilegeButton>
<PrivilegeColumn code="COL_INVOICE_AMOUNT">...</PrivilegeColumn>
<PrivilegeFilter code="FILTER_INVOICE_STATUS">...</PrivilegeFilter>

<MaskedValue value={value} pattern={maskPattern} />
<RequireApprovalButton action="INVOICE.MARK_PAID" onClick={...} />
```

## A.7 Admin Management Module — 10 Screens

**Route prefix:** `/admin/privileges` — guarded by `requireAction('PRIVILEGE.MANAGE')`.

| # | Screen | Purpose |
|---|---|---|
| 1 | **Roles List** | List, create, clone, delete roles |
| 2 | **Role Editor (Permission Matrix)** | 15-tab matrix to set grants for every target level |
| 3 | **Users List** | List users with roles, overrides, last login |
| 4 | **User Detail** | Roles · Overrides · Effective Permissions · Activity · Approvals |
| 5 | **Preview as User** | Render UI with another user's permissions; writes blocked; logged |
| 6 | **Privilege Templates** | Pre-built bundles; apply to role with conflict resolution |
| 7 | **Approval Queue** | Pending `ALLOW_WITH_APPROVAL` requests |
| 8 | **Audit Log** | Filterable, exportable, immutable |
| 9 | **Role Comparison** | Side-by-side color-coded diff of two roles |
| 10 | **Registry Inspector** | Read-only view of loaded product manifest + Sync Registry |

### Role Editor — 15 tabs (one per target level)

Each tab provides:
- Bulk "set all to X" per group
- Per-row time-bound grant (validFrom / validUntil pickers)
- Per-row condition expression with syntax help
- Inline diff vs. parent role (if inheritance active)
- Search box to filter targets
- Sticky footer with Discard / Save

| Tab | Mode options |
|---|---|
| Menu Items | `HIDDEN` / `VISIBLE` |
| Modules | `NO_ACCESS` / `VIEW` / `EDIT` |
| Forms | `NO_ACCESS` / `VIEW` / `EDIT` |
| Tabs | `HIDDEN` / `VIEW` / `EDIT` |
| Sections | `HIDDEN` / `COLLAPSED` / `VIEW` / `EDIT` |
| Fields | `HIDDEN` / `MASKED` / `VIEW` / `EDIT` / `REQUIRED` / `OPTIONAL` (+ mask pattern) |
| Buttons | `HIDDEN` / `DISABLED` / `VISIBLE` |
| List Columns | `HIDDEN` / `MASKED` / `VISIBLE` (+ mask pattern) |
| List Filters | `HIDDEN` / `VISIBLE` |
| Bulk Actions | `ALLOW` / `DENY` / `ALLOW_WITH_APPROVAL` |
| Actions | `ALLOW` / `DENY` / `ALLOW_WITH_APPROVAL` |
| Status Transitions | `ALLOW` / `DENY` / `ALLOW_WITH_APPROVAL` |
| Record Scope | `OWN` / `TEAM` / `BRANCH` / `DEPARTMENT` / `ALL` (radio) |
| Reports | `HIDDEN` / `VIEW` / `EXPORT` |
| Dashboard Widgets | `HIDDEN` / `VISIBLE` |

## A.8 Backend API Routes

All under `/api/privilege/*`, guarded by `requireAction('PRIVILEGE.MANAGE')` unless noted.

```
GET    /api/privilege/registry                            # full tree
POST   /api/privilege/registry/sync                       # re-seed from manifest
GET    /api/privilege/registry/:level                     # one level at a time

GET    /api/privilege/roles
POST   /api/privilege/roles
GET    /api/privilege/roles/:id
PATCH  /api/privilege/roles/:id
DELETE /api/privilege/roles/:id
POST   /api/privilege/roles/:id/clone
GET    /api/privilege/roles/:id/grants
PUT    /api/privilege/roles/:id/grants                    # bulk upsert
DELETE /api/privilege/roles/:id/grants/:grantId
GET    /api/privilege/roles/compare?a=&b=

GET    /api/privilege/users
GET    /api/privilege/users/:id
GET    /api/privilege/users/:id/roles
POST   /api/privilege/users/:id/roles
DELETE /api/privilege/users/:id/roles/:roleId
GET    /api/privilege/users/:id/overrides
POST   /api/privilege/users/:id/overrides
DELETE /api/privilege/users/:id/overrides/:overrideId
GET    /api/privilege/users/:id/effective
POST   /api/privilege/users/:id/preview

GET    /api/privilege/templates
POST   /api/privilege/templates
GET    /api/privilege/templates/:id
DELETE /api/privilege/templates/:id
POST   /api/privilege/templates/:id/apply

GET    /api/privilege/approvals?status=PENDING
POST   /api/privilege/approvals/:id/approve
POST   /api/privilege/approvals/:id/reject

GET    /api/privilege/audit
GET    /api/privilege/audit/:id
GET    /api/privilege/audit/export

# Self (no admin guard)
GET    /api/me/privileges
GET    /api/me/approval-requests
POST   /api/me/approval-requests
```

## A.9 Built-in System Roles (seed)

| Code | Description |
|---|---|
| `SUPER_ADMIN` | Bypasses all checks; single instance |
| `ADMIN` | Full access to all modules + privilege management |
| `MANAGER` | Full business access; no privilege mgmt; no destructive bulk actions |
| `STAFF` | View/edit own + team records; no delete |
| `VIEWER` | Read-only with PII fields masked |
| `AUDITOR` | Read-only + full audit log access |

System roles are non-deletable; grants are editable with a reset-to-defaults action.

## A.10 Product Manifest — THE ONLY FILE THAT CHANGES PER PRODUCT

```ts
// src/seed/privilege-registry.ts
export const productManifest: ProductManifest = {
  product: { code: 'INVOICE', name: 'Invoice Generator' },
  menuItems: [/* ... */],
  modules: [
    {
      code: 'XXX', name: '...',
      forms: [{ code: '...', name: '...', tabs: [...], sections: [...], buttons: [...] }],
      actions: [...],
      bulkActions: [...],
      transitions: [...],
      scopes: [...],
      listColumns: [...],
      listFilters: [...],
    },
  ],
  reports: [...],
  dashboardWidgets: [...],
};
```

The Invoice Generator's full manifest is in **Part B §B.8**.

## A.11 Performance Notes

- Cache `/api/me/privileges` in the frontend store; revalidate on logout or role-change WS push.
- `EffectivePrivilege` is the single-query runtime source for the frontend.
- Resolver recompute is async (BullMQ); UI shows "permissions refreshing" toast.
- All audit writes async; never block the user action.

<!-- ═══ COPY-END: PRIVILEGE ═══ -->

---

# PART B — INVOICE GENERATOR (PRODUCT-SPECIFIC)

## B.1 Project Setup

```
/apps
  /web              # React + Vite + TS
  /api              # Node + Express + TS + Prisma
/packages
  /shared           # zod schemas, types, calc helpers, privilege client SDK
/prisma
  schema.prisma     # contains privilege schema (Part A.3) + invoice schema (B.2)
```

**Dev commands:** `pnpm dev`, `pnpm db:push`, `pnpm db:seed`, `pnpm build`.

## B.2 Prisma Schema — Invoice Domain

```prisma
model Company {
  id              String   @id @default(cuid())
  name            String
  logoUrl         String?
  email           String
  phone           String
  gstin           String?
  pan             String?
  addressLine1    String
  addressLine2    String?
  city            String
  state           String
  pincode         String
  country         String   @default("India")
  defaultCurrency String   @default("INR")
  bankName        String?
  accountNumber   String?
  ifsc            String?
  updatedAt       DateTime @updatedAt
}

model Customer {
  id              String   @id @default(cuid())
  name            String
  type            String   // 'INDIVIDUAL' | 'BUSINESS'
  email           String
  phone           String
  gstin           String?
  billingAddress  String
  shippingAddress String?
  city            String
  state           String
  pincode         String
  notes           String?
  isActive        Boolean  @default(true)
  // Record-scope columns (used by RECORD_SCOPE resolver)
  createdById     String
  teamId          String?
  branchId        String?
  departmentId   String?
  invoices        Invoice[]
  createdAt       DateTime @default(now())
  @@index([name])
  @@index([createdById])
  @@index([teamId])
}

model Product {
  id           String   @id @default(cuid())
  name         String
  type         String   // 'PRODUCT' | 'SERVICE'
  sku          String?  @unique
  description  String?
  hsnSac       String?
  unit         String   // 'NOS' | 'KG' | 'LITRE' | 'HOUR' | 'BOX' | 'METER' | 'SET' | 'OTHER'
  sellingPrice Decimal  @db.Decimal(12,2)
  taxRate      Int      // 0,5,12,18,28
  category     String?
  isActive     Boolean  @default(true)
  createdById  String
  createdAt    DateTime @default(now())
  @@index([name])
}

model Invoice {
  id              String   @id @default(cuid())
  invoiceNumber   String   @unique
  invoiceDate     DateTime
  dueDate         DateTime
  referenceNo     String?
  paymentTerms    String
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])
  billingAddress  String
  shippingAddress String?
  lineItems       InvoiceLineItem[]

  subtotal        Decimal  @db.Decimal(14,2)
  totalDiscount   Decimal  @db.Decimal(14,2)
  taxableAmount   Decimal  @db.Decimal(14,2)
  cgst            Decimal  @db.Decimal(14,2) @default(0)
  sgst            Decimal  @db.Decimal(14,2) @default(0)
  igst            Decimal  @db.Decimal(14,2) @default(0)
  shippingCharges Decimal  @db.Decimal(14,2) @default(0)
  roundOff        Decimal  @db.Decimal(14,2) @default(0)
  grandTotal      Decimal  @db.Decimal(14,2)
  amountInWords   String

  notes         String?
  terms         String?
  status        String   @default("DRAFT") // DRAFT | SENT | PAID | CANCELLED
  attachmentUrl String?

  // Record-scope columns
  createdById   String
  teamId        String?
  branchId      String?
  departmentId  String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([status, invoiceDate])
  @@index([createdById])
  @@index([customerId])
}

model InvoiceLineItem {
  id           String  @id @default(cuid())
  invoiceId    String
  invoice      Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  productId    String?
  itemName     String
  description  String?
  hsnSac       String?
  quantity     Decimal @db.Decimal(12,3)
  unit         String
  rate         Decimal @db.Decimal(12,2)
  discountPct  Decimal @db.Decimal(5,2) @default(0)
  taxPct       Int
  gross        Decimal @db.Decimal(14,2)
  discountAmt  Decimal @db.Decimal(14,2)
  taxableValue Decimal @db.Decimal(14,2)
  taxAmt       Decimal @db.Decimal(14,2)
  lineTotal    Decimal @db.Decimal(14,2)
  sortOrder    Int     @default(0)
}
```

## B.3 Calculation Module (shared)

`packages/shared/src/calc.ts` — pure, unit-tested.

```ts
export function calcLine(qty: number, rate: number, discountPct: number, taxPct: number) {
  const gross = round2(qty * rate);
  const discountAmt = round2(gross * (discountPct / 100));
  const taxableValue = round2(gross - discountAmt);
  const taxAmt = round2(taxableValue * (taxPct / 100));
  const lineTotal = round2(taxableValue + taxAmt);
  return { gross, discountAmt, taxableValue, taxAmt, lineTotal };
}

export function calcInvoice(
  lines: LineCalcInput[],
  opts: { customerState: string; companyState: string; shipping: number; roundOff: number; }
) { /* Subtotal, totalDiscount, taxableAmount, totalTax, CGST/SGST/IGST split, grandTotal, amountInWords */ }

export function amountInWordsINR(amount: number): string;
export function formatINR(amount: number): string; // 1,00,000.00
```

**Edge cases:** zero qty/rate, 3-decimal qty, ≥1 crore amounts, negative round-off, mixed tax rates, 100% line discount.

## B.4 Modules — Privilege-Wired Implementation

Every UI field is wrapped in `<PrivilegeField code="...">`; every section in `<PrivilegeSection>`; every button in `<PrivilegeButton>`; every list column in `<PrivilegeColumn>`. List queries pass through `applyRecordScope` middleware.

### B.4.1 Company Profile
- **Route:** `/settings/company`
- **Module code:** `COMPANY_PROFILE`
- **Sections:** Identity, Tax Info, Address, Financial
- **Buttons:** `BTN_COMPANY_SAVE`, `BTN_COMPANY_UPLOAD_LOGO`
- **Actions:** `COMPANY.VIEW`, `COMPANY.EDIT`

### B.4.2 Customers
- **Routes:** `/customers`, `/customers/new`, `/customers/:id/edit`
- **Module code:** `CUSTOMERS`
- **Sections:** Basic, Contact, Tax, Address, Meta
- **List columns:** Name, Type, Email, Phone (masked), City, Created
- **List filters:** Type, City, State, Active
- **Actions:** `CUSTOMER.LIST`, `CUSTOMER.VIEW`, `CUSTOMER.CREATE`, `CUSTOMER.EDIT`, `CUSTOMER.DELETE`
- **Bulk actions:** `CUSTOMER.BULK_DELETE`, `CUSTOMER.BULK_EXPORT`
- **Logic:** "Same as Billing" copies billing to shipping; GSTIN required only when type=BUSINESS.

### B.4.3 Product Catalog
- **Routes:** `/products`, `/products/new`, `/products/:id/edit`
- **Module code:** `PRODUCTS`
- **Sections:** Basic, Pricing, Tax, Categorisation
- **List columns:** Name, Type, SKU, Unit, Price, Tax %
- **List filters:** Type, Category, Active
- **Actions:** `PRODUCT.LIST`, `PRODUCT.VIEW`, `PRODUCT.CREATE`, `PRODUCT.EDIT`, `PRODUCT.DELETE`
- **Bulk actions:** `PRODUCT.BULK_DELETE`, `PRODUCT.BULK_IMPORT`, `PRODUCT.BULK_EXPORT`

### B.4.4 Invoice Creation — **highest weight**

- **Routes:** `/invoices/new`, `/invoices/:id/edit`
- **Module code:** `INVOICES`
- **5 sections** (each a `<PrivilegeSection>`):

| Section Code | Contents |
|---|---|
| `INVOICE_HEADER` | Invoice Number (auto `INV-YYYY-NNNN`), Invoice Date, Due Date, Reference, Payment Terms |
| `INVOICE_CUSTOMER` | Searchable customer dropdown + Quick Add modal; auto-populates billing & shipping with override |
| `INVOICE_LINE_ITEMS` | Dynamic editable table with add/delete rows and live calc |
| `INVOICE_TOTALS` | Subtotal, Discount, Taxable, CGST/SGST or IGST, Shipping, Round Off, Grand Total, Amount in Words |
| `INVOICE_FOOTER` | Notes, Terms (with saved default), Status, Attachment |

- **Buttons:** `BTN_INVOICE_SAVE_DRAFT`, `BTN_INVOICE_SAVE_PREVIEW`, `BTN_INVOICE_CANCEL`, `BTN_INVOICE_ADD_LINE`, `BTN_INVOICE_DELETE_LINE`
- **Actions:** `INVOICE.LIST`, `INVOICE.VIEW`, `INVOICE.CREATE`, `INVOICE.EDIT`, `INVOICE.DELETE`, `INVOICE.DUPLICATE`, `INVOICE.DOWNLOAD_PDF`, `INVOICE.PRINT`
- **Status transitions:**
  - `INVOICE.DRAFT_TO_SENT` — Send invoice
  - `INVOICE.SENT_TO_PAID` — Mark as paid
  - `INVOICE.SENT_TO_CANCELLED` — Cancel sent invoice
  - `INVOICE.PAID_TO_CANCELLED` — Reverse paid invoice (high-risk → `ALLOW_WITH_APPROVAL` by default)
  - `INVOICE.DRAFT_TO_CANCELLED` — Discard draft
- **Bulk actions:** `INVOICE.BULK_SEND`, `INVOICE.BULK_MARK_PAID`, `INVOICE.BULK_EXPORT`, `INVOICE.BULK_DELETE`
- **State:** React Hook Form + Zod (`packages/shared/src/schemas/invoice.ts`); recompute totals on every line change via `useWatch`.

### B.4.5 Invoice Listing
- **Route:** `/invoices` (landing screen after login)
- **Top metrics card:** total count + total amount (respects record scope)
- **List columns:** Invoice #, Date, Customer, Due Date, Amount, Status, Actions
- **List filters:** Status, Date range, Customer, Created by
- **Search:** invoice number or customer name
- **Sort:** date, amount, invoice number
- **Pagination:** 10 / 25 / 50
- **Row actions:** View, Edit, Duplicate, Download PDF, Delete

### B.4.6 Invoice Preview & PDF
- **Route:** `/invoices/:id/preview`
- **Layout:** A4 portrait, print CSS, 15mm margins, logo base64-embedded
- **Sections:** Header (logo + meta), Bill To / Ship To, line items, totals, amount in words, bank details, terms, signature
- **Actions:** `INVOICE.DOWNLOAD_PDF`, `INVOICE.PRINT`, Back to Edit

## B.5 Auto-Numbering
- Fetch latest invoice, parse `INV-YYYY-NNNN`, increment.
- Editable by user; uniqueness validated on save.
- Counter resets at Indian FY boundary (April 1).

## B.6 GST Logic
```ts
function gstSplit(taxAmt: number, companyState: string, customerState: string) {
  if (companyState === customerState) return { cgst: taxAmt / 2, sgst: taxAmt / 2, igst: 0 };
  return { cgst: 0, sgst: 0, igst: taxAmt };
}
```

## B.7 API Routes (all guarded by privilege middleware)

```
POST   /api/auth/login
GET    /api/me
GET    /api/me/privileges

GET    /api/company                       requireModule('COMPANY_PROFILE', 'VIEW')
PUT    /api/company                       requireAction('COMPANY.EDIT')

GET    /api/customers                     requireAction('CUSTOMER.LIST') + applyRecordScope('CUSTOMERS')
POST   /api/customers                     requireAction('CUSTOMER.CREATE') + scrubRequestFields('CUSTOMER_FORM')
GET    /api/customers/:id                 requireAction('CUSTOMER.VIEW') + scrubResponseFields('CUSTOMER_FORM')
PATCH  /api/customers/:id                 requireAction('CUSTOMER.EDIT') + scrubRequestFields('CUSTOMER_FORM')
DELETE /api/customers/:id                 requireAction('CUSTOMER.DELETE')
POST   /api/customers/bulk/delete         requireBulkAction('CUSTOMER.BULK_DELETE')
POST   /api/customers/bulk/export         requireBulkAction('CUSTOMER.BULK_EXPORT')

GET    /api/products                      requireAction('PRODUCT.LIST') + applyRecordScope('PRODUCTS')
POST   /api/products                      requireAction('PRODUCT.CREATE')
PATCH  /api/products/:id                  requireAction('PRODUCT.EDIT')
DELETE /api/products/:id                  requireAction('PRODUCT.DELETE')
POST   /api/products/bulk/delete          requireBulkAction('PRODUCT.BULK_DELETE')
POST   /api/products/bulk/import          requireBulkAction('PRODUCT.BULK_IMPORT')
POST   /api/products/bulk/export          requireBulkAction('PRODUCT.BULK_EXPORT')

GET    /api/invoices                      requireAction('INVOICE.LIST') + applyRecordScope('INVOICES')
POST   /api/invoices                      requireAction('INVOICE.CREATE')
GET    /api/invoices/:id                  requireAction('INVOICE.VIEW')
PATCH  /api/invoices/:id                  requireAction('INVOICE.EDIT')
DELETE /api/invoices/:id                  requireAction('INVOICE.DELETE')
POST   /api/invoices/:id/duplicate        requireAction('INVOICE.DUPLICATE')
GET    /api/invoices/:id/pdf              requireAction('INVOICE.DOWNLOAD_PDF')
POST   /api/invoices/:id/transition       requireTransition(req.body.transitionCode)
POST   /api/invoices/bulk/send            requireBulkAction('INVOICE.BULK_SEND')
POST   /api/invoices/bulk/mark-paid       requireBulkAction('INVOICE.BULK_MARK_PAID')
POST   /api/invoices/bulk/export          requireBulkAction('INVOICE.BULK_EXPORT')
POST   /api/invoices/bulk/delete          requireBulkAction('INVOICE.BULK_DELETE')

GET    /api/reports/:reportCode           requireReport(req.params.reportCode)
GET    /api/reports/:reportCode/export    requireReport(req.params.reportCode, 'EXPORT')

GET    /api/dashboard/widgets             # returns only widgets the user can see
```

## B.8 Product Manifest — Invoice Generator

`apps/api/src/seed/invoice-registry.ts`

```ts
import { ProductManifest } from '@shared/privilege';

export const invoiceManifest: ProductManifest = {
  product: { code: 'INVOICE', name: 'Invoice Generator' },

  // ----- MENU ITEMS -----
  menuItems: [
    { code: 'NAV_DASHBOARD', name: 'Dashboard', icon: 'home', route: '/dashboard', sortOrder: 1 },
    { code: 'NAV_INVOICES', name: 'Invoices', icon: 'file-text', route: '/invoices', sortOrder: 2 },
    { code: 'NAV_CUSTOMERS', name: 'Customers', icon: 'users', route: '/customers', sortOrder: 3 },
    { code: 'NAV_PRODUCTS', name: 'Products', icon: 'package', route: '/products', sortOrder: 4 },
    { code: 'NAV_REPORTS', name: 'Reports', icon: 'bar-chart', route: '/reports', sortOrder: 5 },
    { code: 'NAV_SETTINGS', name: 'Settings', icon: 'settings', route: '/settings', sortOrder: 6 },
    { code: 'NAV_SETTINGS_COMPANY', name: 'Company Profile', parentCode: 'NAV_SETTINGS', route: '/settings/company', sortOrder: 1 },
    { code: 'NAV_SETTINGS_PRIVILEGES', name: 'Roles & Permissions', parentCode: 'NAV_SETTINGS', route: '/admin/privileges', sortOrder: 2 },
    { code: 'NAV_SETTINGS_USERS', name: 'Users', parentCode: 'NAV_SETTINGS', route: '/admin/users', sortOrder: 3 },
  ],

  // ----- MODULES -----
  modules: [
    {
      code: 'COMPANY_PROFILE', name: 'Company Profile', icon: 'building', sortOrder: 1,
      forms: [{
        code: 'COMPANY_PROFILE_FORM', name: 'Company Profile',
        sections: [
          { code: 'COMPANY_IDENTITY', name: 'Identity', fields: [
            { code: 'COMPANY_NAME', name: 'Company Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_LOGO', name: 'Logo', dataType: 'FILE' },
            { code: 'COMPANY_EMAIL', name: 'Business Email', dataType: 'EMAIL', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_MIDDLE' },
            { code: 'COMPANY_PHONE', name: 'Phone', dataType: 'PHONE', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'COMPANY_TAX', name: 'Tax Info', fields: [
            { code: 'COMPANY_GSTIN', name: 'GSTIN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
            { code: 'COMPANY_PAN', name: 'PAN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'COMPANY_ADDRESS', name: 'Address', fields: [
            { code: 'COMPANY_ADDRESS1', name: 'Address Line 1', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_ADDRESS2', name: 'Address Line 2', dataType: 'TEXT' },
            { code: 'COMPANY_CITY', name: 'City', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_STATE', name: 'State', dataType: 'SELECT', defaultRequired: true },
            { code: 'COMPANY_PINCODE', name: 'Pincode', dataType: 'TEXT', defaultRequired: true },
            { code: 'COMPANY_COUNTRY', name: 'Country', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'COMPANY_FINANCIAL', name: 'Financial', fields: [
            { code: 'COMPANY_CURRENCY', name: 'Default Currency', dataType: 'SELECT', defaultRequired: true },
            { code: 'COMPANY_BANK_NAME', name: 'Bank Name', dataType: 'TEXT' },
            { code: 'COMPANY_ACCOUNT_NO', name: 'Account Number', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
            { code: 'COMPANY_IFSC', name: 'IFSC Code', dataType: 'TEXT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_COMPANY_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_COMPANY_UPLOAD_LOGO', name: 'Upload Logo', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'COMPANY.VIEW', name: 'View Company Profile' },
        { code: 'COMPANY.EDIT', name: 'Edit Company Profile' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [], // single-record module, no scope dimension
      listColumns: [],
      listFilters: [],
    },

    {
      code: 'CUSTOMERS', name: 'Customers', icon: 'users', sortOrder: 2,
      forms: [{
        code: 'CUSTOMER_FORM', name: 'Customer',
        sections: [
          { code: 'CUSTOMER_BASIC', name: 'Basic', fields: [
            { code: 'CUSTOMER_NAME', name: 'Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'CUSTOMER_TYPE', name: 'Type', dataType: 'RADIO', defaultRequired: true },
          ]},
          { code: 'CUSTOMER_CONTACT', name: 'Contact', fields: [
            { code: 'CUSTOMER_EMAIL', name: 'Email', dataType: 'EMAIL', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_MIDDLE' },
            { code: 'CUSTOMER_PHONE', name: 'Phone', dataType: 'PHONE', defaultRequired: true, isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'CUSTOMER_TAX', name: 'Tax', fields: [
            { code: 'CUSTOMER_GSTIN', name: 'GSTIN', dataType: 'TEXT', isPii: true, defaultMaskPattern: 'MASK_LAST_4' },
          ]},
          { code: 'CUSTOMER_ADDRESS', name: 'Address', fields: [
            { code: 'CUSTOMER_BILLING_ADDRESS', name: 'Billing Address', dataType: 'TEXTAREA', defaultRequired: true },
            { code: 'CUSTOMER_SHIPPING_ADDRESS', name: 'Shipping Address', dataType: 'TEXTAREA' },
            { code: 'CUSTOMER_CITY', name: 'City', dataType: 'TEXT', defaultRequired: true },
            { code: 'CUSTOMER_STATE', name: 'State', dataType: 'SELECT', defaultRequired: true },
            { code: 'CUSTOMER_PINCODE', name: 'Pincode', dataType: 'TEXT', defaultRequired: true },
          ]},
          { code: 'CUSTOMER_META', name: 'Meta', fields: [
            { code: 'CUSTOMER_NOTES', name: 'Notes', dataType: 'TEXTAREA' },
          ]},
        ],
        buttons: [
          { code: 'BTN_CUSTOMER_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_CUSTOMER_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_CUSTOMER_DELETE', name: 'Delete', variant: 'destructive' },
        ],
      }],
      actions: [
        { code: 'CUSTOMER.LIST', name: 'List Customers' },
        { code: 'CUSTOMER.VIEW', name: 'View Customer' },
        { code: 'CUSTOMER.CREATE', name: 'Create Customer' },
        { code: 'CUSTOMER.EDIT', name: 'Edit Customer' },
        { code: 'CUSTOMER.DELETE', name: 'Delete Customer', isHighRisk: true },
      ],
      bulkActions: [
        { code: 'CUSTOMER.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
        { code: 'CUSTOMER.BULK_EXPORT', name: 'Bulk Export' },
      ],
      transitions: [],
      scopes: [{ code: 'DEFAULT', name: 'Customers', ownerField: 'createdById', teamField: 'teamId', branchField: 'branchId', departmentField: 'departmentId' }],
      listColumns: [
        { code: 'COL_CUSTOMER_NAME', name: 'Name', fieldCode: 'CUSTOMER_NAME', sortOrder: 1 },
        { code: 'COL_CUSTOMER_TYPE', name: 'Type', fieldCode: 'CUSTOMER_TYPE', sortOrder: 2 },
        { code: 'COL_CUSTOMER_EMAIL', name: 'Email', fieldCode: 'CUSTOMER_EMAIL', defaultMaskPattern: 'MASK_MIDDLE', sortOrder: 3 },
        { code: 'COL_CUSTOMER_PHONE', name: 'Phone', fieldCode: 'CUSTOMER_PHONE', defaultMaskPattern: 'MASK_LAST_4', sortOrder: 4 },
        { code: 'COL_CUSTOMER_GSTIN', name: 'GSTIN', fieldCode: 'CUSTOMER_GSTIN', defaultMaskPattern: 'MASK_LAST_4', sortOrder: 5 },
        { code: 'COL_CUSTOMER_CITY', name: 'City', fieldCode: 'CUSTOMER_CITY', sortOrder: 6 },
        { code: 'COL_CUSTOMER_CREATED', name: 'Created', sortOrder: 7 },
      ],
      listFilters: [
        { code: 'FILTER_CUSTOMER_TYPE', name: 'Customer Type', sortOrder: 1 },
        { code: 'FILTER_CUSTOMER_STATE', name: 'State', sortOrder: 2 },
        { code: 'FILTER_CUSTOMER_CITY', name: 'City', sortOrder: 3 },
        { code: 'FILTER_CUSTOMER_ACTIVE', name: 'Active Status', sortOrder: 4 },
      ],
    },

    {
      code: 'PRODUCTS', name: 'Product Catalog', icon: 'package', sortOrder: 3,
      forms: [{
        code: 'PRODUCT_FORM', name: 'Product',
        sections: [
          { code: 'PRODUCT_BASIC', name: 'Basic', fields: [
            { code: 'PRODUCT_NAME', name: 'Item Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'PRODUCT_TYPE', name: 'Item Type', dataType: 'RADIO', defaultRequired: true },
            { code: 'PRODUCT_SKU', name: 'SKU', dataType: 'TEXT' },
            { code: 'PRODUCT_DESCRIPTION', name: 'Description', dataType: 'TEXTAREA' },
            { code: 'PRODUCT_HSN_SAC', name: 'HSN/SAC', dataType: 'TEXT' },
          ]},
          { code: 'PRODUCT_PRICING', name: 'Pricing', fields: [
            { code: 'PRODUCT_UNIT', name: 'Unit', dataType: 'SELECT', defaultRequired: true },
            { code: 'PRODUCT_PRICE', name: 'Selling Price', dataType: 'CURRENCY', defaultRequired: true },
          ]},
          { code: 'PRODUCT_TAX', name: 'Tax', fields: [
            { code: 'PRODUCT_TAX_RATE', name: 'Tax Rate (%)', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'PRODUCT_META', name: 'Categorisation', fields: [
            { code: 'PRODUCT_CATEGORY', name: 'Category', dataType: 'TEXT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_PRODUCT_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_PRODUCT_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_PRODUCT_DELETE', name: 'Delete', variant: 'destructive' },
        ],
      }],
      actions: [
        { code: 'PRODUCT.LIST', name: 'List Products' },
        { code: 'PRODUCT.VIEW', name: 'View Product' },
        { code: 'PRODUCT.CREATE', name: 'Create Product' },
        { code: 'PRODUCT.EDIT', name: 'Edit Product' },
        { code: 'PRODUCT.DELETE', name: 'Delete Product', isHighRisk: true },
      ],
      bulkActions: [
        { code: 'PRODUCT.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
        { code: 'PRODUCT.BULK_IMPORT', name: 'Bulk Import from CSV' },
        { code: 'PRODUCT.BULK_EXPORT', name: 'Bulk Export' },
      ],
      transitions: [],
      scopes: [{ code: 'DEFAULT', name: 'Products', ownerField: 'createdById' }],
      listColumns: [
        { code: 'COL_PRODUCT_NAME', name: 'Item Name', fieldCode: 'PRODUCT_NAME', sortOrder: 1 },
        { code: 'COL_PRODUCT_TYPE', name: 'Type', fieldCode: 'PRODUCT_TYPE', sortOrder: 2 },
        { code: 'COL_PRODUCT_SKU', name: 'SKU', fieldCode: 'PRODUCT_SKU', sortOrder: 3 },
        { code: 'COL_PRODUCT_UNIT', name: 'Unit', fieldCode: 'PRODUCT_UNIT', sortOrder: 4 },
        { code: 'COL_PRODUCT_PRICE', name: 'Price', fieldCode: 'PRODUCT_PRICE', sortOrder: 5 },
        { code: 'COL_PRODUCT_TAX', name: 'Tax %', fieldCode: 'PRODUCT_TAX_RATE', sortOrder: 6 },
      ],
      listFilters: [
        { code: 'FILTER_PRODUCT_TYPE', name: 'Type', sortOrder: 1 },
        { code: 'FILTER_PRODUCT_CATEGORY', name: 'Category', sortOrder: 2 },
        { code: 'FILTER_PRODUCT_ACTIVE', name: 'Active Status', sortOrder: 3 },
        { code: 'FILTER_PRODUCT_TAX_RATE', name: 'Tax Rate', sortOrder: 4 },
      ],
    },

    {
      code: 'INVOICES', name: 'Invoices', icon: 'file-text', sortOrder: 4,
      forms: [{
        code: 'INVOICE_FORM', name: 'Invoice',
        sections: [
          { code: 'INVOICE_HEADER', name: 'Invoice Header', fields: [
            { code: 'INVOICE_NUMBER', name: 'Invoice Number', dataType: 'TEXT', defaultRequired: true },
            { code: 'INVOICE_DATE', name: 'Invoice Date', dataType: 'DATE', defaultRequired: true },
            { code: 'INVOICE_DUE_DATE', name: 'Due Date', dataType: 'DATE', defaultRequired: true },
            { code: 'INVOICE_REFERENCE', name: 'Reference / PO Number', dataType: 'TEXT' },
            { code: 'INVOICE_PAYMENT_TERMS', name: 'Payment Terms', dataType: 'SELECT', defaultRequired: true },
          ]},
          { code: 'INVOICE_CUSTOMER', name: 'Customer Selection', fields: [
            { code: 'INVOICE_CUSTOMER_ID', name: 'Customer', dataType: 'SELECT', defaultRequired: true },
            { code: 'INVOICE_BILLING_ADDRESS', name: 'Billing Address', dataType: 'TEXTAREA' },
            { code: 'INVOICE_SHIPPING_ADDRESS', name: 'Shipping Address', dataType: 'TEXTAREA' },
          ]},
          { code: 'INVOICE_LINE_ITEMS', name: 'Line Items', fields: [
            { code: 'LINE_ITEM_PRODUCT', name: 'Item', dataType: 'SELECT', defaultRequired: true },
            { code: 'LINE_ITEM_DESCRIPTION', name: 'Description', dataType: 'TEXT' },
            { code: 'LINE_ITEM_HSN', name: 'HSN/SAC', dataType: 'TEXT' },
            { code: 'LINE_ITEM_QTY', name: 'Quantity', dataType: 'NUMBER', defaultRequired: true },
            { code: 'LINE_ITEM_UNIT', name: 'Unit', dataType: 'TEXT' },
            { code: 'LINE_ITEM_RATE', name: 'Rate', dataType: 'CURRENCY', defaultRequired: true },
            { code: 'LINE_ITEM_DISCOUNT_PCT', name: 'Discount %', dataType: 'NUMBER' },
            { code: 'LINE_ITEM_TAX_PCT', name: 'Tax %', dataType: 'SELECT', defaultRequired: true },
            { code: 'LINE_ITEM_AMOUNT', name: 'Amount', dataType: 'CURRENCY' },
          ]},
          { code: 'INVOICE_TOTALS', name: 'Totals & Summary', fields: [
            { code: 'INVOICE_SUBTOTAL', name: 'Subtotal', dataType: 'CURRENCY' },
            { code: 'INVOICE_TOTAL_DISCOUNT', name: 'Total Discount', dataType: 'CURRENCY' },
            { code: 'INVOICE_TAXABLE', name: 'Taxable Amount', dataType: 'CURRENCY' },
            { code: 'INVOICE_CGST', name: 'CGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_SGST', name: 'SGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_IGST', name: 'IGST', dataType: 'CURRENCY' },
            { code: 'INVOICE_SHIPPING', name: 'Shipping Charges', dataType: 'CURRENCY' },
            { code: 'INVOICE_ROUND_OFF', name: 'Round Off', dataType: 'CURRENCY' },
            { code: 'INVOICE_GRAND_TOTAL', name: 'Grand Total', dataType: 'CURRENCY' },
            { code: 'INVOICE_AMOUNT_IN_WORDS', name: 'Amount in Words', dataType: 'TEXT' },
          ]},
          { code: 'INVOICE_FOOTER', name: 'Footer', fields: [
            { code: 'INVOICE_NOTES', name: 'Notes to Customer', dataType: 'TEXTAREA' },
            { code: 'INVOICE_TERMS', name: 'Terms & Conditions', dataType: 'TEXTAREA' },
            { code: 'INVOICE_STATUS', name: 'Status', dataType: 'SELECT' },
            { code: 'INVOICE_ATTACHMENT', name: 'Attachment', dataType: 'FILE' },
          ]},
        ],
        buttons: [
          { code: 'BTN_INVOICE_SAVE_DRAFT', name: 'Save as Draft', variant: 'default' },
          { code: 'BTN_INVOICE_SAVE_PREVIEW', name: 'Save & Preview', variant: 'primary' },
          { code: 'BTN_INVOICE_CANCEL', name: 'Cancel', variant: 'default' },
          { code: 'BTN_INVOICE_ADD_LINE', name: 'Add Line Item', variant: 'default' },
          { code: 'BTN_INVOICE_DELETE_LINE', name: 'Delete Line', variant: 'destructive' },
          { code: 'BTN_INVOICE_DOWNLOAD_PDF', name: 'Download PDF', variant: 'default' },
          { code: 'BTN_INVOICE_PRINT', name: 'Print', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'INVOICE.LIST', name: 'List Invoices' },
        { code: 'INVOICE.VIEW', name: 'View Invoice' },
        { code: 'INVOICE.CREATE', name: 'Create Invoice' },
        { code: 'INVOICE.EDIT', name: 'Edit Invoice' },
        { code: 'INVOICE.DELETE', name: 'Delete Invoice', isHighRisk: true },
        { code: 'INVOICE.DUPLICATE', name: 'Duplicate Invoice' },
        { code: 'INVOICE.DOWNLOAD_PDF', name: 'Download PDF' },
        { code: 'INVOICE.PRINT', name: 'Print Invoice' },
      ],
      bulkActions: [
        { code: 'INVOICE.BULK_SEND', name: 'Bulk Send', isHighRisk: true },
        { code: 'INVOICE.BULK_MARK_PAID', name: 'Bulk Mark as Paid', isHighRisk: true },
        { code: 'INVOICE.BULK_EXPORT', name: 'Bulk Export' },
        { code: 'INVOICE.BULK_DELETE', name: 'Bulk Delete', isHighRisk: true },
      ],
      transitions: [
        { code: 'INVOICE.DRAFT_TO_SENT', name: 'Send Invoice', fromStatus: 'DRAFT', toStatus: 'SENT' },
        { code: 'INVOICE.DRAFT_TO_CANCELLED', name: 'Discard Draft', fromStatus: 'DRAFT', toStatus: 'CANCELLED' },
        { code: 'INVOICE.SENT_TO_PAID', name: 'Mark as Paid', fromStatus: 'SENT', toStatus: 'PAID' },
        { code: 'INVOICE.SENT_TO_CANCELLED', name: 'Cancel Sent Invoice', fromStatus: 'SENT', toStatus: 'CANCELLED' },
        { code: 'INVOICE.PAID_TO_CANCELLED', name: 'Reverse Paid Invoice', fromStatus: 'PAID', toStatus: 'CANCELLED' },
      ],
      scopes: [{ code: 'DEFAULT', name: 'Invoices', ownerField: 'createdById', teamField: 'teamId', branchField: 'branchId', departmentField: 'departmentId' }],
      listColumns: [
        { code: 'COL_INVOICE_NUMBER', name: 'Invoice #', fieldCode: 'INVOICE_NUMBER', sortOrder: 1 },
        { code: 'COL_INVOICE_DATE', name: 'Date', fieldCode: 'INVOICE_DATE', sortOrder: 2 },
        { code: 'COL_INVOICE_CUSTOMER', name: 'Customer', sortOrder: 3 },
        { code: 'COL_INVOICE_DUE', name: 'Due Date', fieldCode: 'INVOICE_DUE_DATE', sortOrder: 4 },
        { code: 'COL_INVOICE_AMOUNT', name: 'Amount', fieldCode: 'INVOICE_GRAND_TOTAL', sortOrder: 5 },
        { code: 'COL_INVOICE_STATUS', name: 'Status', fieldCode: 'INVOICE_STATUS', sortOrder: 6 },
        { code: 'COL_INVOICE_CREATED_BY', name: 'Created By', sortOrder: 7 },
      ],
      listFilters: [
        { code: 'FILTER_INVOICE_STATUS', name: 'Status', sortOrder: 1 },
        { code: 'FILTER_INVOICE_DATE_RANGE', name: 'Date Range', sortOrder: 2 },
        { code: 'FILTER_INVOICE_CUSTOMER', name: 'Customer', sortOrder: 3 },
        { code: 'FILTER_INVOICE_CREATED_BY', name: 'Created By', sortOrder: 4 },
        { code: 'FILTER_INVOICE_AMOUNT_RANGE', name: 'Amount Range', sortOrder: 5 },
        { code: 'FILTER_INVOICE_PAYMENT_TERMS', name: 'Payment Terms', sortOrder: 6 },
      ],
    },

    {
      code: 'PRIVILEGE_MGMT', name: 'Privilege Management', icon: 'shield', sortOrder: 90,
      forms: [],
      actions: [
        { code: 'PRIVILEGE.MANAGE', name: 'Manage Roles & Permissions' },
        { code: 'PRIVILEGE.AUDIT_VIEW', name: 'View Audit Log' },
        { code: 'PRIVILEGE.PREVIEW_AS_USER', name: 'Preview as Another User' },
        { code: 'PRIVILEGE.TEMPLATE_MANAGE', name: 'Manage Templates' },
        { code: 'PRIVILEGE.APPROVAL_HANDLE', name: 'Approve / Reject Requests' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [],
      listColumns: [],
      listFilters: [],
    },

    {
      code: 'USER_MGMT', name: 'User Management', icon: 'user-cog', sortOrder: 91,
      forms: [{
        code: 'USER_FORM', name: 'User',
        sections: [
          { code: 'USER_BASIC', name: 'Basic', fields: [
            { code: 'USER_FULL_NAME', name: 'Full Name', dataType: 'TEXT', defaultRequired: true },
            { code: 'USER_EMAIL', name: 'Email', dataType: 'EMAIL', defaultRequired: true, isPii: true },
            { code: 'USER_PASSWORD', name: 'Password', dataType: 'TEXT', defaultRequired: true },
            { code: 'USER_ACTIVE', name: 'Active', dataType: 'TEXT' },
          ]},
          { code: 'USER_ORG', name: 'Organisation', fields: [
            { code: 'USER_TEAM', name: 'Team', dataType: 'SELECT' },
            { code: 'USER_BRANCH', name: 'Branch', dataType: 'SELECT' },
            { code: 'USER_DEPARTMENT', name: 'Department', dataType: 'SELECT' },
            { code: 'USER_MANAGER', name: 'Manager', dataType: 'SELECT' },
          ]},
        ],
        buttons: [
          { code: 'BTN_USER_SAVE', name: 'Save', variant: 'primary' },
          { code: 'BTN_USER_DEACTIVATE', name: 'Deactivate', variant: 'destructive' },
          { code: 'BTN_USER_RESET_PASSWORD', name: 'Reset Password', variant: 'default' },
        ],
      }],
      actions: [
        { code: 'USER.LIST', name: 'List Users' },
        { code: 'USER.CREATE', name: 'Create User' },
        { code: 'USER.EDIT', name: 'Edit User' },
        { code: 'USER.DEACTIVATE', name: 'Deactivate User', isHighRisk: true },
        { code: 'USER.RESET_PASSWORD', name: 'Reset User Password' },
      ],
      bulkActions: [],
      transitions: [],
      scopes: [],
      listColumns: [],
      listFilters: [],
    },
  ],

  // ----- REPORTS -----
  reports: [
    { code: 'RPT_INVOICE_AGING', name: 'Invoice Aging Report', category: 'Finance', description: 'Outstanding invoices grouped by aging buckets' },
    { code: 'RPT_REVENUE_SUMMARY', name: 'Revenue Summary', category: 'Finance', description: 'Monthly/quarterly revenue breakdown' },
    { code: 'RPT_TAX_LIABILITY', name: 'Tax Liability Report', category: 'Finance', description: 'CGST/SGST/IGST collected over period' },
    { code: 'RPT_CUSTOMER_LIFETIME', name: 'Customer Lifetime Value', category: 'CRM' },
    { code: 'RPT_TOP_CUSTOMERS', name: 'Top Customers by Revenue', category: 'CRM' },
    { code: 'RPT_TOP_PRODUCTS', name: 'Top Selling Products', category: 'Sales' },
    { code: 'RPT_INVOICE_STATUS', name: 'Invoice Status Distribution', category: 'Operations' },
    { code: 'RPT_USER_ACTIVITY', name: 'User Activity Report', category: 'Admin' },
  ],

  // ----- DASHBOARD WIDGETS -----
  dashboardWidgets: [
    { code: 'WIDGET_REVENUE_MTD', name: 'Revenue (Month to Date)' },
    { code: 'WIDGET_REVENUE_YTD', name: 'Revenue (Year to Date)' },
    { code: 'WIDGET_OUTSTANDING', name: 'Outstanding Receivables' },
    { code: 'WIDGET_OVERDUE_COUNT', name: 'Overdue Invoice Count' },
    { code: 'WIDGET_TOP_CUSTOMERS', name: 'Top 5 Customers' },
    { code: 'WIDGET_RECENT_INVOICES', name: 'Recent Invoices' },
    { code: 'WIDGET_INVOICES_BY_STATUS', name: 'Invoices by Status (chart)' },
    { code: 'WIDGET_REVENUE_TREND', name: 'Revenue Trend (12-month)' },
    { code: 'WIDGET_TAX_COLLECTED_MTD', name: 'Tax Collected (MTD)' },
    { code: 'WIDGET_PENDING_APPROVALS', name: 'My Pending Approvals' },
  ],
};
```

## B.9 Default Role Grants (seed)

| Role | Invoice Module | Customers | Products | Reports | Notable |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | All EDIT | All EDIT | All EDIT | All EXPORT | Bypasses everything |
| `ADMIN` | All EDIT, all actions ALLOW | All EDIT | All EDIT | All EXPORT | Includes `PRIVILEGE.MANAGE` |
| `ACCOUNTANT` | EDIT; `BULK_DELETE` DENY; `PAID_TO_CANCELLED` `ALLOW_WITH_APPROVAL` | EDIT | EDIT | All EXPORT | Cannot manage privileges or users |
| `SALES` | EDIT own + team (RECORD_SCOPE = TEAM); cannot DELETE; cannot transition PAID→CANCELLED | EDIT (TEAM scope) | VIEW | RPT_TOP_CUSTOMERS, RPT_TOP_PRODUCTS only (VIEW) | No bulk delete/send |
| `VIEWER` | All modules VIEW; all destructive DENY; PII columns MASKED | VIEW (MASKED PII) | VIEW | All VIEW (no EXPORT) | Read-only |
| `AUDITOR` | All VIEW; `AUDIT_VIEW` ALLOW | VIEW (unmasked) | VIEW | All EXPORT | Read-only + audit access |

## B.10 Seed Data Requirements

- **1 company profile** (Accordex Systems Pvt Ltd, Bangalore, Karnataka)
- **6 users:** 1 SUPER_ADMIN, 1 ADMIN, 1 ACCOUNTANT, 1 SALES (with team), 1 VIEWER, 1 AUDITOR
- **2 teams, 2 branches, 2 departments**
- **3 customers** (1 Individual; 1 Business intra-state Karnataka; 1 Business inter-state Tamil Nadu)
- **5 products** (mix Product/Service; tax rates 0/5/12/18/28)
- **5 invoices** (1 Draft, 2 Sent, 1 Paid, 1 Cancelled; one intra-state with CGST/SGST split, one inter-state with IGST)
- **3 privilege templates:** "Front Desk Receptionist", "Read-Only Auditor", "Finance Approver"
- **2 sample approval requests** (1 pending, 1 approved)

## B.11 README Requirements

`/README.md` covering:
1. Project description
2. Tech stack
3. Folder structure (tree command output)
4. Prerequisites (Node 20+, pnpm, PostgreSQL 15+)
5. `.env.example` keys
6. Setup: clone → `pnpm install` → `cp .env.example .env` → `pnpm db:push` → `pnpm db:seed` → `pnpm dev`
7. Default login credentials (table of 6 seed users with role + password)
8. **Privilege System Overview** — 1-page summary of the 15-level architecture with screenshot of Role Editor matrix
9. **How Record Scope Works** — example of SALES user seeing only their team's invoices
10. **How Approval Flow Works** — example of ACCOUNTANT reversing a paid invoice → goes to ADMIN queue
11. **How to Add a New Permission** — copy/paste guide for extending the registry
12. Completed feature checklist
13. Skipped / future features
14. Deployment notes

## B.12 Acceptance Checklist

**Functionality**
- [ ] All 6 invoice modules implemented end-to-end
- [ ] Live calculations correct for all edge cases (zero, decimals, large numbers)
- [ ] GST split toggles intra/inter-state by comparing customer/company state
- [ ] Invoice PDF matches preview pixel-for-pixel; A4; logo embedded
- [ ] Indian number formatting (`1,00,000.00`) for INR
- [ ] Amount in words generates correctly up to 99,99,99,999.99

**Privilege Engine**
- [ ] All 15 target levels modelled and seeded for Invoice product
- [ ] Field masking applied server-side AND client-side for PII fields
- [ ] Record scope correctly filters list queries (SQL WHERE clause)
- [ ] Status transitions correctly gated (e.g., SALES can DRAFT_TO_SENT but not PAID_TO_CANCELLED)
- [ ] Bulk actions separate from individual actions (a SALES user with INVOICE.DELETE=DENY but INVOICE.BULK_DELETE=ALLOW is honoured exactly)
- [ ] `ALLOW_WITH_APPROVAL` correctly queues to ApprovalRequest table
- [ ] Time-bound grants expire and revert at correct time
- [ ] Condition expressions (e.g., `record.status == 'DRAFT'`) evaluate correctly

**Admin UI**
- [ ] All 10 admin screens implemented
- [ ] Role Editor's 15 tabs all functional with bulk "set all to X"
- [ ] Preview-as-user shows banner, blocks writes, logs to audit
- [ ] Role comparison color-coded diff works
- [ ] Privilege templates apply with all 3 conflict strategies (Overwrite / Keep / Merge Permissive)
- [ ] Approval queue notifies approvers
- [ ] Audit log is filterable, exportable, immutable

**Integration**
- [ ] Every API write route guarded
- [ ] Every UI field wrapped in `<PrivilegeField>`
- [ ] Every list column respects `LIST_COLUMN` mode + mask
- [ ] No console errors
- [ ] Lighthouse a11y ≥ 90

---

## Implementation Order (for Cursor)

1. **Scaffold monorepo + Prisma** — schema = Part A.3 + Part B.2
2. **Build Privilege Engine (Part A)** — resolver, middleware, hooks
3. **Seed registry** from `invoice-registry.ts` (Part B.8)
4. **Seed system roles + 6 sample users + org units** (Part B.10)
5. **Build Admin UI** — all 10 screens (Part A.7)
6. **Build Company Profile module**
7. **Build Customer module** (with `<PrivilegeField>`, `<PrivilegeColumn>`, `<PrivilegeButton>`)
8. **Build Product Catalog module**
9. **Build Invoice Creation module** — leave 2 days, this is the heavy one
10. **Build Invoice Listing module** with record scope + filters
11. **Build Invoice Preview + PDF module**
12. **Build Dashboard + Reports modules**
13. **Seed 3 customers / 5 products / 5 invoices / 3 templates / 2 approvals**
14. **Write README + verify acceptance checklist**

---

**END OF PROMPT.**
