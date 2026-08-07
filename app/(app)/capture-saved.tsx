import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function CaptureSavedScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const queue = useCaptureQueue();

  const item = queue.items.find((candidate) => candidate.cardId === id);
  const state = item?.state ?? 'synced';

  const isQueued = state === 'queued';
  const isUploading = state === 'uploading';
  const isProcessing = state === 'processing';
  const isSynced = state === 'synced';
  const isFailed = state === 'failed';

  // Progression steps copy
  const getStatusTitle = () => {
    if (isQueued) return 'Saving card…';
    if (isUploading) return 'Uploading securely…';
    if (isProcessing) return 'Reading your card…';
    if (isFailed) return "Couldn't read this card";
    return 'Ready to review!';
  };

  const getStatusBody = () => {
    if (isQueued) return 'Securing photos in your local queue.';
    if (isUploading) return 'Sending encrypted images to Card Nest servers.';
    if (isProcessing) return 'AI is organizing contact details from your card.';
    if (isFailed)
      return (
        item?.lastError ||
        'Your photos are safe on this device. Check your connection or AI settings and try again.'
      );
    return 'Your card is processed and saved. Review and adjust contact details whenever you are ready.';
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.icon,
          {
            backgroundColor: isFailed
              ? theme.colors.warningSoft
              : isSynced
              ? theme.colors.successSoft
              : theme.colors.primarySoft,
          },
        ]}>
        {isQueued || isUploading || isProcessing ? (
          <ActivityIndicator color={theme.colors.primary} size="large" />
        ) : (
          <MaterialCommunityIcons
            color={isFailed ? theme.colors.warning : theme.colors.success}
            name={isFailed ? 'cloud-alert-outline' : 'cloud-check-outline'}
            size={48}
          />
        )}
      </View>

      <View style={styles.copyBlock}>
        <AppText accessibilityRole="header" variant="display" style={styles.center}>
          {getStatusTitle()}
        </AppText>
        <AppText muted style={styles.center}>
          {getStatusBody()}
        </AppText>
      </View>

      {/* Progress Steps Indicator */}
      {!isSynced && !isFailed ? (
        <View
          style={[
            styles.stepsContainer,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}>
          <StepRow active={isQueued || isUploading || isProcessing} done={isUploading || isProcessing} label="1. Saving card" />
          <StepRow active={isUploading || isProcessing} done={isProcessing} label="2. Uploading securely" />
          <StepRow active={isProcessing} done={false} label="3. Reading card & organizing" />
        </View>
      ) : null}

      <View style={styles.actions}>
        {isSynced || !item ? (
          <AppButton onPress={() => router.replace({ pathname: '/(app)/cards/[id]/edit', params: { id } })}>
            Review contact
          </AppButton>
        ) : null}

        {isFailed && item ? (
          <AppButton loading={queue.isProcessing} onPress={() => void queue.retry(item.id)}>
            Retry extraction
          </AppButton>
        ) : null}

        <AppButton
          onPress={() => router.replace('/(app)/(tabs)/cards')}
          variant={isSynced || isFailed ? 'secondary' : 'primary'}>
          Go to cards
        </AppButton>
        
        <AppButton onPress={() => router.replace('/(app)/(tabs)/scan')} variant="secondary">
          Scan another card
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

function StepRow({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={styles.stepRow}>
      <MaterialCommunityIcons
        color={done ? theme.colors.success : active ? theme.colors.primary : theme.colors.textMuted}
        name={done ? 'check-circle' : active ? 'progress-clock' : 'circle-outline'}
        size={18}
      />
      <AppText
        variant="caption"
        style={{
          color: done ? theme.colors.success : active ? theme.colors.text : theme.colors.textMuted,
          fontWeight: active ? '600' : '400',
        }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { alignSelf: 'stretch', gap: 12, marginTop: 8, maxWidth: 420, width: '100%' },
  center: { maxWidth: 560, textAlign: 'center' },
  copyBlock: { alignItems: 'center', gap: 8 },
  icon: { alignItems: 'center', borderRadius: 999, height: 96, justifyContent: 'center', width: 96 },
  safeArea: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' },
  stepRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  stepsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
  },
});
