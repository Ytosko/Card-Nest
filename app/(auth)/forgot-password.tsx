import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getAuthCallbackUrl } from '@/src/features/auth/auth-redirect';
import { forgotPasswordSchema, getFieldErrors, normalizeEmail, type FieldErrors, validateEmailField } from '@/src/features/auth/auth-validation';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const { initialized, session } = useAuth();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (initialized && session) return <Redirect href="/(app)/home" />;

  async function submit() {
    setFormError(null);
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(result.data.email), {
        redirectTo: getAuthCallbackUrl('recovery'),
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setFormError(getAuthErrorMessage(error instanceof Error ? error : undefined, 'We could not send the reset email. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reset password' }} />
      <AuthShell
        eyebrow="Account recovery"
        footer={<AuthLink href="/(auth)/sign-in">Back to sign in</AuthLink>}
        subtitle="We’ll send a secure link to choose a new password."
        title="Reset your password">
        <View style={{ gap: theme.spacing[4] }}>
          {sent ? (
            <AuthNotice
              message="If an account exists for that email, a reset link is on its way. Check spam if it does not arrive shortly."
              tone="success"
            />
          ) : null}
          {formError ? <AuthNotice message={formError} /> : null}
          <AppTextField
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            icon="email-outline"
            keyboardType="email-address"
            label="Email address"
            onBlur={() => setErrors((current) => ({ ...current, email: validateEmailField(email) }))}
            onChangeText={setEmail}
            onSubmitEditing={() => void submit()}
            placeholder="you@example.com"
            returnKeyType="send"
            textContentType="emailAddress"
            value={email}
          />
          <AppButton loading={loading} onPress={() => void submit()}>
            {sent ? 'Send another link' : 'Send reset link'}
          </AppButton>
        </View>
      </AuthShell>
    </>
  );
}
