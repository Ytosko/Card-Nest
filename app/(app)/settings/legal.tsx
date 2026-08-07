import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { getPublicEnv } from '@/src/config/env';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function LegalScreen() { const { document = 'privacy' } = useLocalSearchParams<{ document: string }>(); const theme = useAppTheme(); const env = getPublicEnv(); const privacy = document !== 'terms'; const url = privacy ? env.EXPO_PUBLIC_PRIVACY_URL : env.EXPO_PUBLIC_TERMS_URL; return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}><Stack.Screen options={{ headerShown: true, title: privacy ? 'Privacy' : 'Terms' }} /><View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}><MaterialCommunityIcons color={theme.colors.primary} name={privacy ? 'shield-lock-outline' : 'file-document-outline'} size={42} /></View><AppText variant="display" style={styles.center}>{privacy ? 'Your privacy matters.' : 'Clear terms, plainly presented.'}</AppText><AppText muted style={styles.center}>{privacy ? 'Read how Card Nest protects account data, private card images, and provider keys.' : 'Review the terms that apply when you use Card Nest.'}</AppText><AppButton onPress={() => void WebBrowser.openBrowserAsync(url)}>Open {privacy ? 'privacy policy' : 'terms'}</AppButton></SafeAreaView>; }
const styles = StyleSheet.create({ center: { maxWidth: 560, textAlign: 'center' }, icon: { alignItems: 'center', borderRadius: 999, height: 88, justifyContent: 'center', width: 88 }, safeArea: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' } });
