import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { UserAvatar } from '@/src/components/ui/user-avatar';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAuth } from '@/src/features/auth/auth-provider';
import { cardKeys, useCards } from '@/src/features/cards/card-hooks';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { bulkDeleteCards, bulkToggleFavorite, isSavedContact, markCardExported } from '@/src/features/cards/card-service';
import { exportCardsToContacts } from '@/src/features/contacts/contact-export';
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
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [activeChip, setActiveChip] = useState<FilterChipMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'error'>('info');

  const pendingQueue = queue.items.filter((item) => item.state !== 'synced');

  // Saved contacts only — failed-extraction placeholders never surface here; they are
  // managed from the Sync page.
  const rawCards = useMemo(() => (cardsQuery.data ?? []).filter(isSavedContact), [cardsQuery.data]);

  // Instant live client-side search & filtering across all fields
  const filteredCards = useMemo(() => {
    const list = rawCards;
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
        return (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at);
      });
  }, [rawCards, input, activeChip, sortMode]);

  const hasAnyContacts = rawCards.length > 0;
  const hasAnyRecords = hasAnyContacts || pendingQueue.length > 0;
  const selectedCount = selectedIds.size;
  const isAllFilteredSelected = filteredCards.length > 0 && filteredCards.every((c) => selectedIds.has(c.id));

  // Selection mode helpers
  function enterSelectionMode(initialCardId?: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setIsSelectionMode(true);
    if (initialCardId) {
      setSelectedIds(new Set([initialCardId]));
    }
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleCardSelection(cardId: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map((c) => c.id)));
    }
  }

  // Bulk Operations
  async function handleBulkFavorite(targetState: boolean) {
    if (selectedCount === 0) return;
    setIsProcessingBulk(true);
    setNoticeMessage(null);
    try {
      await bulkToggleFavorite(Array.from(selectedIds), targetState);
      await queryClient.invalidateQueries({ queryKey: cardKeys.all });
      setNoticeTone('success');
      setNoticeMessage(
        `${selectedCount} ${selectedCount === 1 ? 'contact' : 'contacts'} ${
          targetState ? 'added to favorites' : 'removed from favorites'
        }.`
      );
      exitSelectionMode();
    } catch {
      setNoticeTone('error');
      setNoticeMessage('Could not update favorite status for selected contacts.');
    } finally {
      setIsProcessingBulk(false);
    }
  }

  async function handleBulkExportToContacts() {
    if (selectedCount === 0) return;
    setIsProcessingBulk(true);
    setNoticeMessage(null);
    try {
      const selectedCards = rawCards.filter((c) => selectedIds.has(c.id));
      const result = await exportCardsToContacts(selectedCards);
      await Promise.all(result.succeeded.map(({ cardId }) => markCardExported(cardId).catch(() => undefined)));
      const exportedCount = result.succeeded.length;
      const skippedCount = result.failed.length;

      await queryClient.invalidateQueries({ queryKey: cardKeys.all });
      setNoticeTone(skippedCount === 0 ? 'success' : 'error');
      setNoticeMessage(
        `${exportedCount} ${exportedCount === 1 ? 'contact' : 'contacts'} saved to your phone` +
          (skippedCount > 0 ? `; ${skippedCount} not saved. ${result.failed[0].message}` : '') +
          '.'
      );
      if (skippedCount === 0) {
        exitSelectionMode();
      } else {
        setSelectedIds(new Set(result.failed.map(({ cardId }) => cardId)));
      }
    } catch {
      setNoticeTone('error');
      setNoticeMessage('Could not export selected contacts to phone contacts.');
    } finally {
      setIsProcessingBulk(false);
    }
  }

  async function executeBulkDelete() {
    setDeleteConfirmVisible(false);
    if (selectedCount === 0) return;

    setIsDeletingBulk(true);
    setNoticeMessage(null);

    const selectedCards = rawCards.filter((c) => selectedIds.has(c.id));
    const { deletedCount, failedIds } = await bulkDeleteCards(selectedCards);

    await queryClient.invalidateQueries({ queryKey: cardKeys.all });
    setIsDeletingBulk(false);

    if (failedIds.length === 0) {
      setNoticeTone('success');
      setNoticeMessage(`${deletedCount} ${deletedCount === 1 ? 'contact' : 'contacts'} deleted.`);
      exitSelectionMode();
    } else {
      setSelectedIds(new Set(failedIds));
      setNoticeTone('error');
      setNoticeMessage(`${deletedCount} deleted · ${failedIds.length} couldn't be deleted.`);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Blocking Progress Modal for Bulk Delete */}
      <Modal animationType="fade" transparent visible={isDeletingBulk}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <ActivityIndicator color={theme.colors.danger} size="large" />
            <AppText variant="title">Deleting {selectedCount} contacts…</AppText>
            <AppText muted variant="caption">
              Permanently removing contact records and private card images
            </AppText>
          </View>
        </View>
      </Modal>

      {/* Bulk Delete Confirmation Dialog */}
      <Modal animationType="fade" transparent visible={deleteConfirmVisible}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={32} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Delete {selectedCount} {selectedCount === 1 ? 'contact' : 'contacts'}?
            </AppText>
            <AppText muted variant="caption" style={{ textAlign: 'center' }}>
              This will permanently remove the selected contacts and their saved card images from Card Nest.
            </AppText>
            <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
              <AppButton onPress={() => void executeBulkDelete()} style={{ backgroundColor: theme.colors.danger }}>
                Delete {selectedCount} {selectedCount === 1 ? 'contact' : 'contacts'}
              </AppButton>
              <AppButton onPress={() => setDeleteConfirmVisible(false)} variant="secondary">
                Cancel
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        contentContainerStyle={[
          styles.content,
          { gap: theme.spacing[3], padding: theme.spacing[5] },
          !hasAnyContacts && styles.grow,
        ]}
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
          ) : hasAnyRecords ? (
            <EmptyState
              body="Your scanned card is still processing. It will appear here automatically once it syncs."
              icon="progress-check"
              title="No saved contacts yet"
            />
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
            {/* Header: Normal Mode vs Selection Mode */}
            {isSelectionMode ? (
              <View style={[styles.selectionHeader, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}>
                <View style={styles.selectionCountWrap}>
                  <AppText variant="title" style={{ color: theme.colors.primary }}>
                    {selectedCount} selected
                  </AppText>
                  <AppText muted variant="caption">
                    out of {filteredCards.length} shown
                  </AppText>
                </View>

                <View style={styles.selectionHeaderActions}>
                  <Pressable
                    accessibilityLabel={isAllFilteredSelected ? 'Deselect all' : 'Select all'}
                    onPress={toggleSelectAllFiltered}
                    style={[styles.headerBtn, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
                    <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                      {isAllFilteredSelected ? 'Deselect all' : 'Select all'}
                    </AppText>
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Cancel selection mode"
                    onPress={exitSelectionMode}
                    style={[styles.headerBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <AppText variant="caption">Cancel</AppText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.topBar}>
                <BrandMark compact />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {hasAnyContacts ? (
                    <Pressable
                      accessibilityLabel="Enter selection mode to select contacts"
                      onPress={() => enterSelectionMode()}
                      style={[styles.selectChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                      <MaterialCommunityIcons color={theme.colors.primary} name="checkbox-multiple-marked-outline" size={16} />
                      <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                        Select
                      </AppText>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityLabel="Open settings and profile"
                    onPress={() => router.push('/(app)/(tabs)/settings')}>
                    <UserAvatar avatarPath={profile?.avatar_path} displayName={profile?.display_name} email={user?.email} size={40} />
                  </Pressable>
                </View>
              </View>
            )}

            {noticeMessage ? <AuthNotice message={noticeMessage} tone={noticeTone} /> : null}
            {params.confirmed === 'true' ? <AuthNotice message="Email confirmed. Your Card Nest is ready." tone="success" /> : null}

            {/* Sync / Offline Banner — Only shown when active sync queue exists */}
            {pendingQueue.length > 0 && !isSelectionMode ? (
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
          <CardListRow
            card={item}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(item.id)}
            onLongPress={() => {
              if (!isSelectionMode) {
                enterSelectionMode(item.id);
              } else {
                toggleCardSelection(item.id);
              }
            }}
            onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: item.id } })}
            onSelectToggle={() => toggleCardSelection(item.id)}
          />
        )}
      />

      {/* Floating Bottom Bulk Action Toolbar */}
      {isSelectionMode && selectedCount > 0 ? (
        <View
          style={[
            styles.bulkToolbar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.lg,
            },
          ]}>
          <Pressable
            accessibilityLabel="Add selected contacts to favorites"
            disabled={isProcessingBulk}
            onPress={() => void handleBulkFavorite(true)}
            style={styles.toolbarBtn}>
            <MaterialCommunityIcons color={theme.colors.warning} name="star" size={20} />
            <AppText variant="caption" style={{ fontSize: 11 }}>
              Favorite
            </AppText>
          </Pressable>

          <Pressable
            accessibilityLabel="Remove selected contacts from favorites"
            disabled={isProcessingBulk}
            onPress={() => void handleBulkFavorite(false)}
            style={styles.toolbarBtn}>
            <MaterialCommunityIcons color={theme.colors.textMuted} name="star-outline" size={20} />
            <AppText variant="caption" style={{ fontSize: 11 }}>
              Unfavorite
            </AppText>
          </Pressable>

          <Pressable
            accessibilityLabel="Save selected contacts to phone contacts"
            disabled={isProcessingBulk}
            onPress={() => void handleBulkExportToContacts()}
            style={styles.toolbarBtn}>
            <MaterialCommunityIcons color={theme.colors.primary} name="account-plus-outline" size={20} />
            <AppText variant="caption" style={{ fontSize: 11 }}>
              Export
            </AppText>
          </Pressable>

          <Pressable
            accessibilityLabel={`Delete ${selectedCount} selected contacts`}
            disabled={isProcessingBulk}
            onPress={() => setDeleteConfirmVisible(true)}
            style={[styles.toolbarBtn, { borderLeftWidth: 1, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={20} />
            <AppText variant="caption" style={{ fontSize: 11, color: theme.colors.danger, fontWeight: '700' }}>
              Delete ({selectedCount})
            </AppText>
          </Pressable>
        </View>
      ) : null}
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
  bulkToolbar: {
    alignItems: 'center',
    alignSelf: 'center',
    bottom: 24,
    borderWidth: 2,
    elevation: 8,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-around',
    maxWidth: 720,
    paddingHorizontal: 8,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: '92%',
  },
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
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 96, width: '100%' },
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
  headerBtn: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  loader: { marginTop: 60 },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
    padding: 24,
    width: '100%',
  },
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
  selectChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectionCountWrap: { gap: 2 },
  selectionHeader: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectionHeaderActions: { flexDirection: 'row', gap: 8 },
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
  toolbarBtn: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
