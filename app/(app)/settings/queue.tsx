import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function QueueScreen() { const theme = useAppTheme(); const queue = useCaptureQueue(); return <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}><Stack.Screen options={{ headerShown: true, title: 'Sync and queue' }} /><ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[4], padding: theme.spacing[5] }]}>{!queue.items.length ? <EmptyState body="New captures are secured here before they upload. There is nothing waiting right now." icon="cloud-check-outline" title="Everything is synced" /> : queue.items.map((item) => <View key={item.id} style={[styles.item, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, padding: theme.spacing[4] }]}><MaterialCommunityIcons color={item.state === 'failed' ? theme.colors.warning : item.state === 'synced' ? theme.colors.success : theme.colors.primary} name={item.state === 'failed' ? 'cloud-alert-outline' : item.state === 'synced' ? 'cloud-check-outline' : 'cloud-upload-outline'} size={26} /><View style={styles.copy}><AppText variant="bodyStrong">{item.state === 'failed' ? 'Upload paused' : item.state === 'synced' ? 'Synced' : item.state === 'uploading' ? 'Uploading' : 'Waiting to upload'}</AppText><AppText muted variant="caption">{item.lastError ?? `Captured ${new Date(item.createdAt).toLocaleString()}`}</AppText></View>{item.state === 'failed' ? <AppButton onPress={() => void queue.retry(item.id)} variant="secondary">Retry</AppButton> : null}</View>)}{queue.items.some((item) => item.state === 'synced') ? <AppButton onPress={() => void queue.dismissSynced()} variant="secondary">Clear completed</AppButton> : null}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ content: { alignSelf: 'center', maxWidth: 760, width: '100%' }, copy: { flex: 1 }, item: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12 }, safeArea: { flex: 1 } });
