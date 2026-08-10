import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

interface AlphabetSectionHeaderProps {
  title: string;
  count?: number;
}

export const AlphabetSectionHeader = React.memo(function AlphabetSectionHeader({
  title,
  count,
}: AlphabetSectionHeaderProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <AppText
        style={[
          styles.title,
          {
            color: theme.colors.primary,
          },
        ]}
      >
        {title}
      </AppText>
      {count !== undefined && count > 0 ? (
        <AppText muted variant="caption" style={styles.count}>
          ({count})
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    height: 28,
    paddingHorizontal: 12,
  },
  count: {
    fontSize: 11,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
