import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companySchema, type CompanyInput } from '@invoice/shared';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeField, PrivilegeSection, Guarded } from '@/lib/privilege/usePrivilege';

export function CompanyPage() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['company'],
    queryFn: () => api<CompanyInput>('/api/company'),
  });

  const form = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: { country: 'India', defaultCurrency: 'INR' },
  });

  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: (body: CompanyInput) =>
      api('/api/company', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });

  return (
    <Guarded module="COMPANY_PROFILE" min="VIEW">
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="max-w-3xl space-y-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Company Profile</h2>
          <Guarded action="COMPANY.EDIT">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Guarded>
        </div>

        <PrivilegeSection code="COMPANY_IDENTITY">
          <Card>
            <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="COMPANY_NAME" defaultRequired>
                <div><Label>Company Name</Label><Input {...form.register('name')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_EMAIL" defaultRequired>
                <div><Label>Email</Label><Input type="email" {...form.register('email')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_PHONE" defaultRequired>
                <div><Label>Phone</Label><Input {...form.register('phone')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="COMPANY_TAX">
          <Card>
            <CardHeader><CardTitle>Tax Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="COMPANY_GSTIN">
                <div><Label>GSTIN</Label><Input {...form.register('gstin')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_PAN">
                <div><Label>PAN</Label><Input {...form.register('pan')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="COMPANY_ADDRESS">
          <Card>
            <CardHeader><CardTitle>Address</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="COMPANY_ADDRESS1" defaultRequired>
                <div><Label>Address Line 1</Label><Input {...form.register('addressLine1')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_ADDRESS2">
                <div><Label>Address Line 2</Label><Input {...form.register('addressLine2')} /></div>
              </PrivilegeField>
              <div className="grid gap-4 md:grid-cols-3">
                <PrivilegeField code="COMPANY_CITY" defaultRequired>
                  <div><Label>City</Label><Input {...form.register('city')} /></div>
                </PrivilegeField>
                <PrivilegeField code="COMPANY_STATE" defaultRequired>
                  <div><Label>State</Label><Input {...form.register('state')} /></div>
                </PrivilegeField>
                <PrivilegeField code="COMPANY_PINCODE" defaultRequired>
                  <div><Label>Pincode</Label><Input {...form.register('pincode')} /></div>
                </PrivilegeField>
              </div>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="COMPANY_FINANCIAL">
          <Card>
            <CardHeader><CardTitle>Financial</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="COMPANY_BANK_NAME">
                <div><Label>Bank Name</Label><Input {...form.register('bankName')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_ACCOUNT_NO">
                <div><Label>Account Number</Label><Input {...form.register('accountNumber')} /></div>
              </PrivilegeField>
              <PrivilegeField code="COMPANY_IFSC">
                <div><Label>IFSC</Label><Input {...form.register('ifsc')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>
      </form>
    </Guarded>
  );
}
