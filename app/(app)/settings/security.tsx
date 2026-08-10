import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { PASSKEY_ENABLED } from '@/src/features/auth/auth-flags';
import {
  deletePasskey,
  listUserPasskeys,
  registerPasskey,
  renamePasskey,
  type UserPasskey,
} from '@/src/features/auth/passkey-service';
import { useSecurity } from '@/src/features/security/security-provider';
import {
  hasLocalBiometricHardware,
  setAutoLockTimeout,
  setBiometricEnabled,
  type AutoLockTimeout,
} from '@/src/features/security/security-storage';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SecuritySettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const {
    unlockMethod,
    autoLockTimeout,
    biometricEnabled,
    refreshSecurityState,
  } = useSecurity();

  const [passkeys, setPasskeys] = useState<UserPasskey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [hasBioHardware, setHasBioHardware] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    const res = await listUserPasskeys();
    if (res.success) {
      setPasskeys(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (PASSKEY_ENABLED) void fetchPasskeys();
    else setLoading(false);
    void (async () => {
      setHasBioHardware(await hasLocalBiometricHardware());
    })();
  }, [fetchPasskeys]);

  async function handleAddPasskey() {
    setAdding(true);
    const res = await registerPasskey('Card Nest Account Passkey');
    setAdding(false);
    if (res.success) {
      Alert.alert('Passkey Added', 'New account passkey registered successfully.');
      void fetchPasskeys();
    } else {
      Alert.alert("Passkey couldn't be created", res.error);
    }
  }

  function handleRename(passkey: UserPasskey) {
    Alert.prompt(
      'Rename Passkey',
      'Enter a new friendly name for this passkey:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (newName?: string) => {
            if (!newName?.trim()) return;
            void (async () => {
              const res = await renamePasskey(passkey.id, newName.trim());
              if (res.success) {
                void fetchPasskeys();
              } else {
                Alert.alert('Rename Failed', res.error);
              }
            })();
          },
        },
      ],
      'plain-text',
      passkey.name
    );
  }

  function handleDelete(passkey: UserPasskey) {
    const isLast = passkeys.length === 1;
    const warningMsg = isLast
      ? 'Warning: Deleting your last passkey will require Google or email recovery to sign back in. Are you sure?'
      : 'Are you sure you want to remove this passkey from your Card Nest account?';

    Alert.alert('Remove Passkey', warningMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await deletePasskey(passkey.id);
            if (res.success) {
              void fetchPasskeys();
            } else {
              Alert.alert('Deletion Failed', res.error);
            }
          })();
        },
      },
    ]);
  }

  async function handleAutoLockChange(timeout: AutoLockTimeout) {
    await setAutoLockTimeout(timeout);
    await refreshSecurityState();
  }

  async function handleBiometricToggle(enabled: boolean) {
    await setBiometricEnabled(enabled);
    await refreshSecurityState();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Security & App Lock', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: APP LOCK (THIS DEVICE) */}
        <View style={styles.section}>
          <AppText variant="title">App Lock (This Device)</AppText>
          <AppText muted variant="caption">
            Protect Card Nest when launching or returning to the app on this device.
          </AppText>

          <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <MaterialCommunityIcons
                  name={unlockMethod === 'passkey' ? 'fingerprint' : 'shield-lock'}
                  size={24}
                  color={theme.colors.primary}
                />
                <View>
                  <AppText variant="label">Current Unlock Method</AppText>
                  <AppText muted variant="caption">
                    {unlockMethod === 'passkey'
                      ? 'Passkey (Biometrics / Platform Passkey)'
                      : unlockMethod === 'pin'
                      ? '6-digit Card Nest PIN'
                      : 'Unconfigured'}
                  </AppText>
                </View>
              </View>
            </View>

            <AppButton
              variant="secondary"
              onPress={() => router.push('/(app)/security-setup')}
              style={{ marginTop: 8 }}
            >
              Change Unlock Method / Reset PIN
            </AppButton>
          </View>

          {hasBioHardware ? (
            <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <MaterialCommunityIcons name="face-recognition" size={24} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">Biometric Convenience</AppText>
                    <AppText muted variant="caption">
                      Use fingerprint or face unlock as a convenience fallback for PIN unlock on this device.
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={(val) => void handleBiometricToggle(val)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
            </View>
          ) : null}

          {/* AUTO-LOCK TIMEOUT SELECTOR */}
          <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="label" style={{ marginBottom: 4 }}>Auto-Lock Timing</AppText>
            <AppText muted variant="caption" style={{ marginBottom: 12 }}>
              Automatically lock Card Nest after background inactivity.
            </AppText>

            <View style={styles.timeoutGrid}>
              {(['immediately', '1m', '5m', '15m'] as AutoLockTimeout[]).map((t) => {
                const isSelected = autoLockTimeout === t;
                const labelMap = { immediately: 'Immediately', '1m': '1 min', '5m': '5 min', '15m': '15 min' };
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeoutOption,
                      {
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.primary + '15' : 'transparent',
                      },
                    ]}
                    onPress={() => void handleAutoLockChange(t)}
                  >
                    <AppText
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '700' : '400',
                        color: isSelected ? theme.colors.primary : theme.colors.text,
                      }}
                    >
                      {labelMap[t]}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION 2: ACCOUNT PASSKEYS */}
        {PASSKEY_ENABLED ? (
          <View style={styles.section}>
            <AppText variant="title">Account Sign-In Passkeys</AppText>
            <AppText muted variant="caption">
              Passkeys registered to your Card Nest account across all your devices.
            </AppText>

            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <View style={{ gap: 12 }}>
                {passkeys.length === 0 ? (
                  <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                    <MaterialCommunityIcons name="fingerprint-off" size={32} color={theme.colors.textMuted} />
                    <AppText variant="label">No account passkeys registered</AppText>
                    <AppText muted variant="caption" style={{ textAlign: 'center' }}>
                      Add a passkey to sign in to your Card Nest account without passwords.
                    </AppText>
                  </View>
                ) : (
                  passkeys.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                    >
                      <View style={styles.row}>
                        <View style={styles.rowLeft}>
                          <MaterialCommunityIcons name="fingerprint" size={24} color={theme.colors.primary} />
                          <View>
                            <AppText variant="label">{item.name}</AppText>
                            <AppText muted variant="caption">
                              Created {new Date(item.createdAt).toLocaleDateString()}
                            </AppText>
                          </View>
                        </View>
                        <View style={styles.actions}>
                          <TouchableOpacity style={styles.actionIcon} onPress={() => handleRename(item)}>
                            <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.text} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.actionIcon} onPress={() => handleDelete(item)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                )}

                <AppButton loading={adding} onPress={() => void handleAddPasskey()}>
                  <MaterialCommunityIcons name="plus" size={18} color="#fff" style={{ marginRight: 6 }} />
                  Add Account Passkey
                </AppButton>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 24, paddingBottom: 40 },
  section: { gap: 8 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  actionIcon: { padding: 4 },
  emptyCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, gap: 8, padding: 20 },
  timeoutGrid: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  timeoutOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
