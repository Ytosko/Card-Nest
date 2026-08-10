import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentVersionInfo,
  isNewerVersion,
  parseVersionCodeFromRelease,
} from './update-service';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '0.1.4-alpha-d7102',
      android: { versionCode: 6 },
    },
  },
}));

vi.mock('expo-updates', () => ({
  runtimeVersion: '0.1.4-alpha-d7102',
  channel: 'alpha',
  updateId: 'test-ota-id',
  checkForUpdateAsync: vi.fn(() => Promise.resolve({ isAvailable: false })),
  fetchUpdateAsync: vi.fn(() => Promise.resolve({ isNew: false })),
  reloadAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///app-docs/',
  createDownloadResumable: vi.fn(),
  getContentUriAsync: vi.fn(),
}));

vi.mock('expo-intent-launcher', () => ({
  startActivityAsync: vi.fn(),
}));

describe('Update Service', () => {
  it('returns valid current version info', () => {
    const current = getCurrentVersionInfo();
    expect(current.versionName).toBe('0.1.4-alpha-d7102');
    expect(current.versionCode).toBe(6);
    expect(current.otaChannel).toBe('alpha');
  });

  it('parses versionCode from release notes accurately', () => {
    const notes = 'Release 0.1.4-alpha-d7102 with versionCode: 7';
    expect(parseVersionCodeFromRelease('v0.1.4-alpha-d7102', notes)).toBe(7);
  });

  it('identifies newer releases using versionCode comparison', () => {
    const current = { versionName: '0.1.4-alpha-d7102', versionCode: 6 };
    const isNewer = isNewerVersion(current, 'v0.1.5-alpha', 'New release with versionCode: 7');
    expect(isNewer).toBe(true);
  });

  it('identifies same version as not newer', () => {
    const current = { versionName: '0.1.4-alpha-d7102', versionCode: 6 };
    const isNewer = isNewerVersion(current, 'v0.1.4-alpha-d7102', 'Release notes with versionCode: 6');
    expect(isNewer).toBe(false);
  });
});
