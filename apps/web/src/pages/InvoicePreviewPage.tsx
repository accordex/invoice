import { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatINR } from '@invoice/shared/calc';
import { api } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Guarded } from '@/lib/privilege/usePrivilege';

export function InvoicePreviewPage() {
  const { id } = useParams();
  const printRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['invoice-preview', id],
    queryFn: async () => {
      const [invoice, company] = await Promise.all([
        api<{
          invoiceNumber: string;
          invoiceDate: string;
          dueDate: string;
          billingAddress: string;
          shippingAddress?: string;
          subtotal: number;
          totalDiscount: number;
          taxableAmount: number;
          cgst: number;
          sgst: number;
          igst: number;
          shippingCharges: number;
          roundOff: number;
          grandTotal: number;
          amountInWords: string;
          notes?: string;
          terms?: string;
          status: string;
          customer: { name: string; gstin?: string };
          lineItems: Array<{
            itemName: string;
            description?: string;
            hsnSac?: string;
            quantity: number;
            unit: string;
            rate: number;
            discountPct: number;
            taxPct: number;
            lineTotal: number;
          }>;
        }>(`/api/invoices/${id}`),
        api<{
          name: string;
          email: string;
          phone: string;
          gstin?: string;
          addressLine1: string;
          addressLine2?: string;
          city: string;
          state: string;
          pincode: string;
          bankName?: string;
          accountNumber?: string;
          ifsc?: string;
        }>('/api/company'),
      ]);
      return { invoice, company };
    },
  });

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    if (printRef.current) {
      html2pdf().set({
        margin: 15,
        filename: `${data?.invoice.invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(printRef.current).save();
    }
  };

  if (!data) return <p>Loading...</p>;

  const { invoice, company } = data;

  return (
    <Guarded action="INVOICE.VIEW">
      <div className="space-y-4 no-print">
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/invoices">Back</Link></Button>
          <Guarded action="INVOICE.EDIT">
            <Button variant="outline" asChild><Link to={`/invoices/${id}/edit`}>Edit</Link></Button>
          </Guarded>
          <Guarded action="INVOICE.PRINT">
            <Button variant="outline" onClick={handlePrint}>Print</Button>
          </Guarded>
          <Guarded action="INVOICE.DOWNLOAD_PDF">
            <Button onClick={handleDownloadPdf}>Download PDF</Button>
          </Guarded>
        </div>
      </div>

      <div ref={printRef} className="invoice-preview mx-auto max-w-[210mm] bg-white p-8 shadow-lg text-sm">
        <div className="flex justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">{company?.name}</h1>
            <p>{company?.addressLine1}</p>
            {company?.addressLine2 && <p>{company.addressLine2}</p>}
            <p>{company?.city}, {company?.state} — {company?.pincode}</p>
            <p>GSTIN: {company?.gstin}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">TAX INVOICE</h2>
            <p><strong>{invoice.invoiceNumber}</strong></p>
            <p>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
            <p>Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
            <p className="mt-2 uppercase text-xs font-medium">{invoice.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold mb-1">Bill To</h3>
            <p className="font-medium">{invoice.customer.name}</p>
            <p className="whitespace-pre-line">{invoice.billingAddress}</p>
            {invoice.customer.gstin && <p>GSTIN: {invoice.customer.gstin}</p>}
          </div>
          <div>
            <h3 className="font-semibold mb-1">Ship To</h3>
            <p className="whitespace-pre-line">{invoice.shippingAddress ?? invoice.billingAddress}</p>
          </div>
        </div>

        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">#</th>
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2 text-left">HSN</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Tax%</th>
              <th className="border p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line, i) => (
              <tr key={i}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2">{line.itemName}</td>
                <td className="border p-2">{line.hsnSac}</td>
                <td className="border p-2 text-right">{line.quantity} {line.unit}</td>
                <td className="border p-2 text-right">₹{formatINR(Number(line.rate))}</td>
                <td className="border p-2 text-right">{line.taxPct}%</td>
                <td className="border p-2 text-right">₹{formatINR(Number(line.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{formatINR(Number(invoice.subtotal))}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>₹{formatINR(Number(invoice.totalDiscount))}</span></div>
            <div className="flex justify-between"><span>Taxable</span><span>₹{formatINR(Number(invoice.taxableAmount))}</span></div>
            {Number(invoice.igst) > 0 ? (
              <div className="flex justify-between"><span>IGST</span><span>₹{formatINR(Number(invoice.igst))}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span>CGST</span><span>₹{formatINR(Number(invoice.cgst))}</span></div>
                <div className="flex justify-between"><span>SGST</span><span>₹{formatINR(Number(invoice.sgst))}</span></div>
              </>
            )}
            {Number(invoice.shippingCharges) > 0 && (
              <div className="flex justify-between"><span>Shipping</span><span>₹{formatINR(Number(invoice.shippingCharges))}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>Grand Total</span><span>₹{formatINR(Number(invoice.grandTotal))}</span>
            </div>
          </div>
        </div>

        <p className="italic text-sm mb-6">Amount in words: {invoice.amountInWords}</p>

        {company?.bankName && (
          <div className="border-t pt-4 mb-4 text-sm">
            <p className="font-semibold">Bank Details</p>
            <p>{company.bankName} · A/C: {company.accountNumber} · IFSC: {company.ifsc}</p>
          </div>
        )}

        {invoice.terms && (
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold">Terms & Conditions</p>
            <p className="whitespace-pre-line">{invoice.terms}</p>
          </div>
        )}

        <div className="mt-12 text-right">
          <p className="text-sm">For {company?.name}</p>
          <p className="mt-8 text-sm">Authorised Signatory</p>
        </div>
      </div>
    </Guarded>
  );
}
