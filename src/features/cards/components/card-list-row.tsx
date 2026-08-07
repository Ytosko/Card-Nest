import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';
import type { Card } from '@/src/types/database.helpers';

export function CardListRow({ card, onPress }: { card: Card; onPress: () => void }) {
  const theme = useAppTheme();
  const initials = (card.display_name ?? card.company ?? '?')
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Pressable
      accessibilityHint="Opens contact details"
      accessibilityLabel={`${card.display_name ?? card.company ?? 'Unnamed card'}${card.company ? `, ${card.company}` : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.72 : 1,
          padding: theme.spacing[4],
        },
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
        <AppText variant="label" style={{ color: theme.colors.primary }}>{initials}</AppText>
      </View>
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <AppText numberOfLines={1} variant="bodyStrong" style={styles.name}>{card.display_name ?? card.company ?? 'Unnamed card'}</AppText>
          {card.is_favorite ? <MaterialCommunityIcons color={theme.colors.warning} name="star" size={18} /> : null}
        </View>
        <AppText muted numberOfLines={1} variant="caption">
          {[card.job_title, card.company].filter(Boolean).join(' · ') || card.primary_email || 'Add details'}
        </AppText>
      </View>
      <MaterialCommunityIcons color={theme.colors.textMuted} name="chevron-right" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 2 },
  name: { flex: 1 },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  row: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76 },
});
