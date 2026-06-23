import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceSchema, type InvoiceInput } from '@invoice/shared';
import { calcInvoice, calcLine, formatINR } from '@invoice/shared/calc';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrivilegeField, PrivilegeSection, Guarded } from '@/lib/privilege/usePrivilege';

export function InvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api<{ items: Array<{ id: string; name: string; billingAddress: string; shippingAddress?: string; state: string }> }>('/api/customers'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ items: Array<{ id: string; name: string; unit: string; sellingPrice: number; taxRate: number; hsnSac?: string }> }>('/api/products'),
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => api<{ state: string }>('/api/company'),
  });

  const { data: existing } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<InvoiceInput & { id: string; lineItems: InvoiceInput['lineItems'] }>(`/api/invoices/${id}`),
    enabled: isEdit,
  });

  const { data: nextNumber } = useQuery({
    queryKey: ['next-invoice-number'],
    queryFn: () => api<{ invoiceNumber: string }>('/api/invoices/next-number'),
    enabled: !isEdit,
  });

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      paymentTerms: 'Net 30',
      status: 'DRAFT',
      shippingCharges: 0,
      roundOff: 0,
      lineItems: [{ itemName: '', quantity: 1, unit: 'NOS', rate: 0, discountPct: 0, taxPct: 18, sortOrder: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lineItems' });
  const watched = useWatch({ control: form.control });
  const customerId = watched.customerId;
  const selectedCustomer = customers?.items.find((c) => c.id === customerId);

  useEffect(() => {
    if (existing) {
      form.reset({
        ...existing,
        invoiceDate: existing.invoiceDate.toString().slice(0, 10),
        dueDate: existing.dueDate.toString().slice(0, 10),
        lineItems: existing.lineItems.map((l) => ({
          ...l,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          discountPct: Number(l.discountPct),
        })),
      });
    } else if (nextNumber) {
      form.setValue('invoiceNumber', nextNumber.invoiceNumber);
    }
  }, [existing, nextNumber, form]);

  useEffect(() => {
    if (selectedCustomer && !isEdit) {
      form.setValue('billingAddress', selectedCustomer.billingAddress);
      form.setValue('shippingAddress', selectedCustomer.shippingAddress ?? selectedCustomer.billingAddress);
    }
  }, [selectedCustomer, form, isEdit]);

  const totals = calcInvoice(
    (watched.lineItems ?? []).map((l) => ({
      quantity: Number(l?.quantity ?? 0),
      rate: Number(l?.rate ?? 0),
      discountPct: Number(l?.discountPct ?? 0),
      taxPct: Number(l?.taxPct ?? 0),
    })),
    {
      customerState: selectedCustomer?.state ?? 'Karnataka',
      companyState: company?.state ?? 'Karnataka',
      shipping: Number(watched.shippingCharges ?? 0),
      roundOff: Number(watched.roundOff ?? 0),
    }
  );

  const saveMutation = useMutation({
    mutationFn: (data: InvoiceInput) =>
      (isEdit
        ? api<{ id: string }>(`/api/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : api<{ id: string }>('/api/invoices', { method: 'POST', body: JSON.stringify(data) })),
    onSuccess: (result: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${result.id}/preview`);
    },
  });

  const onSubmit = (data: InvoiceInput, preview = false) => {
    saveMutation.mutate(data);
    if (!preview) navigate('/invoices');
  };

  return (
    <Guarded action={isEdit ? 'INVOICE.EDIT' : 'INVOICE.CREATE'}>
      <form onSubmit={form.handleSubmit((d) => onSubmit(d, true))} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save & Preview'}
            </Button>
          </div>
        </div>

        <PrivilegeSection code="INVOICE_HEADER">
          <Card>
            <CardHeader><CardTitle>Invoice Header</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PrivilegeField code="INVOICE_NUMBER" defaultRequired>
                <div><Label>Invoice Number</Label><Input {...form.register('invoiceNumber')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_DATE" defaultRequired>
                <div><Label>Invoice Date</Label><Input type="date" {...form.register('invoiceDate')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_DUE_DATE" defaultRequired>
                <div><Label>Due Date</Label><Input type="date" {...form.register('dueDate')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_REFERENCE">
                <div><Label>Reference</Label><Input {...form.register('referenceNo')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_PAYMENT_TERMS" defaultRequired>
                <div><Label>Payment Terms</Label><Input {...form.register('paymentTerms')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="INVOICE_CUSTOMER">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="INVOICE_CUSTOMER_ID" defaultRequired>
                <div>
                  <Label>Customer</Label>
                  <select className="flex h-10 w-full rounded-md border px-3 text-sm" {...form.register('customerId')}>
                    <option value="">Select customer</option>
                    {customers?.items.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_BILLING_ADDRESS">
                <div><Label>Billing Address</Label><Textarea {...form.register('billingAddress')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_SHIPPING_ADDRESS">
                <div><Label>Shipping Address</Label><Textarea {...form.register('shippingAddress')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="INVOICE_LINE_ITEMS">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ itemName: '', quantity: 1, unit: 'NOS', rate: 0, discountPct: 0, taxPct: 18, sortOrder: fields.length })}>
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Disc %</th>
                    <th className="p-2 text-right">Tax %</th>
                    <th className="p-2 text-right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const line = watched.lineItems?.[index];
                    const lineTotal = calcLine(
                      Number(line?.quantity ?? 0),
                      Number(line?.rate ?? 0),
                      Number(line?.discountPct ?? 0),
                      Number(line?.taxPct ?? 0)
                    ).lineTotal;

                    return (
                      <tr key={field.id} className="border-b">
                        <td className="p-2">
                          <select
                            className="w-full rounded border px-2 py-1"
                            onChange={(e) => {
                              const product = products?.items.find((p) => p.id === e.target.value);
                              if (product) {
                                form.setValue(`lineItems.${index}.productId`, product.id);
                                form.setValue(`lineItems.${index}.itemName`, product.name);
                                form.setValue(`lineItems.${index}.unit`, product.unit);
                                form.setValue(`lineItems.${index}.rate`, Number(product.sellingPrice));
                                form.setValue(`lineItems.${index}.taxPct`, product.taxRate as 0 | 5 | 12 | 18 | 28);
                                form.setValue(`lineItems.${index}.hsnSac`, product.hsnSac);
                              }
                            }}
                          >
                            <option value="">Select or type below</option>
                            {products?.items.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <Input className="mt-1" {...form.register(`lineItems.${index}.itemName`)} />
                        </td>
                        <td className="p-2"><Input type="number" step="0.001" className="text-right" {...form.register(`lineItems.${index}.quantity`, { valueAsNumber: true })} /></td>
                        <td className="p-2"><Input type="number" className="text-right" {...form.register(`lineItems.${index}.rate`, { valueAsNumber: true })} /></td>
                        <td className="p-2"><Input type="number" className="text-right" {...form.register(`lineItems.${index}.discountPct`, { valueAsNumber: true })} /></td>
                        <td className="p-2">
                          <select className="w-full rounded border px-2 py-1" {...form.register(`lineItems.${index}.taxPct`, { valueAsNumber: true })}>
                            {[0, 5, 12, 18, 28].map((t) => <option key={t} value={t}>{t}%</option>)}
                          </select>
                        </td>
                        <td className="p-2 text-right">₹{formatINR(lineTotal)}</td>
                        <td className="p-2">
                          {fields.length > 1 && (
                            <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>×</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="INVOICE_TOTALS">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 max-w-md ml-auto text-sm">
              <span>Subtotal</span><span className="text-right">₹{formatINR(totals.subtotal)}</span>
              <span>Discount</span><span className="text-right">₹{formatINR(totals.totalDiscount)}</span>
              <span>Taxable</span><span className="text-right">₹{formatINR(totals.taxableAmount)}</span>
              {totals.igst > 0 ? (
                <><span>IGST</span><span className="text-right">₹{formatINR(totals.igst)}</span></>
              ) : (
                <>
                  <span>CGST</span><span className="text-right">₹{formatINR(totals.cgst)}</span>
                  <span>SGST</span><span className="text-right">₹{formatINR(totals.sgst)}</span>
                </>
              )}
              <PrivilegeField code="INVOICE_SHIPPING">
                <div className="flex justify-between gap-4">
                  <Label>Shipping</Label>
                  <Input type="number" className="w-32 text-right" {...form.register('shippingCharges', { valueAsNumber: true })} />
                </div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_ROUND_OFF">
                <div className="flex justify-between gap-4">
                  <Label>Round Off</Label>
                  <Input type="number" className="w-32 text-right" {...form.register('roundOff', { valueAsNumber: true })} />
                </div>
              </PrivilegeField>
              <span className="font-bold text-lg">Grand Total</span>
              <span className="text-right font-bold text-lg">₹{formatINR(totals.grandTotal)}</span>
              <span className="col-span-2 text-xs text-muted-foreground italic">{totals.amountInWords}</span>
            </CardContent>
          </Card>
        </PrivilegeSection>

        <PrivilegeSection code="INVOICE_FOOTER">
          <Card>
            <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <PrivilegeField code="INVOICE_NOTES">
                <div><Label>Notes</Label><Textarea {...form.register('notes')} /></div>
              </PrivilegeField>
              <PrivilegeField code="INVOICE_TERMS">
                <div><Label>Terms</Label><Textarea {...form.register('terms')} /></div>
              </PrivilegeField>
            </CardContent>
          </Card>
        </PrivilegeSection>
      </form>
    </Guarded>
  );
}
