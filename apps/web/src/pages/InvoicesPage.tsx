import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatINR } from '@invoice/shared/calc';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Guarded, useColumnMode, MaskedValue } from '@/lib/privilege/usePrivilege';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SENT: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? ''}`}>
      {status}
    </span>
  );
}

export function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          invoiceNumber: string;
          invoiceDate: string;
          dueDate: string;
          grandTotal: number;
          status: string;
          customer: { name: string };
        }>;
        metrics: { count: number; totalAmount: number };
      }>('/api/invoices'),
  });

  const colNumber = useColumnMode('COL_INVOICE_NUMBER');
  const colDate = useColumnMode('COL_INVOICE_DATE');
  const colCustomer = useColumnMode('COL_INVOICE_CUSTOMER');
  const colDue = useColumnMode('COL_INVOICE_DUE');
  const colAmount = useColumnMode('COL_INVOICE_AMOUNT');
  const colStatus = useColumnMode('COL_INVOICE_STATUS');

  return (
    <Guarded action="INVOICE.LIST">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Invoices</h2>
          <Guarded action="INVOICE.CREATE">
            <Button asChild>
              <Link to="/invoices/new">New Invoice</Link>
            </Button>
          </Guarded>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Invoices</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{data?.metrics.count ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Amount</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{formatINR(Number(data?.metrics.totalAmount ?? 0))}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6">Loading...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {colNumber.mode !== 'HIDDEN' && <th className="p-3 text-left">Invoice #</th>}
                    {colDate.mode !== 'HIDDEN' && <th className="p-3 text-left">Date</th>}
                    {colCustomer.mode !== 'HIDDEN' && <th className="p-3 text-left">Customer</th>}
                    {colDue.mode !== 'HIDDEN' && <th className="p-3 text-left">Due Date</th>}
                    {colAmount.mode !== 'HIDDEN' && <th className="p-3 text-right">Amount</th>}
                    {colStatus.mode !== 'HIDDEN' && <th className="p-3 text-left">Status</th>}
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/30">
                      {colNumber.mode !== 'HIDDEN' && (
                        <td className="p-3">
                          <Link to={`/invoices/${inv.id}/preview`} className="text-primary hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                      )}
                      {colDate.mode !== 'HIDDEN' && (
                        <td className="p-3">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                      )}
                      {colCustomer.mode !== 'HIDDEN' && <td className="p-3">{inv.customer.name}</td>}
                      {colDue.mode !== 'HIDDEN' && (
                        <td className="p-3">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                      )}
                      {colAmount.mode !== 'HIDDEN' && (
                        <td className="p-3 text-right">
                          {colAmount.mode === 'MASKED' ? (
                            <MaskedValue value={formatINR(Number(inv.grandTotal))} pattern={colAmount.maskPattern} />
                          ) : (
                            `₹${formatINR(Number(inv.grandTotal))}`
                          )}
                        </td>
                      )}
                      {colStatus.mode !== 'HIDDEN' && (
                        <td className="p-3"><StatusBadge status={inv.status} /></td>
                      )}
                      <td className="p-3 text-right space-x-2">
                        <Guarded action="INVOICE.EDIT">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/invoices/${inv.id}/edit`}>Edit</Link>
                          </Button>
                        </Guarded>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </Guarded>
  );
}
