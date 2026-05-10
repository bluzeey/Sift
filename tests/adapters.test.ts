import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { redditAdapter } from "../src/content/adapters/redditAdapter";
import { substackAdapter } from "../src/content/adapters/substackAdapter";
import { xAdapter } from "../src/content/adapters/xAdapter";

function loadFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests", "fixtures", name), "utf8");
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("site adapters", () => {
  it("detects and extracts X candidates", () => {
    window.history.replaceState({}, "", "/x-home");
    document.body.innerHTML = loadFixture("x-feed.html");

    const candidates = xAdapter.findCandidates(document);
    expect(candidates).toHaveLength(2);

    const extracted = xAdapter.extractCandidate(candidates[0]);
    expect(extracted?.site).toBe("x");
    expect(extracted?.author).toContain("Ada");
    expect(extracted?.url).toContain("/status/");
    expect(extracted?.text).toContain("benchmark quality matters");
    expect(extracted?.text).not.toContain("Reply");
  });

  it("extracts X image metadata and keeps video posts conservative", () => {
    window.history.replaceState({}, "", "/x-media");
    document.body.innerHTML = loadFixture("x-media-feed.html");

    const candidates = xAdapter.findCandidates(document);
    expect(candidates).toHaveLength(2);

    const imagePost = xAdapter.extractCandidate(candidates[0]);
    expect(imagePost?.mediaType).toBe("image");
    expect(imagePost?.images).toHaveLength(1);
    expect(imagePost?.images?.[0]?.alt).toContain("eval routing");
    expect(imagePost?.mediaSummary).toContain("Architecture sketch from the thread");
    expect(imagePost?.isMediaOnly).toBe(false);

    const videoPost = xAdapter.extractCandidate(candidates[1]);
    expect(videoPost?.mediaType).toBe("video");
    expect(videoPost?.isMediaOnly).toBe(true);
  });

  it("detects and extracts Reddit candidates", () => {
    window.history.replaceState({}, "", "/reddit-programming");
    document.body.innerHTML = loadFixture("reddit-feed.html");

    const candidates = redditAdapter.findCandidates(document);
    expect(candidates).toHaveLength(2);

    const extracted = redditAdapter.extractCandidate(candidates[0]);
    expect(extracted?.site).toBe("reddit");
    expect(extracted?.community).toBe("r/programming");
    expect(extracted?.text).toContain("offline-first");
  });

  it("detects Substack previews and full articles", () => {
    window.history.replaceState({}, "", "/archive");
    document.body.innerHTML = loadFixture("substack-archive.html");

    const previews = substackAdapter.findCandidates(document);
    expect(previews).toHaveLength(2);
    const preview = substackAdapter.extractCandidate(previews[0]);
    expect(preview?.kind).toBe("post");
    expect(preview?.text).toContain("DOM-first tools");

    window.history.replaceState({}, "", "/p/writing-better");
    document.body.innerHTML = loadFixture("substack-article.html");

    const articles = substackAdapter.findCandidates(document);
    expect(articles).toHaveLength(1);
    const article = substackAdapter.extractCandidate(articles[0]);
    expect(article?.kind).toBe("article");
    expect(article?.text.length).toBeGreaterThan(250);
    expect(article?.text.length).toBeLessThanOrEqual(3203);

    window.history.replaceState({}, "", "/@jeremygrummet/note/c-255608835");
    document.body.innerHTML = loadFixture("substack-note.html");

    const notes = substackAdapter.findCandidates(document);
    expect(notes).toHaveLength(1);

    const note = substackAdapter.extractCandidate(notes[0]);
    expect(note?.kind).toBe("note");
    expect(note?.url).toContain("/note/");
    expect(note?.text).toContain("Trust in the age of AI");
    expect(note?.text).toContain("Humanity - Hubris or Humility?");
    expect(note?.text).not.toContain("wisdomandaction.com.au");
    expect(note?.text).not.toContain("Like");
  });

  it("extracts Substack preview image metadata", () => {
    window.history.replaceState({}, "", "/archive-images");
    document.body.innerHTML = loadFixture("substack-image-archive.html");

    const previews = substackAdapter.findCandidates(document);
    expect(previews).toHaveLength(1);

    const preview = substackAdapter.extractCandidate(previews[0]);
    expect(preview?.mediaType).toBe("image");
    expect(preview?.images?.[0]?.alt).toContain("review times");
    expect(preview?.text).toContain("review loops");
  });
});
