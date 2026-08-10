import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useUpdates, type UpdateStatus } from '@/src/features/updates/update-provider';
import { getCurrentVersionInfo } from '@/src/services/update-service';
import { useAppTheme } from '@/src/theme/theme-provider';

function statusCopy(status: UpdateStatus, versionName?: string, percent = 0) {
  switch (status) {
    case 'checking':
      return { title: 'Checking for updates…', body: 'Looking for an official Card Nest release.' };
    case 'updateAvailable':
      return { title: `Update available${versionName ? ` — ${versionName}` : ''}`, body: 'Download the signed Android release when you are ready.' };
    case 'downloading':
      return { title: `Downloading… ${percent}%`, body: 'Keep Card Nest open while the verified package downloads.' };
    case 'downloaded':
      return { title: 'Ready to install', body: 'The verified update is stored on this device. It will not be downloaded again.' };
    case 'installPermissionRequired':
      return { title: 'Allow app installs', body: 'Android needs permission for Card Nest to open its signed update package.' };
    case 'launchingInstaller':
      return { title: 'Opening Android installer…', body: 'Follow Android’s prompts to finish updating Card Nest.' };
    case 'error':
      return { title: 'Update needs attention', body: 'Your current Card Nest installation is unchanged.' };
    default:
      return { title: 'Card Nest is up to date', body: 'You are using the latest compatible release.' };
  }
}

export default function AboutScreen() {
  const theme = useAppTheme();
  const currentVersion = getCurrentVersionInfo();
  const {
    status,
    result,
    downloadPercent,
    error,
    check,
    beginUpdate,
    installDownloaded,
    allowAppInstalls,
    clearError,
  } = useUpdates();
  const [showChangelog, setShowChangelog] = useState(false);
  const release = result?.latestVersion;
  const copy = statusCopy(status, release?.versionName, downloadPercent);
  const busy = status === 'checking' || status === 'downloading' || status === 'launchingInstaller';

  useEffect(() => {
    if (!result && status === 'idle') void check(false, true);
  }, [check, result, status]);

  async function handlePrimaryAction() {
    if (status === 'installPermissionRequired') {
      await allowAppInstalls();
      return;
    }
    if (status === 'downloaded' && release) {
      await installDownloaded();
      return;
    }
    if (status === 'error') {
      clearError();
      await check(true, true);
      return;
    }
    await beginUpdate();
  }

  const actionLabel =
    status === 'downloading'
      ? `Downloading… ${downloadPercent}%`
      : status === 'launchingInstaller'
        ? 'Opening installer…'
        : status === 'installPermissionRequired'
          ? 'Allow app installs'
          : status === 'downloaded'
            ? result?.isOtaDownloaded && !release
              ? 'Restart to update'
              : 'Install update'
            : status === 'error'
              ? 'Try again'
              : 'Download update';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'About Card Nest' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <BrandMark />
          <AppText variant="display" style={styles.center}>
            People are more than paper.
          </AppText>
          <AppText muted style={styles.center}>
            Card Nest turns business cards into a private, useful contact library you can carry between devices.
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <MaterialCommunityIcons color={theme.colors.primary} name="information-outline" size={24} />
            <View style={styles.flex}>
              <AppText variant="label">Installed version</AppText>
              <AppText muted variant="caption">
                {currentVersion.versionName} (build {currentVersion.versionCode})
              </AppText>
              {currentVersion.otaRuntimeVersion ? (
                <AppText muted variant="caption">
                  OTA channel: {currentVersion.otaChannel || 'default'} · Runtime: {currentVersion.otaRuntimeVersion}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        <View
          accessibilityLiveRegion="polite"
          aria-busy={busy}
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.statusIcon, { backgroundColor: theme.colors.primarySoft }]}>
              {busy ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <MaterialCommunityIcons
                  color={status === 'error' ? theme.colors.danger : theme.colors.primary}
                  name={status === 'idle' ? 'check-circle-outline' : 'arrow-up-bold-circle-outline'}
                  size={24}
                />
              )}
            </View>
            <View style={styles.flex}>
              <AppText variant="label">{copy.title}</AppText>
              <AppText muted variant="caption">{copy.body}</AppText>
            </View>
          </View>

          {status === 'downloading' ? (
            <View
              accessibilityLabel={`Update download ${downloadPercent} percent complete`}
              accessibilityRole="progressbar"
              style={[styles.progressTrack, { backgroundColor: theme.colors.primarySoft }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.colors.primary, width: `${downloadPercent}%` },
                ]}
              />
            </View>
          ) : null}

          {error ? <AuthNotice message={error} /> : null}
          {status !== 'idle' && status !== 'checking' ? (
            <AppButton loading={busy} onPress={() => void handlePrimaryAction()}>
              {actionLabel}
            </AppButton>
          ) : (
            <AppButton disabled={busy} variant="secondary" onPress={() => void check(true, true)}>
              Check for updates
            </AppButton>
          )}

          {release?.releaseNotes ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowChangelog(true)}
              style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.6 : 1 }]}>
              <AppText style={{ color: theme.colors.primary }} variant="label">
                What’s new
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <AppText muted variant="caption" style={styles.footerNote}>
          Official releases from Ytosko/Card-Nest · Card Nest © 2026
        </AppText>
      </ScrollView>

      <Modal
        accessibilityViewIsModal
        animationType="slide"
        transparent
        visible={showChangelog}
        onRequestClose={() => setShowChangelog(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.xl }]}>
            <View style={styles.modalHeader}>
              <AppText variant="title">What’s new in {release?.versionName}</AppText>
              <Pressable
                accessibilityLabel="Close release notes"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowChangelog(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <AppText style={styles.releaseNotesText}>{release?.releaseNotes || 'No release notes provided.'}</AppText>
            </ScrollView>
            <AppButton onPress={() => setShowChangelog(false)} variant="secondary">
              Close
            </AppButton>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, gap: 16, padding: 16, width: '100%' },
  center: { maxWidth: 600, textAlign: 'center' },
  flex: { flex: 1 },
  footerNote: { marginTop: 12, textAlign: 'center' },
  header: { alignItems: 'center', gap: 12, marginBottom: 12 },
  linkButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  modalBody: { maxHeight: 350, marginVertical: 16 },
  modalCard: { maxWidth: 500, padding: 20, width: '90%' },
  modalHeader: { alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  modalOverlay: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  progressFill: { borderRadius: 999, height: '100%' },
  progressTrack: { borderRadius: 999, height: 8, overflow: 'hidden', width: '100%' },
  releaseNotesText: { fontSize: 14, lineHeight: 22 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  scrollContent: { alignItems: 'center', gap: 16, padding: 20 },
  safeArea: { flex: 1 },
  statusIcon: { alignItems: 'center', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
});
