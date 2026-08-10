import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentVersionInfo,
  isNewerVersion,
  parseSemVer,
  parseVersionCodeFromRelease,
} from './update-service';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '0.1.5-alpha-e4f81',
      android: { versionCode: 7 },
    },
  },
}));

vi.mock('expo-updates', () => ({
  runtimeVersion: '0.1.5-alpha-e4f81',
  channel: 'alpha',
  updateId: 'test-ota-id',
  isEmbeddedLaunch: true,
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
    expect(current.versionName).toBe('0.1.5-alpha-e4f81');
    expect(current.versionCode).toBe(7);
    expect(current.otaChannel).toBe('alpha');
  });

  it('parses semver numbers accurately', () => {
    expect(parseSemVer('0.1.5-alpha-e4f81')).toEqual([0, 1, 5]);
    expect(parseSemVer('v0.1.4-alpha-d7102')).toEqual([0, 1, 4]);
  });

  it('parses versionCode from release notes accurately', () => {
    const notes = 'Release 0.1.5-alpha-e4f81 with versionCode: 7';
    expect(parseVersionCodeFromRelease('v0.1.5-alpha-e4f81', notes)).toBe(7);
  });

  it('identifies newer releases using semver and versionCode comparison', () => {
    const current = { versionName: '0.1.4-alpha-d7102', versionCode: 6 };
    const isNewer = isNewerVersion(current, 'v0.1.5-alpha-e4f81', 'New release with versionCode: 7');
    expect(isNewer).toBe(true);
  });

  it('identifies older release as not newer', () => {
    const current = { versionName: '0.1.5-alpha-e4f81', versionCode: 7 };
    const isNewer = isNewerVersion(current, 'v0.1.4-alpha-d7102', 'Old release with versionCode: 6');
    expect(isNewer).toBe(false);
  });

  it('identifies same version as not newer', () => {
    const current = { versionName: '0.1.5-alpha-e4f81', versionCode: 7 };
    const isNewer = isNewerVersion(current, 'v0.1.5-alpha-e4f81', 'Release notes with versionCode: 7');
    expect(isNewer).toBe(false);
  });
});
