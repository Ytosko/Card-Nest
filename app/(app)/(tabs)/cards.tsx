import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ScreenHeader } from '@/src/components/ui/screen-header';
import { useCards } from '@/src/features/cards/card-hooks';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { useAppTheme } from '@/src/theme/theme-provider';

type FilterMode = 'all' | 'favorites' | 'review';

export default function CardsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: FilterMode }>();
  const cards = useCards();

  const [filter, setFilter] = useState<FilterMode>(params.filter ?? 'all');

  useEffect(() => {
    if (params.filter && ['all', 'favorites', 'review'].includes(params.filter)) {
      setFilter(params.filter);
    }
  }, [params.filter]);

  const filteredCards = (cards.data ?? []).filter(
    (card) => filter === 'all' || (filter === 'favorites' ? card.is_favorite : card.status === 'review' || card.status === 'failed')
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[3], padding: theme.spacing[5] }, !cards.data?.length && styles.grow]}
        data={filteredCards}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          cards.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
          ) : cards.isError ? (
            <View style={styles.loader}>
              <AppText style={{ color: theme.colors.danger }}>We could not load your contacts.</AppText>
            </View>
          ) : filter !== 'all' && cards.data?.length ? (
            <EmptyState body="Choose another filter to see your contacts." icon="filter-variant" title="Nothing in this view" />
          ) : (
            <EmptyState
              action="Add a contact"
              body="Scan a business card or enter contact details manually."
              icon="card-plus-outline"
              onAction={() => router.push('/(app)/cards/new')}
              title="Your library is empty"
            />
          )
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing[4] }}>
            <ScreenHeader
              actionIcon="plus"
              actionLabel="Add contact manually"
              onAction={() => router.push('/(app)/cards/new')}
              subtitle="Your private, cloud-backed business contact library"
              title="Contact Library"
            />
            <View accessibilityRole="radiogroup" style={styles.filters}>
              {([
                ['all', 'All Contacts'],
                ['favorites', 'Favorites'],
                ['review', 'Needs Review'],
              ] as const).map(([value, label]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: filter === value }}
                  key={value}
                  onPress={() => setFilter(value)}
                  style={[
                    styles.filter,
                    {
                      backgroundColor: filter === value ? theme.colors.primarySoft : theme.colors.surface,
                      borderColor: filter === value ? theme.colors.primary : theme.colors.borderStrong,
                    },
                  ]}>
                  <AppText variant="label" style={{ color: filter === value ? theme.colors.primary : theme.colors.text }}>
                    {label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: theme.spacing[3] }}
        refreshControl={<RefreshControl refreshing={cards.isRefetching} onRefresh={() => void cards.refetch()} tintColor={theme.colors.primary} />}
        renderItem={({ item }) => (
          <CardListRow card={item} onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: item.id } })} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  filter: { borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grow: { flexGrow: 1 },
  loader: { marginTop: 80 },
  safeArea: { flex: 1 },
});
