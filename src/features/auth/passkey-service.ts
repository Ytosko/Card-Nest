import { Platform } from 'react-native';
import * as PasskeyNative from 'react-native-passkeys';

import { supabase } from '@/src/lib/supabase/client';

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

export type PasskeyResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function isPasskeySupported(): boolean {
  if (Platform.OS === 'web') {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      Boolean(window.navigator?.credentials?.create)
    );
  }
  try {
    return PasskeyNative.isSupported();
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

    // Native Mobile Registration (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startRegistration();
    if (startError || !startData) {
      return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const creationOptions = (startData as any).publicKey || startData;

    // Pass creation options to native authenticator
    const credential = await PasskeyNative.create(creationOptions as any);
    if (!credential) {
      return { success: false, error: 'Passkey registration was cancelled.' };
    }

    // Verify registration response with Supabase Auth
    const { data: verifyData, error: verifyError } = await supabase.auth.passkey.verifyRegistration({
      challengeId,
      credential: credential as any,
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
    const message = err?.message || '';
    if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('abort')) {
      return { success: false, error: 'Passkey registration was cancelled.' };
    }
    return { success: false, error: "Passkey couldn't be created. You can try again or set it up later from Security settings." };
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult<void>> {
  try {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        return { success: false, error: error.message || 'Passkey sign-in failed.' };
      }
      return { success: true, data: undefined };
    }

    // Native Mobile Authentication (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startAuthentication();
    if (startError || !startData) {
      return { success: false, error: startError?.message || 'Failed to initiate passkey sign-in.' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const requestOptions = (startData as any).publicKey || startData;

    const assertion = await PasskeyNative.get(requestOptions as any);
    if (!assertion) {
      return { success: false, error: 'Passkey sign-in was cancelled.' };
    }

    const { error: verifyError } = await supabase.auth.passkey.verifyAuthentication({
      challengeId,
      credential: assertion as any,
    });
    if (verifyError) {
      return { success: false, error: verifyError.message || 'Passkey authentication failed.' };
    }

    return { success: true, data: undefined };
  } catch (err: any) {
    const message = err?.message || '';
    if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('abort')) {
      return { success: false, error: 'Passkey sign-in was cancelled.' };
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
