import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerSchema, type CustomerInput } from '@invoice/shared';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeField, PrivilegeSection, Guarded } from '@/lib/privilege/usePrivilege';

export function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: existing } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<CustomerInput>(`/api/customers/${id}`),
    enabled: isEdit,
  });

  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { type: 'INDIVIDUAL', isActive: true },
  });

  useEffect(() => {
    if (existing) form.reset(existing);
  }, [existing, form]);

  const mutation = useMutation({
    mutationFn: (data: CustomerInput) =>
      isEdit
        ? api(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : api('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
  });

  const sameAsBilling = () => {
    form.setValue('shippingAddress', form.getValues('billingAddress'));
  };

  return (
    <Guarded action={isEdit ? 'CUSTOMER.EDIT' : 'CUSTOMER.CREATE'}>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="max-w-2xl space-y-6">
        <h2 className="text-2xl font-bold">{isEdit ? 'Edit Customer' : 'New Customer'}</h2>

        <PrivilegeSection code="CUSTOMER_BASIC">
          <Card>
            <CardHeader><CardTitle>Basic</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="CUSTOMER_NAME" defaultRequired>
                <div><Label>Name</Label><Input {...form.register('name')} /></div>
              </PrivilegeField>
              <PrivilegeField code="CUSTOMER_TYPE" defaultRequired>
                <div>
                  <Label>Type</Label>
                  <select className="flex h-10 w-full rounded-md border px-3" {...form.register('type')}>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="CUSTOMER_CONTACT">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="CUSTOMER_EMAIL" defaultRequired>
                <div><Label>Email</Label><Input type="email" {...form.register('email')} /></div>
              </PrivilegeField>
              <PrivilegeField code="CUSTOMER_PHONE" defaultRequired>
                <div><Label>Phone</Label><Input {...form.register('phone')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="CUSTOMER_TAX">
          <Card>
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent>
              <PrivilegeField code="CUSTOMER_GSTIN">
                <div><Label>GSTIN</Label><Input {...form.register('gstin')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="CUSTOMER_ADDRESS">
          <Card>
            <CardHeader><CardTitle>Address</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="CUSTOMER_BILLING_ADDRESS" defaultRequired>
                <div><Label>Billing Address</Label><Textarea {...form.register('billingAddress')} /></div>
              </PrivilegeField>
              <PrivilegeField code="CUSTOMER_SHIPPING_ADDRESS">
                <div className="flex justify-between items-center">
                  <Label>Shipping Address</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={sameAsBilling}>Same as Billing</Button>
                </div>
                <Textarea {...form.register('shippingAddress')} />
              </PrivilegeField>
              <div className="grid gap-4 md:grid-cols-3">
                <PrivilegeField code="CUSTOMER_CITY" defaultRequired>
                  <div><Label>City</Label><Input {...form.register('city')} /></div>
                </PrivilegeField>
                <PrivilegeField code="CUSTOMER_STATE" defaultRequired>
                  <div><Label>State</Label><Input {...form.register('state')} /></div>
                </PrivilegeField>
                <PrivilegeField code="CUSTOMER_PINCODE" defaultRequired>
                  <div><Label>Pincode</Label><Input {...form.register('pincode')} /></div>
                </PrivilegeField>
              </div>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/customers')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>Save</Button>
        </div>
      </form>
    </Guarded>
  );
}
