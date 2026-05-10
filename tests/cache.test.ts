import { describe, expect, it } from "vitest";
import { buildCandidateCacheKey } from "../src/content/classifier/postHash";
import { SessionCache } from "../src/content/classifier/sessionCache";

describe("session dedupe", () => {
  it("normalizes repeated text into the same hash", async () => {
    const first = await buildCandidateCacheKey({ site: "x", text: "Useful text about AI research", preferencesFingerprint: "prefs-1" });
    const second = await buildCandidateCacheKey({
      site: "x",
      text: " useful   text about ai research ",
      preferencesFingerprint: "prefs-1"
    });
    const third = await buildCandidateCacheKey({ site: "x", text: "useful text about ai research", preferencesFingerprint: "prefs-2" });

    expect(first).toBe(second);
    expect(third).not.toBe(first);
  });

  it("distinguishes posts with different media context", async () => {
    const first = await buildCandidateCacheKey({
      site: "x",
      text: "Worth saving.",
      preferencesFingerprint: "prefs-1",
      mediaSummary: "Image 1 alt: routing chart",
      imageSources: ["https://pbs.twimg.com/media/chart-a.jpg"]
    });
    const second = await buildCandidateCacheKey({
      site: "x",
      text: "Worth saving.",
      preferencesFingerprint: "prefs-1",
      mediaSummary: "Image 1 alt: meme screenshot",
      imageSources: ["https://pbs.twimg.com/media/chart-b.jpg"]
    });

    expect(first).not.toBe(second);
  });

  it("stores and clears in-memory outcomes", () => {
    const cache = new SessionCache();
    const outcome = { ok: true as const, result: { label: "useful" as const, confidence: 0.92, reason: "Dense and relevant", action: "show" as const } };

    cache.resolve("key", outcome);
    expect(cache.get("key")).toEqual(outcome);

    cache.clear();
    expect(cache.get("key")).toBeUndefined();
  });
});
