import * as Linking from 'expo-linking';

export function getAuthCallbackUrl(flow: 'confirmation' | 'recovery' = 'confirmation') {
  return Linking.createURL('auth/callback', { queryParams: { flow } });
}
