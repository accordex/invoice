import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(1),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().default('India'),
  defaultCurrency: z.string().default('INR'),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifsc: z.string().optional().nullable(),
});

export type CompanyInput = z.infer<typeof companySchema>;
