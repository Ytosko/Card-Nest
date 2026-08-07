import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { completeOnboarding } from '@/src/lib/onboarding';
import { useAppTheme } from '@/src/theme/theme-provider';

const pages = [
  {
    icon: 'card-account-details-outline' as const,
    eyebrow: 'CAPTURE IN A MOMENT',
    title: 'Turn every introduction into a useful contact.',
    body: 'Photograph the front and back of a business card. Card Nest keeps the original images and prepares the details for your review.',
  },
  {
    icon: 'shield-lock-outline' as const,
    eyebrow: 'PRIVATE BY DEFAULT',
    title: 'Your card library belongs to you.',
    body: 'Cards and images are protected per account, sync across your devices, and remain useful when your connection drops.',
  },
  {
    icon: 'creation-outline' as const,
    eyebrow: 'YOUR CHOICE OF AI',
    title: 'Bring your own provider key when you want smart extraction.',
    body: 'Use OpenAI or Gemini. Your key stays in secure device storage and is never saved in the Card Nest cloud.',
  },
];

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const content = pages[page];

  function finish() {
    completeOnboarding();
    router.replace('/(auth)/sign-in');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.topBar, { paddingHorizontal: theme.spacing[5] }]}>
        <BrandMark compact />
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
          <AppText muted variant="label">Skip</AppText>
        </Pressable>
      </View>
      <View style={[styles.content, { padding: theme.spacing[5] }]}>
        <View
          style={[
            styles.illustration,
            { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border, borderRadius: theme.radii.xl },
          ]}>
          <View style={[styles.iconRing, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name={content.icon} size={62} />
          </View>
        </View>
        <View style={[styles.copy, { gap: theme.spacing[3] }]}>
          <AppText variant="label" style={{ color: theme.colors.primary }}>{content.eyebrow}</AppText>
          <AppText accessibilityRole="header" variant="display">{content.title}</AppText>
          <AppText muted>{content.body}</AppText>
        </View>
      </View>
      <View style={[styles.footer, { padding: theme.spacing[5] }]}>
        <View accessibilityLabel={`Page ${page + 1} of ${pages.length}`} style={styles.dots}>
          {pages.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[
                styles.dot,
                { backgroundColor: index === page ? theme.colors.primary : theme.colors.borderStrong, width: index === page ? 24 : 8 },
              ]}
            />
          ))}
        </View>
        <AppButton onPress={() => (page === pages.length - 1 ? finish() : setPage(page + 1))}>
          {page === pages.length - 1 ? 'Get started' : 'Continue'}
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 30, justifyContent: 'center' },
  copy: { maxWidth: 600 },
  dot: { borderRadius: 4, height: 8 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  footer: { gap: 20 },
  iconRing: { alignItems: 'center', borderRadius: 999, height: 132, justifyContent: 'center', width: 132 },
  illustration: { alignItems: 'center', aspectRatio: 1.65, borderWidth: 1, justifyContent: 'center', maxHeight: 280 },
  safeArea: { flex: 1 },
  skip: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 72 },
});
