import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatINR } from '@invoice/shared/calc';
import { api } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Guarded } from '@/lib/privilege/usePrivilege';

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api<{
        data: {
          revenueMtd: number;
          revenueYtd: number;
          outstanding: number;
          overdueCount: number;
          recentInvoices: Array<{ id: string; invoiceNumber: string; grandTotal: number; customer: { name: string } }>;
        };
      }>('/api/dashboard/widgets'),
  });

  const d = data?.data;

  return (
    <Guarded module="INVOICES" min="VIEW">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue MTD</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{formatINR(Number(d?.revenueMtd ?? 0))}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue YTD</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{formatINR(Number(d?.revenueYtd ?? 0))}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Outstanding</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{formatINR(Number(d?.outstanding ?? 0))}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{d?.overdueCount ?? 0}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {d?.recentInvoices?.map((inv) => (
                <div key={inv.id} className="flex justify-between border-b py-2 text-sm">
                  <Link to={`/invoices/${inv.id}/preview`} className="text-primary hover:underline">
                    {inv.invoiceNumber} — {inv.customer.name}
                  </Link>
                  <span>₹{formatINR(Number(inv.grandTotal))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Guarded>
  );
}
