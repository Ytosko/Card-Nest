import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCards } from '@/src/features/cards/card-hooks';
import { markCardExported } from '@/src/features/cards/card-service';
import { exportCardToContacts } from '@/src/features/contacts/contact-export';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function ContactsSettingsScreen() {
  const theme = useAppTheme(); const cards = useCards(); const [selected, setSelected] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  // Only contacts saved through Review — extractions still awaiting review are not exportable.
  const exportableCards = (cards.data ?? []).filter((card) => card.status === 'ready');
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function exportSelected() { const chosen = exportableCards.filter((card) => selected.has(card.id)); if (!chosen.length) return; setBusy(true); setError(null); setNotice(null); let completed = 0; try { for (const card of chosen) { await exportCardToContacts(card); await markCardExported(card.id); completed += 1; } setNotice(`${completed} ${completed === 1 ? 'contact' : 'contacts'} saved to your device.`); setSelected(new Set()); await cards.refetch(); } catch (reason) { setError(`${completed ? `${completed} saved. ` : ''}${reason instanceof Error ? reason.message : 'Export stopped before completion.'}`); } finally { setBusy(false); } }
  return <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}><Stack.Screen options={{ headerShown: true, title: 'Contact export' }} /><ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[4], padding: theme.spacing[5] }]}><View style={{ gap: theme.spacing[2] }}><AppText variant="title">Choose contacts to export</AppText><AppText muted>Card Nest creates contacts only for the cards you select. Existing device contacts are never uploaded.</AppText></View>{notice ? <AuthNotice message={notice} tone="success" /> : null}{error ? <AuthNotice message={error} /> : null}{!exportableCards.length ? <EmptyState body="Save a business card before exporting to your device contacts." icon="account-multiple-plus-outline" title="No cards to export" /> : exportableCards.map((card) => { const checked = selected.has(card.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} key={card.id} onPress={() => toggle(card.id)} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: checked ? theme.colors.primary : theme.colors.border, borderRadius: theme.radii.md, padding: theme.spacing[4] }]}><MaterialCommunityIcons color={checked ? theme.colors.primary : theme.colors.textMuted} name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={24} /><View style={styles.copy}><AppText variant="bodyStrong">{card.display_name ?? card.company ?? 'Unnamed card'}</AppText><AppText muted variant="caption">{card.company ?? card.primary_email ?? 'No company'}</AppText></View>{card.last_exported_to_contacts_at ? <MaterialCommunityIcons color={theme.colors.success} name="check" size={18} /> : null}</Pressable>; })}{exportableCards.length ? <><AppButton disabled={!selected.size} loading={busy} onPress={() => void exportSelected()}>Export {selected.size || ''} selected</AppButton><AppButton onPress={() => setSelected(new Set(exportableCards.map((card) => card.id)))} variant="secondary">Select all</AppButton></> : null}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' }, copy: { flex: 1 }, row: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12 }, safeArea: { flex: 1 } });
