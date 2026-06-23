import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatINR } from '@invoice/shared/calc';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Guarded } from '@/lib/privilege/usePrivilege';

export function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      api<{ items: Array<{ id: string; name: string; type: string; sku?: string; unit: string; sellingPrice: number; taxRate: number }> }>(
        '/api/products'
      ),
  });

  return (
    <Guarded action="PRODUCT.LIST">
      <div className="space-y-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Products</h2>
          <Guarded action="PRODUCT.CREATE">
            <Button asChild><Link to="/products/new">Add Product</Link></Button>
          </Guarded>
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? <p className="p-6">Loading...</p> : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">SKU</th>
                    <th className="p-3 text-left">Unit</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Tax %</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="p-3">{p.name}</td>
                      <td className="p-3">{p.type}</td>
                      <td className="p-3">{p.sku}</td>
                      <td className="p-3">{p.unit}</td>
                      <td className="p-3 text-right">₹{formatINR(Number(p.sellingPrice))}</td>
                      <td className="p-3 text-right">{p.taxRate}%</td>
                      <td className="p-3 text-right">
                        <Guarded action="PRODUCT.EDIT">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/products/${p.id}/edit`}>Edit</Link>
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
