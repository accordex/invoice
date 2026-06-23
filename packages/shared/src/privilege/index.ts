export type TargetLevel =
  | 'MENU_ITEM'
  | 'MODULE'
  | 'FORM'
  | 'TAB'
  | 'SECTION'
  | 'FIELD'
  | 'BUTTON'
  | 'LIST_COLUMN'
  | 'LIST_FILTER'
  | 'BULK_ACTION'
  | 'ACTION'
  | 'STATUS_TRANSITION'
  | 'RECORD_SCOPE'
  | 'REPORT'
  | 'DASHBOARD_WIDGET';

export type Mode =
  | 'NO_ACCESS'
  | 'HIDDEN'
  | 'COLLAPSED'
  | 'DISABLED'
  | 'VISIBLE'
  | 'VIEW'
  | 'EDIT'
  | 'MASKED'
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'ALLOW'
  | 'DENY'
  | 'ALLOW_WITH_APPROVAL'
  | 'OWN'
  | 'TEAM'
  | 'BRANCH'
  | 'DEPARTMENT'
  | 'ALL'
  | 'EXPORT';

export interface ResolvedPrivilege {
  level: TargetLevel;
  targetId: string;
  mode: Mode;
  maskPattern?: string;
  requiresApproval?: boolean;
}

export type PrivilegeMap = Record<string, { mode: Mode; maskPattern?: string }>;

export interface ManifestField {
  code: string;
  name: string;
  dataType: string;
  defaultRequired?: boolean;
  defaultMaskPattern?: string;
  isPii?: boolean;
  sortOrder?: number;
}

export interface ManifestSection {
  code: string;
  name: string;
  fields: ManifestField[];
  sortOrder?: number;
}

export interface ManifestTab {
  code: string;
  name: string;
  sections: ManifestSection[];
  sortOrder?: number;
}

export interface ManifestButton {
  code: string;
  name: string;
  variant?: string;
  sortOrder?: number;
}

export interface ManifestForm {
  code: string;
  name: string;
  tabs?: ManifestTab[];
  sections?: ManifestSection[];
  buttons?: ManifestButton[];
  sortOrder?: number;
}

export interface ManifestAction {
  code: string;
  name: string;
  isHighRisk?: boolean;
}

export interface ManifestBulkAction {
  code: string;
  name: string;
  isHighRisk?: boolean;
}

export interface ManifestTransition {
  code: string;
  name: string;
  fromStatus: string;
  toStatus: string;
}

export interface ManifestScope {
  code: string;
  name: string;
  ownerField?: string;
  teamField?: string;
  branchField?: string;
  departmentField?: string;
}

export interface ManifestListColumn {
  code: string;
  name: string;
  fieldCode?: string;
  defaultMaskPattern?: string;
  sortOrder?: number;
}

export interface ManifestListFilter {
  code: string;
  name: string;
  sortOrder?: number;
}

export interface ManifestModule {
  code: string;
  name: string;
  icon?: string;
  sortOrder?: number;
  forms: ManifestForm[];
  actions: ManifestAction[];
  bulkActions: ManifestBulkAction[];
  transitions: ManifestTransition[];
  scopes: ManifestScope[];
  listColumns: ManifestListColumn[];
  listFilters: ManifestListFilter[];
}

export interface ManifestMenuItem {
  code: string;
  name: string;
  icon?: string;
  parentCode?: string;
  route?: string;
  sortOrder?: number;
}

export interface ManifestReport {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

export interface ManifestWidget {
  code: string;
  name: string;
  description?: string;
}

export interface ProductManifest {
  product: { code: string; name: string };
  menuItems: ManifestMenuItem[];
  modules: ManifestModule[];
  reports: ManifestReport[];
  dashboardWidgets: ManifestWidget[];
}

export function maskValue(value: string, pattern?: string): string {
  if (!value || !pattern || pattern === 'MASK_NONE') return value;

  switch (pattern) {
    case 'MASK_LAST_4':
      return value.length <= 4 ? value : '*'.repeat(value.length - 4) + value.slice(-4);
    case 'MASK_FIRST_4':
      return value.length <= 4 ? value : value.slice(0, 4) + '*'.repeat(value.length - 4);
    case 'MASK_MIDDLE': {
      const at = value.indexOf('@');
      if (at > 1) return value[0] + '***' + value.slice(at);
      const mid = Math.floor(value.length / 2);
      return value.slice(0, mid - 1) + '***' + value.slice(mid + 2);
    }
    case 'MASK_FULL':
      return '*'.repeat(value.length);
    case 'MASK_INITIAL': {
      const parts = value.trim().split(/\s+/);
      return parts.map((p) => p[0]?.toUpperCase() + '.').join(' ');
    }
    default:
      if (pattern.startsWith('MASK_CUSTOM:')) {
        const [, regex, replace] = pattern.split(':');
        return value.replace(new RegExp(regex), replace ?? '***');
      }
      return value;
  }
}
