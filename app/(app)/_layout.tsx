import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthLoadingScreen } from '@/src/features/auth/components/auth-loading-screen';

export default function SignedInLayout() {
  const { initialized, recoveryMode, session } = useAuth();

  if (!initialized) return <AuthLoadingScreen />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (recoveryMode) return <Redirect href="/(auth)/reset-password" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
