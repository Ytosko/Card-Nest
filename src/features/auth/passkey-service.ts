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

export interface PasskeyDiagnosticEvent {
  stage:
    | 'registration_start_requested'
    | 'registration_options_received'
    | 'native_create_started'
    | 'native_create_succeeded'
    | 'native_create_failed'
    | 'registration_verify_started'
    | 'registration_verify_succeeded'
    | 'registration_verify_failed'
    | 'authentication_start_requested'
    | 'authentication_options_received'
    | 'native_get_started'
    | 'native_get_succeeded'
    | 'native_get_failed'
    | 'authentication_verify_started'
    | 'authentication_verify_succeeded'
    | 'authentication_verify_failed';
  platform: string;
  apiLevel?: number | string;
  packageName: string;
  rpId: string;
  origin: string;
  hasOptions?: boolean;
  hasCredential?: boolean;
  errorName?: string;
  errorCode?: string;
  errorMessage?: string;
  errorClass?: string;
  rawErrorString?: string;
}

export function logPasskeyDiagnostic(
  stage: PasskeyDiagnosticEvent['stage'],
  extra?: Partial<PasskeyDiagnosticEvent> & { err?: any }
) {
  const event: PasskeyDiagnosticEvent = {
    stage,
    platform: Platform.OS,
    apiLevel: Platform.OS === 'android' ? Platform.Version : undefined,
    packageName: 'dev.ytosko.cardnest',
    rpId: 'cardnest.ytosko.dev',
    origin: 'https://cardnest.ytosko.dev',
    hasOptions: extra?.hasOptions,
    hasCredential: extra?.hasCredential,
    errorName: extra?.err?.name || extra?.errorName,
    errorCode: extra?.err?.code || extra?.errorCode,
    errorMessage: extra?.err?.message || extra?.errorMessage,
    errorClass: extra?.err?.constructor?.name || extra?.errorClass,
    rawErrorString: extra?.err ? String(extra.err) : undefined,
  };
  console.log('[CardNest Passkey Diagnostic]', JSON.stringify(event, null, 2));
}

export async function registerPasskey(friendlyName?: string): Promise<PasskeyResult<UserPasskey>> {
  logPasskeyDiagnostic('registration_start_requested');
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
      if (!isPasskeySupported()) {
        return { success: false, error: 'Passkeys are not supported on this browser.' };
      }
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) {
        logPasskeyDiagnostic('registration_verify_failed', { err: error });
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
      logPasskeyDiagnostic('native_create_failed', { errorMessage: 'Native module missing' });
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.', code: 'PASSKEY_NATIVE_MODULE_MISSING' };
    }

    // Native Mobile Registration (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startRegistration();
    const defaultFailMessage = "Passkey couldn't be created. Please try again or use your Card Nest PIN.";
    if (startError || !startData) {
      logPasskeyDiagnostic('native_create_failed', { err: startError || 'Missing start registration payload' });
      return { success: false, error: defaultFailMessage, code: 'PASSKEY_AUTH_FAILED' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const creationOptions = (startData as any).publicKey || startData;
    logPasskeyDiagnostic('registration_options_received', { hasOptions: Boolean(creationOptions) });

    let credential: any = null;
    logPasskeyDiagnostic('native_create_started');
    try {
      credential = await nativeMod.create(creationOptions);
      logPasskeyDiagnostic('native_create_succeeded', { hasCredential: Boolean(credential) });
    } catch (createErr: any) {
      logPasskeyDiagnostic('native_create_failed', { err: createErr });
      if (isUserCancellation(createErr)) {
        return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
      }
      return { success: false, error: defaultFailMessage, code: 'PASSKEY_AUTH_FAILED' };
    }

    if (!credential) {
      logPasskeyDiagnostic('native_create_failed', { errorMessage: 'No credential object returned' });
      return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }

    logPasskeyDiagnostic('registration_verify_started');
    const { data: verifyData, error: verifyError } = await supabase.auth.passkey.verifyRegistration({
      challengeId,
      credential,
    });
    if (verifyError) {
      logPasskeyDiagnostic('registration_verify_failed', { err: verifyError });
      return { success: false, error: defaultFailMessage, code: 'PASSKEY_AUTH_FAILED' };
    }

    logPasskeyDiagnostic('registration_verify_succeeded');
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
    logPasskeyDiagnostic('native_create_failed', { err });
    if (isUserCancellation(err)) {
      return { success: false, error: 'Passkey registration was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }
    return { success: false, error: "Passkey couldn't be created. Please try again or use your Card Nest PIN.", code: 'PASSKEY_AUTH_FAILED' };
  }
}

export async function signInWithPasskey(): Promise<PasskeyResult<void>> {
  logPasskeyDiagnostic('authentication_start_requested');
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
      if (!isPasskeySupported()) {
        return { success: false, error: 'Passkeys are not supported on this browser.' };
      }
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        if (isNoCredentialsError(error)) {
          await authStorage.removeItem('has_device_passkey');
          return {
            success: false,
            error: 'No passkey found on this device. Sign in with Google or email, then add a passkey from Security.',
            code: 'PASSKEY_NOT_REGISTERED',
          };
        }
        return { success: false, error: error.message || 'Passkey sign-in failed.', code: 'PASSKEY_AUTH_FAILED' };
      }
      return { success: true, data: undefined };
    }

    const nativeMod = getNativePasskeysModule();
    if (!nativeMod) {
      logPasskeyDiagnostic('native_get_failed', { errorMessage: 'Native module missing' });
      return { success: false, error: 'Passkeys require the Card Nest app version that supports passkeys.', code: 'PASSKEY_NATIVE_MODULE_MISSING' };
    }

    // Native Mobile Authentication (Android Credential Manager / iOS ASAuthorizationController)
    const { data: startData, error: startError } = await supabase.auth.passkey.startAuthentication();
    if (startError || !startData) {
      logPasskeyDiagnostic('native_get_failed', { err: startError || 'Missing start authentication payload' });
      return { success: false, error: startError?.message || 'Failed to initiate passkey sign-in.', code: 'PASSKEY_AUTH_FAILED' };
    }

    const challengeId = (startData as any).challengeId || (startData as any).id || '';
    const requestOptions = (startData as any).publicKey || startData;
    logPasskeyDiagnostic('authentication_options_received', { hasOptions: Boolean(requestOptions) });

    let assertion: any = null;
    logPasskeyDiagnostic('native_get_started');
    try {
      assertion = await nativeMod.get(requestOptions);
      logPasskeyDiagnostic('native_get_succeeded', { hasCredential: Boolean(assertion) });
    } catch (getErr: any) {
      logPasskeyDiagnostic('native_get_failed', { err: getErr });
      if (isUserCancellation(getErr)) {
        return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
      }
      if (isNoCredentialsError(getErr)) {
        await authStorage.removeItem('has_device_passkey');
        return {
          success: false,
          error: 'No passkey found on this device. Sign in with Google or email, then add a passkey from Security.',
          code: 'PASSKEY_NOT_REGISTERED',
        };
      }
      const detailedMessage = getErr?.message ? `Passkey sign-in failed (${getErr.message}). Please try signing in with Google or Email.` : 'Passkey sign-in failed. Please try signing in with Google or Email.';
      return {
        success: false,
        error: detailedMessage,
        code: 'PASSKEY_AUTH_FAILED',
      };
    }

    if (!assertion) {
      logPasskeyDiagnostic('native_get_failed', { errorMessage: 'No assertion returned' });
      return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }

    logPasskeyDiagnostic('authentication_verify_started');
    const { error: verifyError } = await supabase.auth.passkey.verifyAuthentication({
      challengeId,
      credential: assertion,
    });
    if (verifyError) {
      logPasskeyDiagnostic('authentication_verify_failed', { err: verifyError });
      return { success: false, error: verifyError.message || 'Passkey authentication failed.', code: 'PASSKEY_AUTH_FAILED' };
    }

    logPasskeyDiagnostic('authentication_verify_succeeded');
    return { success: true, data: undefined };
  } catch (err: any) {
    logPasskeyDiagnostic('native_get_failed', { err });
    if (isUserCancellation(err)) {
      return { success: false, error: 'Passkey sign-in was cancelled.', code: 'PASSKEY_CANCELLED', isCancelled: true };
    }
    if (isNoCredentialsError(err)) {
      await authStorage.removeItem('has_device_passkey');
      return {
        success: false,
        error: 'No passkey found on this device. Sign in with Google or email, then add a passkey from Security.',
        code: 'PASSKEY_NOT_REGISTERED',
      };
    }
    const detailedMessage = err?.message ? `Passkey sign-in failed (${err.message}). Please try signing in with Google or Email.` : 'Passkey sign-in failed. Please try signing in with Google or Email.';
    return { success: false, error: detailedMessage, code: 'PASSKEY_AUTH_FAILED' };
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
