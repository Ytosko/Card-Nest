import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function AuthLoadingScreen({ label = 'Opening your Card Nest…' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { gap: theme.spacing[5] }]}>
        <BrandMark compact />
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <AppText muted>{label}</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  safeArea: { flex: 1 },
});
