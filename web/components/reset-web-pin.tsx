'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { clearAllWebUnlockSessions, webLockStorageKey } from '@/lib/web-lock';

export function ResetWebPin({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    localStorage.removeItem(webLockStorageKey(userId));
    clearAllWebUnlockSessions(sessionStorage);
    void fetch('/api/auth/reauth/google/complete', { method: 'POST' }).finally(() => router.replace('/app'));
  }, [router, userId]);
  return <main className="app-loading" role="status">Google account verified. Preparing a new browser PIN…</main>;
}
