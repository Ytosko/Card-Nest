import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

export interface VersionInfo {
  versionName: string;
  versionCode: number;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
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

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Ytosko/Card-Nest/releases/latest';

export function getCurrentVersionInfo(): VersionInfo {
  const configVersion = Constants.expoConfig?.version || '0.1.3-alpha-c9085';
  const configVersionCode = Constants.expoConfig?.android?.versionCode || 5;
  return {
    versionName: configVersion,
    versionCode: configVersionCode,
  };
}

export function parseVersionCodeFromRelease(tag: string, notes: string): number | undefined {
  const match = notes.match(/versionCode:?\s*(\d+)/i) || tag.match(/v?(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

export function isNewerVersion(current: VersionInfo, latestTag: string, latestNotes: string): boolean {
  const cleanTag = latestTag.replace(/^v/u, '');
  if (cleanTag === current.versionName) return false;

  const latestCode = parseVersionCodeFromRelease(latestTag, latestNotes);
  if (latestCode !== undefined && current.versionCode !== undefined) {
    return latestCode > current.versionCode;
  }

  return cleanTag.localeCompare(current.versionName, undefined, { numeric: true, sensitivity: 'base' }) > 0;
}

let cachedCheck: UpdateCheckResult | null = null;
let lastCheckTime = 0;

export async function checkForAppUpdate(force = false): Promise<UpdateCheckResult> {
  const now = Date.now();
  // Throttle automatic network checks to once every 10 minutes unless forced
  if (!force && cachedCheck && now - lastCheckTime < 10 * 60 * 1000) {
    return cachedCheck;
  }

  const current = getCurrentVersionInfo();
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CardNest-App',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const data = await response.json();
    const latestTag = data.tag_name || data.name || current.versionName;
    const releaseNotes = data.body || 'No release notes available.';
    const apkAsset = (data.assets || []).find((a: any) => a.name?.endsWith('.apk'));
    const apkUrl = apkAsset?.browser_download_url;

    const available = isNewerVersion(current, latestTag, releaseNotes);

    cachedCheck = {
      isUpdateAvailable: available,
      currentVersion: current,
      latestVersion: {
        versionName: latestTag.replace(/^v/u, ''),
        versionCode: parseVersionCodeFromRelease(latestTag, releaseNotes),
        releaseNotes,
        apkUrl,
        publishedAt: data.published_at || new Date().toISOString(),
      },
      checkedAt: new Date().toISOString(),
    };
    lastCheckTime = now;
    return cachedCheck;
  } catch (err: any) {
    return {
      isUpdateAvailable: false,
      currentVersion: current,
      checkedAt: new Date().toISOString(),
      error: err?.message || 'Network unavailable',
    };
  }
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
