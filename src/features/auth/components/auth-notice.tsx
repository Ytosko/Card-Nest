import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function AuthNotice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' | 'info' }) {
  const theme = useAppTheme();
  const config = {
    error: { color: theme.colors.danger, background: theme.colors.dangerSoft, icon: 'alert-circle-outline' as const },
    success: { color: theme.colors.success, background: theme.colors.successSoft, icon: 'check-circle-outline' as const },
    info: { color: theme.colors.primary, background: theme.colors.primarySoft, icon: 'information-outline' as const },
  }[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: config.background, borderRadius: theme.radii.md }]}>
      <MaterialCommunityIcons color={config.color} name={config.icon} size={20} />
      <AppText style={[styles.copy, { color: config.color }]} variant="caption">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  notice: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, padding: 12 },
});
