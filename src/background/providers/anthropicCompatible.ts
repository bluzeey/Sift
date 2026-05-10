import { REQUEST_TIMEOUT_MS, getClassifierSystemPrompt } from "../../shared/constants";
import type { ClassificationResult, ProviderConfig, SerializableCandidate, UserPreferences } from "../../shared/types";
import { prepareCandidateImages } from "./mediaPayload";
import {
  buildUserPrompt,
  finalizeClassificationResult,
  isImagePayloadRejected,
  parseProviderJson,
  sanitizeClassificationResult
} from "./openAICompatible";

function buildAnthropicContent(prompt: string, images: Awaited<ReturnType<typeof prepareCandidateImages>>): Array<Record<string, unknown>> {
  return [
    { type: "text", text: prompt },
    ...images.map((image) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.base64
      }
    }))
  ];
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

  const preparedImages = await prepareCandidateImages(candidate);

  const classifyOnce = async (images: Awaited<ReturnType<typeof prepareCandidateImages>>): Promise<ClassificationResult> => {
    const response = (await postJson(
      config.baseUrl,
      {
        model: config.model,
        max_tokens: 200,
        temperature: 0,
        system: getClassifierSystemPrompt(candidate.site),
        messages: [
          {
            role: "user",
            content: buildAnthropicContent(buildUserPrompt(candidate, preferences, images.length > 0), images)
          }
        ]
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

    const rawResult = sanitizeClassificationResult(parseProviderJson(text));
    const mediaMode = candidate.mediaType === "video"
      ? "video-metadata"
      : images.length > 0
        ? "image-vision"
        : candidate.mediaType === "image"
          ? "metadata-only"
          : "none";
    return finalizeClassificationResult(candidate, rawResult, mediaMode);
  };

  try {
    return await classifyOnce(preparedImages);
  } catch (error) {
    if (preparedImages.length > 0 && isImagePayloadRejected(error)) {
      return classifyOnce([]);
    }

    throw error;
  }
}
