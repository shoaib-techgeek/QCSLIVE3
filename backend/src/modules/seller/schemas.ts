import { z } from 'zod';

const description = z.string().trim().max(1000);

export const createSellerSchema = z.object({ storeName: z.string().trim().min(1).max(60), description: description.optional() }).strict();
export const updateSellerSchema = z.object({ description: description.nullable() }).strict();
