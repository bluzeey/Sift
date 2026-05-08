import { CLASSIFIER_SYSTEM_PROMPT, REQUEST_TIMEOUT_MS } from "../../shared/constants";
import type { ClassificationResult, ProviderConfig, SerializableCandidate, UserPreferences } from "../../shared/types";
import { parseProviderJson, sanitizeClassificationResult } from "./openAICompatible";

function buildUserPrompt(candidate: SerializableCandidate, preferences: UserPreferences): string {
  return `User interests:\n${preferences.interests || "None provided."}\n\nUser dislikes:\n${preferences.dislikes || "None provided."}\n\nSite:\n${candidate.site}\n\nContent:\n${candidate.text}\n\nReturn strict JSON only with label, confidence, reason, and action.`;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Provider request failed with ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function classifyWithAnthropicCompatible(
  candidate: SerializableCandidate,
  config: ProviderConfig,
  preferences: UserPreferences
): Promise<ClassificationResult> {
  if (!config.apiKey) {
    throw new Error("API key is required for the selected provider");
  }

  const response = (await postJson(
    config.baseUrl,
    {
      model: config.model,
      max_tokens: 200,
      temperature: 0,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(candidate, preferences) }]
    },
    {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    }
  )) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = response.content?.find((entry) => entry.type === "text")?.text;
  if (!text) {
    throw new Error("Provider returned an empty response");
  }

  return sanitizeClassificationResult(parseProviderJson(text));
}
