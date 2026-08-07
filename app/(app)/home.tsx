import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useNetworkState } from 'expo-network';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppText } from '@/src/components/ui/app-text';
import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ confirmed?: string }>();
  const network = useNetworkState();
  const { profile, user } = useAuth();
  const firstName = profile?.display_name?.trim().split(/\s+/u)[0];

  return (
    <>
      <Stack.Screen options={{ title: 'Card Nest' }} />
      <Head>
        <title>Card Nest — Your private business card library</title>
        <meta content="Scan, organize, and safely back up the business cards worth keeping." name="description" />
      </Head>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[8], padding: theme.spacing[5] }]}>
          <View style={[styles.topBar, styles.maxWidth]}>
            <BrandMark compact />
            <Pressable
              accessibilityLabel="Open account"
              accessibilityRole="button"
              onPress={() => router.push('/(app)/account')}
              style={({ pressed }) => [
                styles.accountButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="account-outline" size={24} />
            </Pressable>
          </View>

          {params.confirmed === 'true' ? (
            <View style={styles.maxWidth}>
              <AuthNotice message="Email confirmed. Your Card Nest is ready." tone="success" />
            </View>
          ) : null}

          <View style={[styles.hero, styles.maxWidth, { gap: theme.spacing[3] }]}>
            <AppText variant="label" style={{ color: theme.colors.primary }}>
              YOUR CONTACT LIBRARY
            </AppText>
            <AppText accessibilityRole="header" variant="display">
              {firstName ? `Welcome, ${firstName}.` : 'Welcome to your Card Nest.'}
            </AppText>
            <AppText muted style={styles.intro}>
              Your account is secure and ready. Card capture and organization arrive in the next build phase.
            </AppText>
          </View>

          <View
            style={[
              styles.primaryPanel,
              styles.maxWidth,
              { backgroundColor: theme.colors.surfaceBrand, borderRadius: theme.radii.xl, gap: theme.spacing[5], padding: theme.spacing[6] },
            ]}>
            <View style={styles.panelIcon}>
              <MaterialCommunityIcons color={theme.colors.textOnBrand} name="shield-check-outline" size={34} />
            </View>
            <View style={{ flex: 1, gap: theme.spacing[2] }}>
              <AppText variant="title" style={{ color: theme.colors.textOnBrand }}>
                Private by design
              </AppText>
              <AppText style={{ color: theme.colors.textOnBrand }}>
                Your profile and future cards are isolated with per-user Row Level Security.
              </AppText>
            </View>
          </View>

          <View
            style={[
              styles.statusCard,
              styles.maxWidth,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] },
            ]}>
            <AppText variant="title">Account status</AppText>
            <StatusRow icon="email-check-outline" label="Email" value={user?.email_confirmed_at ? 'Confirmed' : 'Confirmation pending'} />
            <StatusRow icon="account-circle-outline" label="Profile" value={profile?.display_name ? 'Personalized' : 'Ready to personalize'} />
            <StatusRow
              icon={network.isConnected === false ? 'cloud-off-outline' : 'cloud-check-outline'}
              label="Cloud connection"
              value={network.isConnected === false ? 'Offline — your session is preserved' : 'Connected'}
              warning={network.isConnected === false}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function StatusRow({ icon, label, value, warning = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; warning?: boolean }) {
  const theme = useAppTheme();
  const color = warning ? theme.colors.warning : theme.colors.success;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusIcon, { backgroundColor: warning ? theme.colors.warningSoft : theme.colors.successSoft }]}>
        <MaterialCommunityIcons color={color} name={icon} size={19} />
      </View>
      <View style={styles.statusCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText muted variant="caption">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  content: { alignItems: 'center', flexGrow: 1, paddingBottom: 40 },
  hero: { alignItems: 'flex-start' },
  intro: { maxWidth: 620 },
  maxWidth: { maxWidth: 720, width: '100%' },
  panelIcon: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  primaryPanel: { alignItems: 'flex-start', flexDirection: 'row' },
  safeArea: { flex: 1 },
  statusCard: { borderWidth: 1 },
  statusCopy: { flex: 1 },
  statusIcon: { alignItems: 'center', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
