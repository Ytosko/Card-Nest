import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { authStorage } from '@/src/lib/supabase/auth-storage';
import { supabase } from '@/src/lib/supabase/client';

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

export type PasskeyErrorCode =
  | 'PASSKEY_EXPO_GO'
  | 'PASSKEY_NATIVE_MODULE_MISSING'
  | 'PASSKEY_UNSUPPORTED'
  | 'PASSKEY_NOT_REGISTERED'
  | 'PASSKEY_CANCELLED'
  | 'PASSKEY_AUTH_FAILED'
  | 'PASSKEY_DOMAIN_ASSOCIATION_FAILED';

export interface PasskeyAvailability {
  isSupported: boolean;
  code?: PasskeyErrorCode;
  reason?: string;
}

export type PasskeyResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: PasskeyErrorCode; isCancelled?: boolean };

let overrideNativeModule: any = null;

export function setNativePasskeysModule(mod: any) {
  overrideNativeModule = mod;
}

export function isExpoGoEnvironment(): boolean {
  if (Constants.appOwnership === 'expo') return true;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return true;
  return false;
}

function getNativePasskeysModule(): any | null {
  if (overrideNativeModule) return overrideNativeModule;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-passkeys');
    if (mod && (typeof mod.isSupported === 'function' || typeof mod.create === 'function' || typeof mod.default?.isSupported === 'function')) {
      return mod.default || mod;
    }
  } catch {
    // Native module not present in current binary (e.g. Expo Go)
  }
  return null;
}

export function getPasskeyAvailability(): PasskeyAvailability {
  if (Platform.OS === 'web') {
    const isWebSupported =
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      Boolean(window.navigator?.credentials?.create);
    if (!isWebSupported) {
      return { isSupported: false, code: 'PASSKEY_UNSUPPORTED', reason: 'Passkeys are not supported in this browser.' };
    }
    return { isSupported: true };
  }

  if (isExpoGoEnvironment()) {
    return { isSupported: false, code: 'PASSKEY_EXPO_GO', reason: 'Passkeys require a standalone build or development client.' };
  }

  const nativeMod = getNativePasskeysModule();
  if (!nativeMod) {
    return { isSupported: false, code: 'PASSKEY_NATIVE_MODULE_MISSING', reason: 'Passkeys require the Card Nest app version that supports passkeys.' };
  }

  try {
    const supported = Boolean(nativeMod.isSupported());
    if (!supported) {
      return { isSupported: false, code: 'PASSKEY_UNSUPPORTED', reason: 'Passkeys are not supported on this device.' };
    }
    return { isSupported: true };
  } catch (err: any) {
    return { isSupported: false, code: 'PASSKEY_UNSUPPORTED', reason: err?.message || 'Passkey support check failed.' };
  }
}

export function isPasskeySupported(): boolean {
  return getPasskeyAvailability().isSupported;
}

export async function verifyDomainAssociation(): Promise<{ isValid: boolean; details?: string }> {
  try {
    const res = await fetch('https://cardnest.ytosko.dev/.well-known/assetlinks.json', { method: 'GET' });
    if (!res.ok) {
      return { isValid: false, details: `Assetlinks HTTP ${res.status}` };
    }
    const data = await res.json();
    const hasPackage = Array.isArray(data) && data.some((item: any) => item?.target?.package_name === 'dev.ytosko.cardnest');
    return { isValid: hasPackage, details: hasPackage ? 'Valid domain association' : 'Missing package dev.ytosko.cardnest' };
  } catch (err: any) {
    return { isValid: false, details: err?.message || 'Domain association network check failed' };
  }
}

function isUserCancellation(err: any): boolean {
  const message = (err?.message || err?.name || String(err || '')).toLowerCase();
  return (
    message.includes('cancel') ||
    message.includes('abort') ||
    message.includes('notallowederror') ||
    message.includes('user_cancel') ||
    message.includes('dismiss')
  );
}

function isNoCredentialsError(err: any): boolean {
  const message = (err?.message || err?.name || String(err || '')).toLowerCase();
  return (
    message.includes('nocredentials') ||
    message.includes('no credential') ||
    message.includes('not found') ||
    message.includes('nocredentialsexception') ||
    err?.code === 'no_credentials'
  );
}

export async function listUserPasskeys(): Promise<PasskeyResult<UserPasskey[]>> {
  try {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      return { success: false, error: error.message, code: 'PASSKEY_AUTH_FAILED' };
    }
    const passkeys: UserPasskey[] = (data || []).map((item: any) => ({
      id: item.id || item.credential_id || String(Math.random()),
      name: item.friendly_name || item.name || 'Passkey',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      lastUsedAt: item.last_used_at || item.lastUsedAt || null,
    }));
    return { success: true, data: passkeys };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retrieve passkeys', code: 'PASSKEY_AUTH_FAILED' };
  }
}

export async function registerPasskey(friendlyName?: string): Promise<PasskeyResult<UserPasskey>> {
  const availability = getPasskeyAvailability();
  if (!availability.isSupported) {
    return {
      success: false,
      error: availability.reason || 'Passkeys are not supported on this platform.',
      code: availability.code || 'PASSKEY_UNSUPPORTED',
    };
  }

  try {
    if (Platform.OS === 'web') {
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) {
        return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings.", code: 'PASSKEY_AUTH_FAILED' };
      }
      await authStorage.setItem('has_device_passkey', 'true');
      await authStorage.setItem('passkey_setup_prompted', 'true');
      return {
        success: true,
        data: {
          id: (data as any)?.id || 'web-passkey',
          name: friendlyName || 'Card Nest Passkey',
          createdAt: new Date().toISOString(),
        },
      };
    }

    const nativeMod = getNativePasskeysModule();
    if (!nativeMod) {
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.', code: 'PASSKEY_NATIVE_MODULE_MISSING' };
    }

    // Native Mobile Registration (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startRegistration();
    if (startError || !startData) {
      return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings.", code: 'PASSKEY_AUTH_FAILED' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const creationOptions = (startData as any).publicKey || startData;

    let credential: any = null;
    try {
      credential = await nativeMod.create(creationOptions);
    } catch (createErr: any) {
      if (isUserCancellation(createErr)) {
        return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
      }
      return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings.", code: 'PASSKEY_AUTH_FAILED' };
    }

    if (!credential) {
      return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.passkey.verifyRegistration({
      challengeId,
      credential,
    });
    if (verifyError) {
      return { success: false, error: 'Passkey verification failed. Please try again.', code: 'PASSKEY_AUTH_FAILED' };
    }

    await authStorage.setItem('has_device_passkey', 'true');
    await authStorage.setItem('passkey_setup_prompted', 'true');

    return {
      success: true,
      data: {
        id: (verifyData as any)?.id || (credential as any)?.id || 'native-passkey',
        name: friendlyName || 'Card Nest Passkey',
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    if (isUserCancellation(err)) {
      return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }
    return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings.", code: 'PASSKEY_AUTH_FAILED' };
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult<void>> {
  const availability = getPasskeyAvailability();
  if (!availability.isSupported) {
    return {
      success: false,
      error: availability.reason || 'Passkeys are not supported on this device.',
      code: availability.code || 'PASSKEY_UNSUPPORTED',
    };
  }

  try {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        if (isNoCredentialsError(error)) {
          return {
            success: false,
            error: 'No passkey found for this account on this device. Please sign in with Google or Email first.',
            code: 'PASSKEY_NOT_REGISTERED',
          };
        }
        return { success: false, error: error.message || 'Passkey sign-in failed.', code: 'PASSKEY_AUTH_FAILED' };
      }
      return { success: true, data: undefined };
    }

    const nativeMod = getNativePasskeysModule();
    if (!nativeMod) {
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.', code: 'PASSKEY_NATIVE_MODULE_MISSING' };
    }

    // Native Mobile Authentication (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startAuthentication();
    if (startError || !startData) {
      return { success: false, error: startError?.message || 'Failed to initiate passkey sign-in.', code: 'PASSKEY_AUTH_FAILED' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const requestOptions = (startData as any).publicKey || startData;

    let assertion: any = null;
    try {
      assertion = await nativeMod.get(requestOptions);
    } catch (getErr: any) {
      if (isUserCancellation(getErr)) {
        return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
      }
      if (isNoCredentialsError(getErr)) {
        return {
          success: false,
          error: 'No passkey found for this account on this device. Please sign in with Google or Email first, then create a passkey in Security settings.',
          code: 'PASSKEY_NOT_REGISTERED',
        };
      }
      return {
        success: false,
        error: 'Passkey sign-in failed. Please try signing in with Google or Email.',
        code: 'PASSKEY_AUTH_FAILED',
      };
    }

    if (!assertion) {
      return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }

    const { error: verifyError } = await supabase.auth.passkey.verifyAuthentication({
      challengeId,
      credential: assertion,
    });
    if (verifyError) {
      return { success: false, error: verifyError.message || 'Passkey authentication failed.', code: 'PASSKEY_AUTH_FAILED' };
    }

    return { success: true, data: undefined };
  } catch (err: any) {
    if (isUserCancellation(err)) {
      return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }
    if (isNoCredentialsError(err)) {
      return {
        success: false,
        error: 'No passkey found for this account on this device. Please sign in with Google or Email first, then create a passkey in Security settings.',
        code: 'PASSKEY_NOT_REGISTERED',
      };
    }
    return { success: false, error: 'Passkey sign-in failed. Please try signing in with Google or Email.', code: 'PASSKEY_AUTH_FAILED' };
  }
}

export async function renamePasskey(id: string, name: string): Promise<PasskeyResult<void>> {
  try {
    const { error } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName: name });
    if (error) return { success: false, error: error.message, code: 'PASSKEY_AUTH_FAILED' };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to rename passkey.', code: 'PASSKEY_AUTH_FAILED' };
  }
}

export async function deletePasskey(id: string): Promise<PasskeyResult<void>> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (error) return { success: false, error: error.message, code: 'PASSKEY_AUTH_FAILED' };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete passkey.', code: 'PASSKEY_AUTH_FAILED' };
  }
}
