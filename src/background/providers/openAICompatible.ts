import { CLASSIFIER_SYSTEM_PROMPT, REQUEST_TIMEOUT_MS } from "../../shared/constants";
import type { ClassificationResult, ProviderConfig, SerializableCandidate, UserPreferences } from "../../shared/types";

function buildUserPrompt(candidate: SerializableCandidate, preferences: UserPreferences): string {
  return `User interests:\n${preferences.interests || "None provided."}\n\nUser dislikes:\n${preferences.dislikes || "None provided."}\n\nSite:\n${candidate.site}\n\nContent:\n${candidate.text}\n\nClassify this content for the user. Return strict JSON:\n{\n  "label": "useful" | "maybe" | "slop",\n  "confidence": number,\n  "reason": string,\n  "action": "show" | "label" | "hide"\n}\n\nRules:\n- confidence must be between 0 and 1\n- reason must be under 8 words\n- action should be "hide" only for clear slop\n- uncertain content should be "maybe"\n- thoughtful disagreement should not be punished\n- do not include markdown\n- do not include extra fields`;
}

function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Provider returned non-JSON content");
    }

    return JSON.parse(match[0]);
  }
}

export function parseProviderJson(text: string): unknown {
  return parseJsonResponse(text);
}

export function sanitizeClassificationResult(input: unknown): ClassificationResult {
  const label =
    input && typeof input === "object" && "label" in input && typeof input.label === "string"
      ? input.label
      : "maybe";
  const confidenceValue =
    input && typeof input === "object" && "confidence" in input && typeof input.confidence === "number"
      ? input.confidence
      : 0.5;
  const reasonValue =
    input && typeof input === "object" && "reason" in input && typeof input.reason === "string"
      ? input.reason
      : "Needs review";
  const actionValue =
    input && typeof input === "object" && "action" in input && typeof input.action === "string"
      ? input.action
      : label === "slop"
        ? "hide"
        : "label";

  const normalizedLabel = label === "useful" || label === "maybe" || label === "slop" ? label : "maybe";
  const confidence = Math.max(0, Math.min(1, confidenceValue));
  const reason = reasonValue
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
  const action =
    actionValue === "show" || actionValue === "label" || actionValue === "hide"
      ? actionValue
      : normalizedLabel === "slop"
        ? "hide"
        : "label";

  return {
    label: normalizedLabel,
    confidence,
    reason: reason || "Needs review",
    action: normalizedLabel === "slop" && confidence >= 0.75 ? action : action === "hide" ? "label" : action
  };
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

export async function classifyWithOpenAICompatible(
  candidate: SerializableCandidate,
  config: ProviderConfig,
  preferences: UserPreferences
): Promise<ClassificationResult> {
  const response = (await postJson(
    config.baseUrl,
    {
      model: config.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(candidate, preferences) }
      ]
    },
    config.apiKey
      ? {
          Authorization: `Bearer ${config.apiKey}`
        }
      : {}
  )) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Provider returned an empty response");
  }

  return sanitizeClassificationResult(parseJsonResponse(content));
}
