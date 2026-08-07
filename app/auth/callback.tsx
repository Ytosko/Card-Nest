import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { parseAuthLink } from '@/src/features/auth/auth-link';
import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AuthCallbackScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const incomingUrl = Linking.useLinkingURL();
  const { beginRecovery } = useAuth();
  const processedUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleUrl(url: string | null) {
      if (!url || processedUrl.current === url) return;
      processedUrl.current = url;
      const result = parseAuthLink(url);

      if (result.kind === 'error') {
        if (active) setError(getAuthErrorMessage(new Error(result.message), 'This sign-in link is invalid or no longer available. Request a new one and try again.'));
        return;
      }
      if (result.kind === 'invalid') {
        if (active) setError('This link is invalid or incomplete. It may have expired or already been used.');
        return;
      }

      try {
        const { data, error: sessionError } = result.kind === 'code'
          ? await supabase.auth.exchangeCodeForSession(result.code)
          : await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error('No session was returned for this link.');

        const isRecovery = result.flowType === 'recovery';
        if (isRecovery) {
          beginRecovery();
          router.replace('/(auth)/reset-password');
        } else {
          router.replace({ pathname: '/(app)/home', params: { confirmed: 'true' } });
        }
      } catch (sessionError) {
        if (active) {
          setError(getAuthErrorMessage(sessionError instanceof Error ? sessionError : undefined, 'This link could not be verified. It may have expired or already been used.'));
        }
      }
    }

    if (incomingUrl) void handleUrl(incomingUrl);
    else void Linking.getInitialURL().then(handleUrl);

    return () => {
      active = false;
    };
  }, [beginRecovery, incomingUrl, router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Secure link' }} />
      <AuthShell
        eyebrow={error ? 'Link unavailable' : 'Secure connection'}
        footer={error ? <AuthLink href="/(auth)/sign-in">Back to sign in</AuthLink> : undefined}
        subtitle={error ? 'Your account is safe. Choose the right next step below.' : 'Hold on while we verify this Card Nest link.'}
        title={error ? 'We couldn’t open that link' : 'Verifying your link'}>
        <View style={{ gap: theme.spacing[4] }}>
          {error ? (
            <>
              <AuthNotice message={error} />
              <AppButton onPress={() => router.replace('/(auth)/forgot-password')} variant="secondary">
                Request a password reset
              </AppButton>
              <AppButton onPress={() => router.replace('/(auth)/sign-in')}>
                Try signing in
              </AppButton>
            </>
          ) : (
            <AuthNotice message="Checking the link and restoring your secure session…" tone="info" />
          )}
        </View>
      </AuthShell>
    </>
  );
}
