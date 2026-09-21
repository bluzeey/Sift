import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyWithOpenAICompatible } from "../src/background/providers/openAICompatible";
import { DEFAULT_BASE_URLS, DEFAULT_PROVIDER_MODELS } from "../src/shared/constants";
import type { ProviderConfig, SerializableCandidate, UserPreferences } from "../src/shared/types";

const candidate: SerializableCandidate = {
  id: "x:openrouter-test",
  site: "x",
  text: "A practical post about evaluating retrieval systems.",
  kind: "post"
};

const config: ProviderConfig = {
  provider: "openrouter",
  baseUrl: DEFAULT_BASE_URLS.openrouter,
  apiKey: "test-openrouter-key",
  model: DEFAULT_PROVIDER_MODELS.openrouter as string
};

const preferences: UserPreferences = {
  interests: "AI engineering",
  dislikes: "engagement bait",
  provider: "openrouter",
  model: config.model,
  autoHide: false,
  threshold: 0.75,
  sessionOnly: true
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenRouter provider", () => {
  it("uses the OpenRouter chat endpoint, bearer key, and cheapest JSON-capable model", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        label: "useful",
        confidence: 0.92,
        reason: "specific evaluation advice",
        action: "show",
        needsVision: false
      }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await classifyWithOpenAICompatible(candidate, config, preferences);

    expect(result.label).toBe("useful");
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.headers).toMatchObject({ Authorization: "Bearer test-openrouter-key" });
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: "mistralai/mistral-nemo",
      response_format: { type: "json_object" },
      provider: {
        sort: "price",
        require_parameters: true
      }
    });
  });
});
