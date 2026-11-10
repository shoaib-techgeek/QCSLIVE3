import { z } from 'zod';

export const addItemSchema = z.object({ skuId: z.uuid(), qty: z.number().int().min(1).max(1000) }).strict();
export const updateItemSchema = z
  .object({ qty: z.number().int().min(1).max(1000).optional(), selected: z.boolean().optional(), acceptPrice: z.literal(true).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
