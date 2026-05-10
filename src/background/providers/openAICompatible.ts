import { REQUEST_TIMEOUT_MS, getClassifierSystemPrompt } from "../../shared/constants";
import type { ClassificationResult, ProviderConfig, SerializableCandidate, UserPreferences } from "../../shared/types";
import type { PreparedImage } from "./mediaPayload";
import { prepareCandidateImages } from "./mediaPayload";

export function buildUserPrompt(candidate: SerializableCandidate, preferences: UserPreferences, imagesIncluded: boolean): string {
  return [
    `User interests:\n${preferences.interests || "None provided."}`,
    `User dislikes:\n${preferences.dislikes || "None provided."}`,
    `Site:\n${candidate.site}`,
    `Kind:\n${candidate.kind || "unknown"}`,
    candidate.author ? `Author:\n${candidate.author}` : "",
    candidate.community ? `Community:\n${candidate.community}` : "",
    `Media type:\n${candidate.mediaType || "none"}`,
    candidate.mediaSummary ? `Media metadata:\n${candidate.mediaSummary}` : "",
    candidate.isMediaOnly ? "This post is mostly media with little visible text." : "",
    `Post text:\n${candidate.text || "None provided."}`,
    imagesIncluded
      ? "Visible post images are attached. Use them together with the text and metadata."
      : "No image bytes are attached. If the post seems image-dependent, be conservative.",
    [
      "Classify this content for the user. Return strict JSON:",
      "{",
      '  "label": "useful" | "maybe" | "slop",',
      '  "confidence": number,',
      '  "reason": string,',
      '  "action": "show" | "label" | "hide",',
      '  "needsVision": boolean',
      "}"
    ].join("\n"),
    [
      "Rules:",
      "- confidence must be between 0 and 1",
      "- reason must be under 8 words",
      "- action should be hide only for clear slop",
      "- uncertain content should be maybe",
      "- thoughtful disagreement should not be punished",
      "- media-only or unclear video posts should not be hidden",
      "- for video posts, rely only on text and visible metadata",
      "- set needsVision true only when image understanding seems necessary but unavailable",
      "- do not include markdown",
      "- do not include extra fields"
    ].join("\n")
  ]
    .filter(Boolean)
    .join("\n\n");
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
  const needsVisionValue =
    input && typeof input === "object" && "needsVision" in input && typeof input.needsVision === "boolean"
      ? input.needsVision
      : false;

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
    action: normalizedLabel === "slop" && confidence >= 0.75 ? action : action === "hide" ? "label" : action,
    needsVision: needsVisionValue,
    mediaMode: "none"
  };
}

function buildUserContent(prompt: string, images: PreparedImage[]): string | Array<Record<string, unknown>> {
  if (images.length === 0) {
    return prompt;
  }

  return [
    { type: "text", text: prompt },
    ...images.map((image) => ({
      type: "image_url",
      image_url: {
        url: image.dataUrl,
        detail: "low"
      }
    }))
  ];
}

export function isImagePayloadRejected(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const match = error.message.match(/Provider request failed with (\d+)/);
  if (!match) {
    return false;
  }

  return [400, 415, 422].includes(Number(match[1]));
}

export function finalizeClassificationResult(
  candidate: SerializableCandidate,
  result: ClassificationResult,
  mediaMode: ClassificationResult["mediaMode"]
): ClassificationResult {
  const needsVision = result.needsVision ?? false;

  if (candidate.mediaType === "video") {
    return {
      ...result,
      label: candidate.isMediaOnly && result.label === "slop" ? "maybe" : result.label,
      reason: result.reason || "video",
      action: result.action === "hide" ? "label" : result.action,
      mediaMode: "video-metadata",
      needsVision: false
    };
  }

  if (candidate.mediaType === "image" && mediaMode !== "image-vision") {
    return {
      ...result,
      action: result.action === "hide" ? "label" : result.action,
      mediaMode,
      needsVision: needsVision || Boolean(candidate.isMediaOnly)
    };
  }

  return {
    ...result,
    mediaMode,
    needsVision: mediaMode === "image-vision" ? false : needsVision
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
  const preparedImages = await prepareCandidateImages(candidate);

  const classifyOnce = async (images: PreparedImage[]): Promise<ClassificationResult> => {
    const response = (await postJson(
      config.baseUrl,
      {
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: getClassifierSystemPrompt(candidate.site) },
          {
            role: "user",
            content: buildUserContent(buildUserPrompt(candidate, preferences, images.length > 0), images)
          }
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

    const rawResult = sanitizeClassificationResult(parseJsonResponse(content));
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
