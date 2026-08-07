import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function QueueScreen() {
  const theme = useAppTheme();
  const queue = useCaptureQueue();

  const isRetrying = queue.isRetryingBulk;
  const progressText = queue.bulkProgress
    ? `${queue.bulkProgress.current} of ${queue.bulkProgress.total} retrying...`
    : 'Retrying all failed...';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Sync and Queue' }} />

      <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[4], padding: theme.spacing[5] }]}>
        {/* Metric Summary Bar */}
        <View style={styles.metricsRow}>
          <MetricChip icon="clock-outline" label="Queued" value={queue.queuedCount} />
          <MetricChip icon="cloud-upload-outline" label="Syncing" value={queue.syncingCount} />
          <MetricChip icon="cloud-alert-outline" isAlert label="Failed" value={queue.failedCount} />
          <MetricChip icon="cloud-check-outline" isSuccess label="Synced" value={queue.syncedCount} />
        </View>

        {/* Summary Notification Notice */}
        {queue.bulkSummaryNotice ? (
          <AuthNotice
            message={queue.bulkSummaryNotice}
            tone={queue.failedCount === 0 ? 'success' : 'info'}
          />
        ) : null}

        {/* Prominent Bulk Action Banner */}
        {queue.failedCount > 0 ? (
          <View
            style={[
              styles.bulkBanner,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.lg,
                padding: theme.spacing[4],
              },
            ]}>
            <View style={styles.bulkCopy}>
              <View style={styles.bulkTitleRow}>
                <MaterialCommunityIcons color={theme.colors.warning} name="cloud-alert-outline" size={22} />
                <AppText variant="title" style={{ fontSize: 16 }}>
                  {queue.failedCount} {queue.failedCount === 1 ? 'card needs attention' : 'cards need attention'}
                </AppText>
              </View>
              <AppText muted variant="caption">
                Reset transient errors and retry processing through the queue pipeline without duplicating captures.
              </AppText>
            </View>

            <AppButton
              disabled={isRetrying || queue.failedCount === 0}
              loading={isRetrying}
              onPress={() => void queue.retryAllFailed()}>
              {isRetrying ? progressText : 'Retry all failed'}
            </AppButton>
          </View>
        ) : null}

        {/* Queue Items List */}
        {!queue.items.length ? (
          <EmptyState
            body="New captures are secured here before they upload. There is nothing waiting right now."
            icon="cloud-check-outline"
            title="Everything is synced"
          />
        ) : (
          queue.items.map((item) => {
            const isFailed = item.state === 'failed';
            const isSynced = item.state === 'synced';
            const isUploading = item.state === 'uploading' || item.state === 'processing';

            return (
              <View
                key={item.id}
                style={[
                  styles.item,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: isFailed ? theme.colors.warning : theme.colors.border,
                    borderRadius: theme.radii.lg,
                    padding: theme.spacing[4],
                  },
                ]}>
                <MaterialCommunityIcons
                  color={
                    isFailed ? theme.colors.warning : isSynced ? theme.colors.success : theme.colors.primary
                  }
                  name={
                    isFailed
                      ? 'cloud-alert-outline'
                      : isSynced
                      ? 'cloud-check-outline'
                      : isUploading
                      ? 'cloud-upload-outline'
                      : 'clock-outline'
                  }
                  size={26}
                />

                <View style={styles.copy}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText variant="bodyStrong">
                      {isFailed
                        ? 'Upload paused'
                        : isSynced
                        ? 'Synced'
                        : item.state === 'uploading'
                        ? 'Uploading images...'
                        : item.state === 'processing'
                        ? 'Extracting contact...'
                        : 'Waiting to upload'}
                    </AppText>

                    {item.attemptCount > 1 ? (
                      <AppText muted variant="caption">
                        (Attempt {item.attemptCount})
                      </AppText>
                    ) : null}
                  </View>

                  <AppText muted variant="caption">
                    {item.lastError || `Captured ${new Date(item.createdAt).toLocaleString()}`}
                  </AppText>
                </View>

                {isFailed ? (
                  <AppButton
                    disabled={isRetrying}
                    onPress={() => void queue.retry(item.id)}
                    variant="secondary">
                    Retry
                  </AppButton>
                ) : isUploading ? (
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                ) : null}
              </View>
            );
          })
        )}

        {/* Clear Completed Action */}
        {queue.syncedCount > 0 ? (
          <AppButton onPress={() => void queue.dismissSynced()} variant="secondary">
            Clear completed ({queue.syncedCount})
          </AppButton>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricChip({
  icon,
  label,
  value,
  isAlert = false,
  isSuccess = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
  isAlert?: boolean;
  isSuccess?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isAlert && value > 0 ? theme.colors.warning : theme.colors.border,
        },
      ]}>
      <MaterialCommunityIcons
        color={
          isAlert && value > 0
            ? theme.colors.warning
            : isSuccess && value > 0
            ? theme.colors.success
            : theme.colors.textMuted
        }
        name={icon}
        size={18}
      />
      <AppText variant="caption" style={{ fontSize: 11, color: theme.colors.textMuted }}>
        {label}
      </AppText>
      <AppText
        variant="bodyStrong"
        style={{
          color:
            isAlert && value > 0
              ? theme.colors.warning
              : isSuccess && value > 0
              ? theme.colors.success
              : theme.colors.text,
        }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bulkBanner: { borderWidth: 1, gap: 12 },
  bulkCopy: { gap: 4 },
  bulkTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  chip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 8,
  },
  content: { alignSelf: 'center', maxWidth: 760, width: '100%' },
  copy: { flex: 1 },
  item: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  safeArea: { flex: 1 },
});
