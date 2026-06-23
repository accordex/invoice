import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productSchema, type ProductInput } from '@invoice/shared';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeField, PrivilegeSection, Guarded } from '@/lib/privilege/usePrivilege';

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: existing } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<ProductInput & { sellingPrice: number }>(`/api/products/${id}`),
    enabled: isEdit,
  });

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { type: 'PRODUCT', unit: 'NOS', taxRate: 18, isActive: true },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        ...existing,
        sellingPrice: Number(existing.sellingPrice),
      });
    }
  }, [existing, form]);

  const mutation = useMutation({
    mutationFn: (data: ProductInput) =>
      isEdit
        ? api(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : api('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  return (
    <Guarded action={isEdit ? 'PRODUCT.EDIT' : 'PRODUCT.CREATE'}>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="max-w-2xl space-y-6">
        <h2 className="text-2xl font-bold">{isEdit ? 'Edit Product' : 'New Product'}</h2>

        <PrivilegeSection code="PRODUCT_BASIC">
          <Card>
            <CardHeader><CardTitle>Basic</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="PRODUCT_NAME" defaultRequired>
                <div><Label>Name</Label><Input {...form.register('name')} /></div>
              </PrivilegeField>
              <PrivilegeField code="PRODUCT_TYPE" defaultRequired>
                <div>
                  <Label>Type</Label>
                  <select className="flex h-10 w-full rounded-md border px-3" {...form.register('type')}>
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
              </PrivilegeField>
              <PrivilegeField code="PRODUCT_SKU">
                <div><Label>SKU</Label><Input {...form.register('sku')} /></div>
              </PrivilegeField>
              <PrivilegeField code="PRODUCT_DESCRIPTION">
                <div><Label>Description</Label><Textarea {...form.register('description')} /></div>
              </PrivilegeField>
              <PrivilegeField code="PRODUCT_HSN_SAC">
                <div><Label>HSN/SAC</Label><Input {...form.register('hsnSac')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="PRODUCT_PRICING">
          <Card>
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="PRODUCT_UNIT" defaultRequired>
                <div>
                  <Label>Unit</Label>
                  <select className="flex h-10 w-full rounded-md border px-3" {...form.register('unit')}>
                    {['NOS', 'KG', 'LITRE', 'HOUR', 'BOX', 'METER', 'SET', 'OTHER'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </PrivilegeField>
              <PrivilegeField code="PRODUCT_PRICE" defaultRequired>
                <div><Label>Selling Price</Label><Input type="number" {...form.register('sellingPrice', { valueAsNumber: true })} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="PRODUCT_TAX">
          <Card>
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent>
              <PrivilegeField code="PRODUCT_TAX_RATE" defaultRequired>
                <div>
                  <Label>Tax Rate (%)</Label>
                  <select className="flex h-10 w-full rounded-md border px-3" {...form.register('taxRate', { valueAsNumber: true })}>
                    {[0, 5, 12, 18, 28].map((t) => <option key={t} value={t}>{t}%</option>)}
                  </select>
                </div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>Save</Button>
        </div>
      </form>
    </Guarded>
  );
}
