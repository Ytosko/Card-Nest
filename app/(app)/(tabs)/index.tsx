import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { useCards } from '@/src/features/cards/card-hooks';
import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function DashboardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ confirmed?: string }>();
  const { profile } = useAuth();
  const cards = useCards();
  const queue = useCaptureQueue();

  const firstName = profile?.display_name?.trim().split(/\s+/u)[0];
  const allCards = cards.data ?? [];
  const readyCards = allCards.filter((c) => c.status === 'ready');
  const hasContacts = readyCards.length > 0;
  const recentContacts = readyCards.slice(0, 5);

  const pendingQueue = queue.items.filter((item) => item.state !== 'synced');

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing[4], padding: theme.spacing[5] }]}
        refreshControl={<RefreshControl refreshing={cards.isRefetching} onRefresh={() => void cards.refetch()} tintColor={theme.colors.primary} />}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <BrandMark compact />
          <AppButton accessibilityLabel="Scan a business card" onPress={() => router.push('/(app)/(tabs)/scan')} style={styles.scanButton}>
            Scan card
          </AppButton>
        </View>

        {params.confirmed === 'true' ? <AuthNotice message="Email confirmed. Your Card Nest is ready." tone="success" /> : null}

        {/* Sync / Offline Banner — Only shown when active sync, offline, or retry required */}
        {pendingQueue.length > 0 ? (
          <Pressable
            accessibilityLabel="View sync queue status"
            onPress={() => router.push('/(app)/settings/queue')}
            style={[styles.syncBanner, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="cloud-sync-outline" size={20} />
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ color: theme.colors.primary }}>
                Syncing {pendingQueue.length} {pendingQueue.length === 1 ? 'contact' : 'contacts'} in background
              </AppText>
              <AppText muted variant="caption">
                Tap to view queue status
              </AppText>
            </View>
            <MaterialCommunityIcons color={theme.colors.primary} name="chevron-right" size={20} />
          </Pressable>
        ) : null}

        {/* Header Greeting */}
        <View style={{ gap: theme.spacing[1] }}>
          <AppText variant="label" style={{ color: theme.colors.primary }}>
            BUSINESS CONTACT LIBRARY
          </AppText>
          <AppText accessibilityRole="header" variant="display">
            {firstName ? `Welcome back, ${firstName}.` : 'Your Business Contacts'}
          </AppText>
        </View>

        {/* Prominent Search Field */}
        <Pressable
          accessibilityLabel="Search contacts"
          onPress={() => router.push('/(app)/(tabs)/search')}
          style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <MaterialCommunityIcons color={theme.colors.primary} name="magnify" size={22} />
          <AppText muted style={{ flex: 1 }}>
            Search name, company, title, email, phone...
          </AppText>
        </Pressable>

        {/* Useful Shortcuts */}
        <View style={styles.shortcutsRow}>
          <ShortcutChip icon="account-group-outline" label="All Contacts" onPress={() => router.push('/(app)/(tabs)/cards')} />
          <ShortcutChip icon="star-outline" label="Favorites" onPress={() => router.push({ pathname: '/(app)/(tabs)/cards', params: { filter: 'favorites' } })} />
          <ShortcutChip icon="line-scan" label="Scan Card" onPress={() => router.push('/(app)/(tabs)/scan')} />
        </View>

        {/* Populated State: Recent Contacts List */}
        {hasContacts ? (
          <View style={{ gap: theme.spacing[3] }}>
            <View style={styles.sectionHeader}>
              <AppText variant="title">Recent Contacts</AppText>
              <Pressable accessibilityLabel="See all contacts" onPress={() => router.push('/(app)/(tabs)/cards')}>
                <AppText variant="label" style={{ color: theme.colors.primary }}>
                  See all ({readyCards.length})
                </AppText>
              </Pressable>
            </View>

            {cards.isLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
            {recentContacts.map((card) => (
              <CardListRow
                card={card}
                key={card.id}
                onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: card.id } })}
              />
            ))}
          </View>
        ) : null}

        {/* Zero Contacts State: Simple Onboarding */}
        {!cards.isLoading && !hasContacts ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, padding: theme.spacing[5] }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="card-account-details-outline" size={36} />
            </View>
            <AppText variant="title" style={{ textAlign: 'center' }}>
              No contacts saved yet
            </AppText>
            <AppText muted style={{ textAlign: 'center' }}>
              Scan your first business card to automatically extract contact details with AI and build your private cloud contact library.
            </AppText>
            <AppButton onPress={() => router.push('/(app)/(tabs)/scan')} style={{ marginTop: theme.spacing[2], width: '100%' }}>
              Scan your first card
            </AppButton>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShortcutChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortcutChip,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={18} />
      <AppText variant="bodyStrong" style={{ color: theme.colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  emptyBox: { alignItems: 'center', borderWidth: 1, gap: 14, marginTop: 8 },
  emptyIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  safeArea: { flex: 1 },
  scanButton: { minHeight: 40, paddingHorizontal: 16 },
  searchBar: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  shortcutChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  shortcutsRow: { flexDirection: 'row', gap: 10 },
  syncBanner: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
