import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getAuthCallbackUrl } from '@/src/features/auth/auth-redirect';
import { normalizeEmail } from '@/src/features/auth/auth-validation';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function VerifyEmailScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const { initialized, pendingEmail, session } = useAuth();
  const email = useMemo(() => normalizeEmail(params.email ?? pendingEmail ?? ''), [params.email, pendingEmail]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (initialized && session) return <Redirect href="/(app)/home" />;

  async function resend() {
    setMessage(null);
    setError(null);
    if (!email) {
      setError('Return to create account and enter your email again.');
      return;
    }
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getAuthCallbackUrl() },
      });
      if (resendError) throw resendError;
      setMessage('A fresh confirmation link is on its way.');
    } catch (resendError) {
      setError(getAuthErrorMessage(resendError instanceof Error ? resendError : undefined, 'We could not resend the email. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Confirm email' }} />
      <AuthShell
        eyebrow="One quick step"
        footer={<AuthLink href="/(auth)/sign-in">I’ve already confirmed — sign in</AuthLink>}
        subtitle="Confirmation keeps your Card Nest private and recoverable."
        title="Check your inbox">
        <View style={{ gap: theme.spacing[5] }}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="email-check-outline" size={42} />
          </View>
          <View style={{ gap: theme.spacing[2] }}>
            <AppText>We sent a confirmation link{email ? ' to' : '.'}</AppText>
            {email ? <AppText variant="bodyStrong">{email}</AppText> : null}
            <AppText muted variant="caption">
              Open the link on this device. If it has expired, request another below.
            </AppText>
          </View>
          {message ? <AuthNotice message={message} tone="success" /> : null}
          {error ? <AuthNotice message={error} /> : null}
          <AppButton loading={loading} onPress={() => void resend()} variant="secondary">
            Resend confirmation email
          </AppButton>
          <AuthLink href="/(auth)/sign-up">Use a different email</AuthLink>
        </View>
      </AuthShell>
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, height: 72, justifyContent: 'center', width: 72 },
});
