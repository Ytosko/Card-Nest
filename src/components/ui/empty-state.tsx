import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

import { AppButton } from './app-button';
import { AppText } from './app-text';

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.container, { gap: theme.spacing[3], padding: theme.spacing[6] }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}>
        <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={34} />
      </View>
      <AppText variant="title" style={styles.center}>{title}</AppText>
      <AppText muted style={styles.center}>{body}</AppText>
      {action && onAction ? <AppButton onPress={onAction} style={styles.action}>{action}</AppButton> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: 8, minWidth: 180 },
  center: { textAlign: 'center' },
  container: { alignItems: 'center', justifyContent: 'center' },
  icon: { alignItems: 'center', borderRadius: 999, height: 72, justifyContent: 'center', width: 72 },
});
