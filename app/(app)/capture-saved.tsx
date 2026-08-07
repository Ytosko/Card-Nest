import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function CaptureSavedScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(); const theme = useAppTheme(); const router = useRouter(); const queue = useCaptureQueue();
  const item = queue.items.find((candidate) => candidate.cardId === id); const synced = item?.state === 'synced'; const failed = item?.state === 'failed';
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}><Stack.Screen options={{ headerShown: false }} /><View style={[styles.icon, { backgroundColor: failed ? theme.colors.warningSoft : theme.colors.successSoft }]}><MaterialCommunityIcons color={failed ? theme.colors.warning : theme.colors.success} name={failed ? 'cloud-alert-outline' : synced ? 'cloud-check-outline' : 'cloud-upload-outline'} size={48} /></View><AppText accessibilityRole="header" variant="display" style={styles.center}>{failed ? 'Your card is safe on this device.' : synced ? 'Your card is in the cloud.' : 'Your card is safely queued.'}</AppText><AppText muted style={styles.center}>{failed ? 'The upload paused and will retry automatically. You can keep working.' : synced ? 'Review and complete the contact details whenever you are ready.' : 'Card Nest is uploading the private images. Closing the app will not lose this capture.'}</AppText><View style={styles.actions}>{synced ? <AppButton onPress={() => router.replace({ pathname: '/(app)/cards/[id]/edit', params: { id } })}>Review contact</AppButton> : null}{failed && item ? <AppButton onPress={() => void queue.retry(item.id)}>Retry now</AppButton> : null}<AppButton onPress={() => router.replace('/(app)/(tabs)/cards')} variant={synced || failed ? 'secondary' : 'primary'}>Go to cards</AppButton><AppButton onPress={() => router.replace('/(app)/(tabs)/scan')} variant="secondary">Scan another</AppButton></View></SafeAreaView>;
}

const styles = StyleSheet.create({ actions: { alignSelf: 'stretch', gap: 12, marginTop: 12, maxWidth: 420, width: '100%' }, center: { maxWidth: 560, textAlign: 'center' }, icon: { alignItems: 'center', borderRadius: 999, height: 96, justifyContent: 'center', width: 96 }, safeArea: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' } });
