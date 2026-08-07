import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { forwardRef, useId, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

import { AppText } from './app-text';

type Props = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export const AppTextField = forwardRef<TextInput, Props>(function AppTextField(
  { label, error, hint, icon, secureTextEntry, style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorId = useId();
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View
        style={[
          styles.inputFrame,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.borderStrong,
            borderRadius: theme.radii.md,
            minHeight: theme.sizes.touchTarget,
          },
        ]}>
        {icon ? <MaterialCommunityIcons color={theme.colors.textMuted} name={icon} size={20} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-describedby={error || hint ? errorId : undefined}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={isPassword && !passwordVisible}
          selectionColor={theme.colors.primary}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.family.body,
              fontSize: theme.typography.size.body,
            },
            style,
          ]}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setPasswordVisible((value) => !value)}
            style={styles.visibilityButton}>
            <MaterialCommunityIcons
              color={theme.colors.textMuted}
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
      {error || hint ? (
        <AppText
          nativeID={errorId}
          style={{ color: error ? theme.colors.danger : theme.colors.textMuted }}
          variant="caption">
          {error ?? hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 7 },
  input: { flex: 1, minHeight: 46, paddingVertical: 10 },
  inputFrame: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  visibilityButton: { alignItems: 'center', height: 44, justifyContent: 'center', marginRight: -8, width: 44 },
});
