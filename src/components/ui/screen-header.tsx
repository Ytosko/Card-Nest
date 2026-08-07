import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function ScreenHeader({ title, subtitle, actionIcon, actionLabel, onAction }: {
  title: string;
  subtitle?: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" variant="title">{title}</AppText>
        {subtitle ? <AppText muted variant="caption">{subtitle}</AppText> : null}
      </View>
      {actionIcon && actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.65 : 1 },
          ]}>
          <MaterialCommunityIcons color={theme.colors.primary} name={actionIcon} size={23} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 2 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
});
