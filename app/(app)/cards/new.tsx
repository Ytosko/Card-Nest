import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { CardForm } from '@/src/features/cards/components/card-form';
import { emptyCardDraft, type CardDraft } from '@/src/features/cards/card-schema';
import { createCard } from '@/src/features/cards/card-service';
import { cardKeys } from '@/src/features/cards/card-hooks';
import { useAuth } from '@/src/features/auth/auth-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function NewCardScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(draft: CardDraft) {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const card = await createCard(user.id, draft);
      await client.invalidateQueries({ queryKey: cardKeys.all });
      router.replace({ pathname: '/(app)/cards/[id]', params: { id: card.id } });
    } catch {
      setError('We could not save this contact. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.colors.background, flex: 1 }}><Stack.Screen options={{ headerShown: true, title: 'Add contact' }} /><CardForm busy={busy} error={error} initial={emptyCardDraft} onSubmit={(draft) => void save(draft)} submitLabel="Save contact" /></SafeAreaView>;
}
