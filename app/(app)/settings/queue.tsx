import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { EmptyState } from '@/src/components/ui/empty-state';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { CompactQueueRow } from '@/src/features/capture/components/compact-queue-row';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function QueueScreen() {
  const theme = useAppTheme();
  const queue = useCaptureQueue();

  const [deleteAllConfirmVisible, setDeleteAllConfirmVisible] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const isRetrying = queue.isRetryingBulk;
  const isDeleting = queue.isDeletingFailed;
  const isBusy = isRetrying || isDeleting || deletingItemId !== null;
  const progressText = queue.bulkProgress
    ? `${queue.bulkProgress.current} of ${queue.bulkProgress.total} ${isDeleting ? 'deleting' : 'retrying'}...`
    : isDeleting
    ? 'Deleting all failed...'
    : 'Retrying all failed...';

  async function handleDeleteSingle(itemId: string) {
    setDeletingItemId(itemId);
    try {
      await queue.deleteFailed(itemId);
    } finally {
      setDeletingItemId(null);
    }
  }

  function confirmDeleteAll() {
    setDeleteAllConfirmVisible(false);
    void queue.deleteAllFailed();
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Sync and Queue' }} />

      {/* Delete All Failed Confirmation Dialog */}
      <Modal animationType="fade" transparent visible={deleteAllConfirmVisible}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={32} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Delete {queue.failedCount} failed {queue.failedCount === 1 ? 'scan' : 'scans'}?
            </AppText>
            <AppText muted variant="caption" style={{ textAlign: 'center' }}>
              This removes the queued captures, their local photos, and any partial cloud data. Saved contacts are
              never affected.
            </AppText>
            <View style={{ gap: 8, marginTop: 8, width: '100%' }}>
              <AppButton onPress={confirmDeleteAll} style={{ backgroundColor: theme.colors.danger }}>
                Delete {queue.failedCount} failed {queue.failedCount === 1 ? 'scan' : 'scans'}
              </AppButton>
              <AppButton onPress={() => setDeleteAllConfirmVisible(false)} variant="secondary">
                Cancel
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

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
              disabled={isBusy || queue.failedCount === 0}
              loading={isRetrying}
              onPress={() => void queue.retryAllFailed()}>
              {isRetrying || isDeleting ? progressText : 'Retry all failed'}
            </AppButton>

            <AppButton
              disabled={isBusy || queue.failedCount === 0}
              loading={isDeleting}
              onPress={() => setDeleteAllConfirmVisible(true)}
              variant="secondary">
              Delete all failed
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
          <View style={{ gap: 2 }}>
            {queue.items.map((item) => (
              <CompactQueueRow
                key={item.id}
                isBusy={isBusy}
                isDeletingThisItem={deletingItemId === item.id}
                item={item}
                onDelete={(id) => void handleDeleteSingle(id)}
                onRetry={(id) => void queue.retry(id)}
              />
            ))}
          </View>
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
  failedActions: { gap: 6 },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
    padding: 24,
    width: '100%',
  },
  item: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  safeArea: { flex: 1 },
});
