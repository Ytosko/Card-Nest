import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { PASSKEY_ENABLED } from '@/src/features/auth/auth-flags';
import { registerPasskey } from '@/src/features/auth/passkey-service';
import { useSecurity } from '@/src/features/security/security-provider';
import {
  hasLocalBiometricHardware,
  savePin,
  setBiometricEnabled,
  setUnlockMethod,
} from '@/src/features/security/security-storage';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SecuritySetupScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { unlock, refreshSecurityState } = useSecurity();

  const [mode, setMode] = useState<'choose' | 'pin'>('choose');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBiometricOffer, setShowBiometricOffer] = useState(false);

  async function handleSelectPasskey() {
    setError(null);
    setLoading(true);
    try {
      const res = await registerPasskey();
      if (res.success) {
        await setUnlockMethod('passkey');
        await refreshSecurityState();
        unlock();
        router.replace('/(app)/home');
      } else {
        if (res.isCancelled) return;
        setError(
          res.error ||
            'Passkey registration failed on this device. Please create a 6-digit Card Nest PIN below.'
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Passkey setup failed. Please create a Card Nest PIN.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(num: string) {
    setError(null);
    if (pinStep === 'enter') {
      if (pin.length < 6) {
        const next = pin + num;
        setPin(next);
        if (next.length === 6) {
          setTimeout(() => setPinStep('confirm'), 200);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const next = confirmPin + num;
        setConfirmPin(next);
        if (next.length === 6) {
          if (next === pin) {
            void finalizePinSetup(next);
          } else {
            setError('PINs do not match. Please re-enter your PIN.');
            setConfirmPin('');
          }
        }
      }
    }
  }

  function handleDeleteKey() {
    setError(null);
    if (pinStep === 'enter') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  }

  async function finalizePinSetup(validPin: string) {
    setLoading(true);
    try {
      await savePin(validPin);
      await refreshSecurityState();

      const hasBio = await hasLocalBiometricHardware();
      if (hasBio) {
        setShowBiometricOffer(true);
      } else {
        unlock();
        router.replace('/(app)/home');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save PIN.');
      setPin('');
      setConfirmPin('');
      setPinStep('enter');
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricResponse(enable: boolean) {
    await setBiometricEnabled(enable);
    await refreshSecurityState();
    unlock();
    router.replace('/(app)/home');
  }

  if (showBiometricOffer) {
    return (
      <AuthShell title="Biometric Convenience" subtitle="Unlock Card Nest using Fingerprint or Face ID">
        <View style={styles.biometricContainer}>
          <AppText style={styles.biometricDescription}>
            Would you like to enable fingerprint or face unlock for fast access on this device? Your 6-digit PIN will remain active as a fallback.
          </AppText>

          <AppButton
            onPress={() => void handleBiometricResponse(true)}
            style={styles.actionBtn}
          >
            Enable Biometric Unlock
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={() => void handleBiometricResponse(false)}
            style={styles.actionBtn}
          >
            No Thanks, PIN Only
          </AppButton>
        </View>
      </AuthShell>
    );
  }

  if (mode === 'pin') {
    const currentPinLength = pinStep === 'enter' ? pin.length : confirmPin.length;

    return (
      <AuthShell
        title={pinStep === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
        subtitle={
          pinStep === 'enter'
            ? 'Enter a 6-digit PIN used to unlock Card Nest on this device.'
            : 'Re-enter your 6-digit PIN to confirm.'
        }
      >
        <View style={styles.pinContainer}>
          {error ? <AuthNotice tone="error" message={error} /> : null}

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: index < currentPinLength ? theme.colors.primary : 'transparent',
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
                  disabled={loading}
                >
                  <AppText style={[styles.keypadText, { color: theme.colors.text }]}>
                    {key === 'DEL' ? '⌫' : key}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppButton
            variant="secondary"
            onPress={() => {
              setMode('choose');
              setPin('');
              setConfirmPin('');
              setPinStep('enter');
              setError(null);
            }}
            style={styles.backBtn}
          >
            Back to Security Options
          </AppButton>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Protect Card Nest"
      subtitle="Choose how you'd like to unlock Card Nest on this device."
    >
      <View style={styles.optionsContainer}>
        {error ? <AuthNotice tone="error" message={error} /> : null}

        {PASSKEY_ENABLED ? (
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => void handleSelectPasskey()}
            disabled={loading}
          >
            <View style={styles.optionHeader}>
              <AppText style={[styles.optionTitle, { color: theme.colors.text }]}>Use Passkey</AppText>
              <View style={[styles.badge, { backgroundColor: theme.colors.primary + '20' }]}>
                <AppText style={[styles.badgeText, { color: theme.colors.primary }]}>Recommended</AppText>
              </View>
            </View>
            <AppText style={[styles.optionDesc, { color: theme.colors.textMuted }]}>
              Use fingerprint, face unlock, device PIN, or platform passkey.
            </AppText>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => {
            setError(null);
            setMode('pin');
          }}
          disabled={loading}
        >
          <View style={styles.optionHeader}>
            <AppText style={[styles.optionTitle, { color: theme.colors.text }]}>Create Card Nest PIN</AppText>
          </View>
          <AppText style={[styles.optionDesc, { color: theme.colors.textMuted }]}>
            Create a 6-digit PIN used only to unlock Card Nest on this device.
          </AppText>
        </TouchableOpacity>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  optionsContainer: {
    gap: 16,
    marginTop: 8,
  },
  optionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinContainer: {
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
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
  backBtn: {
    marginTop: 8,
    width: '100%',
  },
  biometricContainer: {
    gap: 20,
    marginTop: 8,
  },
  biometricDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionBtn: {
    width: '100%',
  },
});
