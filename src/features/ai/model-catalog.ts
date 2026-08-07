import { Directory, File, Paths } from 'expo-file-system';

import type { AiProvider } from './ai-provider';

/**
 * Dynamic, capability-driven model discovery for Gemini and OpenAI.
 *
 * The provider APIs are the source of truth — there is no frozen model catalog.
 * Filtering removes model families that cannot run Card Nest's multimodal
 * structured-extraction flow (embeddings, audio/TTS, image generation, ...)
 * based on capability metadata and capability-indicating ID segments, never on
 * "does the name contain vision" style matching.
 */

export type ModelCompatibility = 'compatible' | 'candidate' | 'incompatible';

export type AiModelInfo = {
  /** Exact provider model ID — always used verbatim in API calls. */
  id: string;
  /** Friendly label for display; the ID remains authoritative. */
  displayName: string;
  provider: AiProvider;
  /**
   * compatible  — capability metadata (or a probe) confirms the extraction flow
   * candidate   — listed by the provider and not excluded, but unprobed (OpenAI)
   * incompatible — a probe confirmed the model cannot accept image input
   */
  compatibility: ModelCompatibility;
  capabilityHint: string | null;
  lastValidatedAt: string | null;
};

export type ModelCatalog = {
  provider: AiProvider;
  fetchedAt: string;
  models: AiModelInfo[];
};

export type ConnectionTestResult = {
  status: 'connected' | 'invalid-key' | 'rate-limited' | 'model-unavailable' | 'network-error' | 'provider-error';
  message: string;
  modelCount?: number;
};

const CATALOG_FRESH_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

type GeminiModelMeta = {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  supportedActions?: string[];
};

/**
 * Capability-indicating ID segments for Gemini variants that expose
 * generateContent but cannot run image→structured-JSON extraction
 * (embeddings, audio/TTS/live, image/video generation, retrieval-only).
 */
const GEMINI_EXCLUDED_SEGMENTS =
  /(embedding|embed-|aqa|-tts|native-audio|dialog|live-|image-generation|imagen|veo|learnlm|robotics|computer-use)/iu;

export function isGeminiModelEligible(model: GeminiModelMeta): boolean {
  const methods = model.supportedGenerationMethods ?? model.supportedActions ?? [];
  if (!methods.includes('generateContent')) return false;
  const id = model.name.replace(/^models\//u, '');
  if (!/gemini/iu.test(id) && !/gemma/iu.test(id)) return false;
  if (GEMINI_EXCLUDED_SEGMENTS.test(id)) return false;
  return true;
}

export function geminiModelInfo(model: GeminiModelMeta): AiModelInfo {
  const id = model.name.replace(/^models\//u, '');
  return {
    id,
    displayName: model.displayName?.trim() || id,
    provider: 'gemini',
    compatibility: 'compatible',
    capabilityHint: 'Multimodal · Structured JSON',
    lastValidatedAt: null,
  };
}

async function fetchGeminiModels(apiKey: string): Promise<AiModelInfo[]> {
  const models: GeminiModelMeta[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString());
    if (!response.ok) throw await providerHttpError('gemini', response);

    const body = (await response.json()) as { models?: GeminiModelMeta[]; nextPageToken?: string };
    models.push(...(body.models ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return models
    .filter(isGeminiModelEligible)
    .map(geminiModelInfo)
    .sort((a, b) => b.id.localeCompare(a.id));
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

type OpenAiModelMeta = { id: string; created?: number };

/**
 * Capability-indicating ID segments for OpenAI models that cannot run the
 * image→structured-JSON chat flow (embeddings, audio, moderation, image/video
 * generation, legacy completions-only families).
 */
const OPENAI_EXCLUDED_SEGMENTS =
  /(embedding|whisper|tts|audio|realtime|transcribe|moderation|dall-e|sora|image|davinci|babbage|curie|-ada|instruct|search|computer-use|deep-research|codex)/iu;

/** Families that use the chat/responses interface and are extraction candidates. */
const OPENAI_CANDIDATE_FAMILIES = /^(gpt-[45]|gpt-[0-9]+(?:\.[0-9]+)?|o[0-9]|chatgpt-)/iu;

export function isOpenAiModelCandidate(model: OpenAiModelMeta): boolean {
  if (OPENAI_EXCLUDED_SEGMENTS.test(model.id)) return false;
  if (!OPENAI_CANDIDATE_FAMILIES.test(model.id)) return false;
  // gpt-3.x families cannot accept images.
  if (/^gpt-3/iu.test(model.id)) return false;
  return true;
}

export function openAiFriendlyName(id: string): string {
  return id
    .replace(/^chatgpt-/u, 'ChatGPT ')
    .replace(/^gpt-/u, 'GPT-')
    .replace(/-(mini|nano|pro|turbo|chat|latest|preview|codex|deep-research)/gu, ' $1')
    .replace(/-(\d{4})-(\d{2})-(\d{2})$/u, ' ($1-$2-$3)');
}

export function openAiModelInfo(model: OpenAiModelMeta): AiModelInfo {
  return {
    id: model.id,
    displayName: openAiFriendlyName(model.id),
    provider: 'openai',
    compatibility: 'candidate',
    capabilityHint: 'Chat · JSON schema output',
    lastValidatedAt: null,
  };
}

async function fetchOpenAiModels(apiKey: string): Promise<AiModelInfo[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw await providerHttpError('openai', response);

  const body = (await response.json()) as { data?: OpenAiModelMeta[] };
  return (body.data ?? [])
    .filter(isOpenAiModelCandidate)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map(openAiModelInfo);
}

// A 1x1 transparent PNG used only for the lightweight image-capability probe.
const PROBE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export type ModelValidationResult = { status: 'compatible' | 'incompatible' | 'unavailable'; message: string };

/**
 * Confirms a specific model can run the extraction flow. Gemini exposes enough
 * capability metadata to validate without spending tokens; OpenAI's model list
 * has no capability metadata, so a minimal single-token image probe is used.
 * Results are cached in the catalog — probes never run per scan.
 */
export async function validateModel(
  provider: AiProvider,
  apiKey: string,
  modelId: string
): Promise<ModelValidationResult> {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}?key=${encodeURIComponent(apiKey)}`
    );
    if (response.status === 404) return { status: 'unavailable', message: 'This model is no longer available.' };
    if (!response.ok) throw await providerHttpError('gemini', response);
    const meta = (await response.json()) as GeminiModelMeta;
    return isGeminiModelEligible({ ...meta, name: meta.name ?? modelId })
      ? { status: 'compatible', message: 'Model supports multimodal extraction.' }
      : { status: 'incompatible', message: 'This model cannot run card extraction.' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Reply with OK.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${PROBE_PNG_BASE64}` } },
          ],
        },
      ],
      max_completion_tokens: 5,
    }),
  });

  if (response.ok) return { status: 'compatible', message: 'Model accepts image input.' };

  const errText = (await response.text()).slice(0, 300).toLowerCase();
  if (response.status === 404 || errText.includes('model_not_found') || errText.includes('does not exist') || errText.includes('decommissioned') || errText.includes('deprecated')) {
    return { status: 'unavailable', message: 'This model is no longer available.' };
  }
  if (response.status === 400 && (errText.includes('image') || errText.includes('content type') || errText.includes('modality') || errText.includes('invalid content'))) {
    return { status: 'incompatible', message: 'This model does not accept card images.' };
  }
  throw await providerHttpError('openai', response, errText);
}

// ---------------------------------------------------------------------------
// Shared errors
// ---------------------------------------------------------------------------

export class ModelCatalogError extends Error {
  status: ConnectionTestResult['status'];
  httpStatus?: number;

  constructor(status: ConnectionTestResult['status'], message: string, httpStatus?: number) {
    super(message);
    this.name = 'ModelCatalogError';
    this.status = status;
    this.httpStatus = httpStatus;
  }
}

async function providerHttpError(provider: AiProvider, response: Response, bodyText?: string): Promise<ModelCatalogError> {
  const name = provider === 'openai' ? 'OpenAI' : 'Gemini';
  if (response.status === 401 || response.status === 403) {
    return new ModelCatalogError('invalid-key', `Invalid API key — ${name} rejected the credential.`, response.status);
  }
  if (response.status === 429) {
    return new ModelCatalogError('rate-limited', `${name} is rate limiting requests. Try again shortly.`, response.status);
  }
  const detail = (bodyText ?? (await response.text().catch(() => ''))).slice(0, 120);
  return new ModelCatalogError('provider-error', `${name} returned ${response.status}${detail ? `: ${detail}` : '.'}`, response.status);
}

// ---------------------------------------------------------------------------
// Catalog fetch + cache
// ---------------------------------------------------------------------------

const memoryCache = new Map<AiProvider, ModelCatalog>();
const isWebRuntime = typeof window !== 'undefined' && !('nativeCallSyncHook' in window);

function cacheFile(provider: AiProvider): File | null {
  try {
    const directory = new Directory(Paths.document, 'cardnest-ai-cache');
    if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
    return new File(directory, `models-${provider}.json`);
  } catch {
    return null;
  }
}

function loadPersistedCatalog(provider: AiProvider): ModelCatalog | null {
  try {
    if (isWebRuntime) {
      const raw = window.localStorage.getItem(`cardnest.ai.models.${provider}`);
      return raw ? (JSON.parse(raw) as ModelCatalog) : null;
    }
    const file = cacheFile(provider);
    if (!file?.exists) return null;
    return JSON.parse(file.textSync()) as ModelCatalog;
  } catch {
    return null;
  }
}

function persistCatalog(catalog: ModelCatalog) {
  try {
    if (isWebRuntime) {
      window.localStorage.setItem(`cardnest.ai.models.${catalog.provider}`, JSON.stringify(catalog));
      return;
    }
    cacheFile(catalog.provider)?.write(JSON.stringify(catalog));
  } catch {
    // Cache persistence is best-effort; never block on it.
  }
}

export function getCachedCatalog(provider: AiProvider, { allowStale = false } = {}): ModelCatalog | null {
  const cached = memoryCache.get(provider) ?? loadPersistedCatalog(provider);
  if (!cached) return null;
  memoryCache.set(provider, cached);
  if (allowStale) return cached;
  return Date.now() - Date.parse(cached.fetchedAt) <= CATALOG_FRESH_MS ? cached : null;
}

/**
 * Returns the compatible/candidate model catalog for a provider. Serves the
 * cached catalog inside the freshness window unless forceRefresh is set.
 */
export async function getModelCatalog(
  provider: AiProvider,
  apiKey: string,
  { forceRefresh = false } = {}
): Promise<ModelCatalog> {
  if (!forceRefresh) {
    const cached = getCachedCatalog(provider);
    if (cached) return cached;
  }

  let models: AiModelInfo[];
  try {
    models = provider === 'gemini' ? await fetchGeminiModels(apiKey) : await fetchOpenAiModels(apiKey);
  } catch (error) {
    if (error instanceof ModelCatalogError) throw error;
    throw new ModelCatalogError('network-error', 'Could not reach the provider. Check your connection and try again.');
  }

  // Preserve prior probe results across refreshes so validation is not repeated.
  const previous = getCachedCatalog(provider, { allowStale: true });
  if (previous) {
    for (const model of models) {
      const before = previous.models.find((m) => m.id === model.id);
      if (before && model.compatibility === 'candidate' && before.compatibility !== 'candidate') {
        model.compatibility = before.compatibility;
        model.lastValidatedAt = before.lastValidatedAt;
      }
    }
  }

  const catalog: ModelCatalog = { provider, fetchedAt: new Date().toISOString(), models };
  memoryCache.set(provider, catalog);
  persistCatalog(catalog);
  return catalog;
}

/** Records a probe/validation outcome for a model into the cached catalog. */
export function recordModelValidation(provider: AiProvider, modelId: string, result: ModelValidationResult) {
  const catalog = getCachedCatalog(provider, { allowStale: true });
  if (!catalog) return;
  const next: ModelCatalog = {
    ...catalog,
    models:
      result.status === 'unavailable'
        ? catalog.models.filter((m) => m.id !== modelId)
        : catalog.models.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  compatibility: result.status === 'compatible' ? 'compatible' : 'incompatible',
                  lastValidatedAt: new Date().toISOString(),
                }
              : m
          ),
  };
  memoryCache.set(provider, next);
  persistCatalog(next);
}

// ---------------------------------------------------------------------------
// Defaults + selection checks
// ---------------------------------------------------------------------------

/**
 * Suggests a default only when the user has never chosen a model. Preference
 * heuristics (low-cost, low-latency tiers first) are separate from availability
 * — they rank whatever the provider currently returns and never pin an ID.
 */
export function pickDefaultModel(models: AiModelInfo[]): string | null {
  const usable = models.filter((m) => m.compatibility !== 'incompatible');
  if (usable.length === 0) return null;
  const tiers: ((id: string) => boolean)[] = [
    (id) => /flash-lite|nano/u.test(id),
    (id) => /flash|mini/u.test(id),
  ];
  for (const matches of tiers) {
    const hit = usable.find((m) => matches(m.id) && !/preview|exp/u.test(m.id));
    if (hit) return hit.id;
  }
  return usable[0].id;
}

export type SelectedModelStatus = 'usable' | 'unknown' | 'unavailable';

/**
 * Cheap pre-extraction check against the cached catalog only — no network
 * calls. 'unknown' (no cache / stale cache) must never block extraction.
 */
export function checkSelectedModelAgainstCache(provider: AiProvider, modelId: string): SelectedModelStatus {
  const catalog = getCachedCatalog(provider);
  if (!catalog) return 'unknown';
  const entry = catalog.models.find((m) => m.id === modelId);
  if (!entry) return 'unavailable';
  return entry.compatibility === 'incompatible' ? 'unavailable' : 'usable';
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export async function testProviderConnection(
  provider: AiProvider,
  apiKey: string,
  selectedModel?: string | null
): Promise<ConnectionTestResult> {
  let catalog: ModelCatalog;
  try {
    catalog = await getModelCatalog(provider, apiKey, { forceRefresh: true });
  } catch (error) {
    if (error instanceof ModelCatalogError) {
      return { status: error.status, message: error.message };
    }
    return { status: 'network-error', message: 'Could not reach the provider. Check your connection and try again.' };
  }

  if (selectedModel) {
    const entry = catalog.models.find((m) => m.id === selectedModel);
    if (!entry) {
      return {
        status: 'model-unavailable',
        message: `Connected, but your selected model (${selectedModel}) is no longer available. Choose another model.`,
        modelCount: catalog.models.length,
      };
    }
  }

  return {
    status: 'connected',
    message: `Connected. ${catalog.models.length} compatible models available.`,
    modelCount: catalog.models.length,
  };
}
