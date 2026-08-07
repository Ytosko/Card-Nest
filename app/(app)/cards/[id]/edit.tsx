import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/app-text';
import { CardForm } from '@/src/features/cards/components/card-form';
import { useCard, cardKeys } from '@/src/features/cards/card-hooks';
import { draftFromCard, updateCard } from '@/src/features/cards/card-service';
import type { CardDraft } from '@/src/features/cards/card-schema';
import { useAuth } from '@/src/features/auth/auth-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function EditCardScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme(); const router = useRouter(); const client = useQueryClient(); const { user } = useAuth();
  const card = useCard(id); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save(draft: CardDraft) {
    if (!user) return; setBusy(true); setError(null);
    try { await updateCard(id, user.id, draft); await Promise.all([client.invalidateQueries({ queryKey: cardKeys.all }), client.invalidateQueries({ queryKey: cardKeys.detail(id) })]); router.back(); }
    catch { setError('We could not update this contact. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  if (card.isLoading) return <View style={{ backgroundColor: theme.colors.background, flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!card.data) return <View style={{ backgroundColor: theme.colors.background, flex: 1, justifyContent: 'center', padding: 24 }}><AppText>This card is no longer available.</AppText></View>;
  return <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.colors.background, flex: 1 }}><Stack.Screen options={{ headerShown: true, title: 'Edit contact' }} /><CardForm busy={busy} error={error} initial={draftFromCard(card.data)} onSubmit={(draft) => void save(draft)} submitLabel="Save changes" /></SafeAreaView>;
}
