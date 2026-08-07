import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '@/src/theme/theme-provider';

type TextVariant = 'caption' | 'label' | 'body' | 'bodyStrong' | 'title' | 'display';
type Props = ComponentProps<typeof Text> & { variant?: TextVariant; muted?: boolean };

export function AppText({ variant = 'body', muted = false, style, ...props }: Props) {
  const theme = useAppTheme();
  const variantStyle = {
    caption: {
      fontFamily: theme.typography.family.body,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    label: {
      fontFamily: theme.typography.family.bodyStrong,
      fontSize: theme.typography.size.label,
      lineHeight: theme.typography.lineHeight.label,
    },
    body: {
      fontFamily: theme.typography.family.body,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },
    bodyStrong: {
      fontFamily: theme.typography.family.bodyStrong,
      fontSize: theme.typography.size.body,
      lineHeight: theme.typography.lineHeight.body,
    },
    title: {
      fontFamily: theme.typography.family.heading,
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
    },
    display: {
      fontFamily: theme.typography.family.headingBold,
      fontSize: theme.typography.size.display,
      lineHeight: theme.typography.lineHeight.display,
    },
  }[variant];

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[{ color: muted ? theme.colors.textMuted : theme.colors.text }, variantStyle, style]}
      {...props}
    />
  );
}
