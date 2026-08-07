import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/src/features/auth/components/auth-loading-screen';
import { useAuth } from '@/src/features/auth/auth-provider';
import { hasCompletedOnboarding } from '@/src/lib/onboarding';

export default function IndexScreen() {
  const { initialized, recoveryMode, session } = useAuth();

  if (!initialized) return <AuthLoadingScreen />;
  if (session && recoveryMode) return <Redirect href="/(auth)/reset-password" />;
  if (session) return <Redirect href="/(app)/(tabs)" />;
  return <Redirect href={hasCompletedOnboarding() ? '/(auth)/sign-in' : '/onboarding'} />;
}
