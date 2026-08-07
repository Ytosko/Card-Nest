import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ScreenHeader } from '@/src/components/ui/screen-header';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { useCards } from '@/src/features/cards/card-hooks';
import { useAppTheme } from '@/src/theme/theme-provider';

type FilterTab = 'all' | 'favorites' | 'has_company';

export default function SearchScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const cardsQuery = useCards();
  const allCards = cardsQuery.data ?? [];

  // Live client-side search across all fields
  const filteredCards = useMemo(() => {
    const list = cardsQuery.data ?? [];
    const query = input.trim().toLowerCase();

    return list.filter((card) => {
      // Tab filter check
      if (activeTab === 'favorites' && !card.is_favorite) return false;
      if (activeTab === 'has_company' && !card.company) return false;

      // Text search check
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [allCards, activeTab, input]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[3], padding: theme.spacing[5] }, !filteredCards.length && styles.grow]}
        data={filteredCards}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing[3] }}>
            <ScreenHeader subtitle="Browse contacts or search names, companies, and details" title="Contacts Browser" />
            <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.md }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="magnify" size={22} />
              <TextInput
                accessibilityLabel="Search contacts"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setInput}
                placeholder="Search name, company, phone, email, notes..."
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

            {/* Quick Filter Chips */}
            <View style={styles.chipsRow}>
              <FilterChip active={activeTab === 'all'} label={`All (${allCards.length})`} onPress={() => setActiveTab('all')} />
              <FilterChip
                active={activeTab === 'favorites'}
                icon="star"
                label={`Favorites (${allCards.filter((c) => c.is_favorite).length})`}
                onPress={() => setActiveTab('favorites')}
              />
              <FilterChip
                active={activeTab === 'has_company'}
                icon="domain"
                label="Company"
                onPress={() => setActiveTab('has_company')}
              />
            </View>
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: theme.spacing[2] }}
        ListEmptyComponent={
          cardsQuery.isLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
          ) : input ? (
            <EmptyState body="Try searching a different name, company, email, or phone number." icon="magnify-close" title="No matching contacts" />
          ) : (
            <EmptyState body="Scan a business card to build your contact library." icon="card-account-details-outline" title="No contacts in library" />
          )
        }
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
    minHeight: 34,
    paddingHorizontal: 12,
  },
  chipsRow: { flexDirection: 'row', gap: 8 },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  grow: { flexGrow: 1 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  loader: { marginTop: 60 },
  safeArea: { flex: 1 },
  search: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52, paddingHorizontal: 14 },
});
