/* eslint-disable import/first -- Vitest native-module mocks must be registered before importing the service. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  secure: new Map<string, string>(),
  expoFetch: vi.fn(),
  startActivity: vi.fn(),
  canInstall: vi.fn(async () => true),
}));

vi.mock('expo-constants', () => ({
  default: {
    appOwnership: null,
    nativeAppVersion: null,
    nativeBuildVersion: null,
    expoConfig: {
      version: '1.0.2-beta-f0D2X',
      android: { package: 'dev.ytosko.cardnest', versionCode: 11 },
    },
  },
}));

vi.mock('expo-updates', () => ({
  runtimeVersion: '1.0.2-beta-f0D2X',
  channel: 'beta',
  updateId: 'test-ota-id',
  isEmbeddedLaunch: true,
  checkForUpdateAsync: vi.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: vi.fn(async () => ({ isNew: false })),
  reloadAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => testState.secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    testState.secure.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    testState.secure.delete(key);
  }),
}));

function joinUri(parts: unknown[]): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
    .join('/')
    .replace(/([^:]\/)\/+/gu, '$1');
}

vi.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    create() {}
  }

  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    get exists() {
      return testState.files.has(this.uri);
    }
    get size() {
      return testState.files.get(this.uri)?.byteLength ?? 0;
    }
    get contentUri() {
      return `content://dev.ytosko.cardnest/${encodeURIComponent(this.uri)}`;
    }
    create() {
      testState.files.set(this.uri, new Uint8Array());
    }
    delete() {
      testState.files.delete(this.uri);
    }
    move(destination: File) {
      const bytes = testState.files.get(this.uri) ?? new Uint8Array();
      testState.files.delete(this.uri);
      testState.files.set(destination.uri, bytes);
      this.uri = destination.uri;
    }
    readableStream() {
      const bytes = testState.files.get(this.uri) ?? new Uint8Array();
      let consumed = false;
      return {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: bytes };
          },
          releaseLock: () => undefined,
        }),
      };
    }
    writableStream() {
      const chunks: Uint8Array[] = [];
      return {
        getWriter: () => ({
          write: async (chunk: Uint8Array) => {
            chunks.push(chunk);
          },
          close: async () => {
            const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
            testState.files.set(this.uri, bytes);
          },
          abort: async () => undefined,
        }),
      };
    }
  }

  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});

vi.mock('expo/fetch', () => ({ fetch: testState.expoFetch }));

vi.mock('expo-intent-launcher', () => ({
  ActivityAction: { MANAGE_UNKNOWN_APP_SOURCES: 'android.settings.MANAGE_UNKNOWN_APP_SOURCES' },
  startActivityAsync: testState.startActivity,
}));

vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({ canRequestPackageInstalls: testState.canInstall }),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import {
  checkForAppUpdate,
  downloadNativeUpdate,
  getCurrentVersionInfo,
  getDownloadedApk,
  getReleaseChannel,
  isNewerVersion,
  isOfficialApkAsset,
  launchApkInstaller,
  openInstallPermissionSettings,
  parseGithubRelease,
  parseSemVer,
  parseVersionCodeFromRelease,
  resetUpdateServiceCacheForTests,
  type NativeRelease,
} from './update-service';

const assetSize = 1024 * 1024;
const release: NativeRelease = {
  versionName: '1.0.3-beta-f0D3X',
  versionCode: 12,
  tagName: 'v1.0.3-beta-f0D3X',
  releaseNotes: 'Native updater recovery. versionCode: 12',
  publishedAt: '2026-08-11T00:00:00.000Z',
  asset: {
    name: 'Card-Nest-1.0.3-beta-f0D3X-android.apk',
    url: 'https://github.com/Ytosko/Card-Nest/releases/download/v1.0.3-beta-f0D3X/Card-Nest-1.0.3-beta-f0D3X-android.apk',
    size: assetSize,
  },
};

function streamingResponse(bytes: Uint8Array) {
  let consumed = false;
  return {
    ok: true,
    status: 200,
    url: 'https://release-assets.githubusercontent.com/github-production-release-asset/test',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(bytes.byteLength) : null) },
    body: {
      getReader: () => ({
        read: async () => {
          if (consumed) return { done: true, value: undefined };
          consumed = true;
          return { done: false, value: bytes };
        },
        releaseLock: () => undefined,
      }),
    },
  };
}

beforeEach(() => {
  testState.files.clear();
  testState.secure.clear();
  testState.expoFetch.mockReset();
  testState.startActivity.mockReset().mockResolvedValue({ resultCode: 0 });
  testState.canInstall.mockReset().mockResolvedValue(true);
  vi.unstubAllGlobals();
  resetUpdateServiceCacheForTests();
});

describe('native update release selection', () => {
  it('reads the embedded native version and build', () => {
    expect(getCurrentVersionInfo()).toMatchObject({ versionName: '1.0.2-beta-f0D2X', versionCode: 11 });
  });

  it('parses semantic versions and release channels', () => {
    expect(parseSemVer('v1.2.3-beta-f0D2X')).toEqual([1, 2, 3]);
    expect(getReleaseChannel('1.0.0')).toBe('stable');
    expect(getReleaseChannel('1.0.0-beta-test')).toBe('beta');
    expect(getReleaseChannel('1.0.0-alpha-test')).toBe('alpha');
  });

  it('only treats a build as newer when versionCode is higher, ignoring display versionName ordering', () => {
    const current = { versionName: '1.0.5-beta-f0D3X', versionCode: 14 };

    // Higher versionCode with lower display versionName (e.g., 1.0.2-X0811 with versionCode 16 > 14)
    expect(isNewerVersion(current, 'v1.0.2-X0811', '', 16)).toBe(true);

    // Same versionCode
    expect(isNewerVersion(current, 'v1.0.2-X0811', '', 14)).toBe(false);

    // Lower versionCode
    expect(isNewerVersion(current, 'v1.0.2-X0811', '', 13)).toBe(false);

    // Higher versionCode
    expect(isNewerVersion(current, 'v1.0.6-beta', '', 15)).toBe(true);
  });

  it('safely falls back without offering invalid downgrades when versionCode is missing', () => {
    const current = { versionName: '1.0.5-beta-f0D3X', versionCode: 14 };

    // Display versionName is semantically lower and no versionCode provided -> no update (prevents false downgrade)
    expect(isNewerVersion(current, 'v1.0.2-X0811', '')).toBe(false);

    // Display versionName is semantically higher and no versionCode provided -> accepts update
    expect(isNewerVersion(current, 'v1.0.6', '')).toBe(true);
  });

  it('handles GitHub release service failures gracefully without crashing app', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
    })));
    const result = await checkForAppUpdate(true);
    expect(result.isNativeUpdateAvailable).toBe(false);
    expect(result.error).toContain('503');
  });

  it('does not offer alpha releases to beta users or beta releases to stable users', () => {
    expect(isNewerVersion({ versionName: '1.0.2-beta-x', versionCode: 11 }, 'v1.0.3-alpha-x', '')).toBe(false);
    expect(isNewerVersion({ versionName: '1.0.2', versionCode: 11 }, 'v1.0.3-beta-x', '')).toBe(false);
    expect(isNewerVersion({ versionName: '1.0.2-beta-x', versionCode: 11 }, 'v1.0.3', '')).toBe(true);
  });

  it('accepts only the exact official GitHub APK path, filename, and credible size', () => {
    expect(isOfficialApkAsset(release.tagName, release.versionName, release.asset)).toBe(true);
    expect(isOfficialApkAsset(release.tagName, release.versionName, { ...release.asset, url: 'https://example.com/update.apk' })).toBe(false);
    expect(isOfficialApkAsset(release.tagName, release.versionName, { ...release.asset, name: 'app-release.apk' })).toBe(false);
    expect(isOfficialApkAsset(release.tagName, release.versionName, { ...release.asset, size: 5 })).toBe(false);
  });

  it('parses a matching GitHub release and rejects mismatched APK assets', () => {
    const parsed = parseGithubRelease({
      tag_name: release.tagName,
      body: release.releaseNotes,
      published_at: release.publishedAt,
      draft: false,
      assets: [{ name: release.asset.name, browser_download_url: release.asset.url, size: assetSize }],
    });
    expect(parsed).toMatchObject({ versionName: release.versionName, versionCode: 12 });
    expect(parseGithubRelease({ tag_name: release.tagName, assets: [{ name: 'random.apk', size: assetSize }] })).toBeNull();
  });

  it('selects the verified newer release from GitHub using cardnest-release.json metadata', async () => {
    testState.expoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        versionName: '1.0.2-X0811',
        versionCode: 16,
        platform: 'android',
        apkAsset: 'Card-Nest-1.0.2-X0811-android.apk',
      }),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{
        tag_name: 'v1.0.2-X0811',
        body: 'Release 1.0.2-X0811',
        published_at: release.publishedAt,
        draft: false,
        assets: [
          { name: 'Card-Nest-1.0.2-X0811-android.apk', browser_download_url: 'https://github.com/Ytosko/Card-Nest/releases/download/v1.0.2-X0811/Card-Nest-1.0.2-X0811-android.apk', size: assetSize },
          { name: 'cardnest-release.json', browser_download_url: 'https://github.com/Ytosko/Card-Nest/releases/download/v1.0.2-X0811/cardnest-release.json', size: 120 },
        ],
      }],
    })));
    const result = await checkForAppUpdate(true);
    expect(result.isNativeUpdateAvailable).toBe(true);
    expect(result.latestVersion?.versionName).toBe('1.0.2-X0811');
    expect(result.latestVersion?.versionCode).toBe(16);
  });
});

describe('recoverable APK download and installation', () => {
  it('streams one verified APK, persists it, and reuses it without redownloading', async () => {
    const bytes = new Uint8Array(assetSize).fill(7);
    testState.expoFetch.mockResolvedValueOnce(streamingResponse(bytes));
    const progress = vi.fn();

    const first = await downloadNativeUpdate(release, progress);
    const second = await downloadNativeUpdate(release, progress);

    expect(first).toEqual(second);
    expect(first.size).toBe(assetSize);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(testState.expoFetch).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith(100);
    expect(await getDownloadedApk(release)).toEqual(first);
  });

  it('rejects an incomplete download and does not persist it', async () => {
    const bytes = new Uint8Array(assetSize - 1);
    testState.expoFetch.mockResolvedValueOnce({
      ...streamingResponse(bytes),
      headers: { get: () => null },
    });
    await expect(downloadNativeUpdate(release)).rejects.toThrow('incomplete');
    expect(await getDownloadedApk(release)).toBeNull();
  });

  it('keeps the downloaded APK when Android requires unknown-source permission', async () => {
    testState.expoFetch.mockResolvedValueOnce(streamingResponse(new Uint8Array(assetSize).fill(9)));
    const metadata = await downloadNativeUpdate(release);
    testState.canInstall.mockResolvedValue(false);

    await expect(launchApkInstaller(metadata)).resolves.toEqual({ status: 'permissionRequired' });
    expect(testState.startActivity).not.toHaveBeenCalled();
    expect(await getDownloadedApk(release)).toEqual(metadata);
  });

  it('opens the saved APK through a content URI with the Android package MIME type', async () => {
    testState.expoFetch.mockResolvedValueOnce(streamingResponse(new Uint8Array(assetSize).fill(3)));
    const metadata = await downloadNativeUpdate(release);

    await expect(launchApkInstaller(metadata)).resolves.toEqual({ status: 'launched' });
    expect(testState.startActivity).toHaveBeenCalledWith(
      'android.intent.action.VIEW',
      expect.objectContaining({
        data: expect.stringMatching(/^content:\/\//u),
        type: 'application/vnd.android.package-archive',
        flags: 1,
      }),
    );
  });

  it('opens Android install permission settings for the Card Nest package', async () => {
    await openInstallPermissionSettings();
    expect(testState.startActivity).toHaveBeenCalledWith('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: 'package:dev.ytosko.cardnest',
    });
  });
});
