import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import {
  deletePasskey,
  listUserPasskeys,
  registerPasskey,
  renamePasskey,
  type UserPasskey,
} from '@/src/features/auth/passkey-service';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function SecuritySettingsScreen() {
  const theme = useAppTheme();
  const [passkeys, setPasskeys] = useState<UserPasskey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    const res = await listUserPasskeys();
    if (res.success) {
      setPasskeys(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPasskeys();
  }, [fetchPasskeys]);

  async function handleAddPasskey() {
    setAdding(true);
    const res = await registerPasskey('Card Nest Security Passkey');
    setAdding(false);
    if (res.success) {
      Alert.alert('Passkey Added', 'New passkey registered successfully.');
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
      passkey.name,
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Security & Passkeys', headerShown: true }} />
      <View style={styles.header}>
        <AppText variant="title">Passkeys</AppText>
        <AppText muted variant="caption">
          Sign in quickly with fingerprint, face unlock, device PIN, or hardware key.
        </AppText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={passkeys}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons name="fingerprint-off" size={36} color={theme.colors.textMuted} />
              <AppText variant="label">No passkeys registered</AppText>
              <AppText muted variant="caption" style={{ textAlign: 'center' }}>
                Add a passkey to enable fast, passwordless biometric sign-in on your devices.
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.passkeyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <View style={styles.passkeyLeft}>
                <MaterialCommunityIcons name="fingerprint" size={28} color={theme.colors.primary} />
                <View>
                  <AppText variant="label">{item.name}</AppText>
                  <AppText muted variant="caption">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </AppText>
                  {item.lastUsedAt ? (
                    <AppText muted variant="caption">
                      Last used {new Date(item.lastUsedAt).toLocaleDateString()}
                    </AppText>
                  ) : null}
                </View>
              </View>
              <View style={styles.passkeyActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRename(item)}>
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <AppButton loading={adding} onPress={() => void handleAddPasskey()}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" style={{ marginRight: 6 }} />
          Add passkey
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionBtn: { padding: 6 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  container: { flex: 1, padding: 16 },
  emptyCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, gap: 8, padding: 24 },
  footer: { marginTop: 12, width: '100%' },
  header: { gap: 4, marginBottom: 16 },
  listContent: { gap: 12, paddingBottom: 24 },
  passkeyActions: { flexDirection: 'row', gap: 4 },
  passkeyCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  passkeyLeft: { alignItems: 'center', flexDirection: 'row', gap: 12 },
});
