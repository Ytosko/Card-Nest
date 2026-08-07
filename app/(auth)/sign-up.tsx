import { Redirect, Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getAuthCallbackUrl } from '@/src/features/auth/auth-redirect';
import { getFieldErrors, normalizeEmail, signUpSchema, type FieldErrors, validateConfirmationField, validateDisplayNameField, validateEmailField, validateNewPasswordField } from '@/src/features/auth/auth-validation';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { AuthMethodDivider, GoogleAuthButton } from '@/src/features/auth/components/google-auth-button';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SignUpScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { initialized, session, setPendingEmail, signInWithGoogle } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (initialized && session) return <Redirect href="/(app)/home" />;

  async function submit() {
    setFormError(null);
    const result = signUpSchema.safeParse({ displayName, email, password, confirmPassword });
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const normalizedEmail = normalizeEmail(result.data.email);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: result.data.password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          data: { display_name: result.data.displayName?.trim() || null },
        },
      });
      if (error) throw error;
      setPendingEmail(normalizedEmail);
      if (data.session) router.replace('/(app)/home');
      else router.replace({ pathname: '/(auth)/verify-email', params: { email: normalizedEmail } });
    } catch (error) {
      setFormError(getAuthErrorMessage(error instanceof Error ? error : undefined, 'We could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const outcome = await signInWithGoogle();
      if (outcome === 'success') router.replace('/(app)/home');
      // A cancelled Google flow simply returns to the form without an error.
    } catch (error) {
      setFormError(
        getAuthErrorMessage(
          error instanceof Error ? error : undefined,
          'Google sign-in could not be completed. Please try again.'
        )
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create account' }} />
      <AuthShell
        eyebrow="Your private library"
        footer={
          <View style={styles.footerRow}>
            <AppText muted>Already have an account?</AppText>
            <AuthLink href="/(auth)/sign-in">Sign in</AuthLink>
          </View>
        }
        subtitle="Save and sync the connections worth keeping."
        title="Create your Card Nest">
        <View style={{ gap: theme.spacing[4] }}>
          {formError ? <AuthNotice message={formError} /> : null}
          <AppTextField
            autoCapitalize="words"
            autoComplete="name"
            error={errors.displayName}
            icon="account-outline"
            label="Name (optional)"
            onBlur={() => setErrors((current) => ({ ...current, displayName: validateDisplayNameField(displayName) }))}
            onChangeText={setDisplayName}
            onSubmitEditing={() => emailRef.current?.focus()}
            placeholder="How Card Nest should greet you"
            returnKeyType="next"
            textContentType="name"
            value={displayName}
          />
          <AppTextField
            ref={emailRef}
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            icon="email-outline"
            keyboardType="email-address"
            label="Email address"
            onBlur={() => setErrors((current) => ({ ...current, email: validateEmailField(email) }))}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@example.com"
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
          />
          <AppTextField
            ref={passwordRef}
            autoComplete="new-password"
            error={errors.password}
            hint="At least 8 characters"
            icon="lock-outline"
            label="Password"
            onBlur={() => setErrors((current) => ({ ...current, password: validateNewPasswordField(password) }))}
            onChangeText={setPassword}
            onSubmitEditing={() => confirmationRef.current?.focus()}
            placeholder="Create a secure password"
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
            label="Confirm password"
            onBlur={() => setErrors((current) => ({ ...current, confirmPassword: validateConfirmationField(confirmPassword, password) }))}
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => void submit()}
            placeholder="Enter it again"
            returnKeyType="go"
            secureTextEntry
            textContentType="newPassword"
            value={confirmPassword}
          />
          <AppText muted variant="caption">
            By continuing, you agree to keep your account credentials secure.
          </AppText>
          <AppButton disabled={googleLoading} loading={loading} onPress={() => void submit()}>
            Create account
          </AppButton>
          <AuthMethodDivider />
          <GoogleAuthButton disabled={loading} loading={googleLoading} onPress={() => void submitGoogle()} />
        </View>
      </AuthShell>
    </>
  );
}

const styles = StyleSheet.create({
  footerRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
});
