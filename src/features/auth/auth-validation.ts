import { z } from 'zod';

const emailSchema = z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().max(120, 'Use 120 characters or fewer.').optional(),
    email: emailSchema,
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  displayName: z.string().trim().max(120, 'Use 120 characters or fewer.'),
});

export type FieldErrors = Record<string, string | undefined>;

export function getFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function firstMessage(result: z.ZodSafeParseResult<unknown>) {
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function validateEmailField(value: string) {
  return firstMessage(emailSchema.safeParse(value));
}

export function validateCurrentPasswordField(value: string) {
  return firstMessage(z.string().min(1, 'Enter your password.').safeParse(value));
}

export function validateNewPasswordField(value: string) {
  return firstMessage(z.string().min(8, 'Use at least 8 characters.').safeParse(value));
}

export function validateConfirmationField(value: string, password: string) {
  if (!value) return 'Confirm your password.';
  return value === password ? undefined : 'Passwords do not match.';
}

export function validateDisplayNameField(value: string) {
  return firstMessage(z.string().trim().max(120, 'Use 120 characters or fewer.').safeParse(value));
}
