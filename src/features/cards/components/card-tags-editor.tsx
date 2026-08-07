import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { useAuth } from '@/src/features/auth/auth-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

import { cardKeys, useTags } from '../card-hooks';
import { createTag, setCardTag, type CardWithRelations } from '../card-service';

export function CardTagsEditor({ card }: { card: CardWithRelations }) {
  const theme = useAppTheme(); const { user } = useAuth(); const client = useQueryClient(); const tags = useTags();
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const selected = new Set(card.card_tags.flatMap((item) => item.tags?.id ? [item.tags.id] : []));
  async function toggle(tagId: string) { if (!user) return; setBusy(true); try { await setCardTag(card.id, user.id, tagId, !selected.has(tagId)); await client.invalidateQueries({ queryKey: cardKeys.detail(card.id) }); } finally { setBusy(false); } }
  async function add() { if (!user || !name.trim()) return; setBusy(true); try { const tag = await createTag(user.id, name); await setCardTag(card.id, user.id, tag.id, true); setName(''); await Promise.all([client.invalidateQueries({ queryKey: cardKeys.tags }), client.invalidateQueries({ queryKey: cardKeys.detail(card.id) })]); } finally { setBusy(false); } }
  return <><View style={styles.chips}>{card.card_tags.flatMap((item) => item.tags ? [<View key={item.tags.id} style={[styles.chip, { backgroundColor: theme.colors.primarySoft }]}><AppText variant="caption" style={{ color: theme.colors.primary }}>{item.tags.name}</AppText></View>] : [])}<Pressable accessibilityLabel="Manage tags" accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.chip, { borderColor: theme.colors.borderStrong, borderWidth: 1 }]}><MaterialCommunityIcons color={theme.colors.primary} name="plus" size={16} /><AppText variant="caption">Manage</AppText></Pressable></View><Modal animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet" visible={open}><View style={[styles.modal, { backgroundColor: theme.colors.background, padding: theme.spacing[5] }]}><View style={styles.modalHeader}><AppText variant="title">Manage tags</AppText><Pressable accessibilityLabel="Close tag manager" onPress={() => setOpen(false)}><MaterialCommunityIcons color={theme.colors.text} name="close" size={28} /></Pressable></View><View style={styles.addRow}><View style={styles.input}><AppTextField label="New tag" onChangeText={setName} value={name} /></View><AppButton disabled={!name.trim()} loading={busy} onPress={() => void add()}>Add</AppButton></View><ScrollView contentContainerStyle={styles.tagList}>{tags.data?.map((tag) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(tag.id) }} disabled={busy} key={tag.id} onPress={() => void toggle(tag.id)} style={[styles.tagRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}><MaterialCommunityIcons color={selected.has(tag.id) ? theme.colors.primary : theme.colors.textMuted} name={selected.has(tag.id) ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={23} /><AppText variant="bodyStrong">{tag.name}</AppText></Pressable>)}</ScrollView></View></Modal></>;
}

const styles = StyleSheet.create({ addRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 10 }, chip: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 4, minHeight: 34, paddingHorizontal: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, input: { flex: 1 }, modal: { flex: 1, gap: 20 }, modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 }, tagList: { gap: 10, paddingBottom: 40 }, tagRow: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 14 } });
