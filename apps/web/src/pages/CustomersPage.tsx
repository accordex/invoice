import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Guarded, useColumnMode, MaskedValue } from '@/lib/privilege/usePrivilege';

export function CustomersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () =>
      api<{ items: Array<{ id: string; name: string; type: string; email: string; phone: string; city: string }> }>(
        '/api/customers'
      ),
  });

  const colName = useColumnMode('COL_CUSTOMER_NAME');
  const colEmail = useColumnMode('COL_CUSTOMER_EMAIL');
  const colPhone = useColumnMode('COL_CUSTOMER_PHONE');

  return (
    <Guarded action="CUSTOMER.LIST">
      <div className="space-y-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Customers</h2>
          <Guarded action="CUSTOMER.CREATE">
            <Button asChild><Link to="/customers/new">Add Customer</Link></Button>
          </Guarded>
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? <p className="p-6">Loading...</p> : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {colName.mode !== 'HIDDEN' && <th className="p-3 text-left">Name</th>}
                    <th className="p-3 text-left">Type</th>
                    {colEmail.mode !== 'HIDDEN' && <th className="p-3 text-left">Email</th>}
                    {colPhone.mode !== 'HIDDEN' && <th className="p-3 text-left">Phone</th>}
                    <th className="p-3 text-left">City</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((c) => (
                    <tr key={c.id} className="border-b">
                      {colName.mode !== 'HIDDEN' && <td className="p-3">{c.name}</td>}
                      <td className="p-3">{c.type}</td>
                      {colEmail.mode !== 'HIDDEN' && (
                        <td className="p-3">
                          {colEmail.mode === 'MASKED' ? (
                            <MaskedValue value={c.email} pattern={colEmail.maskPattern ?? 'MASK_MIDDLE'} />
                          ) : c.email}
                        </td>
                      )}
                      {colPhone.mode !== 'HIDDEN' && (
                        <td className="p-3">
                          {colPhone.mode === 'MASKED' ? (
                            <MaskedValue value={c.phone} pattern={colPhone.maskPattern ?? 'MASK_LAST_4'} />
                          ) : c.phone}
                        </td>
                      )}
                      <td className="p-3">{c.city}</td>
                      <td className="p-3 text-right">
                        <Guarded action="CUSTOMER.EDIT">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/customers/${c.id}/edit`}>Edit</Link>
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
