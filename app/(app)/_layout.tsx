import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthLoadingScreen } from '@/src/features/auth/components/auth-loading-screen';
import { getPasskeyAvailability, listUserPasskeys } from '@/src/features/auth/passkey-service';
import { authStorage } from '@/src/lib/supabase/auth-storage';

export default function SignedInLayout() {
  const { initialized, recoveryMode, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingPasskey, setCheckingPasskey] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkPasskeyStatus() {
      if (!session || recoveryMode) {
        if (isMounted) setCheckingPasskey(false);
        return;
      }

      try {
        const availability = getPasskeyAvailability();
        const prompted = await authStorage.getItem('passkey_setup_prompted');

        if (prompted === 'true' || !availability.isSupported) {
          if (isMounted) setCheckingPasskey(false);
          return;
        }

        const res = await listUserPasskeys();
        if (res.success && res.data.length === 0) {
          if (isMounted && pathname !== '/passkey-setup') {
            router.replace('/(app)/passkey-setup');
          }
        } else {
          // Account already has registered passkey(s) or list check completed
          await authStorage.setItem('passkey_setup_prompted', 'true');
        }
      } catch {
        // Fallback gracefully on network/storage errors without blocking app access
      } finally {
        if (isMounted) setCheckingPasskey(false);
      }
    }

    void checkPasskeyStatus();

    return () => {
      isMounted = false;
    };
  }, [pathname, recoveryMode, router, session]);

  if (!initialized || (session && checkingPasskey && pathname !== '/passkey-setup')) {
    return <AuthLoadingScreen />;
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (recoveryMode) return <Redirect href="/(auth)/reset-password" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
