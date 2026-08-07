import { z } from 'zod';

const optionalUrl = z.union([z.literal(''), z.string().url()]);

const publicEnvSchema = z.object({
  EXPO_PUBLIC_APP_NAME: z.string().trim().min(1).default('Card Nest'),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  EXPO_PUBLIC_APP_SCHEME: z.string().trim().regex(/^[a-z][a-z0-9+.-]*$/u).default('cardnest'),
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'must use HTTPS',
  }),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  EXPO_PUBLIC_SUPPORT_EMAIL: z.string().trim().optional().default(''),
  EXPO_PUBLIC_PRIVACY_URL: optionalUrl.optional().default(''),
  EXPO_PUBLIC_TERMS_URL: optionalUrl.optional().default(''),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(input: Record<string, string | undefined>) {
  return publicEnvSchema.safeParse(input);
}

const publicEnvSource = {
  EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
};

export const publicEnvResult = parsePublicEnv(publicEnvSource);

export function getPublicEnv(): PublicEnv {
  if (publicEnvResult.success) {
    return publicEnvResult.data;
  }

  const invalidNames = [...new Set(publicEnvResult.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Invalid public application configuration: ${invalidNames.join(', ')}`);
}
