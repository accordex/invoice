import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import type { Mode } from '@invoice/shared/privilege';
import { maskValue } from '@invoice/shared/privilege';
import { api } from '@/lib/utils';

interface PrivilegeEntry {
  mode: Mode;
  maskPattern?: string;
}

interface PrivilegeContextValue {
  map: Record<string, PrivilegeEntry>;
  menuItems: Array<{ code: string; name: string; route?: string | null; icon?: string | null; parentId?: string | null }>;
  isLoading: boolean;
  get: (level: string, code: string) => PrivilegeEntry;
}

const PrivilegeContext = createContext<PrivilegeContextValue | null>(null);

export function PrivilegeProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['privileges'],
    queryFn: () =>
      api<{ privileges: Record<string, PrivilegeEntry>; menuItems: PrivilegeContextValue['menuItems'] }>(
        '/api/auth/me/privileges'
      ),
  });

  const value = useMemo<PrivilegeContextValue>(
    () => ({
      map: data?.privileges ?? {},
      menuItems: data?.menuItems ?? [],
      isLoading,
      get(level, code) {
        return data?.privileges?.[`${level}:${code}`] ?? { mode: 'HIDDEN' as Mode };
      },
    }),
    [data, isLoading]
  );

  return <PrivilegeContext.Provider value={value}>{children}</PrivilegeContext.Provider>;
}

export function usePrivilegeMap() {
  const ctx = useContext(PrivilegeContext);
  if (!ctx) throw new Error('usePrivilegeMap requires PrivilegeProvider');
  return ctx;
}

export function useFieldMode(code: string) {
  const { get } = usePrivilegeMap();
  return get('FIELD', code);
}

export function useButtonMode(code: string) {
  const { get } = usePrivilegeMap();
  return get('BUTTON', code);
}

export function useSectionMode(code: string) {
  const { get } = usePrivilegeMap();
  return get('SECTION', code);
}

export function useColumnMode(code: string) {
  const { get } = usePrivilegeMap();
  return get('LIST_COLUMN', code);
}

export function useMenuItemMode(code: string) {
  const { get } = usePrivilegeMap();
  return get('MENU_ITEM', code);
}

export function useCanDo(actionCode: string) {
  const { get } = usePrivilegeMap();
  const { mode } = get('ACTION', actionCode);
  return {
    allowed: mode === 'ALLOW' || mode === 'ALLOW_WITH_APPROVAL',
    requiresApproval: mode === 'ALLOW_WITH_APPROVAL',
  };
}

export function PrivilegeField({
  code,
  children,
  defaultRequired,
}: {
  code: string;
  children: ReactNode;
  defaultRequired?: boolean;
}) {
  const { mode, maskPattern } = useFieldMode(code);
  if (mode === 'HIDDEN') return null;

  if (mode === 'MASKED' && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ value?: string; readOnly?: boolean }>;
    const value = child.props.value;
    if (typeof value === 'string') {
      return React.cloneElement(child, {
        value: maskValue(value, maskPattern),
        readOnly: true,
      });
    }
  }

  const readOnly = mode === 'VIEW' || mode === 'MASKED';
  const required = mode === 'REQUIRED' || (defaultRequired && mode !== 'OPTIONAL');

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ readOnly?: boolean; required?: boolean; disabled?: boolean }>, {
      readOnly,
      disabled: readOnly,
      required,
    });
  }

  return <>{children}</>;
}

export function PrivilegeSection({ code, children }: { code: string; children: ReactNode }) {
  const { mode } = useSectionMode(code);
  if (mode === 'HIDDEN') return null;
  return (
    <div className={mode === 'COLLAPSED' ? 'opacity-60' : ''} data-section={code}>
      {children}
    </div>
  );
}

export function PrivilegeButton({
  code,
  children,
  onClick,
  variant,
  ...props
}: {
  code: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { mode } = useButtonMode(code);
  if (mode === 'HIDDEN') return null;

  return (
    <Button variant={variant} disabled={mode === 'DISABLED'} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}

export function MaskedValue({ value, pattern }: { value: string; pattern?: string }) {
  return <span>{maskValue(value, pattern)}</span>;
}

export function Guarded({
  module,
  action,
  min = 'VIEW',
  children,
}: {
  module?: string;
  action?: string;
  min?: 'VIEW' | 'EDIT';
  children: ReactNode;
}) {
  const { get } = usePrivilegeMap();

  if (action) {
    const { mode } = get('ACTION', action);
    if (!['ALLOW', 'ALLOW_WITH_APPROVAL'].includes(mode)) return null;
  }

  if (module) {
    const { mode } = get('MODULE', module);
    if (min === 'EDIT' && mode !== 'EDIT') return null;
    if (min === 'VIEW' && !['VIEW', 'EDIT'].includes(mode)) return null;
  }

  return <>{children}</>;
}
