import { describe, expect, it } from 'vitest';

import { canUseFeature, FEATURE_POLICY_VERSION } from './feature-gates';

describe('feature gates', () => {
  it('fails open when the entitlement backend is unavailable', () => {
    expect(canUseFeature('scan_card')).toBe(true);
  });

  it('enables current core features for a normal free user', () => {
    expect(
      canUseFeature('cloud_backup', { policyVersion: FEATURE_POLICY_VERSION, tier: 'free' }),
    ).toBe(true);
  });

  it('honors an explicit disabled entitlement', () => {
    expect(
      canUseFeature('ai_extraction', { policyVersion: FEATURE_POLICY_VERSION, tier: 'disabled' }),
    ).toBe(false);
  });

  it('supports targeted feature restrictions', () => {
    expect(
      canUseFeature('bulk_export', {
        policyVersion: FEATURE_POLICY_VERSION,
        tier: 'free',
        disabledFeatures: ['bulk_export'],
      }),
    ).toBe(false);
  });
});
