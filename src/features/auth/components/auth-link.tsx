import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function AuthLink({ href, children }: { href: Href; children: string }) {
  const theme = useAppTheme();
  return (
    <Link asChild href={href}>
      <Pressable accessibilityRole="link" style={styles.link}>
        {({ pressed }) => (
          <AppText variant="label" style={{ color: theme.colors.primary, opacity: pressed ? 0.65 : 1 }}>
            {children}
          </AppText>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 4 },
});
