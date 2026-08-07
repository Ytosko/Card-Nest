import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCard, useToggleFavorite, cardKeys } from '@/src/features/cards/card-hooks';
import { deleteCard, getSignedCardImageUrls, keepCardSeparate, markCardExported, mergeDuplicateCard } from '@/src/features/cards/card-service';
import { exportCardToContacts } from '@/src/features/contacts/contact-export';
import { CardTagsEditor } from '@/src/features/cards/components/card-tags-editor';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function CardDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme(); const router = useRouter(); const client = useQueryClient();
  const card = useCard(id); const favorite = useToggleFavorite();
  const [images, setImages] = useState<Partial<Record<'front' | 'back', string>>>({});
  const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  useEffect(() => { if (card.data?.card_images.length) void getSignedCardImageUrls(card.data).then(setImages).catch(() => undefined); }, [card.data]);
  if (card.isLoading) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!card.data) return <View style={[styles.center, { backgroundColor: theme.colors.background, padding: 24 }]}><AppText>This card could not be found.</AppText><AppButton onPress={() => router.replace('/(app)/(tabs)/cards')}>Back to cards</AppButton></View>;
  const person = card.data;

  async function exportContact() {
    setBusy(true); setError(null); setNotice(null);
    try { await exportCardToContacts(person); await markCardExported(person.id); setNotice('Saved to your device contacts.'); await card.refetch(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not export this contact.'); }
    finally { setBusy(false); }
  }

  async function shareContact() {
    const text = [person.display_name, [person.job_title, person.company].filter(Boolean).join(' at '), person.primary_phone, person.primary_email, person.website].filter(Boolean).join('\n');
    await Share.share({ title: person.display_name ?? 'Card Nest contact', message: text });
  }

  function confirmDelete() {
    Alert.alert('Delete this card?', 'The contact and its private card images will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
        setBusy(true); setError(null);
        try { await deleteCard(person); await client.invalidateQueries({ queryKey: cardKeys.all }); router.replace('/(app)/(tabs)/cards'); }
        catch { setError('We could not delete this card. Please try again.'); setBusy(false); }
      })() },
    ]);
  }

  async function handleDuplicate(action: 'merge' | 'separate') {
    setBusy(true); setError(null);
    try {
      if (action === 'merge') {
        const existingId = await mergeDuplicateCard(person);
        await client.invalidateQueries({ queryKey: cardKeys.all });
        router.replace({ pathname: '/(app)/cards/[id]', params: { id: existingId } });
      } else {
        await keepCardSeparate(person.id);
        await card.refetch();
        setNotice('This card will be kept as a separate contact.');
      }
    } catch { setError('We could not resolve this possible duplicate. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: person.display_name ?? 'Card details', headerRight: () => <Pressable accessibilityLabel={person.is_favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => favorite.mutate({ cardId: person.id, isFavorite: !person.is_favorite })}><MaterialCommunityIcons color={person.is_favorite ? theme.colors.warning : theme.colors.textMuted} name={person.is_favorite ? 'star' : 'star-outline'} size={26} /></Pressable> }} />
      <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}><AppText variant="display" style={{ color: theme.colors.primary }}>{(person.display_name ?? person.company ?? '?').split(/\s+/u).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</AppText></View>
          <AppText accessibilityRole="header" variant="display" style={styles.centerText}>{person.display_name ?? person.company ?? 'Unnamed card'}</AppText>
          <AppText muted style={styles.centerText}>{[person.job_title, person.company].filter(Boolean).join(' · ')}</AppText>
        </View>
        {notice ? <AuthNotice message={notice} tone="success" /> : null}{error ? <AuthNotice message={error} /> : null}
        {person.duplicate_of_id ? <View style={[styles.duplicate, { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning, borderRadius: theme.radii.lg, padding: theme.spacing[4] }]}><MaterialCommunityIcons color={theme.colors.warning} name="account-multiple-check-outline" size={26} /><View style={styles.detailCopy}><AppText variant="bodyStrong">Possible duplicate</AppText><AppText variant="caption">Card Nest found a similar saved contact. Review both before merging.</AppText><View style={styles.duplicateActions}><AppButton disabled={busy} onPress={() => void handleDuplicate('merge')}>Merge contacts</AppButton><AppButton disabled={busy} onPress={() => void handleDuplicate('separate')} variant="secondary">Keep separate</AppButton></View></View></View> : null}
        <View style={styles.quickActions}>
          <QuickAction disabled={!person.primary_phone} icon="phone-outline" label="Call" onPress={() => void Linking.openURL(`tel:${person.primary_phone}`)} />
          <QuickAction disabled={!person.primary_email} icon="email-outline" label="Email" onPress={() => void Linking.openURL(`mailto:${person.primary_email}`)} />
          <QuickAction icon="share-variant-outline" label="Share" onPress={() => void shareContact()} />
          <QuickAction icon="account-plus-outline" label="Contacts" onPress={() => void exportContact()} />
        </View>
        <Section title="Contact details">
          <DetailRow icon="email-outline" label="Email" value={person.primary_email} onPress={person.primary_email ? () => void Linking.openURL(`mailto:${person.primary_email}`) : undefined} />
          <DetailRow icon="phone-outline" label="Phone" value={person.primary_phone} onPress={person.primary_phone ? () => void Linking.openURL(`tel:${person.primary_phone}`) : undefined} />
          <DetailRow icon="web" label="Website" value={person.website} onPress={person.website ? () => void Linking.openURL(person.website!) : undefined} />
          <DetailRow icon="map-marker-outline" label="Address" value={[person.address_line_1, person.address_line_2, person.city, person.state_region, person.postal_code, person.country].filter(Boolean).join(', ') || null} />
        </Section>
        <Section title="Tags"><CardTagsEditor card={person} /></Section>
        {person.notes ? <Section title="Notes"><AppText>{person.notes}</AppText></Section> : null}
        {images.front || images.back ? <Section title="Original card"><View style={styles.images}>{(['front', 'back'] as const).map((side) => images[side] ? <View key={side} style={styles.imageWrap}><Image contentFit="contain" source={images[side]} style={[styles.image, { backgroundColor: theme.colors.background, borderRadius: theme.radii.md }]} /><AppText muted variant="caption">{side === 'front' ? 'Front' : 'Back'}</AppText></View> : null)}</View></Section> : null}
        <View style={styles.actions}><AppButton onPress={() => router.push({ pathname: '/(app)/cards/[id]/edit', params: { id } })}>Edit contact</AppButton><AppButton disabled={busy} onPress={confirmDelete} variant="secondary">Delete card</AppButton></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress, disabled = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) { const theme = useAppTheme(); return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.quick, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}><MaterialCommunityIcons color={theme.colors.primary} name={icon} size={24} /><AppText variant="caption">{label}</AppText></Pressable>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { const theme = useAppTheme(); return <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[3], padding: theme.spacing[5] }]}><AppText variant="title">{title}</AppText>{children}</View>; }
function DetailRow({ icon, label, value, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string | null; onPress?: () => void }) { const theme = useAppTheme(); if (!value) return null; return <Pressable accessibilityRole={onPress ? 'link' : undefined} onLongPress={() => void Clipboard.setStringAsync(value)} onPress={onPress} style={styles.detail}><MaterialCommunityIcons color={theme.colors.primary} name={icon} size={21} /><View style={styles.detailCopy}><AppText muted variant="caption">{label}</AppText><AppText>{value}</AppText></View><MaterialCommunityIcons color={theme.colors.textMuted} name="content-copy" onPress={() => void Clipboard.setStringAsync(value)} size={18} /></Pressable>; }

const styles = StyleSheet.create({
  actions: { gap: 12 }, avatar: { alignItems: 'center', borderRadius: 32, height: 96, justifyContent: 'center', width: 96 }, center: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' }, centerText: { textAlign: 'center' }, content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' }, detail: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 54 }, detailCopy: { flex: 1 }, duplicate: { alignItems: 'flex-start', borderWidth: 1, flexDirection: 'row', gap: 12 }, duplicateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, hero: { alignItems: 'center', gap: 7, paddingVertical: 16 }, image: { aspectRatio: 1.58, width: '100%' }, imageWrap: { flex: 1, gap: 5, minWidth: 220 }, images: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, quick: { alignItems: 'center', borderWidth: 1, flex: 1, gap: 4, justifyContent: 'center', minHeight: 70, minWidth: 70 }, quickActions: { flexDirection: 'row', gap: 8 }, safeArea: { flex: 1 }, section: { borderWidth: 1 },
});
