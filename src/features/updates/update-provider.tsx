import Constants from 'expo-constants';
import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  applyOtaUpdate,
  checkForAppUpdate,
  downloadNativeUpdate,
  getDownloadedApk,
  launchApkInstaller,
  openInstallPermissionSettings,
  type DownloadedApkMetadata,
  type UpdateCheckResult,
} from '@/src/services/update-service';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'updateAvailable'
  | 'downloading'
  | 'downloaded'
  | 'installPermissionRequired'
  | 'launchingInstaller'
  | 'error';

interface UpdateContextValue {
  status: UpdateStatus;
  result: UpdateCheckResult | null;
  downloadedApk: DownloadedApkMetadata | null;
  downloadPercent: number;
  error: string | null;
  check: (force?: boolean, includeOta?: boolean) => Promise<UpdateCheckResult | null>;
  beginUpdate: () => Promise<void>;
  installDownloaded: () => Promise<void>;
  allowAppInstalls: () => Promise<void>;
  clearError: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function UpdateProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [downloadedApk, setDownloadedApk] = useState<DownloadedApkMetadata | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef<Promise<unknown> | null>(null);

  const runExclusive = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (operationRef.current) return undefined;
    const pending = operation();
    operationRef.current = pending;
    try {
      return await pending;
    } finally {
      operationRef.current = null;
    }
  }, []);

  const check = useCallback(
    async (force = false, includeOta = false): Promise<UpdateCheckResult | null> => {
      if (Platform.OS !== 'android' || Constants.appOwnership === 'expo') return null;
      const checked = await runExclusive(async () => {
        setStatus('checking');
        setError(null);
        const nextResult = await checkForAppUpdate(force, { includeOta });
        setResult(nextResult);

        if (nextResult.error && !nextResult.isUpdateAvailable) {
          setError(nextResult.error);
          setStatus('error');
          return nextResult;
        }
        if (nextResult.isOtaDownloaded) {
          setStatus('downloaded');
          return nextResult;
        }
        if (nextResult.latestVersion) {
          const existing = await getDownloadedApk(nextResult.latestVersion);
          setDownloadedApk(existing);
          setDownloadPercent(existing ? 100 : 0);
          setStatus(existing ? 'downloaded' : 'updateAvailable');
          return nextResult;
        }
        setDownloadedApk(null);
        setDownloadPercent(0);
        setStatus('idle');
        return nextResult;
      });
      return checked ?? null;
    },
    [runExclusive],
  );

  const launchInstaller = useCallback(async (metadata: DownloadedApkMetadata) => {
    setStatus('launchingInstaller');
    const launch = await launchApkInstaller(metadata);
    if (launch.status === 'permissionRequired') {
      setStatus('installPermissionRequired');
      return;
    }
    if (launch.status === 'error') {
      setError(launch.error);
      setStatus('error');
      return;
    }
    // Android resolves the intent after the installer closes or the user cancels.
    // Retain the verified APK so "Ready to install" never triggers a redownload.
    setStatus('downloaded');
  }, []);

  const beginUpdate = useCallback(async () => {
    await runExclusive(async () => {
      setError(null);
      if (result?.isOtaDownloaded && !result.latestVersion) {
        setStatus('launchingInstaller');
        try {
          await applyOtaUpdate();
        } catch (nextError) {
          setError(friendlyError(nextError, 'Card Nest could not restart to apply the update.'));
          setStatus('error');
        }
        return;
      }

      const release = result?.latestVersion;
      if (!release) {
        setError('No verified Android release package is available.');
        setStatus('error');
        return;
      }

      try {
        const existing = downloadedApk ?? (await getDownloadedApk(release));
        const metadata =
          existing ??
          (await (async () => {
            setStatus('downloading');
            setDownloadPercent(0);
            return downloadNativeUpdate(release, setDownloadPercent);
          })());
        setDownloadedApk(metadata);
        setDownloadPercent(100);
        setStatus('downloaded');
        await launchInstaller(metadata);
      } catch (nextError) {
        setError(friendlyError(nextError, 'Card Nest could not download the update.'));
        setStatus('error');
      }
    });
  }, [downloadedApk, launchInstaller, result, runExclusive]);

  const installDownloaded = useCallback(async () => {
    await runExclusive(async () => {
      setError(null);
      const metadata = downloadedApk ?? (await getDownloadedApk(result?.latestVersion));
      if (!metadata) {
        setError('The downloaded update is no longer available. Download it again.');
        setStatus(result?.latestVersion ? 'updateAvailable' : 'error');
        return;
      }
      setDownloadedApk(metadata);
      await launchInstaller(metadata);
    });
  }, [downloadedApk, launchInstaller, result?.latestVersion, runExclusive]);

  const allowAppInstalls = useCallback(async () => {
    await runExclusive(async () => {
      setError(null);
      const metadata = downloadedApk ?? (await getDownloadedApk(result?.latestVersion));
      if (!metadata) {
        setError('The downloaded update is no longer available. Download it again.');
        setStatus(result?.latestVersion ? 'updateAvailable' : 'error');
        return;
      }
      setDownloadedApk(metadata);
      setStatus('launchingInstaller');
      try {
        await openInstallPermissionSettings();
        await launchInstaller(metadata);
      } catch (nextError) {
        setError(friendlyError(nextError, 'Android could not open the app install permission settings.'));
        setStatus('error');
      }
    });
  }, [downloadedApk, launchInstaller, result?.latestVersion, runExclusive]);

  const clearError = useCallback(() => {
    setError(null);
    if (downloadedApk) setStatus('downloaded');
    else if (result?.latestVersion) setStatus('updateAvailable');
    else setStatus('idle');
  }, [downloadedApk, result?.latestVersion]);

  const value = useMemo<UpdateContextValue>(
    () => ({
      status,
      result,
      downloadedApk,
      downloadPercent,
      error,
      check,
      beginUpdate,
      installDownloaded,
      allowAppInstalls,
      clearError,
    }),
    [allowAppInstalls, beginUpdate, check, clearError, downloadPercent, downloadedApk, error, installDownloaded, result, status],
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdates() {
  const value = useContext(UpdateContext);
  if (!value) throw new Error('useUpdates must be used inside UpdateProvider.');
  return value;
}
