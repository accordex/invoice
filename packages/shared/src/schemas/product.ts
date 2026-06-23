import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PRODUCT', 'SERVICE']),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  hsnSac: z.string().optional().nullable(),
  unit: z.enum(['NOS', 'KG', 'LITRE', 'HOUR', 'BOX', 'METER', 'SET', 'OTHER']),
  sellingPrice: z.number().min(0),
  taxRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]),
  category: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
