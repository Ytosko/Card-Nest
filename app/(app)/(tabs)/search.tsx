import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/src/components/ui/empty-state';
import { ScreenHeader } from '@/src/components/ui/screen-header';
import { CardListRow } from '@/src/features/cards/components/card-list-row';
import { useCardSearch } from '@/src/features/cards/card-hooks';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SearchScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(input.trim()), 280);
    return () => clearTimeout(timeout);
  }, [input]);
  const results = useCardSearch(query);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[3], padding: theme.spacing[5] }, !results.data?.length && styles.grow]}
        data={results.data ?? []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing[4] }}>
            <ScreenHeader subtitle="Names, companies, details, and tags" title="Search" />
            <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.md }]}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="magnify" size={22} />
              <TextInput
                accessibilityLabel="Search your cards"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setInput}
                placeholder="Search people, companies, emails…"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
                selectionColor={theme.colors.primary}
                style={[styles.input, { color: theme.colors.text, fontFamily: theme.typography.family.body }]}
                value={input}
              />
              {input ? <MaterialCommunityIcons color={theme.colors.textMuted} name="close-circle" onPress={() => setInput('')} size={21} /> : null}
            </View>
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: theme.spacing[3] }}
        ListEmptyComponent={results.isFetching ? (
          <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
        ) : query ? (
          <EmptyState body="Try a shorter name, company, email, phone number, or tag." icon="magnify-close" title="No matching cards" />
        ) : (
          <EmptyState body="Search across every saved detail without exposing your library." icon="text-search" title="Find anyone quickly" />
        )}
        renderItem={({ item }) => <CardListRow card={item} onPress={() => router.push({ pathname: '/(app)/cards/[id]', params: { id: item.id } })} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 36, width: '100%' },
  grow: { flexGrow: 1 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  loader: { marginTop: 80 },
  safeArea: { flex: 1 },
  search: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52, paddingHorizontal: 14 },
});
