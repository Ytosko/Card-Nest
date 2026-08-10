import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';
import type { CaptureQueueItem } from '@/src/features/capture/capture-queue-db';

export interface CompactQueueRowProps {
  item: CaptureQueueItem;
  onRetry?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  isBusy?: boolean;
  isDeletingThisItem?: boolean;
}

export const CompactQueueRow = React.memo(function CompactQueueRow({
  item,
  onRetry,
  onDelete,
  isBusy = false,
  isDeletingThisItem = false,
}: CompactQueueRowProps) {
  const theme = useAppTheme();

  const isFailed = item.state === 'failed';
  const isSynced = item.state === 'synced';
  const isUploading = item.state === 'uploading' || item.state === 'processing';

  const statusLabel = isFailed
    ? 'Upload paused'
    : isSynced
    ? 'Synced'
    : item.state === 'uploading'
    ? 'Uploading images...'
    : item.state === 'processing'
    ? 'Extracting contact...'
    : 'Waiting to upload';

  const statusIcon = isFailed
    ? 'cloud-alert-outline'
    : isSynced
    ? 'cloud-check-outline'
    : isUploading
    ? 'cloud-upload-outline'
    : 'clock-outline';

  const statusColor = isFailed
    ? theme.colors.warning
    : isSynced
    ? theme.colors.success
    : theme.colors.primary;

  const handleRetry = useCallback(() => {
    if (onRetry) onRetry(item.id);
  }, [onRetry, item.id]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(item.id);
  }, [onDelete, item.id]);

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          borderLeftColor: isFailed ? theme.colors.warning : 'transparent',
          borderLeftWidth: isFailed ? 3 : 0,
        },
      ]}
    >
      <MaterialCommunityIcons color={statusColor} name={statusIcon} size={22} style={styles.icon} />

      <View style={styles.copy}>
        <View style={styles.titleLine}>
          <AppText numberOfLines={1} variant="bodyStrong" style={styles.title}>
            {statusLabel}
          </AppText>
          {item.attemptCount > 1 ? (
            <AppText muted variant="caption" style={styles.attemptText}>
              (Attempt {item.attemptCount})
            </AppText>
          ) : null}
        </View>

        <AppText muted numberOfLines={1} variant="caption" style={styles.subtitle}>
          {item.lastError || `Captured ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </AppText>
      </View>

      {isFailed ? (
        <View style={styles.actionRow}>
          <Pressable
            disabled={isBusy}
            onPress={handleRetry}
            style={[styles.miniBtn, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}
          >
            <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 11 }}>
              Retry
            </AppText>
          </Pressable>

          <Pressable
            disabled={isBusy}
            onPress={handleDelete}
            style={[styles.miniBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          >
            {isDeletingThisItem ? (
              <ActivityIndicator color={theme.colors.danger} size="small" />
            ) : (
              <AppText variant="caption" style={{ color: theme.colors.danger, fontSize: 11 }}>
                Delete
              </AppText>
            )}
          </Pressable>
        </View>
      ) : isUploading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" style={styles.loader} />
      ) : isSynced ? (
        <MaterialCommunityIcons color={theme.colors.success} name="check" size={18} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  attemptText: {
    fontSize: 11,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  icon: {
    marginRight: 2,
  },
  loader: {
    marginHorizontal: 4,
  },
  miniBtn: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
