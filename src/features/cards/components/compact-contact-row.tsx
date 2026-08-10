import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { ContactAvatar } from '@/src/components/ui/contact-avatar';
import { cardKeys } from '@/src/features/cards/card-hooks';
import { toggleFavorite } from '@/src/features/cards/card-service';
import { useAppTheme } from '@/src/theme/theme-provider';
import type { Card } from '@/src/types/database.helpers';

export interface CompactContactRowProps {
  card: Card;
  onPress: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onLongPress?: () => void;
}

export const CompactContactRow = React.memo(function CompactContactRow({
  card,
  onPress,
  isSelectionMode = false,
  isSelected = false,
  onSelectToggle,
  onLongPress,
}: CompactContactRowProps) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();

  const handleToggleFavorite = useCallback(
    async (e: any) => {
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
    },
    [card.id, card.is_favorite, queryClient],
  );

  const secondaryText = useMemoSecondaryText(card);

  const handleRowPress = useCallback(() => {
    if (isSelectionMode) {
      onSelectToggle?.();
    } else {
      onPress();
    }
  }, [isSelectionMode, onSelectToggle, onPress]);

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
          borderBottomColor: theme.colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {/* Checkbox in selection mode */}
      {isSelectionMode ? (
        <MaterialCommunityIcons
          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
          name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={20}
          style={styles.checkbox}
        />
      ) : null}

      <ContactAvatar
        company={card.company}
        contactPhotoPath={card.contact_photo_path}
        email={card.primary_email}
        name={card.display_name}
        size={34}
      />

      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <AppText numberOfLines={1} variant="bodyStrong" style={styles.displayName}>
            {card.display_name ?? card.company ?? 'Unnamed contact'}
          </AppText>

          {card.last_exported_to_contacts_at ? (
            <View style={[styles.savedBadge, { backgroundColor: theme.colors.primarySoft }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="check-circle" size={10} />
            </View>
          ) : null}
        </View>

        {secondaryText ? (
          <AppText muted numberOfLines={1} variant="caption" style={styles.subtext}>
            {secondaryText}
          </AppText>
        ) : null}
      </View>

      {!isSelectionMode ? (
        <Pressable
          accessibilityLabel={card.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityRole="button"
          hitSlop={10}
          onPress={handleToggleFavorite}
          style={styles.favoriteBtn}
        >
          <MaterialCommunityIcons
            color={card.is_favorite ? theme.colors.warning : theme.colors.textMuted + '60'}
            name={card.is_favorite ? 'star' : 'star-outline'}
            size={18}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

function useMemoSecondaryText(card: Card): string | null {
  const parts = [card.job_title, card.company].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  if (card.primary_phone) return card.primary_phone;
  if (card.primary_email) return card.primary_email;
  return null;
}

const styles = StyleSheet.create({
  checkbox: {
    marginRight: 4,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  favoriteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  nameLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  savedBadge: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    padding: 2,
  },
  subtext: {
    fontSize: 12,
    lineHeight: 15,
  },
});
