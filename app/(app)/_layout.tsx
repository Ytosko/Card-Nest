import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthLoadingScreen } from '@/src/features/auth/components/auth-loading-screen';
import { useSecurity } from '@/src/features/security/security-provider';

export default function SignedInLayout() {
  const { initialized: authInitialized, recoveryMode, session } = useAuth();
  const { initialized: securityInitialized, isConfigured, isUnlocked, setPendingDeepLink } =
    useSecurity();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authInitialized || !securityInitialized || !session || recoveryMode) {
      return;
    }

    const isSetupRoute = pathname === '/security-setup' || pathname === '/(app)/security-setup';
    const isUnlockRoute = pathname === '/unlock' || pathname === '/(app)/unlock';

    if (!isConfigured) {
      // Mandatory security setup for new signups AND existing users upgrading
      if (!isSetupRoute) {
        router.replace('/(app)/security-setup');
      }
    } else if (!isUnlocked) {
      // Device lock is configured but app is locked
      if (!isUnlockRoute && !isSetupRoute) {
        // Intercept deep links (e.g. cardnest://cards/<id>) and preserve target path
        if (pathname && pathname !== '/' && pathname !== '/home' && pathname !== '/(app)/home') {
          setPendingDeepLink(pathname);
        }
        router.replace('/(app)/unlock');
      }
    }
  }, [
    authInitialized,
    isConfigured,
    isUnlocked,
    pathname,
    recoveryMode,
    router,
    securityInitialized,
    session,
    setPendingDeepLink,
  ]);

  if (!authInitialized || !securityInitialized) {
    return <AuthLoadingScreen />;
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (recoveryMode) return <Redirect href="/(auth)/reset-password" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
