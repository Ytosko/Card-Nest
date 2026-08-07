import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/src/features/auth/components/auth-loading-screen';
import { useAuth } from '@/src/features/auth/auth-provider';

export default function IndexScreen() {
  const { initialized, recoveryMode, session } = useAuth();

  if (!initialized) return <AuthLoadingScreen />;
  if (session && recoveryMode) return <Redirect href="/(auth)/reset-password" />;
  return <Redirect href={session ? '/(app)/home' : '/(auth)/sign-in'} />;
}
