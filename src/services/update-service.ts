import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export interface VersionInfo {
  versionName: string;
  versionCode: number;
  otaRuntimeVersion?: string;
  otaChannel?: string;
  otaUpdateId?: string;
  isEmbeddedLaunch?: boolean;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  isOtaAvailable?: boolean;
  isOtaDownloaded?: boolean;
  isNativeUpdateAvailable?: boolean;
  currentVersion: VersionInfo;
  latestVersion?: {
    versionName: string;
    versionCode?: number;
    releaseNotes: string;
    apkUrl?: string;
    publishedAt: string;
  };
  checkedAt: string;
  error?: string;
}

const GITHUB_RELEASES_ALL_API = 'https://api.github.com/repos/Ytosko/Card-Nest/releases';

export function logUpdateDiagnostic(event: string, meta: Record<string, any> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    platform: Platform.OS,
    channel: Updates.channel || 'alpha',
    runtimeVersion: Updates.runtimeVersion || '1.0.1-beta-f0D1X',
    updateId: Updates.updateId || null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    ...meta,
  };
  console.log('[CardNest Update Diagnostic]', JSON.stringify(payload, null, 2));
}

export function getCurrentVersionInfo(): VersionInfo {
  const configVersion = Constants.expoConfig?.version || '1.0.1-beta-f0D1X';
  const configVersionCode = Constants.expoConfig?.android?.versionCode || 10;
  return {
    versionName: configVersion,
    versionCode: configVersionCode,
    otaRuntimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : undefined,
    otaChannel: Updates.channel || 'alpha',
    otaUpdateId: Updates.updateId || undefined,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}

export function parseSemVer(versionStr: string): [number, number, number] {
  const clean = versionStr.replace(/^v/u, '').split('-')[0];
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function parseVersionCodeFromRelease(tag: string, notes: string): number | undefined {
  const notesMatch = notes.match(/versionCode:?\s*(\d+)/i);
  if (notesMatch) {
    return parseInt(notesMatch[1], 10);
  }
  const tagMatch = tag.match(/code-?(\d+)/i) || tag.match(/v?\d+\.\d+\.\d+-alpha-.*?(\d+)/i);
  if (tagMatch) {
    return parseInt(tagMatch[1], 10);
  }
  return undefined;
}

export function isNewerVersion(current: VersionInfo, latestTag: string, latestNotes: string): boolean {
  const cleanTag = latestTag.replace(/^v/u, '');
  if (cleanTag === current.versionName) return false;

  const currentSemVer = parseSemVer(current.versionName);
  const latestSemVer = parseSemVer(cleanTag);

  for (let i = 0; i < 3; i++) {
    if (latestSemVer[i] > currentSemVer[i]) return true;
    if (latestSemVer[i] < currentSemVer[i]) return false;
  }

  // Same semver major.minor.patch: compare versionCode if present
  const latestCode = parseVersionCodeFromRelease(latestTag, latestNotes);
  if (latestCode !== undefined && current.versionCode !== undefined) {
    return latestCode > current.versionCode;
  }

  // Fallback to numeric comparison
  return cleanTag.localeCompare(current.versionName, undefined, { numeric: true, sensitivity: 'base' }) > 0;
}

let cachedCheck: UpdateCheckResult | null = null;
let lastCheckTime = 0;

export async function checkForOtaUpdate(): Promise<{ isAvailable: boolean; isDownloaded: boolean; error?: string }> {
  logUpdateDiagnostic('ota_check_started');
  if (__DEV__ || Platform.OS === 'web') {
    logUpdateDiagnostic('ota_check_skipped', { reason: 'development_or_web' });
    return { isAvailable: false, isDownloaded: false };
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    logUpdateDiagnostic('ota_check_completed', { isAvailable: check.isAvailable });
    if (check.isAvailable) {
      const fetchResult = await Updates.fetchUpdateAsync();
      logUpdateDiagnostic('ota_fetch_completed', { isNew: fetchResult.isNew });
      return { isAvailable: true, isDownloaded: fetchResult.isNew };
    }
    return { isAvailable: false, isDownloaded: false };
  } catch (err: any) {
    logUpdateDiagnostic('ota_check_error', { errorMessage: err?.message });
    return { isAvailable: false, isDownloaded: false, error: err?.message };
  }
}

export async function applyOtaUpdate(): Promise<void> {
  logUpdateDiagnostic('ota_apply_requested');
  if (Platform.OS === 'web' || __DEV__) return;
  try {
    await Updates.reloadAsync();
  } catch (err: any) {
    logUpdateDiagnostic('ota_apply_error', { errorMessage: err?.message });
  }
}

export async function checkForAppUpdate(force = false): Promise<UpdateCheckResult> {
  logUpdateDiagnostic('app_check_started', { force });
  const now = Date.now();
  if (!force && cachedCheck && now - lastCheckTime < 10 * 60 * 1000) {
    return cachedCheck;
  }

  const current = getCurrentVersionInfo();
  let otaStatus = { isAvailable: false, isDownloaded: false };

  if (!__DEV__ && Platform.OS !== 'web') {
    otaStatus = await checkForOtaUpdate();
  }

  try {
    const response = await fetch(GITHUB_RELEASES_ALL_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CardNest-App',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const releases: any[] = await response.json();
    logUpdateDiagnostic('github_releases_fetched', { count: releases.length });

    // Filter out draft releases
    const validReleases = releases.filter((r) => !r.draft);
    
    // Find the latest valid release that is newer than current
    let latestNativeRelease: any = null;
    let isNativeNewer = false;

    for (const release of validReleases) {
      const tagName = release.tag_name || release.name || '';
      const notes = release.body || '';
      if (isNewerVersion(current, tagName, notes)) {
        if (!latestNativeRelease || isNewerVersion(getCurrentVersionInfoWithTag(latestNativeRelease.tag_name), tagName, notes)) {
          latestNativeRelease = release;
          isNativeNewer = true;
        }
      }
    }

    const targetRelease = latestNativeRelease || validReleases[0] || null;
    const latestTag = targetRelease ? (targetRelease.tag_name || targetRelease.name || current.versionName) : current.versionName;
    const releaseNotes = targetRelease ? (targetRelease.body || 'No release notes available.') : '';
    const apkAsset = targetRelease ? (targetRelease.assets || []).find((a: any) => a.name?.endsWith('.apk')) : null;
    const apkUrl = apkAsset?.browser_download_url;

    cachedCheck = {
      isUpdateAvailable: isNativeNewer || otaStatus.isAvailable,
      isOtaAvailable: otaStatus.isAvailable,
      isOtaDownloaded: otaStatus.isDownloaded,
      isNativeUpdateAvailable: isNativeNewer,
      currentVersion: current,
      latestVersion: targetRelease
        ? {
            versionName: latestTag.replace(/^v/u, ''),
            versionCode: parseVersionCodeFromRelease(latestTag, releaseNotes),
            releaseNotes,
            apkUrl,
            publishedAt: targetRelease.published_at || new Date().toISOString(),
          }
        : undefined,
      checkedAt: new Date().toISOString(),
    };
    lastCheckTime = now;
    logUpdateDiagnostic('app_check_completed', {
      isUpdateAvailable: cachedCheck.isUpdateAvailable,
      isNativeUpdateAvailable: isNativeNewer,
      isOtaAvailable: otaStatus.isAvailable,
    });
    return cachedCheck;
  } catch (err: any) {
    logUpdateDiagnostic('app_check_failed', { error: err?.message });
    return {
      isUpdateAvailable: otaStatus.isAvailable,
      isOtaAvailable: otaStatus.isAvailable,
      isOtaDownloaded: otaStatus.isDownloaded,
      currentVersion: current,
      checkedAt: new Date().toISOString(),
      error: err?.message || 'Network unavailable',
    };
  }
}

function getCurrentVersionInfoWithTag(tag: string): VersionInfo {
  const clean = tag.replace(/^v/u, '');
  return {
    versionName: clean,
    versionCode: 0,
  };
}

export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'In-app APK installation is supported on Android.' };
  }

  try {
    const docDir = (FileSystem as any).documentDirectory || '';
    const targetPath = `${docDir}CardNest-update.apk`;
    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      targetPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(Math.round(progress * 100));
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      return { success: false, error: 'Failed to download update package.' };
    }

    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Package installation failed.' };
  }
}
