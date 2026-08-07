import { getPublicEnv } from '@/src/config/env';

export function getAuthCallbackUrl(_flow: 'confirmation' | 'recovery' = 'confirmation') {
  return getPublicEnv().EXPO_PUBLIC_AUTH_CALLBACK_URL;
}
