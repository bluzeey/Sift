import { describe, expect, it } from "vitest";
import { buildClassifyPostsMessage } from "../src/shared/messaging";
import { toPersistedPreferences } from "../src/shared/storage";
import type { ExtensionPreferences } from "../src/shared/types";

const basePreferences: ExtensionPreferences = {
  enabled: true,
  interests: "AI research",
  dislikes: "ragebait",
  provider: "openai-compatible",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  apiKey: "sk-test",
  autoHide: false,
  threshold: 0.75,
  sessionOnly: true,
  storePreferencesOnDevice: false,
  pausedSites: {}
};

describe("privacy boundaries", () => {
  it("does not include provider secrets in content-script classify messages", () => {
    const message = buildClassifyPostsMessage("page-session", [
      {
        id: "x:1",
        site: "linkedin",
        text: "A useful technical LinkedIn post about product metrics and engineering tradeoffs.",
        mediaType: "image",
        mediaSummary: "Image 1 alt: rollout metrics slide",
        images: [{ src: "https://media.licdn.com/post-image.jpg", alt: "rollout metrics slide" }],
        cacheKey: "cache-1",
        kind: "post"
      }
    ]);

    expect(JSON.stringify(message)).not.toContain("apiKey");
    expect(JSON.stringify(message)).not.toContain("baseUrl");
    expect(message.items[0].text).toContain("LinkedIn post");
    expect(message.items[0].images?.[0]?.src).toContain("post-image.jpg");
  });

  it("persists only preference fields and keeps sessionOnly in sync", () => {
    const persisted = toPersistedPreferences({
      ...basePreferences,
      storePreferencesOnDevice: true,
      sessionOnly: false
    });

    expect(Object.keys(persisted).sort()).toEqual([
      "apiKey",
      "autoHide",
      "baseUrl",
      "dislikes",
      "enabled",
      "interests",
      "model",
      "pausedSites",
      "provider",
      "sessionOnly",
      "storePreferencesOnDevice",
      "threshold"
    ]);
    expect(JSON.stringify(persisted)).not.toContain("classifications");
    expect(JSON.stringify(persisted)).not.toContain("browsingHistory");
    expect(persisted.sessionOnly).toBe(false);
  });
});
