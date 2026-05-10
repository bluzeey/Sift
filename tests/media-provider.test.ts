import { describe, expect, it } from "vitest";
import { finalizeClassificationResult } from "../src/background/providers/openAICompatible";
import type { SerializableCandidate } from "../src/shared/types";

describe("media-aware provider result normalization", () => {
  it("downgrades media-only video hides to conservative maybe labels", () => {
    const candidate: SerializableCandidate = {
      id: "x:video-1",
      site: "x",
      text: "Watch this.",
      kind: "post",
      mediaType: "video",
      mediaSummary: "Media type: video",
      isMediaOnly: true
    };

    const result = finalizeClassificationResult(candidate, {
      label: "slop",
      confidence: 0.92,
      reason: "engagement bait",
      action: "hide"
    }, "video-metadata");

    expect(result.label).toBe("maybe");
    expect(result.action).toBe("label");
    expect(result.mediaMode).toBe("video-metadata");
  });

  it("marks metadata-only image fallbacks as needing vision", () => {
    const candidate: SerializableCandidate = {
      id: "linkedin:image-1",
      site: "linkedin",
      text: "Worth saving.",
      kind: "post",
      mediaType: "image",
      mediaSummary: "Image 1 alt: chart",
      images: [{ src: "https://media.licdn.com/post-image.jpg", alt: "chart" }],
      isMediaOnly: true
    };

    const result = finalizeClassificationResult(candidate, {
      label: "slop",
      confidence: 0.88,
      reason: "unclear",
      action: "hide"
    }, "metadata-only");

    expect(result.action).toBe("label");
    expect(result.needsVision).toBe(true);
    expect(result.mediaMode).toBe("metadata-only");
  });
});
