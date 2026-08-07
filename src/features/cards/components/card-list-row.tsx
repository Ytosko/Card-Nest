import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { ContactAvatar } from '@/src/components/ui/contact-avatar';
import { cardKeys } from '@/src/features/cards/card-hooks';
import { toggleFavorite } from '@/src/features/cards/card-service';
import { useAppTheme } from '@/src/theme/theme-provider';
import type { Card } from '@/src/types/database.helpers';

export function CardListRow({
  card,
  onPress,
  isSelectionMode = false,
  isSelected = false,
  onSelectToggle,
  onLongPress,
}: {
  card: Card;
  onPress: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onLongPress?: () => void;
}) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();

  async function handleToggleFavorite(e: any) {
    e?.stopPropagation?.();
    const nextState = !card.is_favorite;
    try {
      await toggleFavorite(card.id, nextState);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: cardKeys.all }),
        queryClient.invalidateQueries({ queryKey: cardKeys.detail(card.id) }),
      ]);
    } catch {
      // Revert on failure
    }
  }

  const secondaryText =
    [card.job_title, card.company].filter(Boolean).join(' · ') ||
    card.primary_phone ||
    card.primary_email ||
    'Contact details';

  const handleRowPress = () => {
    if (isSelectionMode) {
      onSelectToggle?.();
    } else {
      onPress();
    }
  };

  return (
    <Pressable
      accessibilityHint={isSelectionMode ? (isSelected ? 'Deselect contact' : 'Select contact') : 'Opens contact details'}
      accessibilityLabel={`${card.display_name ?? card.company ?? 'Unnamed contact'}${card.company ? `, ${card.company}` : ''}`}
      accessibilityRole="button"
      onLongPress={onLongPress}
      onPress={handleRowPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isSelected ? theme.colors.primarySoft : theme.colors.surface,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.72 : 1,
          padding: theme.spacing[4],
        },
      ]}>
      {/* Checkbox indicator in selection mode */}
      {isSelectionMode ? (
        <MaterialCommunityIcons
          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
          name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={24}
        />
      ) : null}

      <ContactAvatar
        company={card.company}
        contactPhotoPath={card.contact_photo_path}
        email={card.primary_email}
        name={card.display_name}
        size={48}
      />

      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <AppText numberOfLines={1} variant="bodyStrong" style={styles.name}>
            {card.display_name ?? card.company ?? 'Unnamed contact'}
          </AppText>

          {card.last_exported_to_contacts_at ? (
            <View style={[styles.contactBadge, { backgroundColor: theme.colors.primarySoft }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="check-circle" size={12} />
              <AppText variant="caption" style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '600' }}>
                Saved
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText muted numberOfLines={1} variant="caption">
          {secondaryText}
        </AppText>
      </View>

      {!isSelectionMode ? (
        <>
          <Pressable
            accessibilityLabel={card.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityRole="button"
            hitSlop={12}
            onPress={(e) => void handleToggleFavorite(e)}
            style={styles.favoriteButton}>
            <MaterialCommunityIcons
              color={card.is_favorite ? theme.colors.warning : theme.colors.textMuted}
              name={card.is_favorite ? 'star' : 'star-outline'}
              size={22}
            />
          </Pressable>

          <MaterialCommunityIcons color={theme.colors.textMuted} name="chevron-right" size={22} />
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contactBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copy: { flex: 1, gap: 2 },
  favoriteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  name: { flex: 1 },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  row: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 74 },
});
