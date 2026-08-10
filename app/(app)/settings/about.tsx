import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/brand-mark';
import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import {
  applyOtaUpdate,
  checkForAppUpdate,
  downloadAndInstallApk,
  getCurrentVersionInfo,
  type UpdateCheckResult,
} from '@/src/services/update-service';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AboutScreen() {
  const theme = useAppTheme();
  const currentVersion = getCurrentVersionInfo();

  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [showChangelog, setShowChangelog] = useState(false);

  const runUpdateCheck = useCallback(async (force = false) => {
    setChecking(true);
    const res = await checkForAppUpdate(force);
    setUpdateResult(res);
    setChecking(false);
  }, []);

  useEffect(() => {
    void runUpdateCheck(false);
  }, [runUpdateCheck]);

  async function handleInstallUpdate() {
    if (updateResult?.isOtaDownloaded) {
      await applyOtaUpdate();
      return;
    }

    if (!updateResult?.latestVersion?.apkUrl) {
      Alert.alert('Update Unavailable', 'No release package found for this update.');
      return;
    }

    setDownloading(true);
    setDownloadPercent(0);

    const res = await downloadAndInstallApk(
      updateResult.latestVersion.apkUrl,
      (percent) => setDownloadPercent(percent),
    );

    setDownloading(false);
    if (!res.success) {
      Alert.alert('Update Failed', res.error || 'Could not install update package.');
    }
  }

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

        {/* Current Version Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.row}>
            <MaterialCommunityIcons color={theme.colors.primary} name="information-outline" size={24} />
            <View>
              <AppText variant="label">Installed Version</AppText>
              <AppText muted variant="caption">
                {currentVersion.versionName} (build {currentVersion.versionCode})
              </AppText>
              {currentVersion.otaRuntimeVersion ? (
                <AppText muted variant="caption">
                  OTA Channel: {currentVersion.otaChannel || 'alpha'} · Runtime: {currentVersion.otaRuntimeVersion}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        {/* In-App Update Checker Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <MaterialCommunityIcons
                color={
                  updateResult?.isUpdateAvailable
                    ? theme.colors.primary
                    : checking
                      ? theme.colors.textMuted
                      : '#10b981'
                }
                name={updateResult?.isUpdateAvailable ? 'arrow-up-bold-circle-outline' : 'check-circle-outline'}
                size={26}
              />
              <View>
                <AppText variant="label">
                  {checking
                    ? 'Checking for updates…'
                    : updateResult?.isOtaDownloaded
                      ? 'OTA Update Downloaded — Ready to Restart'
                      : updateResult?.isUpdateAvailable
                        ? `Update Available — ${updateResult.latestVersion?.versionName}`
                        : 'Card Nest is up to date'}
                </AppText>
                <AppText muted variant="caption">
                  {updateResult?.isOtaDownloaded
                    ? 'A new over-the-air update is ready to be applied.'
                    : updateResult?.isUpdateAvailable
                      ? 'A newer release is ready for installation.'
                      : "You're using the latest release with compatible OTA support."}
                </AppText>
              </View>
            </View>
            {checking ? <ActivityIndicator color={theme.colors.primary} /> : null}
          </View>

          {updateResult?.isUpdateAvailable ? (
            <View style={styles.updateActions}>
              <AppButton loading={downloading} onPress={() => void handleInstallUpdate()}>
                {updateResult.isOtaDownloaded
                  ? 'Restart App to Update'
                  : downloading
                    ? `Downloading (${downloadPercent}%)`
                    : 'Update App'}
              </AppButton>
              {updateResult.latestVersion?.releaseNotes ? (
                <TouchableOpacity style={styles.changelogBtn} onPress={() => setShowChangelog(true)}>
                  <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    What’s new
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <AppButton disabled={checking} variant="secondary" onPress={() => void runUpdateCheck(true)}>
                Check for updates
              </AppButton>
            </View>
          )}
        </View>

        <AppText muted variant="caption" style={styles.footerNote}>
          Open-source software · Official releases from Ytosko/Card-Nest · Card Nest © 2026
        </AppText>
      </ScrollView>

      {/* Changelog Modal */}
      <Modal animationType="slide" transparent visible={showChangelog} onRequestClose={() => setShowChangelog(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <AppText variant="title">
                What’s new in {updateResult?.latestVersion?.versionName}
              </AppText>
              <TouchableOpacity onPress={() => setShowChangelog(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <AppText style={styles.releaseNotesText}>
                {updateResult?.latestVersion?.releaseNotes || 'No release notes provided.'}
              </AppText>
            </ScrollView>
            <View style={styles.modalFooter}>
              <AppButton onPress={() => { setShowChangelog(false); void handleInstallUpdate(); }}>
                Update App
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16, width: '100%' },
  center: { maxWidth: 600, textAlign: 'center' },
  changelogBtn: { alignItems: 'center', paddingVertical: 6 },
  footerNote: { marginTop: 12, textAlign: 'center' },
  header: { alignItems: 'center', gap: 12, marginBottom: 12 },
  modalBody: { maxHeight: 350, marginVertical: 12 },
  modalCard: { borderRadius: 24, maxWidth: 500, padding: 20, width: '90%' },
  modalFooter: { marginTop: 8 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modalOverlay: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center' },
  releaseNotesText: { fontSize: 14, lineHeight: 22 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  scrollContent: { alignItems: 'center', gap: 16, padding: 20 },
  safeArea: { flex: 1 },
  updateActions: { gap: 8, marginTop: 12 },
});
