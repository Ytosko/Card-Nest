import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentVersionInfo,
  isNewerVersion,
  parseVersionCodeFromRelease,
} from './update-service';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '0.1.1-alpha-f9801',
      android: { versionCode: 2 },
    },
  },
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
    expect(current.versionName).toBe('0.1.1-alpha-f9801');
    expect(current.versionCode).toBe(2);
  });

  it('parses versionCode from release notes accurately', () => {
    const notes = 'Release 0.1.1-alpha-f9801 with versionCode: 3';
    expect(parseVersionCodeFromRelease('v0.1.1-alpha-f9801', notes)).toBe(3);
  });

  it('identifies newer releases using versionCode comparison', () => {
    const current = { versionName: '0.1.1-alpha-f9801', versionCode: 2 };
    const isNewer = isNewerVersion(current, 'v0.1.2-alpha', 'New release with versionCode: 3');
    expect(isNewer).toBe(true);
  });

  it('identifies same version as not newer', () => {
    const current = { versionName: '0.1.1-alpha-f9801', versionCode: 2 };
    const isNewer = isNewerVersion(current, 'v0.1.1-alpha-f9801', 'Release notes with versionCode: 2');
    expect(isNewer).toBe(false);
  });
});
