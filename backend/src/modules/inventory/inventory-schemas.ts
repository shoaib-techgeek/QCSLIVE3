import { z } from 'zod';

export const setStockSchema = z.object({ onHand: z.number().int().min(0).max(2_147_483_647), note: z.string().trim().max(200).optional() }).strict();
