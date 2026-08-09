import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { registerPasskey } from '@/src/features/auth/passkey-service';
import { authStorage } from '@/src/lib/supabase/auth-storage';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function PasskeySetupScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCreatePasskey() {
    setLoading(true);
    try {
      const res = await registerPasskey('Card Nest Mobile Passkey');
      if (res.success) {
        await authStorage.setItem('passkey_setup_prompted', 'true');
        Alert.alert('Passkey Created', 'Your Card Nest account is now secured with a passkey.', [
          { text: 'Continue to Contacts', onPress: () => router.replace('/(app)/(tabs)') },
        ]);
      } else {
        Alert.alert("Passkey couldn't be created", res.error, [
          { text: 'Set up later', onPress: () => void handleSetUpLater() },
          { text: 'Try again', style: 'cancel' },
        ]);
      }
    } catch {
      Alert.alert("Passkey couldn't be created", 'You can try again or set it up later from Security settings.', [
        { text: 'Set up later', onPress: () => void handleSetUpLater() },
        { text: 'Try again', style: 'cancel' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetUpLater() {
    await authStorage.setItem('passkey_setup_prompted', 'true');
    router.replace('/(app)/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.primarySoft }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={48} color={theme.colors.primary} />
        </View>

        <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '700', letterSpacing: 1.2 }}>
          RECOMMENDED SECURITY
        </AppText>

        <AppText variant="title" style={styles.title}>
          Secure your Card Nest account
        </AppText>

        <AppText muted style={styles.body}>
          Create a passkey so you can sign in with your fingerprint, face unlock, device PIN, or security key without entering a password.
        </AppText>

        <View style={[styles.featureList, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
            <AppText style={styles.featureText}>Sign in faster using biometrics</AppText>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
            <AppText style={styles.featureText}>Protected against phishing & password theft</AppText>
          </View>
          <View style={styles.featureItem}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
            <AppText style={styles.featureText}>Stored safely in your device’s security hardware</AppText>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <AppButton loading={loading} onPress={() => void handleCreatePasskey()}>
          Create passkey
        </AppButton>
        <AppButton variant="secondary" onPress={() => void handleSetUpLater()}>
          Set up later
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { maxWidth: 340, textAlign: 'center' },
  container: { flex: 1, padding: 24 },
  content: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  featureItem: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  featureList: { borderRadius: 16, borderWidth: 1, gap: 12, marginTop: 12, padding: 16, width: '100%' },
  featureText: { fontSize: 14, fontWeight: '500' },
  footer: { gap: 8, width: '100%' },
  iconContainer: { alignItems: 'center', borderRadius: 40, height: 80, justifyContent: 'center', marginBottom: 8, width: 80 },
  title: { textAlign: 'center' },
});
