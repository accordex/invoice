import { z } from 'zod';

const customerBaseSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['INDIVIDUAL', 'BUSINESS']),
  email: z.string().email(),
  phone: z.string().min(1),
  gstin: z.string().optional().nullable(),
  billingAddress: z.string().min(1),
  shippingAddress: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const customerSchema = customerBaseSchema.refine(
  (d) => d.type !== 'BUSINESS' || (d.gstin && d.gstin.length > 0),
  { message: 'GSTIN is required for business customers', path: ['gstin'] }
);

export const customerUpdateSchema = customerBaseSchema.partial();

export type CustomerInput = z.infer<typeof customerSchema>;
