import { z } from 'zod';

export const DOCUMENT_KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo', 'tax_certificate'] as const;
export const REQUIRED_KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo'] as const;
export const MAX_PHOTOS = 4;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const documentKindSchema = z.enum(DOCUMENT_KINDS);

// 13 digits, with or without dashes (xxxxx-xxxxxxx-x); stored without dashes.
const cnic = z.string().trim().regex(/^\d{5}-?\d{7}-?\d$/, 'Enter a valid 13-digit CNIC.').transform((v) => v.replaceAll('-', ''));

export const kycPiiSchema = z
  .object({
    cnic,
    address: z.string().trim().min(10, 'Enter the full business address.').max(300),
    ntn: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, 'Enter a valid tax number.').optional(),
  })
  .strict();

export const DECISIONS = { start_review: 'under_review', approve: 'approved', approve_with_conditions: 'approved_with_conditions', reject: 'rejected', request_info: 'more_info_required' } as const;

export const decisionSchema = z.object({ decision: z.enum(Object.keys(DECISIONS) as [keyof typeof DECISIONS, ...(keyof typeof DECISIONS)[]]), note: z.string().trim().max(1000).optional() }).strict();

export const queueQuerySchema = z.object({
  status: z.enum(['submitted', 'under_review', 'more_info_required', 'approved', 'approved_with_conditions', 'rejected']).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
