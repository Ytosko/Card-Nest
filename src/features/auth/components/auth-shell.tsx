import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren, ReactNode } from 'react';

import { BrandMark } from '@/src/components/brand-mark';
import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

type Props = PropsWithChildren<{
  title: string;
  subtitle: string;
  eyebrow?: string;
  footer?: ReactNode;
}>;

export function AuthShell({ children, title, subtitle, eyebrow, footer }: Props) {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.orbLarge, styles.decorative, { backgroundColor: theme.colors.primarySoft }]} />
      <View style={[styles.orbSmall, styles.decorative, { backgroundColor: theme.colors.primary }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.flex}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.container, { gap: theme.spacing[6], padding: theme.spacing[5] }]}>
            <BrandMark compact />
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.xl,
                  gap: theme.spacing[6],
                  padding: theme.spacing[6],
                },
                Platform.select({
                  web: { boxShadow: '0 12px 28px rgba(7, 20, 23, 0.08)' },
                  default: {
                    shadowColor: '#071417',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.08,
                    shadowRadius: 28,
                  },
                }),
              ]}>
              <View style={{ gap: theme.spacing[2] }}>
                {eyebrow ? (
                  <AppText variant="label" style={{ color: theme.colors.primary }}>
                    {eyebrow.toUpperCase()}
                  </AppText>
                ) : null}
                <AppText accessibilityRole="header" variant="title" style={styles.title}>
                  {title}
                </AppText>
                <AppText muted>{subtitle}</AppText>
              </View>
              {children}
            </View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  container: { alignSelf: 'center', justifyContent: 'center', maxWidth: 520, minHeight: '100%', width: '100%' },
  flex: { flex: 1 },
  decorative: { pointerEvents: 'none' },
  footer: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  orbLarge: { borderRadius: 999, height: 260, position: 'absolute', right: -110, top: -90, width: 260 },
  orbSmall: { borderRadius: 999, bottom: 70, height: 26, left: 28, opacity: 0.35, position: 'absolute', width: 26 },
  safeArea: { flex: 1, overflow: 'hidden' },
  scrollContent: { flexGrow: 1 },
  title: { fontSize: 28, lineHeight: 36 },
});
