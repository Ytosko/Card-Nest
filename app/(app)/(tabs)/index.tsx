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
  const ready = cards.data?.filter((card) => card.status === 'ready').length ?? 0;
  const favorites = cards.data?.filter((card) => card.is_favorite).length ?? 0;
  const pendingQueue = queue.items.filter((item) => item.state !== 'synced');
  const pendingCards = cards.data?.filter((card) => ['capture_pending', 'uploading', 'processing', 'review'].includes(card.status)).length ?? 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]}
        refreshControl={<RefreshControl refreshing={cards.isRefetching} onRefresh={() => void cards.refetch()} tintColor={theme.colors.primary} />}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <BrandMark compact />
          <AppButton accessibilityLabel="Scan a business card" onPress={() => router.push('/(app)/(tabs)/scan')} style={styles.scanButton}>
            Scan card
          </AppButton>
        </View>

        {params.confirmed === 'true' ? <AuthNotice message="Email confirmed. Your Card Nest is ready." tone="success" /> : null}

        {/* Sync / Offline Banner */}
        {pendingQueue.length > 0 ? (
          <Pressable
            accessibilityLabel="View sync queue status"
            onPress={() => router.push('/(app)/settings/queue')}
            style={[styles.syncBanner, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="cloud-sync-outline" size={20} />
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ color: theme.colors.primary }}>
                Syncing {pendingQueue.length} {pendingQueue.length === 1 ? 'card' : 'cards'} in background
              </AppText>
              <AppText muted variant="caption">Tap to view queue status</AppText>
            </View>
            <MaterialCommunityIcons color={theme.colors.primary} name="chevron-right" size={20} />
          </Pressable>
        ) : null}

        {/* Welcome Header */}
        <View style={{ gap: theme.spacing[1] }}>
          <AppText variant="label" style={{ color: theme.colors.primary }}>YOUR CONTACT WORKSPACE</AppText>
          <AppText accessibilityRole="header" variant="display">{firstName ? `Good to see you, ${firstName}.` : 'Make every introduction count.'}</AppText>
          <AppText muted>Scan, organize, and find the contacts behind your business cards.</AppText>
        </View>

        {/* Quick Search Shortcut */}
        <Pressable
          accessibilityLabel="Search cards"
          onPress={() => router.push('/(app)/(tabs)/search')}
          style={[styles.searchShortcut, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <MaterialCommunityIcons color={theme.colors.textMuted} name="magnify" size={22} />
          <AppText muted style={{ flex: 1 }}>Search names, companies, titles, tags…</AppText>
        </Pressable>

        {/* Dashboard Stats */}
        <View style={styles.stats}>
          <Stat icon="card-account-details-outline" label="Saved" value={ready} />
          <Stat icon="star-outline" label="Favorites" value={favorites} />
          <Stat icon="progress-clock" label="In progress" value={pendingCards + pendingQueue.length} />
        </View>

        {/* Shortcuts Bar */}
        <View style={styles.shortcutsRow}>
          <ShortcutChip icon="cards-outline" label="All Cards" onPress={() => router.push('/(app)/(tabs)/cards')} />
          <ShortcutChip icon="star-outline" label="Favorites" onPress={() => router.push({ pathname: '/(app)/(tabs)/cards', params: { filter: 'favorites' } })} />
          <ShortcutChip icon="alert-circle-outline" label="Review" onPress={() => router.push({ pathname: '/(app)/(tabs)/cards', params: { filter: 'review' } })} />
          <ShortcutChip icon="cog-outline" label="Settings" onPress={() => router.push('/(app)/(tabs)/settings')} />
        </View>

        {/* Hero Scan Banner */}
        <View style={[styles.feature, { backgroundColor: theme.colors.surfaceBrand, borderRadius: theme.radii.xl, padding: theme.spacing[5] }]}>
          <View style={styles.featureIcon}><MaterialCommunityIcons color={theme.colors.textOnBrand} name="line-scan" size={32} /></View>
          <View style={styles.featureCopy}>
            <AppText variant="title" style={{ color: theme.colors.textOnBrand }}>Add a new business card</AppText>
            <AppText style={{ color: theme.colors.textOnBrand, opacity: 0.9 }}>Photograph the front and back or enter details manually. Your records stay encrypted and private.</AppText>
            <View style={styles.featureActions}>
              <AppButton onPress={() => router.push('/(app)/(tabs)/scan')} variant="primary">
                Scan now
              </AppButton>
              <AppButton onPress={() => router.push('/(app)/cards/new')} variant="secondary" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
                Manual entry
              </AppButton>
            </View>
          </View>
        </View>

        {/* Recently Updated / Zero-Card State */}
        <View style={{ gap: theme.spacing[3] }}>
          <View style={styles.sectionTitle}>
            <AppText variant="title">Recently updated</AppText>
            {cards.data?.length ? <AppText onPress={() => router.push('/(app)/(tabs)/cards')} style={{ color: theme.colors.primary }} variant="label">See all</AppText> : null}
          </View>
          {cards.isLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
          {cards.isError ? <AppText style={{ color: theme.colors.danger }}>Your cards could not be loaded. Pull down to try again.</AppText> : null}
          {cards.data?.slice(0, 4).map((card) => <CardListRow card={card} key={card.id} onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: card.id } })} />)}

          {/* Zero-Card Onboarding Cards */}
          {!cards.isLoading && !cards.data?.length ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, padding: theme.spacing[5] }]}>
              <AppText variant="title">How Card Nest works</AppText>
              <AppText muted>Follow these simple steps to build your cloud contact library:</AppText>
              
              <View style={styles.stepList}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepBadge, { backgroundColor: theme.colors.primarySoft }]}>
                    <AppText variant="label" style={{ color: theme.colors.primary }}>1</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">Snap front & back</AppText>
                    <AppText muted variant="caption">Use your camera or select card photos from gallery. Works offline.</AppText>
                  </View>
                </View>

                <View style={styles.stepItem}>
                  <View style={[styles.stepBadge, { backgroundColor: theme.colors.primarySoft }]}>
                    <AppText variant="label" style={{ color: theme.colors.primary }}>2</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">AI extracts details</AppText>
                    <AppText muted variant="caption">OpenAI or Gemini parses contact fields using your private API key.</AppText>
                  </View>
                </View>

                <View style={styles.stepItem}>
                  <View style={[styles.stepBadge, { backgroundColor: theme.colors.primarySoft }]}>
                    <AppText variant="label" style={{ color: theme.colors.primary }}>3</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">Review & save</AppText>
                    <AppText muted variant="caption">Edit any field, handle duplicates, and sync securely to your cloud library.</AppText>
                  </View>
                </View>
              </View>

              <AppButton onPress={() => router.push('/(app)/(tabs)/scan')} style={{ marginTop: theme.spacing[2] }}>
                Scan your first card
              </AppButton>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, padding: theme.spacing[3] }]}>
      <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={22} />
      <AppText variant="title">{value}</AppText>
      <AppText muted variant="caption">{label}</AppText>
    </View>
  );
}

function ShortcutChip({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.shortcutChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={16} />
      <AppText variant="caption" style={{ color: theme.colors.text }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  emptyContainer: { borderWidth: 1, gap: 14 },
  feature: { alignItems: 'flex-start', flexDirection: 'row', gap: 16 },
  featureActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  featureCopy: { flex: 1, gap: 6 },
  featureIcon: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  safeArea: { flex: 1 },
  scanButton: { minHeight: 44, paddingHorizontal: 15 },
  searchShortcut: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  sectionTitle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  shortcutChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shortcutsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { borderWidth: 1, flex: 1, gap: 2, minWidth: 92 },
  stats: { flexDirection: 'row', gap: 10 },
  stepBadge: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepItem: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  stepList: { gap: 14, marginVertical: 4 },
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

