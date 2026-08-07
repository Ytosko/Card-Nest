import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

import { AppText } from './app-text';

type Props = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  children: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  textColor?: string;
};

export function AppButton({ children, disabled, loading = false, variant = 'primary', textColor, style, ...props }: Props) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor:
            variant === 'primary'
              ? state.pressed
                ? theme.colors.primaryPressed
                : theme.colors.primary
              : state.pressed
                ? theme.colors.primarySoft
                : theme.colors.surface,
          borderColor: variant === 'primary' ? theme.colors.primary : theme.colors.borderStrong,
          borderRadius: theme.radii.md,
          minHeight: theme.sizes.touchTarget,
          opacity: isDisabled ? 0.48 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor ?? (variant === 'primary' ? theme.colors.textOnBrand : theme.colors.primary)} />
        ) : null}
        <AppText
          variant="label"
          style={{ color: textColor ?? (variant === 'primary' ? theme.colors.textOnBrand : theme.colors.primary) }}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
});
