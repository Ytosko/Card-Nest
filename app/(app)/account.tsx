import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { getAuthErrorMessage } from '@/src/features/auth/auth-errors';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getFieldErrors, profileSchema, validateDisplayNameField } from '@/src/features/auth/auth-validation';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AccountScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { profile, profileLoading, signOut, updateDisplayName, user } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setDisplayName(profile?.display_name ?? ''), [profile?.display_name]);

  async function saveProfile() {
    setError(null);
    setMessage(null);
    const result = profileSchema.safeParse({ displayName });
    if (!result.success) {
      setNameError(getFieldErrors(result.error).displayName);
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      await updateDisplayName(result.data.displayName);
      setMessage('Profile updated.');
    } catch (saveError) {
      setError(getAuthErrorMessage(saveError instanceof Error ? saveError : undefined, 'We could not update your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError instanceof Error ? signOutError : undefined, 'We could not sign you out. Please try again.'));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Account' }} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[6], padding: theme.spacing[5] }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.topBar, styles.maxWidth]}>
              <Pressable
                accessibilityLabel="Back to Card Nest"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, { borderColor: theme.colors.border, opacity: pressed ? 0.65 : 1 }]}>
                <MaterialCommunityIcons color={theme.colors.text} name="arrow-left" size={24} />
              </Pressable>
              <BrandMark compact />
              <View style={styles.backButton} />
            </View>

            <View style={[styles.heading, styles.maxWidth, { gap: theme.spacing[2] }]}>
              <AppText accessibilityRole="header" variant="display">Your account</AppText>
              <AppText muted>Manage the profile connected to your private Card Nest.</AppText>
            </View>

            <View
              style={[
                styles.card,
                styles.maxWidth,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[5], padding: theme.spacing[5] },
              ]}>
              <View style={styles.sectionHeading}>
                <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                  <MaterialCommunityIcons color={theme.colors.primary} name="account-edit-outline" size={24} />
                </View>
                <View style={styles.sectionCopy}>
                  <AppText variant="title">Profile</AppText>
                  <AppText muted variant="caption">Used to personalize your experience.</AppText>
                </View>
              </View>
              {message ? <AuthNotice message={message} tone="success" /> : null}
              {error ? <AuthNotice message={error} /> : null}
              <AppTextField
                autoCapitalize="words"
                autoComplete="name"
                editable={!profileLoading}
                error={nameError}
                icon="account-outline"
                label="Display name"
                onBlur={() => setNameError(validateDisplayNameField(displayName))}
                onChangeText={setDisplayName}
                onSubmitEditing={() => void saveProfile()}
                placeholder="Add your name"
                returnKeyType="done"
                textContentType="name"
                value={displayName}
              />
              <AppTextField
                autoComplete="email"
                editable={false}
                hint={user?.email_confirmed_at ? 'Confirmed email' : 'Confirmation pending'}
                icon="email-check-outline"
                label="Email address"
                value={user?.email ?? ''}
              />
              <AppButton loading={saving} onPress={() => void saveProfile()}>
                Save profile
              </AppButton>
            </View>

            <View
              style={[
                styles.card,
                styles.maxWidth,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] },
              ]}>
              <AppText variant="title">Session</AppText>
              <AppText muted>Your session is encrypted, refreshed automatically, and kept across app restarts.</AppText>
              <AppButton loading={signingOut} onPress={() => void handleSignOut()} variant="secondary">
                Sign out
              </AppButton>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  card: { borderWidth: 1 },
  content: { alignItems: 'center', flexGrow: 1, paddingBottom: 40 },
  flex: { flex: 1 },
  heading: { alignItems: 'flex-start' },
  maxWidth: { maxWidth: 720, width: '100%' },
  safeArea: { flex: 1 },
  sectionCopy: { flex: 1 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  sectionIcon: { alignItems: 'center', borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
