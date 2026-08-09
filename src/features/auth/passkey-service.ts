import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase/client';

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

export type PasskeyResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; isCancelled?: boolean };

let overrideNativeModule: any = null;

export function setNativePasskeysModule(mod: any) {
  overrideNativeModule = mod;
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

export function isPasskeySupported(): boolean {
  if (Platform.OS === 'web') {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      Boolean(window.navigator?.credentials?.create)
    );
  }

  const nativeMod = getNativePasskeysModule();
  if (!nativeMod) return false;

  try {
    return Boolean(nativeMod.isSupported());
  } catch {
    return false;
  }
}

export async function listUserPasskeys(): Promise<PasskeyResult<UserPasskey[]>> {
  try {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      return { success: false, error: error.message, code: error.code };
    }
    const passkeys: UserPasskey[] = (data || []).map((item: any) => ({
      id: item.id || item.credential_id || String(Math.random()),
      name: item.friendly_name || item.name || 'Passkey',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      lastUsedAt: item.last_used_at || item.lastUsedAt || null,
    }));
    return { success: true, data: passkeys };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retrieve passkeys' };
  }
}

export async function registerPasskey(friendlyName?: string): Promise<PasskeyResult<UserPasskey>> {
  try {
    if (Platform.OS === 'web') {
      if (!isPasskeySupported()) {
        return { success: false, error: 'Passkeys are not supported on this browser.' };
      }
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) {
        return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
      }
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
    if (!nativeMod || !isPasskeySupported()) {
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.' };
    }

    // Native Mobile Registration (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startRegistration();
    if (startError || !startData) {
      return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const creationOptions = (startData as any).publicKey || startData;

    let credential: any = null;
    try {
      credential = await nativeMod.create(creationOptions);
    } catch (createErr: any) {
      if (isUserCancellation(createErr)) {
        return { success: false, error: 'Passkey registration was cancelled.', isCancelled: true };
      }
      return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
    }

    if (!credential) {
      return { success: false, error: 'Passkey registration was cancelled.', isCancelled: true };
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.passkey.verifyRegistration({
      challengeId,
      credential,
    });
    if (verifyError) {
      return { success: false, error: 'Passkey verification failed. Please try again.' };
    }

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
      return { success: false, error: 'Passkey registration was cancelled.', isCancelled: true };
    }
    return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult<void>> {
  try {
    if (Platform.OS === 'web') {
      if (!isPasskeySupported()) {
        return { success: false, error: 'Passkeys are not supported on this browser.' };
      }
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        return { success: false, error: error.message || 'Passkey sign-in failed.' };
      }
      return { success: true, data: undefined };
    }

    const nativeMod = getNativePasskeysModule();
    if (!nativeMod || !isPasskeySupported()) {
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.' };
    }

    // Native Mobile Authentication (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startAuthentication();
    if (startError || !startData) {
      return { success: false, error: startError?.message || 'Failed to initiate passkey sign-in.' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const requestOptions = (startData as any).publicKey || startData;

    let assertion: any = null;
    try {
      assertion = await nativeMod.get(requestOptions);
    } catch (getErr: any) {
      if (isUserCancellation(getErr)) {
        return { success: false, error: 'Passkey sign-in was cancelled.', isCancelled: true };
      }
      return { success: false, error: 'Passkey sign-in failed. Please try signing in with Google or Email.' };
    }

    if (!assertion) {
      return { success: false, error: 'Passkey sign-in was cancelled.', isCancelled: true };
    }

    const { error: verifyError } = await supabase.auth.passkey.verifyAuthentication({
      challengeId,
      credential: assertion,
    });
    if (verifyError) {
      return { success: false, error: verifyError.message || 'Passkey authentication failed.' };
    }

    return { success: true, data: undefined };
  } catch (err: any) {
    if (isUserCancellation(err)) {
      return { success: false, error: 'Passkey sign-in was cancelled.', isCancelled: true };
    }
    return { success: false, error: 'Passkey sign-in failed. Please try signing in with Google or Email.' };
  }
}

export async function renamePasskey(id: string, name: string): Promise<PasskeyResult<void>> {
  try {
    const { error } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName: name });
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to rename passkey.' };
  }
}

export async function deletePasskey(id: string): Promise<PasskeyResult<void>> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete passkey.' };
  }
}
