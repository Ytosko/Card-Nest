import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAuth } from '@/src/features/auth/auth-provider';
import { supabase } from '@/src/lib/supabase/client';
import { getPublicEnv } from '@/src/config/env';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function ProfileScreen() {
  const theme = useAppTheme(); const router = useRouter(); const env = getPublicEnv(); const { profile, user, updateDisplayName, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? ''); const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name]);
  useEffect(() => { if (!profile?.avatar_path) { setAvatarUrl(null); return; } void supabase.storage.from('profile-avatars').createSignedUrl(profile.avatar_path, 3600).then(({ data }) => setAvatarUrl(data?.signedUrl ?? null)); }, [profile?.avatar_path]);

  async function chooseAvatar() {
    if (!user) return; setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 512, height: 512 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      const path = `${user.id}/avatar.jpg`; const file = new File(resized.uri);
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, await file.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from('profiles').update({ avatar_path: path }).eq('user_id', user.id); if (profileError) throw profileError;
      await refreshProfile(); setNotice('Profile photo updated.');
    } catch { setError('We could not update your profile photo. Please try again.'); }
    finally { setBusy(false); }
  }

  async function removeAvatar() {
    if (!user || !profile?.avatar_path) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await supabase.storage.from('profile-avatars').remove([profile.avatar_path]);
      const { error: profileError } = await supabase.from('profiles').update({ avatar_path: null }).eq('user_id', user.id);
      if (profileError) throw profileError;
      await refreshProfile();
      setAvatarUrl(null);
      setNotice('Profile photo removed.');
    } catch {
      setError('We could not remove your profile photo. Please try again.');
    } finally { setBusy(false); }
  }

  async function save() { setBusy(true); setError(null); setNotice(null); try { await updateDisplayName(name); setNotice('Profile updated.'); } catch { setError('We could not update your profile.'); } finally { setBusy(false); } }
  async function requestEmailChange() { const normalized = newEmail.trim().toLowerCase(); if (!normalized || !normalized.includes('@')) { setError('Enter a valid new email address.'); return; } setBusy(true); setError(null); setNotice(null); try { const { error: updateError } = await supabase.auth.updateUser({ email: normalized }, { emailRedirectTo: env.EXPO_PUBLIC_AUTH_CALLBACK_URL }); if (updateError) throw updateError; setNewEmail(''); setNotice('Check both email addresses to approve this secure change. Every link opens Card Nest first.'); } catch { setError('We could not start the email change. Please try again.'); } finally { setBusy(false); } }
  async function handleSignOut() { setBusy(true); setError(null); try { await signOut(); router.replace('/(auth)/sign-in'); } catch { setError('We could not sign you out.'); } finally { setBusy(false); } }
  function confirmDelete() { Alert.alert('Delete your Card Nest account?', 'This permanently removes your profile, card library, and private images. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => void deleteAccount() }]); }
  async function deleteAccount() { setBusy(true); setError(null); const { error: functionError } = await supabase.functions.invoke('delete-account', { body: {} }); if (functionError) { setError('We could not delete your account. Please try again.'); setBusy(false); return; } await supabase.auth.signOut({ scope: 'local' }); router.replace('/(auth)/sign-in'); }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Profile' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <Pressable accessibilityLabel="Change profile photo" accessibilityRole="button" disabled={busy} onPress={() => void chooseAvatar()} style={[styles.avatar, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
              {avatarUrl ? <Image contentFit="cover" source={avatarUrl} style={StyleSheet.absoluteFill} /> : <AppText variant="display" style={{ color: theme.colors.primary }}>{(profile?.display_name || user?.email || '?').split(/[\s@]+/u).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</AppText>}
              <View style={[styles.camera, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons color={theme.colors.textOnBrand} name="camera" size={18} />
              </View>
            </Pressable>
            <View style={styles.avatarActions}>
              <AppText muted variant="caption">Tap to update your photo</AppText>
              {profile?.avatar_path ? (
                <Pressable accessibilityLabel="Remove profile photo" onPress={() => void removeAvatar()} style={{ marginLeft: 8 }}>
                  <AppText variant="caption" style={{ color: theme.colors.danger }}>Remove photo</AppText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {notice ? <AuthNotice message={notice} tone="success" /> : null}
          {error ? <AuthNotice message={error} /> : null}

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] }]}>
            <AppText variant="title">Profile details</AppText>
            <AppTextField autoCapitalize="words" autoComplete="name" icon="account-outline" label="Display name" onChangeText={setName} value={name} />
            <AppTextField editable={false} hint={user?.email_confirmed_at ? 'Confirmed email' : 'Confirmation pending'} icon="email-check-outline" label="Email address" value={user?.email ?? ''} />
            <AppButton loading={busy} onPress={() => void save()}>Save profile</AppButton>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] }]}>
            <AppText variant="title">Change email</AppText>
            <AppText muted variant="caption">For your security, Card Nest asks both addresses to approve the change.</AppText>
            <AppTextField autoCapitalize="none" autoComplete="email" icon="email-edit-outline" keyboardType="email-address" label="New email address" onChangeText={setNewEmail} value={newEmail} />
            <AppButton disabled={!newEmail.trim()} loading={busy} onPress={() => void requestEmailChange()} variant="secondary">Send approval emails</AppButton>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[3], padding: theme.spacing[5] }]}>
            <AppText variant="title">Account</AppText>
            <AppButton disabled={busy} onPress={() => void handleSignOut()} variant="secondary">Sign out</AppButton>
            <AppButton disabled={busy} onPress={confirmDelete} variant="secondary">Delete account</AppButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 112, justifyContent: 'center', overflow: 'hidden', width: 112 },
  avatarActions: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  avatarWrap: { alignItems: 'center', gap: 8 },
  camera: { alignItems: 'center', borderRadius: 999, bottom: 3, height: 34, justifyContent: 'center', position: 'absolute', right: 3, width: 34 },
  card: { borderWidth: 1 },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
});
