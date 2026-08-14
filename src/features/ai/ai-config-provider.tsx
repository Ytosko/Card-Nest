import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/src/features/auth/auth-provider';
import { getServerCredentialStatus, type AiProvider } from '@/src/features/ai/ai-provider';
import { supabase } from '@/src/lib/supabase/client';

export type AIConfigState = {
  activeProvider: AiProvider;
  geminiConnected: boolean;
  openaiConnected: boolean;
  geminiKeyLast4: string | null;
  openaiKeyLast4: string | null;
  geminiSelectedModel: string;
  openaiSelectedModel: string;
  status: 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  refresh: () => Promise<void>;
  setActiveProvider: (provider: AiProvider) => Promise<void>;
  setSelectedModel: (provider: AiProvider, model: string) => Promise<void>;
};

const DEFAULT_STATE: AIConfigState = {
  activeProvider: 'gemini',
  geminiConnected: false,
  openaiConnected: false,
  geminiKeyLast4: null,
  openaiKeyLast4: null,
  geminiSelectedModel: 'gemini-2.5-flash',
  openaiSelectedModel: 'gpt-4o',
  status: 'loading',
  errorMessage: null,
  refresh: async () => {},
  setActiveProvider: async () => {},
  setSelectedModel: async () => {},
};

const AIConfigContext = createContext<AIConfigState>(DEFAULT_STATE);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeProvider, setActiveProviderState] = useState<AiProvider>('gemini');
  const [geminiConnected, setGeminiConnected] = useState(false);
  const [openaiConnected, setOpenaiConnected] = useState(false);
  const [geminiKeyLast4, setGeminiKeyLast4] = useState<string | null>(null);
  const [openaiKeyLast4, setOpenaiKeyLast4] = useState<string | null>(null);
  const [geminiSelectedModel, setGeminiSelectedModel] = useState('gemini-2.5-flash');
  const [openaiSelectedModel, setOpenaiSelectedModel] = useState('gpt-4o');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAIConfig = useCallback(async () => {
    if (!user) {
      setStatus('ready');
      return;
    }

    try {
      setErrorMessage(null);
      const [{ data: pref }, credStatus] = await Promise.all([
        supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        getServerCredentialStatus(),
      ]);

      const gConn = Boolean(credStatus.gemini?.connected);
      const oConn = Boolean(credStatus.openai?.connected);
      setGeminiConnected(gConn);
      setGeminiKeyLast4(credStatus.gemini?.keyLast4 || null);
      setOpenaiConnected(oConn);
      setOpenaiKeyLast4(credStatus.openai?.keyLast4 || null);

      const prefProvider =
        pref?.selected_ai_provider === 'openai' || pref?.selected_ai_provider === 'gemini'
          ? pref.selected_ai_provider
          : null;

      let resolvedProvider: AiProvider = 'gemini';
      if (prefProvider && ((prefProvider === 'gemini' && gConn) || (prefProvider === 'openai' && oConn))) {
        resolvedProvider = prefProvider;
      } else if (gConn) {
        resolvedProvider = 'gemini';
      } else if (oConn) {
        resolvedProvider = 'openai';
      } else if (prefProvider) {
        resolvedProvider = prefProvider;
      }

      setActiveProviderState(resolvedProvider);
      if (pref?.gemini_selected_model) setGeminiSelectedModel(pref.gemini_selected_model);
      if (pref?.openai_selected_model) setOpenaiSelectedModel(pref.openai_selected_model);

      setStatus('ready');
    } catch (err) {
      console.warn('[CardNest AIConfig] Failed to fetch AI config:', err);
      setErrorMessage('Unable to load AI configuration');
      setStatus('error');
    }
  }, [user]);

  useEffect(() => {
    setStatus('loading');
    void fetchAIConfig();
  }, [fetchAIConfig, user]);

  const setActiveProvider = useCallback(
    async (provider: AiProvider) => {
      setActiveProviderState(provider);
      if (!user) return;
      await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, selected_ai_provider: provider, updated_at: new Date().toISOString() });
    },
    [user]
  );

  const setSelectedModel = useCallback(
    async (provider: AiProvider, model: string) => {
      if (provider === 'gemini') setGeminiSelectedModel(model);
      else setOpenaiSelectedModel(model);

      if (!user) return;
      const updatePayload: Record<string, any> = {
        user_id: user.id,
        selected_ai_provider: provider,
        selected_ai_model: model,
        updated_at: new Date().toISOString(),
      };
      if (provider === 'gemini') updatePayload.gemini_selected_model = model;
      if (provider === 'openai') updatePayload.openai_selected_model = model;

      await supabase.from('user_preferences').upsert(updatePayload);
    },
    [user]
  );

  return (
    <AIConfigContext.Provider
      value={{
        activeProvider,
        geminiConnected,
        openaiConnected,
        geminiKeyLast4,
        openaiKeyLast4,
        geminiSelectedModel,
        openaiSelectedModel,
        status,
        errorMessage,
        refresh: fetchAIConfig,
        setActiveProvider,
        setSelectedModel,
      }}
    >
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig(): AIConfigState {
  return useContext(AIConfigContext);
}
