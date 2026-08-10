import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/app-text';
import { ScreenHeader } from '@/src/components/ui/screen-header';
import { UserAvatar } from '@/src/components/ui/user-avatar';
import { useAuth } from '@/src/features/auth/auth-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { profile, user } = useAuth();
  const appVersion = Constants.expoConfig?.version ?? '1.0.1-beta-f0D1X';

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]}>
        <ScreenHeader subtitle="Account, AI, privacy, and app preferences" title="Settings" />
        <Pressable
          accessibilityHint="Opens your profile"
          accessibilityRole="button"
          onPress={() => router.push('/(app)/profile')}
          style={({ pressed }) => [
            styles.profile,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
              opacity: pressed ? 0.7 : 1,
              padding: theme.spacing[4],
            },
          ]}>
          <UserAvatar avatarPath={profile?.avatar_path} displayName={profile?.display_name} email={user?.email} size={54} />
          <View style={styles.profileCopy}>
            <AppText variant="bodyStrong">{profile?.display_name || 'Complete your profile'}</AppText>
            <AppText muted numberOfLines={1} variant="caption">
              {user?.email}
            </AppText>
          </View>
          <MaterialCommunityIcons color={theme.colors.textMuted} name="chevron-right" size={24} />
        </Pressable>

        <SettingsGroup title="Workspace">
          <SettingsRow icon="creation-outline" label="AI extraction" onPress={() => router.push('/(app)/settings/ai')} value="Bring your own key" />
          <SettingsRow icon="cloud-sync-outline" label="Sync and queue" onPress={() => router.push('/(app)/settings/queue')} value="Cloud-backed" />
          <SettingsRow icon="account-multiple-plus-outline" label="Contact export" onPress={() => router.push('/(app)/settings/contacts')} value="Device contacts" />
        </SettingsGroup>
        <SettingsGroup title="Card Nest">
          <SettingsRow icon="shield-lock-outline" label="Privacy" onPress={() => router.push('/(app)/settings/legal?document=privacy')} />
          <SettingsRow icon="file-document-outline" label="Terms" onPress={() => router.push('/(app)/settings/legal?document=terms')} />
          <SettingsRow icon="information-outline" label="About" onPress={() => router.push('/(app)/settings/about')} value={`Version ${appVersion}`} />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <AppText muted variant="label">
        {title}
      </AppText>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.65 : 1 }]}>
      <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={22} />
      <AppText variant="bodyStrong" style={styles.rowLabel}>
        {label}
      </AppText>
      {value ? (
        <AppText muted numberOfLines={1} variant="caption">
          {value}
        </AppText>
      ) : null}
      <MaterialCommunityIcons color={theme.colors.textMuted} name="chevron-right" size={21} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  group: { borderWidth: 1, overflow: 'hidden' },
  profile: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 14 },
  profileCopy: { flex: 1, gap: 2 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 58, paddingHorizontal: 16 },
  rowLabel: { flex: 1 },
  safeArea: { flex: 1 },
});
