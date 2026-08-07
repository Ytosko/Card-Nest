export const FEATURE_POLICY_VERSION = 1 as const;

export const featureKeys = [
  'scan_card',
  'cloud_backup',
  'ai_extraction',
  'bulk_export',
  'advanced_search',
  'unlimited_cards',
  'custom_tags',
] as const;

export type FeatureKey = (typeof featureKeys)[number];
export type EntitlementTier = 'free' | 'pro' | 'team' | 'disabled';

export type Entitlement = {
  policyVersion: typeof FEATURE_POLICY_VERSION;
  tier: EntitlementTier;
  disabledFeatures?: readonly FeatureKey[];
};

const allFeatures = new Set<FeatureKey>(featureKeys);

export function canUseFeature(feature: FeatureKey, entitlement?: Entitlement | null) {
  if (!entitlement) {
    return true;
  }

  if (entitlement.policyVersion !== FEATURE_POLICY_VERSION || entitlement.tier === 'disabled') {
    return entitlement.policyVersion !== FEATURE_POLICY_VERSION;
  }

  return allFeatures.has(feature) && !entitlement.disabledFeatures?.includes(feature);
}
