import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import {
  getProviderKey,
  getServerCredentialStatus,
  removeServerCredential,
  saveServerCredential,
  type AiProvider,
} from '@/src/features/ai/ai-provider';
import {
  getCachedCatalog,
  getModelCatalog,
  ModelCatalogError,
  pickDefaultModel,
  recordModelValidation,
  testProviderConnection,
  validateModel,
  type AiModelInfo,
} from '@/src/features/ai/model-catalog';
import { useAuth } from '@/src/features/auth/auth-provider';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

function providerLabel(provider: AiProvider) {
  return provider === 'openai' ? 'OpenAI' : 'Google Gemini';
}

export default function AiSettingsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySuffix, setKeySuffix] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [validatingModelId, setValidatingModelId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const maskedKeyDisplay = useMemo(() => {
    if (!hasServerKey && !keySuffix) return null;
    return `••••••••${keySuffix || '••••'}`;
  }, [hasServerKey, keySuffix]);

  const selectedModelMissing = useMemo(
    () => Boolean(selectedModel) && models.length > 0 && !models.some((m) => m.id === selectedModel),
    [models, selectedModel]
  );

  const persistSelection = useCallback(
    async (prov: AiProvider, modelId: string) => {
      if (!user) return;
      const { error: saveError } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        selected_ai_provider: prov,
        selected_ai_model: modelId,
      });
      if (saveError) throw saveError;
    },
    [user]
  );

  /**
   * Loads the model catalog. Never silently replaces an existing user selection —
   * a default is auto-picked only when no model has ever been chosen.
   */
  const loadModels = useCallback(
    async (prov: AiProvider, opts: { apiKey?: string; forceRefresh?: boolean; currentSelection?: string }) => {
      const key = opts.apiKey || (await getProviderKey(prov));
      if (!key) {
        const cached = getCachedCatalog(prov, { allowStale: true });
        if (cached) {
          setModels(cached.models);
          return cached.models;
        }
        setModels([]);
        return [];
      }

      const catalog = await getModelCatalog(prov, key, { forceRefresh: opts.forceRefresh ?? false });
      setModels(catalog.models);

      const current = opts.currentSelection ?? selectedModel;
      if (!current) {
        const suggested = pickDefaultModel(catalog.models);
        if (suggested) {
          setSelectedModel(suggested);
          await persistSelection(prov, suggested).catch(() => undefined);
        }
      }
      return catalog.models;
    },
    [persistSelection, selectedModel]
  );

  // Load saved preferences + credential status when the screen opens or provider changes
  useEffect(() => {
    if (!user) return;
    let active = true;
    setApiKeyInput('');
    setModels([]);
    setModelFilter('');
    setError(null);
    setNotice(null);

    void (async () => {
      const { data: pref } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (!active) return;

      const savedProvider =
        pref?.selected_ai_provider === 'openai' || pref?.selected_ai_provider === 'gemini' ? pref.selected_ai_provider : null;
      const savedModel = savedProvider === provider && pref?.selected_ai_model ? pref.selected_ai_model : '';
      if (savedModel) setSelectedModel(savedModel);
      else setSelectedModel('');

      const status = await getServerCredentialStatus();
      if (!active) return;
      const provStatus = status[provider];
      if (provStatus?.hasKey) {
        setHasServerKey(true);
        setKeySuffix(provStatus.keySuffix);
        await loadModels(provider, { currentSelection: savedModel }).catch(() => undefined);
      } else {
        setHasServerKey(false);
        setKeySuffix(null);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, user]);

  async function handleSaveKey() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const newKey = apiKeyInput.trim();
      if (!newKey) throw new Error(`Paste your ${providerLabel(provider)} API key first.`);

      const { keySuffix: savedSuffix } = await saveServerCredential(provider, newKey);
      setHasServerKey(true);
      setKeySuffix(savedSuffix);
      setApiKeyInput('');

      const available = await loadModels(provider, { apiKey: newKey, forceRefresh: true, currentSelection: selectedModel });
      setNotice(`Connected to ${providerLabel(provider)}. ${available.length} compatible models available.`);
    } catch (reason) {
      setError(
        reason instanceof ModelCatalogError
          ? reason.message
          : reason instanceof Error
            ? reason.message
            : 'Could not save or verify the API key.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTestConnection() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const key = await getProviderKey(provider);
      if (!key) {
        throw new Error('Your key is stored securely for extraction, but testing from this device needs the key here. Paste it above once.');
      }
      const result = await testProviderConnection(provider, key, selectedModel || null);
      if (result.status === 'connected') {
        setNotice(result.message);
        await loadModels(provider, { apiKey: key, currentSelection: selectedModel }).catch(() => undefined);
      } else {
        setError(result.message);
        if (result.status === 'model-unavailable') {
          await loadModels(provider, { apiKey: key, forceRefresh: true, currentSelection: selectedModel }).catch(() => undefined);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connection test failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshModels() {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const available = await loadModels(provider, { forceRefresh: true, currentSelection: selectedModel });
      if (available.length === 0) {
        setError('Model list requires your API key on this device. Paste your key above and connect once.');
      } else if (selectedModel && !available.some((m) => m.id === selectedModel)) {
        setError(`Your selected model (${selectedModel}) is no longer available. Choose another model below.`);
      } else {
        setNotice(`Model list refreshed. ${available.length} compatible models available.`);
      }
    } catch (reason) {
      setError(reason instanceof ModelCatalogError ? reason.message : 'Could not refresh the model list.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelectModel(model: AiModelInfo) {
    if (!user || validatingModelId) return;
    setError(null);
    setNotice(null);

    try {
      // OpenAI candidates get a one-time lightweight capability probe before the
      // selection is persisted; results are cached so probes are never repeated.
      if (model.provider === 'openai' && model.compatibility === 'candidate') {
        const key = await getProviderKey('openai');
        if (key) {
          setValidatingModelId(model.id);
          const result = await validateModel('openai', key, model.id);
          recordModelValidation('openai', model.id, result);
          const cached = getCachedCatalog('openai', { allowStale: true });
          if (cached) setModels(cached.models);
          if (result.status === 'incompatible') {
            setError(`${model.displayName} does not accept card images. Choose a multimodal model.`);
            return;
          }
          if (result.status === 'unavailable') {
            setError(`${model.displayName} is no longer available from OpenAI.`);
            return;
          }
        }
      }

      setSelectedModel(model.id);
      await persistSelection(provider, model.id);
      setNotice(`Model updated to ${model.displayName} (${model.id}).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save model selection.');
    } finally {
      setValidatingModelId(null);
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
      setNotice('API key removed from account and device.');
    } catch {
      setError('Could not remove API key.');
    } finally {
      setBusy(false);
    }
  }

  const filteredModels = useMemo(() => {
    if (!modelFilter.trim()) return models;
    const query = modelFilter.trim().toLowerCase();
    return models.filter((m) => m.id.toLowerCase().includes(query) || m.displayName.toLowerCase().includes(query));
  }, [modelFilter, models]);

  const header = (
    <View style={{ gap: theme.spacing[5] }}>
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
            {providerLabel(provider)} — {hasServerKey ? 'Connected' : 'Key Required'}
          </AppText>
          {hasServerKey && maskedKeyDisplay ? (
            <AppText muted variant="caption">
              API Key: {maskedKeyDisplay} · Model: {selectedModel || 'None selected'}
            </AppText>
          ) : (
            <AppText muted variant="caption">
              Enter your key to enable AI contact extraction
            </AppText>
          )}
        </View>
      </View>

      {/* Provider Switcher */}
      <View style={{ gap: theme.spacing[2] }}>
        <AppText variant="title">Provider</AppText>
        <View style={styles.providers}>
          <ProviderButton active={provider === 'openai'} label="OpenAI" onPress={() => setProvider('openai')} />
          <ProviderButton active={provider === 'gemini'} label="Google Gemini" onPress={() => setProvider('gemini')} />
        </View>
      </View>

      {notice ? <AuthNotice message={notice} tone="success" /> : null}
      {error ? <AuthNotice message={error} /> : null}
      {selectedModelMissing && !error ? (
        <AuthNotice message={`Your selected model (${selectedModel}) is no longer available. Choose another model below.`} />
      ) : null}

      {/* API Key Management */}
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
            <AppText variant="title">{hasServerKey ? 'Manage API Key' : `Connect ${providerLabel(provider)}`}</AppText>
            <AppText muted variant="caption">Encrypted at rest (AES-256-GCM) · Synced to your account</AppText>
          </View>
        </View>

        <AppTextField
          autoCapitalize="none"
          autoCorrect={false}
          icon="key-outline"
          label={hasServerKey ? 'Change API Key' : 'API Key'}
          onChangeText={setApiKeyInput}
          placeholder={hasServerKey ? 'Paste new key to replace' : 'Paste your API key'}
          secureTextEntry
          value={apiKeyInput}
        />

        <View style={{ gap: 10 }}>
          {apiKeyInput.trim() || !hasServerKey ? (
            <AppButton loading={busy} onPress={() => void handleSaveKey()}>
              {hasServerKey ? 'Save New Key & Connect' : 'Connect Provider'}
            </AppButton>
          ) : null}

          {hasServerKey ? (
            <>
              <AppButton disabled={busy || refreshing} loading={busy} onPress={() => void handleTestConnection()} variant="secondary">
                Test Connection
              </AppButton>
              <AppButton disabled={busy || refreshing} loading={refreshing} onPress={() => void handleRefreshModels()} variant="secondary">
                Refresh Models
              </AppButton>
              <AppButton
                disabled={busy || refreshing}
                onPress={() => void handleRemoveKey()}
                textColor={theme.colors.danger}
                style={{ borderColor: theme.colors.danger }}
                variant="secondary">
                Remove API Key
              </AppButton>
            </>
          ) : null}
        </View>
      </View>

      {/* Model list heading + search */}
      {models.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          <View style={{ gap: 2 }}>
            <AppText variant="title">Extraction Model</AppText>
            <AppText muted variant="caption">
              {models.length} compatible models from your {providerLabel(provider)} account. Your selection is used exactly as chosen.
            </AppText>
          </View>

          {models.length > 6 ? (
            <View
              style={[
                styles.filterBox,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              ]}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="magnify" size={20} />
              <TextInput
                accessibilityLabel="Search models"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setModelFilter}
                placeholder="Search models…"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.filterInput, { color: theme.colors.text }]}
                value={modelFilter}
              />
              {modelFilter ? (
                <MaterialCommunityIcons color={theme.colors.textMuted} name="close-circle" onPress={() => setModelFilter('')} size={18} />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'AI extraction settings' }} />
      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[2], padding: theme.spacing[5] }]}
        data={filteredModels}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          models.length > 0 && modelFilter ? (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <AppText muted>No models match &quot;{modelFilter}&quot;</AppText>
            </View>
          ) : null
        }
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: theme.spacing[3] }}
        renderItem={({ item }) => {
          const isSelected = selectedModel === item.id;
          const isValidating = validatingModelId === item.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              disabled={item.compatibility === 'incompatible'}
              onPress={() => void handleSelectModel(item)}
              style={[
                styles.modelItem,
                {
                  backgroundColor: isSelected ? theme.colors.primarySoft : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radii.md,
                  opacity: item.compatibility === 'incompatible' ? 0.45 : 1,
                },
              ]}>
              <MaterialCommunityIcons
                color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                name={isValidating ? 'progress-clock' : isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong" style={{ color: isSelected ? theme.colors.primary : theme.colors.text }}>
                  {item.displayName}
                </AppText>
                <AppText muted variant="caption">
                  {item.id}
                  {item.compatibility === 'incompatible'
                    ? ' · Not compatible with card scanning'
                    : item.capabilityHint
                      ? ` · ${item.capabilityHint}`
                      : ''}
                </AppText>
              </View>
              {item.compatibility === 'compatible' ? (
                <MaterialCommunityIcons color={theme.colors.success} name="check-decagram-outline" size={18} />
              ) : null}
            </Pressable>
          );
        }}
      />
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
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
