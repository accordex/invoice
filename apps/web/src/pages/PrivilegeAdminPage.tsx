import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Guarded } from '@/lib/privilege/usePrivilege';

const TABS = [
  'MENU_ITEM', 'MODULE', 'FORM', 'TAB', 'SECTION', 'FIELD', 'BUTTON',
  'LIST_COLUMN', 'LIST_FILTER', 'BULK_ACTION', 'ACTION', 'STATUS_TRANSITION',
  'RECORD_SCOPE', 'REPORT', 'DASHBOARD_WIDGET',
] as const;

export function PrivilegeAdminPage() {
  const [tab, setTab] = useState<string>('MODULE');
  const queryClient = useQueryClient();

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<Array<{ id: string; code: string; name: string; _count: { userRoles: number } }>>('/api/privilege/roles'),
  });

  const { data: registry } = useQuery({
    queryKey: ['registry'],
    queryFn: () => api<{ modules: unknown[]; menuItems: unknown[] }>('/api/privilege/registry'),
  });

  const { data: approvals } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api<Array<{ id: string; targetId: string; status: string; requester: { fullName: string } }>>('/api/privilege/approvals?status=PENDING'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api('/api/privilege/registry/sync', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registry'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/api/privilege/approvals/${id}/approve`, { method: 'POST', body: '{}' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  });

  return (
    <Guarded action="PRIVILEGE.MANAGE">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Roles & Permissions</h2>
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            Sync Registry
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {roles?.map((role) => (
                <Link
                  key={role.id}
                  to={`/admin/privileges/roles/${role.id}`}
                  className="block rounded-md border p-3 hover:bg-muted"
                >
                  <p className="font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.code} · {role._count.userRoles} users</p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Approval Queue ({approvals?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {approvals?.length === 0 && <p className="text-sm text-muted-foreground">No pending approvals</p>}
              {approvals?.map((a) => (
                <div key={a.id} className="flex justify-between items-center border rounded p-3">
                  <div>
                    <p className="font-medium">{a.targetId}</p>
                    <p className="text-xs text-muted-foreground">Requested by {a.requester.fullName}</p>
                  </div>
                  <Button size="sm" onClick={() => approveMutation.mutate(a.id)}>Approve</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Registry Inspector — 15 Target Levels</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mb-4">
              {TABS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? 'default' : 'outline'}
                  onClick={() => setTab(t)}
                >
                  {t.replace('_', ' ')}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Registry loaded with {registry?.modules?.length ?? 0} modules and {registry?.menuItems?.length ?? 0} menu items.
              Open a role to edit grants in the 15-tab permission matrix.
            </p>
          </CardContent>
        </Card>
      </div>
    </Guarded>
  );
}

export function RoleEditorPage() {
  const queryClient = useQueryClient();
  const { id: roleId } = useParams();

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<Array<{ id: string; name: string; code: string }>>('/api/privilege/roles'),
  });

  const role = roles?.find((r) => r.id === roleId);

  const { data: grants } = useQuery({
    queryKey: ['grants', roleId],
    queryFn: () => api<Array<{ targetLevel: string; targetId: string; mode: string }>>(`/api/privilege/roles/${roleId}/grants`),
    enabled: !!roleId,
  });

  const [activeTab, setActiveTab] = useState('MODULE');
  const [localGrants, setLocalGrants] = useState<typeof grants>([]);

  useEffect(() => {
    if (grants) setLocalGrants(grants);
  }, [grants]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api(`/api/privilege/roles/${roleId}/grants`, {
        method: 'PUT',
        body: JSON.stringify({ grants: localGrants ?? grants }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grants', roleId] }),
  });

  return (
    <Guarded action="PRIVILEGE.MANAGE">
      <div className="space-y-6">
        <div className="flex justify-between">
          <div>
            <h2 className="text-2xl font-bold">Role Editor</h2>
            <p className="text-muted-foreground">{role?.name} ({role?.code})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/admin/privileges">Back</Link></Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save Grants</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Button key={t} size="sm" variant={activeTab === t ? 'default' : 'outline'} onClick={() => setActiveTab(t)}>
              {t}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Tab: <strong>{activeTab}</strong> — {grants?.filter((g) => g.targetLevel === activeTab).length ?? 0} grants
            </p>
            <div className="max-h-96 overflow-auto space-y-1 text-sm">
              {grants?.filter((g) => g.targetLevel === activeTab).map((g) => (
                <div key={`${g.targetLevel}:${g.targetId}`} className="flex justify-between border-b py-1">
                  <span>{g.targetId}</span>
                  <span className="font-mono text-xs bg-muted px-2 rounded">{g.mode}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Guarded>
  );
}
