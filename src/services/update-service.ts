import { bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export type ReleaseChannel = 'stable' | 'beta' | 'alpha';

export interface VersionInfo {
  versionName: string;
  versionCode: number;
  otaRuntimeVersion?: string;
  otaChannel?: string;
  otaUpdateId?: string;
  isEmbeddedLaunch?: boolean;
}

export interface NativeReleaseAsset {
  name: string;
  url: string;
  size: number;
  sha256?: string;
}

export interface ReleaseMetadata {
  versionName: string;
  versionCode: number;
  platform: string;
  apkAsset: string;
}

export interface NativeRelease {
  versionName: string;
  versionCode?: number;
  tagName: string;
  releaseNotes: string;
  publishedAt: string;
  asset: NativeReleaseAsset;
  metadata?: ReleaseMetadata;
}

export interface DownloadedApkMetadata {
  versionName: string;
  versionCode?: number;
  assetName: string;
  size: number;
  uri: string;
  sha256: string;
  downloadedAt: string;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  isOtaAvailable?: boolean;
  isOtaDownloaded?: boolean;
  isNativeUpdateAvailable?: boolean;
  currentVersion: VersionInfo;
  latestVersion?: NativeRelease;
  checkedAt: string;
  error?: string;
}

export type InstallerLaunchResult =
  | { status: 'launched' }
  | { status: 'permissionRequired' }
  | { status: 'error'; error: string };

type GithubAsset = {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
  digest?: unknown;
};

type GithubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  published_at?: unknown;
  draft?: unknown;
  assets?: unknown;
};

type NativeIntentLauncherModule = {
  canRequestPackageInstalls?: () => Promise<boolean>;
};

const GITHUB_RELEASES_ALL_API = 'https://api.github.com/repos/Ytosko/Card-Nest/releases';
const OFFICIAL_REPOSITORY_PATH = '/Ytosko/Card-Nest/releases/download/';
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const APK_METADATA_KEY = 'cardnest.native-update.download.v1';
const APK_DIRECTORY_NAME = 'card-nest-updates';
const MIN_APK_BYTES = 1024 * 1024;
const MAX_APK_BYTES = 500 * 1024 * 1024;
const CHECK_CACHE_MS = 10 * 60 * 1000;

let cachedCheck: UpdateCheckResult | null = null;
let lastCheckTime = 0;
let activeDownload: Promise<DownloadedApkMetadata> | null = null;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function normalizeVersionName(value: string): string {
  return value.trim().replace(/^v/u, '');
}

function isCredibleApkSize(size: number): boolean {
  return Number.isSafeInteger(size) && size >= MIN_APK_BYTES && size <= MAX_APK_BYTES;
}

function expectedApkName(versionName: string): string {
  return `Card-Nest-${versionName}-android.apk`;
}

function getUpdateDirectory(): Directory {
  return new Directory(Paths.document, APK_DIRECTORY_NAME);
}

function getFinalApkFile(assetName: string): File {
  return new File(getUpdateDirectory(), assetName);
}

function isSafeAssetName(assetName: string, versionName: string): boolean {
  return assetName === expectedApkName(versionName) && !assetName.includes('/') && !assetName.includes('\\');
}

export function getReleaseChannel(versionName: string): ReleaseChannel {
  const suffix = normalizeVersionName(versionName).split('-').slice(1).join('-').toLowerCase();
  if (suffix.startsWith('alpha')) return 'alpha';
  if (suffix.startsWith('beta')) return 'beta';
  return 'stable';
}

function channelRank(channel: ReleaseChannel): number {
  if (channel === 'stable') return 2;
  if (channel === 'beta') return 1;
  return 0;
}

function acceptsReleaseChannel(current: ReleaseChannel, candidate: ReleaseChannel): boolean {
  if (current === 'stable') return candidate === 'stable';
  if (current === 'beta') return candidate !== 'alpha';
  return true;
}

export function logUpdateDiagnostic(event: string, meta: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    platform: Platform.OS,
    channel: Updates.channel || getReleaseChannel(Constants.expoConfig?.version || '0.0.0'),
    runtimeVersion: Updates.runtimeVersion || null,
    updateId: Updates.updateId || null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    ...meta,
  };
  console.log('[CardNest Update Diagnostic]', JSON.stringify(payload));
}

export function getCurrentVersionInfo(): VersionInfo {
  const nativeVersion = Constants.nativeAppVersion;
  const configVersion = Constants.expoConfig?.version;
  const nativeBuild = Number.parseInt(Constants.nativeBuildVersion || '', 10);
  const configVersionCode = Constants.expoConfig?.android?.versionCode;
  return {
    versionName: nativeVersion || configVersion || '0.0.0',
    versionCode: Number.isFinite(nativeBuild) ? nativeBuild : configVersionCode || 0,
    otaRuntimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : undefined,
    otaChannel: Updates.channel || getReleaseChannel(nativeVersion || configVersion || '0.0.0'),
    otaUpdateId: Updates.updateId || undefined,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}

export function parseSemVer(versionStr: string): [number, number, number] {
  const match = normalizeVersionName(versionStr).match(/^(\d+)\.(\d+)\.(\d+)(?:-|$)/u);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function parseVersionCodeFromRelease(_tag: string, notes: string): number | undefined {
  const match = notes.match(/\bversionCode\s*[:=]\s*(\d+)\b/iu);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function compareSemVer(left: string, right: string): number {
  const leftParts = parseSemVer(left);
  const rightParts = parseSemVer(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function isNewerVersion(
  current: VersionInfo,
  latestTag: string,
  latestNotes: string,
  latestVersionCode?: number,
): boolean {
  const candidate = normalizeVersionName(latestTag);
  const currentChannel = getReleaseChannel(current.versionName);
  const candidateChannel = getReleaseChannel(candidate);
  if (!acceptsReleaseChannel(currentChannel, candidateChannel)) return false;

  // Primary upgrade ordering signal for Android: versionCode comparison
  const candidateCode = latestVersionCode ?? parseVersionCodeFromRelease(latestTag, latestNotes);

  if (candidateCode !== undefined && candidateCode > 0 && current.versionCode > 0) {
    const isNewer = candidateCode > current.versionCode;
    logUpdateDiagnostic('version_code_check', {
      installedVersionName: current.versionName,
      installedVersionCode: current.versionCode,
      candidateVersionName: candidate,
      candidateVersionCode: candidateCode,
      isNewer,
    });
    return isNewer;
  }

  // Fallback when versionCode is absent: compare semver monotonically.
  // Never offer an update if semver indicates candidate is lower or equal.
  if (candidate === current.versionName) return false;
  const semverComparison = compareSemVer(candidate, current.versionName);
  if (semverComparison > 0) return true;

  return false;
}

export function isOfficialApkAsset(
  tagName: string,
  versionName: string,
  asset: Pick<NativeReleaseAsset, 'name' | 'url' | 'size'>,
): boolean {
  if (!isSafeAssetName(asset.name, versionName) || !isCredibleApkSize(asset.size)) return false;
  try {
    const url = new URL(asset.url);
    const encodedTag = encodeURIComponent(tagName);
    const encodedName = encodeURIComponent(asset.name);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'github.com' &&
      url.pathname === `${OFFICIAL_REPOSITORY_PATH}${encodedTag}/${encodedName}`
    );
  } catch {
    return false;
  }
}

function parseSha256Digest(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^sha256:([0-9a-f]{64})$/iu);
  return match?.[1].toLowerCase();
}

export function parseGithubRelease(release: GithubRelease): NativeRelease | null {
  if (release.draft === true) return null;
  const rawTag = typeof release.tag_name === 'string' ? release.tag_name : '';
  const tagName = rawTag.trim();
  const versionName = normalizeVersionName(tagName);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(versionName)) return null;
  const notes = typeof release.body === 'string' ? release.body : '';
  const assets = Array.isArray(release.assets) ? (release.assets as GithubAsset[]) : [];
  const expectedName = expectedApkName(versionName);
  const rawAsset = assets.find((asset) => asset.name === expectedName);
  if (!rawAsset) return null;

  const asset: NativeReleaseAsset = {
    name: typeof rawAsset.name === 'string' ? rawAsset.name : '',
    url: typeof rawAsset.browser_download_url === 'string' ? rawAsset.browser_download_url : '',
    size: typeof rawAsset.size === 'number' ? rawAsset.size : 0,
    sha256: parseSha256Digest(rawAsset.digest),
  };
  if (!isOfficialApkAsset(tagName, versionName, asset)) return null;

  return {
    versionName,
    versionCode: parseVersionCodeFromRelease(tagName, notes),
    tagName,
    releaseNotes: notes || 'No release notes provided.',
    publishedAt: typeof release.published_at === 'string' ? release.published_at : new Date(0).toISOString(),
    asset,
  };
}

export function selectLatestRelease(
  current: VersionInfo,
  candidates: NativeRelease[],
): NativeRelease | undefined {
  const currentChannel = getReleaseChannel(current.versionName);
  const eligible = candidates.filter((item) =>
    acceptsReleaseChannel(currentChannel, getReleaseChannel(item.versionName)),
  );

  // Sort descending by versionCode first (highest versionCode first), then semver fallback
  eligible.sort((left, right) => {
    const leftCode = left.versionCode ?? 0;
    const rightCode = right.versionCode ?? 0;
    if (leftCode !== rightCode) {
      return rightCode - leftCode;
    }
    return compareSemVer(right.versionName, left.versionName);
  });

  return eligible.find((item) =>
    isNewerVersion(current, item.tagName, item.releaseNotes, item.versionCode),
  );
}

export async function checkForOtaUpdate(): Promise<{ isAvailable: boolean; isDownloaded: boolean; error?: string }> {
  logUpdateDiagnostic('ota_check_started');
  if (__DEV__ || Platform.OS === 'web') return { isAvailable: false, isDownloaded: false };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { isAvailable: false, isDownloaded: false };
    const fetchResult = await Updates.fetchUpdateAsync();
    return { isAvailable: true, isDownloaded: fetchResult.isNew };
  } catch (error) {
    const message = errorMessage(error, 'Could not check for an over-the-air update.');
    logUpdateDiagnostic('ota_check_error', { error: message });
    return { isAvailable: false, isDownloaded: false, error: message };
  }
}

export async function applyOtaUpdate(): Promise<void> {
  if (Platform.OS === 'web' || __DEV__) return;
  await Updates.reloadAsync();
}

export async function checkForAppUpdate(
  force = false,
  options: { includeOta?: boolean } = {},
): Promise<UpdateCheckResult> {
  const now = Date.now();
  if (!force && cachedCheck && now - lastCheckTime < CHECK_CACHE_MS) return cachedCheck;

  const current = getCurrentVersionInfo();
  const otaStatus = options.includeOta
    ? await checkForOtaUpdate()
    : { isAvailable: false, isDownloaded: false, error: undefined };

  if (Platform.OS !== 'android') {
    return {
      isUpdateAvailable: otaStatus.isAvailable,
      isOtaAvailable: otaStatus.isAvailable,
      isOtaDownloaded: otaStatus.isDownloaded,
      isNativeUpdateAvailable: false,
      currentVersion: current,
      checkedAt: new Date().toISOString(),
      error: otaStatus.error,
    };
  }

  try {
    const response = await fetch(GITHUB_RELEASES_ALL_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Card-Nest-Android' },
    });
    if (!response.ok) throw new Error(`Release server returned status ${response.status}.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Release server returned an invalid response.');

    const parsedReleases = payload
      .map((item) => parseGithubRelease(item as GithubRelease))
      .filter((item): item is NativeRelease => Boolean(item));

    // Fetch machine-readable metadata (cardnest-release.json) for candidate releases if present
    for (const rel of parsedReleases) {
      const rawRelease = (payload as GithubRelease[]).find(
        (r) => typeof r.tag_name === 'string' && r.tag_name.trim() === rel.tagName
      );
      const assets = Array.isArray(rawRelease?.assets) ? (rawRelease?.assets as GithubAsset[]) : [];
      const metaAsset = assets.find((a) => a.name === 'cardnest-release.json');
      if (metaAsset && typeof metaAsset.browser_download_url === 'string') {
        try {
          const metaResp = await expoFetch(metaAsset.browser_download_url, {
            headers: { Accept: 'application/json', 'User-Agent': 'Card-Nest-Android' },
          });
          if (metaResp.ok) {
            const metaJson = (await metaResp.json()) as ReleaseMetadata;
            if (metaJson && typeof metaJson.versionCode === 'number' && Number.isSafeInteger(metaJson.versionCode)) {
              rel.versionCode = metaJson.versionCode;
              rel.metadata = metaJson;
            }
          }
        } catch {
          // Gracefully fall back to notes parsing / semver if metadata asset cannot be fetched
        }
      }
    }

    const latest = selectLatestRelease(current, parsedReleases);

    logUpdateDiagnostic('update_check_completed', {
      installedVersionName: current.versionName,
      installedVersionCode: current.versionCode,
      githubReleaseTag: latest?.tagName || null,
      parsedReleaseVersionName: latest?.versionName || null,
      parsedReleaseVersionCode: latest?.versionCode || null,
      updateAvailable: Boolean(latest),
    });

    cachedCheck = {
      isUpdateAvailable: Boolean(latest) || otaStatus.isAvailable,
      isOtaAvailable: otaStatus.isAvailable,
      isOtaDownloaded: otaStatus.isDownloaded,
      isNativeUpdateAvailable: Boolean(latest),
      currentVersion: current,
      latestVersion: latest,
      checkedAt: new Date().toISOString(),
    };
    lastCheckTime = now;
    return cachedCheck;
  } catch (error) {
    const message = errorMessage(error, 'Could not reach the Card Nest release service.');
    logUpdateDiagnostic('app_check_failed', { error: message });
    return {
      isUpdateAvailable: otaStatus.isAvailable,
      isOtaAvailable: otaStatus.isAvailable,
      isOtaDownloaded: otaStatus.isDownloaded,
      isNativeUpdateAvailable: false,
      currentVersion: current,
      checkedAt: new Date().toISOString(),
      error: message,
    };
  }
}

function metadataIsWellFormed(value: unknown): value is DownloadedApkMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<DownloadedApkMetadata>;
  return (
    typeof metadata.versionName === 'string' &&
    typeof metadata.assetName === 'string' &&
    typeof metadata.size === 'number' &&
    typeof metadata.uri === 'string' &&
    typeof metadata.sha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(metadata.sha256) &&
    typeof metadata.downloadedAt === 'string'
  );
}

async function removeStoredApk(metadata?: DownloadedApkMetadata): Promise<void> {
  if (metadata) {
    try {
      const file = new File(metadata.uri);
      if (file.exists) file.delete();
    } catch {
      // Invalid or already-removed files are handled by clearing their metadata.
    }
  }
  await SecureStore.deleteItemAsync(APK_METADATA_KEY).catch(() => undefined);
}

async function sha256File(file: File): Promise<string> {
  const hasher = sha256.create();
  const reader = file.readableStream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
    }
    return bytesToHex(hasher.digest());
  } finally {
    reader.releaseLock();
  }
}

export async function getDownloadedApk(release?: NativeRelease): Promise<DownloadedApkMetadata | null> {
  const raw = await SecureStore.getItemAsync(APK_METADATA_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await removeStoredApk();
    return null;
  }
  if (!metadataIsWellFormed(parsed)) {
    await removeStoredApk();
    return null;
  }

  const metadata = parsed;
  const expectedFile = getFinalApkFile(metadata.assetName);
  const isExpectedPath = metadata.uri === expectedFile.uri;
  const matchesRelease =
    !release ||
    (metadata.versionName === release.versionName &&
      metadata.assetName === release.asset.name &&
      metadata.size === release.asset.size &&
      (!release.asset.sha256 || metadata.sha256 === release.asset.sha256));
  if (!isExpectedPath || !matchesRelease || !isCredibleApkSize(metadata.size) || !expectedFile.exists || expectedFile.size !== metadata.size) {
    await removeStoredApk(metadata);
    return null;
  }
  return metadata;
}

function validateDownloadResponseUrl(responseUrl: string): boolean {
  try {
    const url = new URL(responseUrl);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === 'github.com' || host === 'objects.githubusercontent.com' || host === 'release-assets.githubusercontent.com')
    );
  } catch {
    return false;
  }
}

async function performDownload(
  release: NativeRelease,
  onProgress?: (percent: number) => void,
): Promise<DownloadedApkMetadata> {
  if (!isOfficialApkAsset(release.tagName, release.versionName, release.asset)) {
    throw new Error('The release package did not pass Card Nest security validation.');
  }

  const existing = await getDownloadedApk(release);
  if (existing) {
    onProgress?.(100);
    return existing;
  }

  const directory = getUpdateDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const partial = new File(directory, `${release.asset.name}.part`);
  const finalFile = getFinalApkFile(release.asset.name);
  if (partial.exists) partial.delete();
  if (finalFile.exists) finalFile.delete();
  partial.create({ intermediates: true, overwrite: true });

  const response = await expoFetch(release.asset.url, {
    headers: { Accept: APK_MIME_TYPE, 'User-Agent': 'Card-Nest-Android' },
  });
  if (!response.ok || !response.body || !validateDownloadResponseUrl(response.url)) {
    if (partial.exists) partial.delete();
    throw new Error(`The update download failed with status ${response.status}.`);
  }

  const responseLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(responseLength) && responseLength !== release.asset.size) {
    if (partial.exists) partial.delete();
    throw new Error('The update package size does not match the official release.');
  }

  const reader = response.body.getReader();
  const writer = partial.writableStream().getWriter();
  const hasher = sha256.create();
  let received = 0;
  onProgress?.(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > release.asset.size) throw new Error('The update package exceeded its expected size.');
      hasher.update(value);
      await writer.write(value);
      onProgress?.(Math.min(99, Math.floor((received / release.asset.size) * 100)));
    }
    await writer.close();
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    if (partial.exists) partial.delete();
    throw error;
  } finally {
    reader.releaseLock();
  }

  const digest = bytesToHex(hasher.digest());
  if (received !== release.asset.size || partial.size !== release.asset.size) {
    if (partial.exists) partial.delete();
    throw new Error('The update package download was incomplete.');
  }
  if (release.asset.sha256 && digest !== release.asset.sha256) {
    if (partial.exists) partial.delete();
    throw new Error('The update package checksum did not match the official release.');
  }

  partial.move(finalFile);
  const metadata: DownloadedApkMetadata = {
    versionName: release.versionName,
    versionCode: release.versionCode,
    assetName: release.asset.name,
    size: release.asset.size,
    uri: finalFile.uri,
    sha256: digest,
    downloadedAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(APK_METADATA_KEY, JSON.stringify(metadata));
  onProgress?.(100);
  return metadata;
}

export function downloadNativeUpdate(
  release: NativeRelease,
  onProgress?: (percent: number) => void,
): Promise<DownloadedApkMetadata> {
  if (Platform.OS !== 'android') return Promise.reject(new Error('Native APK updates are available on Android only.'));
  if (activeDownload) return activeDownload;
  activeDownload = performDownload(release, onProgress).finally(() => {
    activeDownload = null;
  });
  return activeDownload;
}

async function canRequestPackageInstalls(): Promise<boolean> {
  const nativeModule = requireOptionalNativeModule<NativeIntentLauncherModule>('ExpoIntentLauncher');
  if (!nativeModule?.canRequestPackageInstalls) return true;
  return nativeModule.canRequestPackageInstalls();
}

export async function launchApkInstaller(metadata: DownloadedApkMetadata): Promise<InstallerLaunchResult> {
  if (Platform.OS !== 'android') return { status: 'error', error: 'Native APK installation is available on Android only.' };
  const stored = await getDownloadedApk();
  if (!stored || stored.uri !== metadata.uri || stored.sha256 !== metadata.sha256) {
    return { status: 'error', error: 'The downloaded update is missing or invalid. Download it again.' };
  }

  try {
    if (!(await canRequestPackageInstalls())) return { status: 'permissionRequired' };
    const file = new File(stored.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: APK_MIME_TYPE,
      flags: 1,
    });
    return { status: 'launched' };
  } catch (error) {
    return { status: 'error', error: errorMessage(error, 'Android could not open the package installer.') };
  }
}

export async function openInstallPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const packageName = Constants.expoConfig?.android?.package || 'dev.ytosko.cardnest';
  await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
    data: `package:${packageName}`,
  });
}

export async function verifyDownloadedApk(metadata: DownloadedApkMetadata): Promise<boolean> {
  const stored = await getDownloadedApk();
  if (!stored || stored.uri !== metadata.uri || stored.sha256 !== metadata.sha256) return false;
  const digest = await sha256File(new File(stored.uri));
  if (digest === stored.sha256) return true;
  await removeStoredApk(stored);
  return false;
}

export function resetUpdateServiceCacheForTests() {
  cachedCheck = null;
  lastCheckTime = 0;
  activeDownload = null;
}
