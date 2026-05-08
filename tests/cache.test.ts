import { describe, expect, it } from "vitest";
import { buildCandidateCacheKey } from "../src/content/classifier/postHash";
import { SessionCache } from "../src/content/classifier/sessionCache";

describe("session dedupe", () => {
  it("normalizes repeated text into the same hash", async () => {
    const first = await buildCandidateCacheKey("x", "Useful text about AI research", "prefs-1");
    const second = await buildCandidateCacheKey("x", " useful   text about ai research ", "prefs-1");
    const third = await buildCandidateCacheKey("x", "useful text about ai research", "prefs-2");

    expect(first).toBe(second);
    expect(third).not.toBe(first);
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
