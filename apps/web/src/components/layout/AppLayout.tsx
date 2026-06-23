import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import {
  FileText,
  Users,
  Package,
  Settings,
  Shield,
  Home,
  LogOut,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePrivilegeMap, useMenuItemMode } from '@/lib/privilege/usePrivilege';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  'file-text': FileText,
  users: Users,
  package: Package,
  'bar-chart': BarChart3,
  settings: Settings,
  shield: Shield,
};

interface MenuItem {
  code: string;
  name: string;
  route?: string | null;
  icon?: string | null;
  parentId?: string | null;
  id?: string;
}

function NavLink({ code, name, route, icon, className }: { code: string; name: string; route?: string | null; icon?: string | null; className?: string }) {
  const { mode } = useMenuItemMode(code);
  const location = useLocation();
  if (mode === 'HIDDEN' || !route) return null;

  const Icon = icon ? iconMap[icon] ?? FileText : FileText;
  const active = location.pathname.startsWith(route);

  return (
    <Link
      to={route}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {name}
    </Link>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { menuItems } = usePrivilegeMap();

  const topLevel = (menuItems as MenuItem[]).filter((m) => !m.parentId);

  const getChildren = (parentId: string) =>
    (menuItems as MenuItem[]).filter((m) => m.parentId === parentId);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-lg font-bold">Invoice Generator</h1>
          <p className="text-xs text-muted-foreground">Accordex Systems</p>
        </div>

        <nav className="flex-1 space-y-1">
          {topLevel.map((item) => {
            const children = item.id ? getChildren(item.id) : [];
            return (
              <div key={item.code}>
                <NavLink code={item.code} name={item.name} route={item.route} icon={item.icon} />
                {children.map((child) => (
                  <NavLink
                    key={child.code}
                    code={child.code}
                    name={child.name}
                    route={child.route}
                    icon={child.icon}
                    className="ml-4"
                  />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t pt-4">
          <p className="text-sm font-medium">{user?.fullName}</p>
          <p className="text-xs text-muted-foreground mb-2">{user?.email}</p>
          {user?.previewMode && (
            <p className="text-xs text-amber-600 mb-2 font-medium">Preview mode — writes blocked</p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {user?.previewMode && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm text-center">
            You are previewing as another user. All write operations are blocked.
          </div>
        )}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  return <>{children}</>;
}
