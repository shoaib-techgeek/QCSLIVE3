import { z } from 'zod';

const sellerSku = z.string().trim().regex(/^[A-Za-z0-9._-]{1,64}$/, 'Use letters, numbers, dots, dashes and underscores (up to 64).');
const money = z.number(); // integer-ness and range are checked by validatePrice so the message is consistent

export const createProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    categorySlug: z.string().trim().min(1).max(80),
    options: z.array(z.object({ name: z.string().max(60), values: z.array(z.string().max(60)) }).strict()).default([]),
    skus: z
      .array(
        z.object({
          sellerSku,
          options: z.record(z.string(), z.string()).default({}),
          priceMinor: money,
          compareAtMinor: money.optional(),
        }).strict(),
      )
      .min(1),
  })
  .strict();

export const updateProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    categorySlug: z.string().trim().min(1).max(80).optional(),
    skus: z
      .array(z.object({ id: z.uuid(), priceMinor: money.optional(), compareAtMinor: money.nullable().optional(), active: z.boolean().optional() }).strict())
      .min(1)
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export const listQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'active', 'inactive', 'rejected', 'banned']).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const MODERATION_DECISIONS = { approve: 'active', reject: 'rejected', ban: 'banned', deactivate: 'inactive' } as const;
export const moderateSchema = z
  .object({ decision: z.enum(Object.keys(MODERATION_DECISIONS) as [keyof typeof MODERATION_DECISIONS, ...(keyof typeof MODERATION_DECISIONS)[]]), reason: z.string().trim().max(1000).optional() })
  .strict();
export const adminQueueQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'inactive', 'rejected', 'banned']).default('pending'),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
