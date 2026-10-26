import { z } from 'zod';
import { passwordSchema } from './password.js';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const token = z.string().min(20).max(200);
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number.');

export const registerSchema = z
  .object({
    email,
    password: passwordSchema,
    fullName: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => !v.password.toLowerCase().includes(v.email.split('@')[0] ?? ''), {
    path: ['password'],
    message: 'Password must not contain your email name.',
  });

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const verifyEmailSchema = z.object({ token });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token, password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).nullable().optional(),
    phone: phone.nullable().optional(),
  })
  .strict();
