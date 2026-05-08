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
        site: "x",
        text: "A useful technical post",
        cacheKey: "cache-1",
        kind: "post"
      }
    ]);

    expect(JSON.stringify(message)).not.toContain("apiKey");
    expect(JSON.stringify(message)).not.toContain("baseUrl");
    expect(message.items[0].text).toContain("technical post");
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
