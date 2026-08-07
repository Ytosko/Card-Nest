import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import {
  fetchProviderModels,
  getServerCredentialStatus,
  removeServerCredential,
  saveServerCredential,
  type AiProvider,
} from '@/src/features/ai/ai-provider';
import { useAuth } from '@/src/features/auth/auth-provider';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AiSettingsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySuffix, setKeySuffix] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Masked key display e.g. ••••••••3f9a
  const maskedKeyDisplay = useMemo(() => {
    if (!hasServerKey && !keySuffix) return null;
    const suffix = keySuffix || '••••';
    return `••••••••${suffix}`;
  }, [hasServerKey, keySuffix]);

  // Load user preferences and server credential status from database
  useEffect(() => {
    if (!user) return;
    void supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.selected_ai_provider === 'openai' || data?.selected_ai_provider === 'gemini') {
          setProvider(data.selected_ai_provider);
        }
        if (data?.selected_ai_model) {
          setSelectedModel(data.selected_ai_model);
        }
      });
  }, [user]);

  const testAndFetchModels = useCallback(
    async (prov: AiProvider, apiKeyToTest?: string, verbose = true) => {
      try {
        const available = await fetchProviderModels(prov, apiKeyToTest);
        if (!available.length) throw new Error('No compatible vision models were returned by the provider.');
        setModels(available);

        let modelToSave = selectedModel;
        if (!modelToSave || !available.includes(modelToSave)) {
          modelToSave = available[0];
          setSelectedModel(modelToSave);
        }

        if (user) {
          await supabase.from('user_preferences').upsert({
            user_id: user.id,
            selected_ai_provider: prov,
            selected_ai_model: modelToSave,
          });
        }

        if (verbose) {
          setNotice(`Connected to ${prov === 'openai' ? 'OpenAI' : 'Gemini'}. ${available.length} vision models ready.`);
        }
        return available;
      } catch (reason) {
        if (verbose) {
          setError(reason instanceof Error ? reason.message : 'Connection test failed.');
        }
        return [];
      }
    },
    [selectedModel, user]
  );

  // Refresh credential status whenever provider or user changes
  useEffect(() => {
    setApiKeyInput('');
    setModels([]);
    setError(null);
    setNotice(null);

    void getServerCredentialStatus().then((status) => {
      const provStatus = status[provider];
      if (provStatus?.hasKey) {
        setHasServerKey(true);
        setKeySuffix(provStatus.keySuffix);
        void testAndFetchModels(provider, undefined, false);
      } else {
        setHasServerKey(false);
        setKeySuffix(null);
      }
    });
  }, [provider, testAndFetchModels]);

  async function handleSaveOrTestKey() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const newKey = apiKeyInput.trim();

      if (!newKey && !hasServerKey) {
        throw new Error('Please enter an API key for ' + (provider === 'openai' ? 'OpenAI' : 'Gemini') + '.');
      }

      // Save encrypted key to server database via Edge Function
      if (newKey) {
        const { keySuffix: savedSuffix } = await saveServerCredential(provider, newKey);
        setHasServerKey(true);
        setKeySuffix(savedSuffix);
        setApiKeyInput('');
        await testAndFetchModels(provider, newKey, true);
      } else {
        await testAndFetchModels(provider, undefined, true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save or test key.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectModel(modelName: string) {
    if (!user) return;
    setSelectedModel(modelName);
    setError(null);
    setNotice(null);
    try {
      const { error: saveError } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        selected_ai_provider: provider,
        selected_ai_model: modelName,
      });
      if (saveError) throw saveError;
      setNotice(`Model updated to ${modelName}.`);
    } catch {
      setError('Could not save model selection.');
    }
  }

  async function handleRemoveKey() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeServerCredential(provider);
      setHasServerKey(false);
      setKeySuffix(null);
      setApiKeyInput('');
      setModels([]);
      setNotice(`API key removed from account and device.`);
    } catch {
      setError('Could not remove API key.');
    } finally {
      setBusy(false);
    }
  }

  const filteredModels = useMemo(() => {
    if (!modelFilter.trim()) return models;
    const query = modelFilter.trim().toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(query));
  }, [modelFilter, models]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'AI extraction settings' }} />
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}>
        
        {/* Provider Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: hasServerKey ? theme.colors.primarySoft : theme.colors.surface,
              borderColor: hasServerKey ? theme.colors.primary : theme.colors.border,
            },
          ]}>
          <MaterialCommunityIcons
            color={hasServerKey ? theme.colors.primary : theme.colors.textMuted}
            name={hasServerKey ? 'check-circle' : 'alert-circle-outline'}
            size={24}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">
              {provider === 'openai' ? 'OpenAI' : 'Google Gemini'} — {hasServerKey ? 'Connected' : 'Key Required'}
            </AppText>
            {hasServerKey && maskedKeyDisplay ? (
              <AppText muted variant="caption">
                API Key: {maskedKeyDisplay} · Model: {selectedModel || 'None selected'}
              </AppText>
            ) : (
              <AppText muted variant="caption">
                Enter your key to enable vision contact extraction
              </AppText>
            )}
          </View>
        </View>

        {/* Provider Switcher */}
        <View style={{ gap: theme.spacing[2] }}>
          <AppText variant="title">Select Provider</AppText>
          <View style={styles.providers}>
            <ProviderButton active={provider === 'openai'} label="OpenAI" onPress={() => setProvider('openai')} />
            <ProviderButton active={provider === 'gemini'} label="Google Gemini" onPress={() => setProvider('gemini')} />
          </View>
        </View>

        {notice ? <AuthNotice message={notice} tone="success" /> : null}
        {error ? <AuthNotice message={error} /> : null}

        {/* API Key Management Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
              gap: theme.spacing[4],
              padding: theme.spacing[5],
            },
          ]}>
          <View style={styles.secureHeader}>
            <MaterialCommunityIcons color={theme.colors.primary} name="shield-lock-outline" size={22} />
            <View style={{ flex: 1 }}>
              <AppText variant="title">
                {hasServerKey ? 'Manage API Key' : 'Connect ' + (provider === 'openai' ? 'OpenAI' : 'Gemini')}
              </AppText>
              <AppText muted variant="caption">Encrypted at rest (AES-256-GCM) · Synced to your account</AppText>
            </View>
          </View>

          <AppTextField
            autoCapitalize="none"
            autoCorrect={false}
            icon="key-outline"
            label={hasServerKey ? 'Replace API Key' : 'API Key'}
            onChangeText={setApiKeyInput}
            placeholder={hasServerKey ? 'Paste new key to replace' : 'Paste your API key'}
            secureTextEntry
            value={apiKeyInput}
          />

          <View style={{ gap: 10 }}>
            <AppButton loading={busy} onPress={() => void handleSaveOrTestKey()}>
              {apiKeyInput.trim() ? 'Save Encrypted Key & Connect' : hasServerKey ? 'Test Connection & Refresh Models' : 'Connect Provider'}
            </AppButton>

            {hasServerKey ? (
              <AppButton disabled={busy} onPress={() => void handleRemoveKey()} variant="secondary">
                Remove Key from Account
              </AppButton>
            ) : null}
          </View>
        </View>

        {/* Scrollable Model Selection List */}
        {models.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            <View style={{ gap: 2 }}>
              <AppText variant="title">Select Extraction Model</AppText>
              <AppText muted variant="caption">
                {models.length} vision models available for your {provider === 'openai' ? 'OpenAI' : 'Gemini'} account
              </AppText>
            </View>

            {/* Filter Input */}
            {models.length > 8 ? (
              <View
                style={[
                  styles.filterBox,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}>
                <MaterialCommunityIcons color={theme.colors.textMuted} name="magnify" size={20} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setModelFilter}
                  placeholder="Filter models…"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.filterInput, { color: theme.colors.text }]}
                  value={modelFilter}
                />
                {modelFilter ? (
                  <MaterialCommunityIcons
                    color={theme.colors.textMuted}
                    name="close-circle"
                    onPress={() => setModelFilter('')}
                    size={18}
                  />
                ) : null}
              </View>
            ) : null}

            {/* Scrollable Model Items */}
            <ScrollView
              nestedScrollEnabled={true}
              style={[
                styles.modelScrollContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}>
              {filteredModels.map((item, index) => {
                const isSelected = selectedModel === item;
                const isLast = index === filteredModels.length - 1;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={item}
                    onPress={() => void handleSelectModel(item)}
                    style={[
                      styles.modelItem,
                      {
                        borderBottomColor: isLast ? 'transparent' : theme.colors.border,
                        backgroundColor: isSelected ? theme.colors.primarySoft : 'transparent',
                      },
                    ]}>
                    <MaterialCommunityIcons
                      color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyStrong" style={{ color: isSelected ? theme.colors.primary : theme.colors.text }}>
                        {item}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}

              {filteredModels.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <AppText muted>No models match &quot;{modelFilter}&quot;</AppText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.provider,
        {
          backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.borderStrong,
          borderRadius: theme.radii.md,
        },
      ]}>
      <AppText variant="label" style={{ color: active ? theme.colors.primary : theme.colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 48, width: '100%' },
  filterBox: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  filterInput: { flex: 1, fontSize: 14, minHeight: 40 },
  modelItem: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  modelScrollContainer: {
    borderWidth: 1,
    maxHeight: 320,
  },
  provider: { alignItems: 'center', borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  providers: { flexDirection: 'row', gap: 12 },
  safeArea: { flex: 1 },
  secureHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  statusBanner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
});
