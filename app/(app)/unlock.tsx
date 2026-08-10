import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { useAuth } from '@/src/features/auth/auth-provider';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { signInWithPasskey } from '@/src/features/auth/passkey-service';
import { useSecurity } from '@/src/features/security/security-provider';
import {
  clearDeviceLock,
  verifyPin,
} from '@/src/features/security/security-storage';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AppUnlockScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { session } = useAuth();
  const {
    unlockMethod,
    lockState,
    biometricEnabled,
    pendingDeepLink,
    setPendingDeepLink,
    unlock,
    triggerBiometricUnlock,
    refreshSecurityState,
  } = useSecurity();

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);

  // Forgot PIN re-authentication state
  const [showForgotPinFlow, setShowForgotPinFlow] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);

  const handleSuccessfulUnlock = useCallback(async () => {
    unlock();
    if (pendingDeepLink) {
      const target = pendingDeepLink;
      setPendingDeepLink(null);
      router.replace(target as any);
    } else {
      router.replace('/(app)/home');
    }
  }, [pendingDeepLink, router, setPendingDeepLink, unlock]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (lockoutTimer !== null && lockoutTimer > 0) {
      timer = setTimeout(() => {
        setLockoutTimer((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [lockoutTimer]);

  useEffect(() => {
    if (biometricEnabled && unlockMethod === 'pin' && lockState === 'LOCKED') {
      void (async () => {
        const success = await triggerBiometricUnlock('app_unlock_screen');
        if (success) {
          await handleSuccessfulUnlock();
        }
      })();
    } else if (unlockMethod === 'passkey' && lockState === 'LOCKED') {
      void (async () => {
        setError(null);
        setLoading(true);
        try {
          const res = await signInWithPasskey();
          if (res.success) {
            await handleSuccessfulUnlock();
          } else {
            if (res.isCancelled) return;
            setError(res.error || 'Passkey unlock failed.');
          }
        } catch (err: any) {
          setError(err?.message || 'Passkey unlock failed.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [biometricEnabled, handleSuccessfulUnlock, lockState, triggerBiometricUnlock, unlockMethod]);

  async function attemptPasskeyUnlock() {
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithPasskey();
      if (res.success) {
        await handleSuccessfulUnlock();
      } else {
        if (res.isCancelled) return;
        setError(res.error || 'Passkey unlock failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Passkey unlock failed.');
    } finally {
      setLoading(false);
    }
  }

  async function attemptBiometricUnlock() {
    const success = await triggerBiometricUnlock('user_tap_biometrics');
    if (success) {
      await handleSuccessfulUnlock();
    }
  }

  function handleKeyPress(num: string) {
    if (lockoutTimer !== null && lockoutTimer > 0) return;
    setError(null);
    if (pin.length < 6) {
      const next = pin + num;
      setPin(next);
      if (next.length === 6) {
        void submitPin(next);
      }
    }
  }

  function handleDeleteKey() {
    if (lockoutTimer !== null && lockoutTimer > 0) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  async function submitPin(candidatePin: string) {
    setLoading(true);
    try {
      const res = await verifyPin(candidatePin);
      if (res.success) {
        await handleSuccessfulUnlock();
      } else {
        setError(res.error || 'Incorrect PIN.');
        setPin('');
        if (res.lockoutSeconds) {
          setLockoutTimer(res.lockoutSeconds);
        }
        if (res.requireAccountReauth) {
          setShowForgotPinFlow(true);
        }
      }
    } catch {
      setError('PIN verification failed.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmForgotPinReauth() {
    setReauthError(null);
    if (!reauthPassword) {
      setReauthError('Please enter your account password.');
      return;
    }
    setLoading(true);
    try {
      const userEmail = session?.user?.email;
      if (!userEmail) throw new Error('No active user email found.');

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: reauthPassword,
      });

      if (signInErr) {
        setReauthError('Password incorrect. Please verify your account password.');
        return;
      }

      // Re-authentication successful! Clear old local verifier and force new setup
      await clearDeviceLock();
      await refreshSecurityState();
      setShowForgotPinFlow(false);
      router.replace('/(app)/security-setup');
    } catch (err: any) {
      setReauthError(err?.message || 'Re-authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  if (showForgotPinFlow) {
    return (
      <AuthShell
        title="Verify Your Account"
        subtitle="To reset your local Card Nest PIN, enter your account password."
      >
        <View style={styles.reauthContainer}>
          {reauthError ? <AuthNotice tone="error" message={reauthError} /> : null}

          <AppText style={[styles.reauthDesc, { color: theme.colors.textMuted }]}>
            Your cloud business cards and account data will remain completely safe. Once verified, you can set up a new unlock method for this device.
          </AppText>

          <AppTextField
            label="Account Password"
            value={reauthPassword}
            onChangeText={setReauthPassword}
            secureTextEntry
            placeholder="Enter your password"
          />

          <AppButton
            onPress={() => void handleConfirmForgotPinReauth()}
            loading={loading}
            style={styles.fullWidthBtn}
          >
            Verify & Reset Local Lock
          </AppButton>

          <AppButton
            variant="secondary"
            onPress={() => {
              setShowForgotPinFlow(false);
              setReauthPassword('');
              setReauthError(null);
            }}
            style={styles.fullWidthBtn}
          >
            Cancel
          </AppButton>
        </View>
      </AuthShell>
    );
  }

  if (unlockMethod === 'passkey') {
    return (
      <AuthShell title="Unlock Card Nest" subtitle="Use your passkey to access your business cards.">
        <View style={styles.passkeyContainer}>
          {error ? <AuthNotice tone="error" message={error} /> : null}

          <AppButton
            onPress={() => void attemptPasskeyUnlock()}
            loading={loading}
            style={styles.fullWidthBtn}
          >
            Unlock with Passkey
          </AppButton>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => setShowForgotPinFlow(true)}
          >
            <AppText style={[styles.forgotLinkText, { color: theme.colors.primary }]}>
              Verify your account instead
            </AppText>
          </TouchableOpacity>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Unlock Card Nest" subtitle="Enter your 6-digit Card Nest PIN">
      <View style={styles.pinContainer}>
        {error ? <AuthNotice tone="error" message={error} /> : null}

        {lockoutTimer !== null && lockoutTimer > 0 ? (
          <View style={[styles.lockoutBadge, { backgroundColor: theme.colors.danger + '15' }]}>
            <AppText style={[styles.lockoutText, { color: theme.colors.danger }]}>
              Locked out. Please wait {lockoutTimer}s.
            </AppText>
          </View>
        ) : null}

        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  borderColor: theme.colors.primary,
                  backgroundColor: index < pin.length ? theme.colors.primary : 'transparent',
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.keypadGrid}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'].map((key) => {
            if (key === '') return <View key="empty" style={styles.keypadButtonPlaceholder} />;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.keypadButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  if (key === 'DEL') handleDeleteKey();
                  else handleKeyPress(key);
                }}
                disabled={loading || (lockoutTimer !== null && lockoutTimer > 0)}
              >
                <AppText style={[styles.keypadText, { color: theme.colors.text }]}>
                  {key === 'DEL' ? '⌫' : key}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {biometricEnabled ? (
          <TouchableOpacity
            style={styles.bioButton}
            onPress={() => void attemptBiometricUnlock()}
          >
            <AppText style={[styles.bioButtonText, { color: theme.colors.primary }]}>
              Unlock with Biometrics
            </AppText>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => setShowForgotPinFlow(true)}
        >
          <AppText style={[styles.forgotLinkText, { color: theme.colors.primary }]}>
            Forgot PIN?
          </AppText>
        </TouchableOpacity>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
    rowGap: 16,
  },
  keypadButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  keypadButtonPlaceholder: {
    width: 76,
    height: 76,
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '600',
  },
  passkeyContainer: {
    gap: 20,
    marginTop: 8,
  },
  reauthContainer: {
    gap: 16,
    marginTop: 8,
  },
  reauthDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  fullWidthBtn: {
    width: '100%',
  },
  forgotLink: {
    marginTop: 8,
    padding: 8,
  },
  forgotLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bioButton: {
    marginTop: 4,
    padding: 8,
  },
  bioButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  lockoutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
