import { Redirect, Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getFieldErrors, resetPasswordSchema, type FieldErrors, validateConfirmationField, validateNewPasswordField } from '@/src/features/auth/auth-validation';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { completeRecovery, initialized, recoveryMode, session } = useAuth();
  const confirmationRef = useRef<TextInput>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (initialized && !session) return <Redirect href="/(auth)/forgot-password" />;
  if (initialized && session && !recoveryMode) return <Redirect href="/(app)/home" />;

  async function submit() {
    setFormError(null);
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: result.data.password });
      if (error) throw error;
      completeRecovery();
      router.replace('/(app)/home');
    } catch (error) {
      setFormError(getAuthErrorMessage(error instanceof Error ? error : undefined, 'We could not update your password. Request a new link and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Choose new password' }} />
      <AuthShell
        eyebrow="Secure your account"
        footer={<AuthLink href="/(auth)/forgot-password">Request a new reset link</AuthLink>}
        subtitle="Choose a fresh password for your Card Nest account."
        title="Create a new password">
        <View style={{ gap: theme.spacing[4] }}>
          {formError ? <AuthNotice message={formError} /> : null}
          <AppTextField
            autoComplete="new-password"
            error={errors.password}
            hint="At least 8 characters"
            icon="lock-outline"
            label="New password"
            onBlur={() => setErrors((current) => ({ ...current, password: validateNewPasswordField(password) }))}
            onChangeText={setPassword}
            onSubmitEditing={() => confirmationRef.current?.focus()}
            placeholder="Enter a secure password"
            returnKeyType="next"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
          <AppTextField
            ref={confirmationRef}
            autoComplete="new-password"
            error={errors.confirmPassword}
            icon="shield-check-outline"
            label="Confirm new password"
            onBlur={() => setErrors((current) => ({ ...current, confirmPassword: validateConfirmationField(confirmPassword, password) }))}
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => void submit()}
            placeholder="Enter it again"
            returnKeyType="go"
            secureTextEntry
            textContentType="newPassword"
            value={confirmPassword}
          />
          <AppButton loading={loading} onPress={() => void submit()}>
            Update password
          </AppButton>
        </View>
      </AuthShell>
    </>
  );
}
