import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentVersionInfo,
  isNewerVersion,
  parseVersionCodeFromRelease,
} from './update-service';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '0.1.3-alpha-c9085',
      android: { versionCode: 5 },
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
    expect(current.versionName).toBe('0.1.3-alpha-c9085');
    expect(current.versionCode).toBe(5);
  });

  it('parses versionCode from release notes accurately', () => {
    const notes = 'Release 0.1.3-alpha-c9085 with versionCode: 6';
    expect(parseVersionCodeFromRelease('v0.1.3-alpha-c9085', notes)).toBe(6);
  });

  it('identifies newer releases using versionCode comparison', () => {
    const current = { versionName: '0.1.3-alpha-c9085', versionCode: 5 };
    const isNewer = isNewerVersion(current, 'v0.1.4-alpha', 'New release with versionCode: 6');
    expect(isNewer).toBe(true);
  });

  it('identifies same version as not newer', () => {
    const current = { versionName: '0.1.3-alpha-c9085', versionCode: 5 };
    const isNewer = isNewerVersion(current, 'v0.1.3-alpha-c9085', 'Release notes with versionCode: 5');
    expect(isNewer).toBe(false);
  });
});
