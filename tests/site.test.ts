import { describe, expect, it } from "vitest";
import { getSupportedSiteFromUrl } from "../src/shared/site";

describe("supported site detection", () => {
  it("detects LinkedIn as a supported site", () => {
    expect(getSupportedSiteFromUrl("https://www.linkedin.com/feed/")).toBe("linkedin");
    expect(getSupportedSiteFromUrl("https://www.linkedin.com/search/results/content/")).toBe("linkedin");
  });

  it("detects Peerlist as a supported site", () => {
    expect(getSupportedSiteFromUrl("https://peerlist.io/scroll")).toBe("peerlist");
    expect(getSupportedSiteFromUrl("https://www.peerlist.io/scroll/trending")).toBe("peerlist");
  });
});
