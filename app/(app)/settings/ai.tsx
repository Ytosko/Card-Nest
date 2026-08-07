import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { fetchProviderModels, getProviderKey, removeProviderKey, setProviderKey, type AiProvider } from '@/src/features/ai/ai-provider';
import { useAuth } from '@/src/features/auth/auth-provider';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function AiSettingsScreen() {
  const theme = useAppTheme(); const { user } = useAuth();
  const [provider, setProvider] = useState<AiProvider>('openai'); const [apiKey, setApiKey] = useState(''); const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<string[]>([]); const [model, setModel] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (!user) return; void supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => { if (data?.selected_ai_provider === 'openai' || data?.selected_ai_provider === 'gemini') setProvider(data.selected_ai_provider); if (data?.selected_ai_model) setModel(data.selected_ai_model); }); }, [user]);
  useEffect(() => { setApiKey(''); setModels([]); setError(null); setNotice(null); void getProviderKey(provider).then((value) => setHasKey(Boolean(value))); }, [provider]);

  async function connect() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const key = apiKey.trim() || await getProviderKey(provider); if (!key) throw new Error('Enter your provider API key.');
      const available = await fetchProviderModels(provider, key); if (!available.length) throw new Error('No compatible vision models were available for this key.');
      if (apiKey.trim()) await setProviderKey(provider, apiKey.trim());
      setHasKey(true); setApiKey(''); setModels(available); if (!model || !available.includes(model)) setModel(available[0]); setNotice(`Connected. ${available.length} compatible models are available.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The provider could not be connected.'); }
    finally { setBusy(false); }
  }

  async function saveModel(selected: string) { if (!user) return; setModel(selected); const { error: saveError } = await supabase.from('user_preferences').upsert({ user_id: user.id, selected_ai_provider: provider, selected_ai_model: selected }); if (saveError) setError('The model preference could not be saved.'); else setNotice('AI extraction preference saved.'); }
  async function removeKey() { await removeProviderKey(provider); setHasKey(false); setApiKey(''); setModels([]); setNotice('The API key was removed from this device.'); }

  return <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}><Stack.Screen options={{ headerShown: true, title: 'AI extraction' }} /><ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]} keyboardShouldPersistTaps="handled"><View style={{ gap: theme.spacing[2] }}><AppText variant="title">Choose your provider</AppText><AppText muted>Your key is sent only to the provider you choose and stored only in encrypted device storage. Card Nest never uploads it to Supabase.</AppText></View><View style={styles.providers}><ProviderButton active={provider === 'openai'} label="OpenAI" onPress={() => setProvider('openai')} /><ProviderButton active={provider === 'gemini'} label="Gemini" onPress={() => setProvider('gemini')} /></View>{notice ? <AuthNotice message={notice} tone="success" /> : null}{error ? <AuthNotice message={error} /> : null}<View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] }]}><View style={styles.secure}><MaterialCommunityIcons color={theme.colors.success} name="shield-key-outline" size={24} /><View style={styles.copy}><AppText variant="bodyStrong">{hasKey ? 'A key is stored on this device' : `Connect ${provider === 'openai' ? 'OpenAI' : 'Gemini'}`}</AppText><AppText muted variant="caption">SecureStore · never synchronized</AppText></View></View><AppTextField autoCapitalize="none" autoCorrect={false} icon="key-outline" label={hasKey ? 'Replace API key' : 'API key'} onChangeText={setApiKey} placeholder={hasKey ? 'Leave empty to test the saved key' : 'Paste your key'} secureTextEntry value={apiKey} /><AppButton loading={busy} onPress={() => void connect()}>{hasKey ? 'Test key and refresh models' : 'Connect and find models'}</AppButton>{hasKey ? <AppButton disabled={busy} onPress={() => void removeKey()} variant="secondary">Remove key from device</AppButton> : null}</View>{models.length ? <View style={{ gap: theme.spacing[3] }}><AppText variant="title">Extraction model</AppText><AppText muted variant="caption">Models are fetched live from your provider account.</AppText><View style={[styles.modelList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>{models.slice(0, 30).map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: model === item }} key={item} onPress={() => void saveModel(item)} style={[styles.model, { borderBottomColor: theme.colors.border }]}><MaterialCommunityIcons color={model === item ? theme.colors.primary : theme.colors.textMuted} name={model === item ? 'radiobox-marked' : 'radiobox-blank'} size={21} /><AppText style={styles.copy} variant="bodyStrong">{item}</AppText></Pressable>)}</View></View> : null}</ScrollView></SafeAreaView>;
}

function ProviderButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { const theme = useAppTheme(); return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.provider, { backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface, borderColor: active ? theme.colors.primary : theme.colors.borderStrong, borderRadius: theme.radii.md }]}><AppText variant="label" style={{ color: active ? theme.colors.primary : theme.colors.text }}>{label}</AppText></Pressable>; }
const styles = StyleSheet.create({ card: { borderWidth: 1 }, content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' }, copy: { flex: 1 }, model: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 16 }, modelList: { borderWidth: 1, maxHeight: 480, overflow: 'hidden' }, provider: { alignItems: 'center', borderWidth: 1, flex: 1, minHeight: 52, justifyContent: 'center' }, providers: { flexDirection: 'row', gap: 12 }, safeArea: { flex: 1 }, secure: { alignItems: 'center', flexDirection: 'row', gap: 12 } });
