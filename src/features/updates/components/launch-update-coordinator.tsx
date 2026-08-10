import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/src/features/auth/auth-provider';
import { useSecurity } from '@/src/features/security/security-provider';
import { useUpdates } from '@/src/features/updates/update-provider';

import { UpdateAvailableModal } from './update-available-modal';

export function LaunchUpdateCoordinator() {
  const { initialized: authInitialized, session } = useAuth();
  const { initialized: securityInitialized, isUnlocked } = useSecurity();
  const { status, result, check, beginUpdate } = useUpdates();
  const router = useRouter();
  const checkedRef = useRef(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (checkedRef.current || !authInitialized || !securityInitialized || (session && !isUnlocked)) return;
    checkedRef.current = true;
    void check(false, false);
  }, [authInitialized, check, isUnlocked, securityInitialized, session]);

  const release = result?.latestVersion;
  const visible = Boolean(
    release &&
      session &&
      isUnlocked &&
      status === 'updateAvailable' &&
      dismissedVersion !== release.versionName,
  );

  if (!release) return null;
  return (
    <UpdateAvailableModal
      release={release}
      visible={visible}
      onLater={() => setDismissedVersion(release.versionName)}
      onUpdate={() => {
        setDismissedVersion(release.versionName);
        router.push('/(app)/settings/about');
        void beginUpdate();
      }}
    />
  );
}
