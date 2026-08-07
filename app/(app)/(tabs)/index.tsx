import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { UserAvatar } from '@/src/components/ui/user-avatar';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAuth } from '@/src/features/auth/auth-provider';
import { useCards } from '@/src/features/cards/card-hooks';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

type FilterChipMode = 'all' | 'recent' | 'favorites';
type SortMode = 'recent' | 'name';

export default function ContactsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ confirmed?: string }>();
  const { profile, user } = useAuth();
  const cardsQuery = useCards();
  const queue = useCaptureQueue();

  const [input, setInput] = useState('');
  const [activeChip, setActiveChip] = useState<FilterChipMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const pendingQueue = queue.items.filter((item) => item.state !== 'synced');
  const rawCards = cardsQuery.data ?? [];

  // Instant live client-side search & filtering across all fields
  const filteredCards = useMemo(() => {
    const list = cardsQuery.data ?? [];
    const query = input.trim().toLowerCase();

    return list
      .filter((card) => {
        // Filter chips check
        if (activeChip === 'favorites' && !card.is_favorite) return false;
        if (activeChip === 'recent') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          if (card.created_at < sevenDaysAgo) return false;
        }

        if (!query) return true;

        const searchableText = [
          card.display_name,
          card.first_name,
          card.last_name,
          card.company,
          card.job_title,
          card.department,
          card.primary_email,
          card.primary_phone,
          card.website,
          card.address_line_1,
          card.city,
          card.state_region,
          card.country,
          card.notes,
          card.raw_extracted_text,
          ...(card.card_emails?.map((e) => e.email) ?? []),
          ...(card.card_phone_numbers?.map((p) => p.phone_number) ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      })
      .sort((a, b) => {
        if (sortMode === 'name') {
          const nameA = (a.display_name || a.company || '').toLowerCase();
          const nameB = (b.display_name || b.company || '').toLowerCase();
          return nameA.localeCompare(nameB);
        }
        // Default sort: most recently updated / added first
        return (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at);
      });
  }, [cardsQuery.data, input, activeChip, sortMode]);

  const hasAnyContacts = rawCards.length > 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[3], padding: theme.spacing[5] }, !hasAnyContacts && styles.grow]}
        data={filteredCards}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          cardsQuery.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
          ) : input ? (
            <EmptyState
              body="Try searching a different name, company, email, or phone number."
              icon="magnify-close"
              title="No matching contacts"
            />
          ) : activeChip !== 'all' && hasAnyContacts ? (
            <EmptyState body="Select another filter chip to see your saved contacts." icon="filter-variant" title="Nothing in this view" />
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, padding: theme.spacing[5] }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name="card-account-details-outline" size={38} />
              </View>
              <AppText variant="title" style={{ textAlign: 'center' }}>
                No contacts saved yet
              </AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                Scan your first business card to automatically extract contact details with AI and build your private cloud library.
              </AppText>
              <AppButton onPress={() => router.push('/(app)/(tabs)/scan')} style={{ marginTop: theme.spacing[2], width: '100%' }}>
                Scan your first card
              </AppButton>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing[3] }}>
            {/* Top Bar: Brand Mark + Profile Avatar */}
            <View style={styles.topBar}>
              <BrandMark compact />
              <Pressable
                accessibilityLabel="Open settings and profile"
                onPress={() => router.push('/(app)/(tabs)/settings')}>
                <UserAvatar avatarPath={profile?.avatar_path} displayName={profile?.display_name} email={user?.email} size={40} />
              </Pressable>
            </View>

            {params.confirmed === 'true' ? <AuthNotice message="Email confirmed. Your Card Nest is ready." tone="success" /> : null}

            {/* Sync / Offline Banner — Only shown when active sync queue exists */}
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

            {/* Prominent Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="magnify" size={22} />
              <TextInput
                accessibilityLabel="Search contacts"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setInput}
                placeholder="Search name, company, title, email, phone..."
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
                selectionColor={theme.colors.primary}
                style={[styles.input, { color: theme.colors.text, fontFamily: theme.typography.family.body }]}
                value={input}
              />
              {input ? (
                <Pressable accessibilityLabel="Clear search text" hitSlop={8} onPress={() => setInput('')}>
                  <MaterialCommunityIcons color={theme.colors.textMuted} name="close-circle" size={22} />
                </Pressable>
              ) : null}
            </View>

            {/* Filter Chips & Sort Toggle */}
            <View style={styles.controlsRow}>
              <View style={styles.chipsRow}>
                <FilterChip active={activeChip === 'all'} label={`All (${rawCards.length})`} onPress={() => setActiveChip('all')} />
                <FilterChip
                  active={activeChip === 'favorites'}
                  icon="star"
                  label={`Favorites (${rawCards.filter((c) => c.is_favorite).length})`}
                  onPress={() => setActiveChip('favorites')}
                />
                <FilterChip
                  active={activeChip === 'recent'}
                  icon="clock-outline"
                  label="Recent"
                  onPress={() => setActiveChip('recent')}
                />
              </View>

              <Pressable
                accessibilityLabel="Change sort order"
                onPress={() => setSortMode((prev) => (prev === 'recent' ? 'name' : 'recent'))}
                style={[styles.sortButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name={sortMode === 'recent' ? 'sort-clock-descending' : 'sort-alphabetical-ascending'} size={18} />
              </Pressable>
            </View>
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: theme.spacing[2] }}
        refreshControl={<RefreshControl refreshing={cardsQuery.isRefetching} onRefresh={() => void cardsQuery.refetch()} tintColor={theme.colors.primary} />}
        renderItem={({ item }) => (
          <CardListRow card={item} onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: item.id } })} />
        )}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}>
      {icon ? <MaterialCommunityIcons color={active ? theme.colors.primary : theme.colors.textMuted} name={icon} size={15} /> : null}
      <AppText variant="caption" style={{ color: active ? theme.colors.primary : theme.colors.text, fontWeight: active ? '700' : '500' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  chipsRow: { flex: 1, flexDirection: 'row', gap: 8 },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  controlsRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  emptyBox: { alignItems: 'center', borderWidth: 1, gap: 14, marginTop: 12 },
  emptyIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  grow: { flexGrow: 1 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  loader: { marginTop: 60 },
  safeArea: { flex: 1 },
  searchBar: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  sortButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
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
