import { MAX_PROVIDER_CONCURRENCY } from "../shared/constants";
import { loadPreferences } from "../shared/storage";
import type {
  ClassificationOutcome,
  ClassificationResult,
  ExtensionPreferences,
  ProviderConfig,
  SerializableCandidate,
  UserPreferences
} from "../shared/types";
import { classifyWithAnthropicCompatible } from "./providers/anthropicCompatible";
import { classifyWithLocalEndpoint } from "./providers/localEndpoint";
import { classifyWithOpenAICompatible } from "./providers/openAICompatible";

type CacheStore = Map<string, ClassificationResult>;

function toUserPreferences(preferences: ExtensionPreferences): UserPreferences {
  return {
    interests: preferences.interests,
    dislikes: preferences.dislikes,
    provider: preferences.provider,
    model: preferences.model,
    autoHide: preferences.autoHide,
    threshold: preferences.threshold,
    sessionOnly: preferences.sessionOnly
  };
}

function toProviderConfig(preferences: ExtensionPreferences): ProviderConfig {
  return {
    provider: preferences.provider,
    baseUrl: preferences.baseUrl,
    apiKey: preferences.apiKey,
    model: preferences.model
  };
}

async function classifySingle(
  candidate: SerializableCandidate,
  providerConfig: ProviderConfig,
  userPreferences: UserPreferences
): Promise<ClassificationResult> {
  switch (providerConfig.provider) {
    case "openai-compatible":
      if (!providerConfig.apiKey) {
        throw new Error("API key is required for the selected provider");
      }
      return classifyWithOpenAICompatible(candidate, providerConfig, userPreferences);
    case "anthropic-compatible":
      if (!providerConfig.apiKey) {
        throw new Error("API key is required for the selected provider");
      }
      return classifyWithAnthropicCompatible(candidate, providerConfig, userPreferences);
    case "local":
      return classifyWithLocalEndpoint(candidate, providerConfig, userPreferences);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }

      await task(item);
    }
  });

  await Promise.all(workers);
}

export async function classifyCandidates(
  items: Array<SerializableCandidate & { cacheKey: string }>,
  pageSessionId: string,
  cache: CacheStore
): Promise<Record<string, ClassificationOutcome>> {
  const preferences = await loadPreferences();
  const providerConfig = toProviderConfig(preferences);
  const userPreferences = toUserPreferences(preferences);
  const results: Record<string, ClassificationOutcome> = {};

  await runWithConcurrency(items, MAX_PROVIDER_CONCURRENCY, async (item) => {
    const sessionScopedCacheKey = `${pageSessionId}:${item.cacheKey}`;
    const cached = cache.get(sessionScopedCacheKey);
    if (cached) {
      results[item.id] = { ok: true, result: cached };
      return;
    }

    try {
      const result = await classifySingle(item, providerConfig, userPreferences);
      cache.set(sessionScopedCacheKey, result);
      results[item.id] = { ok: true, result };
    } catch (error) {
      results[item.id] = {
        ok: false,
        error: error instanceof Error ? error.message : "Classification failed"
      };
    }
  });

  return results;
}

export async function testProvider(): Promise<void> {
  const preferences = await loadPreferences();
  await classifySingle(
    {
      id: "provider-test",
      site: "x",
      text: "A technical post about AI research tooling and practical engineering lessons.",
      kind: "post"
    },
    toProviderConfig(preferences),
    toUserPreferences(preferences)
  );
}
