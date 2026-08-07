import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

const GOOGLE_BLUE = '#4285F4';

export function GoogleAuthButton({
  loading = false,
  disabled = false,
  onPress,
}: {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel="Continue with Google"
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? theme.colors.background : theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.md,
          minHeight: theme.sizes.touchTarget,
          opacity: isDisabled ? 0.48 : 1,
        },
      ]}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={GOOGLE_BLUE} size="small" />
        ) : (
          <MaterialCommunityIcons color={GOOGLE_BLUE} name="google" size={20} />
        )}
        <AppText variant="label" style={{ color: theme.colors.text }}>
          Continue with Google
        </AppText>
      </View>
    </Pressable>
  );
}

export function AuthMethodDivider() {
  const theme = useAppTheme();
  return (
    <View accessibilityElementsHidden style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      <AppText muted variant="caption">
        or
      </AppText>
      <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
});
