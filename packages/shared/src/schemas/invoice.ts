import { z } from 'zod';

export const lineItemSchema = z.object({
  productId: z.string().optional().nullable(),
  itemName: z.string().min(1),
  description: z.string().optional().nullable(),
  hsnSac: z.string().optional().nullable(),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  rate: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  taxPct: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]),
  sortOrder: z.number().default(0),
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  referenceNo: z.string().optional().nullable(),
  paymentTerms: z.string().min(1),
  customerId: z.string().min(1),
  billingAddress: z.string().min(1),
  shippingAddress: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
  shippingCharges: z.number().default(0),
  roundOff: z.number().default(0),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).default('DRAFT'),
  attachmentUrl: z.string().optional().nullable(),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
