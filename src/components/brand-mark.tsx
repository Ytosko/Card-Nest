import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

type Props = { compact?: boolean };

export function BrandMark({ compact = false }: Props) {
  const theme = useAppTheme();
  const markSize = compact ? 48 : 64;

  return (
    <View accessibilityLabel="Card Nest" accessibilityRole="image" style={styles.container}>
      <Image
        contentFit="contain"
        source={require('@/assets/images/cardnest-icon.png')}
        style={{ borderRadius: compact ? theme.radii.md : theme.radii.lg, height: markSize, width: markSize }}
      />
      <AppText variant={compact ? 'title' : 'display'} style={compact ? styles.compactWordmark : styles.wordmark}>
        Card Nest
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  compactWordmark: { fontSize: 22, lineHeight: 28 },
  container: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  wordmark: { fontSize: 30, lineHeight: 38 },
});
