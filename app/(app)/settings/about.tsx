import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AboutScreen() { const theme = useAppTheme(); return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}><Stack.Screen options={{ headerShown: true, title: 'About' }} /><BrandMark /><AppText variant="display" style={styles.center}>People are more than paper.</AppText><AppText muted style={styles.center}>Card Nest turns business cards into a private, useful contact library you can carry between devices.</AppText><View style={[styles.version, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}><MaterialCommunityIcons color={theme.colors.primary} name="information-outline" size={22} /><AppText variant="label">Version {Constants.expoConfig?.version ?? '1.0.0'}</AppText></View><AppText muted variant="caption">Open-source software · Card Nest branding © 2026</AppText></SafeAreaView>; }
const styles = StyleSheet.create({ center: { maxWidth: 600, textAlign: 'center' }, safeArea: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center' }, version: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 } });
