import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getFieldErrors, normalizeEmail, signInSchema, type FieldErrors, validateCurrentPasswordField, validateEmailField } from '@/src/features/auth/auth-validation';
import { AuthLink } from '@/src/features/auth/components/auth-link';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SignInScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { initialized, session, setPendingEmail } = useAuth();
  const params = useLocalSearchParams<{ reset?: string; confirmed?: string }>();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (initialized && session) return <Redirect href="/(app)/home" />;

  async function submit() {
    setFormError(null);
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const normalizedEmail = normalizeEmail(result.data.email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: result.data.password });
      if (error) {
        if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed')) {
          setPendingEmail(normalizedEmail);
          router.push({ pathname: '/(auth)/verify-email', params: { email: normalizedEmail } });
          return;
        }
        throw error;
      }
      router.replace('/(app)/home');
    } catch (error) {
      setFormError(getAuthErrorMessage(error instanceof Error ? error : undefined));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <AuthShell
        eyebrow="Welcome back"
        footer={
          <View style={styles.footerRow}>
            <AppText muted>New to Card Nest?</AppText>
            <AuthLink href="/(auth)/sign-up">Create account</AuthLink>
          </View>
        }
        subtitle="Your private business card library is ready when you are."
        title="Sign in to Card Nest">
        <View style={{ gap: theme.spacing[4] }}>
          {params.reset === 'success' ? <AuthNotice message="Password updated. You can now sign in." tone="success" /> : null}
          {params.confirmed === 'true' ? <AuthNotice message="Email confirmed. Welcome to Card Nest." tone="success" /> : null}
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
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@example.com"
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
          />
          <AppTextField
            ref={passwordRef}
            autoComplete="current-password"
            error={errors.password}
            icon="lock-outline"
            label="Password"
            onBlur={() => setErrors((current) => ({ ...current, password: validateCurrentPasswordField(password) }))}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            placeholder="Enter your password"
            returnKeyType="go"
            secureTextEntry
            textContentType="password"
            value={password}
          />
          <View style={styles.forgotRow}>
            <AuthLink href="/(auth)/forgot-password">Forgot password?</AuthLink>
          </View>
          <AppButton loading={loading} onPress={() => void submit()}>
            Sign in
          </AppButton>
        </View>
      </AuthShell>
    </>
  );
}

const styles = StyleSheet.create({
  footerRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  forgotRow: { alignItems: 'flex-end', marginTop: -8 },
});
