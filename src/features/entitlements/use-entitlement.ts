import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/src/features/auth/auth-provider';
import { supabase } from '@/src/lib/supabase/client';

import { FEATURE_POLICY_VERSION, type Entitlement, type FeatureKey, canUseFeature } from './feature-gates';

export function useEntitlement() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['entitlement', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Entitlement | null> => {
      if (!user) return null;
      const { data, error } = await supabase.from('user_entitlements').select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        policyVersion: data.policy_version as typeof FEATURE_POLICY_VERSION,
        tier: data.tier as Entitlement['tier'],
        disabledFeatures: data.disabled_features as FeatureKey[],
      };
    },
  });
}

export function useFeatureAccess(feature: FeatureKey) {
  const entitlement = useEntitlement();
  return { ...entitlement, allowed: entitlement.isError || canUseFeature(feature, entitlement.data) };
}
