import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
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
  return provider === 'openai' ? 'OpenAI' : 'Gemini';
}

export default function AiSettingsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [providerResolved, setProviderResolved] = useState(false);
  const [keySuffix, setKeySuffix] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [validatingModelId, setValidatingModelId] = useState<string | null>(null);

  // Focused flows
  const [setupKeyInput, setSetupKeyInput] = useState('');
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [keyModalInput, setKeyModalInput] = useState('');
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);

  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const autoSelected = useRef(false);

  const maskedKeyDisplay = useMemo(() => {
    if (!hasServerKey && !keySuffix) return null;
    return `••••••••${keySuffix || '••••'}`;
  }, [hasServerKey, keySuffix]);

  const selectedModelInfo = useMemo(() => models.find((m) => m.id === selectedModel) ?? null, [models, selectedModel]);
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

  /** Loads models; a default is auto-picked only when no model was ever chosen. */
  const loadModels = useCallback(
    async (prov: AiProvider, opts: { apiKey?: string; forceRefresh?: boolean; currentSelection?: string }) => {
      const key = opts.apiKey || (await getProviderKey(prov));
      if (!key) {
        const cached = getCachedCatalog(prov, { allowStale: true });
        setModels(cached?.models ?? []);
        return cached?.models ?? [];
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

  // Opening the screen: resolve the active/connected provider automatically so a
  // configured account shows its connected state immediately — never the setup form.
  useEffect(() => {
    if (!user) return;
    let active = true;

    void (async () => {
      const [{ data: pref }, status] = await Promise.all([
        supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        getServerCredentialStatus(),
      ]);
      if (!active) return;

      const preferred =
        pref?.selected_ai_provider === 'openai' || pref?.selected_ai_provider === 'gemini' ? pref.selected_ai_provider : null;

      let initial: AiProvider = 'openai';
      if (preferred && status[preferred]?.hasKey) initial = preferred;
      else if (status.gemini?.hasKey && !status.openai?.hasKey) initial = 'gemini';
      else if (status.openai?.hasKey) initial = 'openai';
      else if (preferred) initial = preferred;

      autoSelected.current = true;
      setProvider(initial);
      setProviderResolved(true);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  // Load connection + models whenever the (resolved) provider changes.
  useEffect(() => {
    if (!user || !providerResolved) return;
    let active = true;
    setSetupKeyInput('');
    setModels([]);
    setModelFilter('');
    setPickerOpen(false);
    setError(null);
    setNotice(null);

    void (async () => {
      const { data: pref } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      const savedModel =
        pref?.selected_ai_provider === provider && pref?.selected_ai_model ? pref.selected_ai_model : '';
      setSelectedModel(savedModel);

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
  }, [provider, providerResolved, user]);

  const applyNewKey = useCallback(
    async (rawKey: string) => {
      const newKey = rawKey.trim();
      if (!newKey) throw new Error(`Paste your ${providerLabel(provider)} API key first.`);

      const { keySuffix: savedSuffix } = await saveServerCredential(provider, newKey);
      setHasServerKey(true);
      setKeySuffix(savedSuffix);

      const available = await loadModels(provider, { apiKey: newKey, forceRefresh: true, currentSelection: selectedModel });
      if (selectedModel && !available.some((m) => m.id === selectedModel)) {
        setPickerOpen(true);
        setError(`Connected, but your previous model (${selectedModel}) is not available with this key. Choose a model below.`);
      } else {
        setNotice(`Connected to ${providerLabel(provider)}. ${available.length} compatible models available.`);
      }
    },
    [loadModels, provider, selectedModel]
  );

  async function handleConnect() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await applyNewKey(setupKeyInput);
      setSetupKeyInput('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save or verify the API key.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceKey() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await applyNewKey(keyModalInput);
      setKeyModalInput('');
      setKeyModalVisible(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save or verify the API key.');
      setKeyModalVisible(false);
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
        throw new Error('Testing from this device needs the key here. Use Change API key to paste it once.');
      }
      const result = await testProviderConnection(provider, key, selectedModel || null);
      if (result.status === 'connected') {
        setNotice(result.message);
        await loadModels(provider, { apiKey: key, currentSelection: selectedModel }).catch(() => undefined);
      } else {
        setError(result.message);
        if (result.status === 'model-unavailable') {
          setPickerOpen(true);
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
        setError('Refreshing models from this device needs the key here. Use Change API key to paste it once.');
      } else if (selectedModel && !available.some((m) => m.id === selectedModel)) {
        setPickerOpen(true);
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
      setPickerOpen(false);
      setModelFilter('');
      setNotice(`Model updated to ${model.displayName}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save model selection.');
    } finally {
      setValidatingModelId(null);
    }
  }

  async function handleRemoveKey() {
    setRemoveConfirmVisible(false);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeServerCredential(provider);
      setHasServerKey(false);
      setKeySuffix(null);
      setModels([]);
      setPickerOpen(false);
      setNotice(`${providerLabel(provider)} disconnected. Your model choice is kept for when you reconnect.`);
    } catch {
      setError('Could not remove the API key.');
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
      {/* Provider Switcher */}
      <View style={styles.providers}>
        <ProviderButton active={provider === 'gemini'} label="Gemini" onPress={() => setProvider('gemini')} />
        <ProviderButton active={provider === 'openai'} label="OpenAI" onPress={() => setProvider('openai')} />
      </View>

      {notice ? <AuthNotice message={notice} tone="success" /> : null}
      {error ? <AuthNotice message={error} /> : null}
      {selectedModelMissing && !error ? (
        <AuthNotice message={`Your selected model (${selectedModel}) is no longer available. Choose another model below.`} />
      ) : null}

      {hasServerKey ? (
        <View
          style={[
            styles.connectedCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}>
          {/* Card header: provider identity + key actions */}
          <View style={styles.connectedHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText variant="title">{providerLabel(provider)}</AppText>
              <View style={[styles.connectedPill, { backgroundColor: theme.colors.successSoft }]}>
                <View style={[styles.connectedDot, { backgroundColor: theme.colors.success }]} />
                <AppText variant="caption" style={{ color: theme.colors.success, fontWeight: '700' }}>
                  Connected
                </AppText>
              </View>
            </View>

            <Pressable
              accessibilityLabel="Change API key"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                setKeyModalInput('');
                setKeyModalVisible(true);
              }}
              style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="key-change" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Remove API key"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setRemoveConfirmVisible(true)}
              style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={18} />
            </Pressable>
          </View>

          {/* Prominent selected-model row — tap to open the picker */}
          <Pressable
            accessibilityHint="Opens the model picker"
            accessibilityLabel={`Selected model ${selectedModel || 'none'}. Change model`}
            accessibilityRole="button"
            onPress={() => setPickerOpen((open) => !open)}
            style={({ pressed }) => [
              styles.modelRow,
              {
                backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.background,
                borderColor: selectedModelMissing ? theme.colors.warning : theme.colors.borderStrong,
                borderRadius: theme.radii.md,
              },
            ]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="robot-outline" size={22} />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText muted variant="caption">
                Selected model
              </AppText>
              <AppText variant="bodyStrong" style={{ color: theme.colors.primary }}>
                {selectedModelInfo?.displayName ?? selectedModel ?? 'Choose a model'}
              </AppText>
              {selectedModelInfo && selectedModelInfo.displayName !== selectedModel ? (
                <AppText muted variant="caption">
                  {selectedModel}
                </AppText>
              ) : null}
            </View>
            <MaterialCommunityIcons
              color={theme.colors.textMuted}
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={22}
            />
          </Pressable>

          {/* Secondary info + quick actions */}
          <View style={styles.connectedFooter}>
            {maskedKeyDisplay ? (
              <AppText muted variant="caption">
                API key {maskedKeyDisplay}
              </AppText>
            ) : (
              <View />
            )}
            <View style={styles.quickActions}>
              <Pressable
                accessibilityLabel="Test connection"
                accessibilityRole="button"
                disabled={busy || refreshing}
                onPress={() => void handleTestConnection()}
                style={[styles.quickAction, { borderColor: theme.colors.border, opacity: busy ? 0.5 : 1 }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name="connection" size={15} />
                <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  Test
                </AppText>
              </Pressable>
              <Pressable
                accessibilityLabel="Refresh models"
                accessibilityRole="button"
                disabled={busy || refreshing}
                onPress={() => void handleRefreshModels()}
                style={[styles.quickAction, { borderColor: theme.colors.border, opacity: refreshing ? 0.5 : 1 }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name="refresh" size={15} />
                <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  Refresh models
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* Setup form — only for a provider that is not connected */
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
              <AppText variant="title">Connect {providerLabel(provider)}</AppText>
              <AppText muted variant="caption">Encrypted at rest (AES-256-GCM) · Synced to your account</AppText>
            </View>
          </View>

          <AppTextField
            autoCapitalize="none"
            autoCorrect={false}
            icon="key-outline"
            label="API Key"
            onChangeText={setSetupKeyInput}
            placeholder="Paste your API key"
            secureTextEntry
            value={setupKeyInput}
          />

          <AppButton loading={busy} onPress={() => void handleConnect()}>
            Connect {providerLabel(provider)}
          </AppButton>
        </View>
      )}

      {/* Model picker (open state) */}
      {hasServerKey && pickerOpen && models.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          <AppText muted variant="caption">
            {models.length} compatible models from your {providerLabel(provider)} account. Your selection is used exactly as chosen.
          </AppText>
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
      {hasServerKey && pickerOpen && models.length === 0 ? (
        <AuthNotice message="Model list needs your API key on this device. Use Change API key to paste it once." />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'AI extraction settings' }} />

      {/* Change API key modal */}
      <Modal animationType="fade" transparent visible={keyModalVisible}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="key-change" size={30} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Update {providerLabel(provider)} API key
            </AppText>
            <AppText muted variant="caption" style={{ textAlign: 'center' }}>
              The new key replaces your encrypted credential. Your selected model is kept when still available.
            </AppText>
            <View style={{ width: '100%' }}>
              <AppTextField
                autoCapitalize="none"
                autoCorrect={false}
                icon="key-outline"
                label="New API key"
                onChangeText={setKeyModalInput}
                placeholder="Paste your new API key"
                secureTextEntry
                value={keyModalInput}
              />
            </View>
            <View style={{ gap: 8, marginTop: 4, width: '100%' }}>
              <AppButton disabled={!keyModalInput.trim()} loading={busy} onPress={() => void handleReplaceKey()}>
                Save
              </AppButton>
              <AppButton disabled={busy} onPress={() => setKeyModalVisible(false)} variant="secondary">
                Cancel
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove connection confirmation */}
      <Modal animationType="fade" transparent visible={removeConfirmVisible}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={30} />
            <AppText variant="title" style={{ textAlign: 'center' }}>
              Remove {providerLabel(provider)} connection?
            </AppText>
            <AppText muted variant="caption" style={{ textAlign: 'center' }}>
              Card Nest will stop using {providerLabel(provider)} until you connect it again.
            </AppText>
            <View style={{ gap: 8, marginTop: 4, width: '100%' }}>
              <AppButton onPress={() => void handleRemoveKey()} style={{ backgroundColor: theme.colors.danger }}>
                Remove connection
              </AppButton>
              <AppButton onPress={() => setRemoveConfirmVisible(false)} variant="secondary">
                Cancel
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        contentContainerStyle={[styles.content, { gap: theme.spacing[2], padding: theme.spacing[5] }]}
        data={hasServerKey && pickerOpen ? filteredModels : []}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          hasServerKey && pickerOpen && models.length > 0 && modelFilter ? (
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
  connectedCard: { borderWidth: 1, gap: 14, padding: 18 },
  connectedDot: { borderRadius: 999, height: 7, width: 7 },
  connectedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  connectedHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  connectedPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
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
  iconButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 360,
    padding: 24,
    width: '100%',
  },
  modelItem: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modelRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  provider: { alignItems: 'center', borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  providers: { flexDirection: 'row', gap: 12 },
  quickAction: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickActions: { flexDirection: 'row', gap: 8 },
  safeArea: { flex: 1 },
  secureHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
});
