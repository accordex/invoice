import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';
import { PrivilegeProvider } from '@/lib/privilege/usePrivilege';
import { AppLayout, ProtectedRoute } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { InvoiceFormPage } from '@/pages/InvoiceFormPage';
import { InvoicePreviewPage } from '@/pages/InvoicePreviewPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerFormPage } from '@/pages/CustomerFormPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductFormPage } from '@/pages/ProductFormPage';
import { CompanyPage } from '@/pages/CompanyPage';
import { PrivilegeAdminPage, RoleEditorPage } from '@/pages/PrivilegeAdminPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AuthenticatedApp() {
  return (
    <PrivilegeProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/invoices" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<InvoiceFormPage />} />
          <Route path="invoices/:id/edit" element={<InvoiceFormPage />} />
          <Route path="invoices/:id/preview" element={<InvoicePreviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/new" element={<CustomerFormPage />} />
          <Route path="customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="settings/company" element={<CompanyPage />} />
          <Route path="admin/privileges" element={<PrivilegeAdminPage />} />
          <Route path="admin/privileges/roles/:id" element={<RoleEditorPage />} />
        </Route>
      </Routes>
    </PrivilegeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AuthenticatedApp />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
