import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractLinkedInPost,
  findLinkedInPosts,
  getLinkedInActionButtons,
  getLinkedInInjectionTarget,
  inferLinkedInKind,
  linkedinAdapter
} from "../src/content/adapters/linkedinAdapter";
import { renderPill } from "../src/content/dom/pillRenderer";

function loadFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests", "fixtures", name), "utf8");
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("linkedin adapter", () => {
  it("finds supported LinkedIn card shapes and ignores nav or modal content", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-feed.html");

    const cards = findLinkedInPosts(document);
    expect(cards).toHaveLength(3);
    expect(cards[0]?.matches(".feed-shared-update-v2")).toBe(true);
    expect(cards[1]?.matches("article.update-components-article")).toBe(true);
    expect(cards[2]?.getAttribute("data-urn")).toContain("urn:li:activity:1003");
  });

  it("extracts commentary, author, url, and timestamps from feed cards", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-feed.html");

    const card = findLinkedInPosts(document)[0];
    const candidate = extractLinkedInPost(card);
    expect(candidate?.site).toBe("linkedin");
    expect(candidate?.author).toBe("Priya Nair");
    expect(candidate?.timestamp).toBe("2026-05-08T10:00:00Z");
    expect(candidate?.url).toContain("urn:li:activity:1001");
    expect(candidate?.text).toContain("Author: Priya Nair");
    expect(candidate?.text).toContain("We cut pilot onboarding time");
    expect(candidate?.text).not.toContain("React");
  });

  it("extracts article preview titles and detects article cards", () => {
    window.history.replaceState({}, "", "/posts/");
    document.body.innerHTML = loadFixture("linkedin-article-preview.html");

    const card = findLinkedInPosts(document)[0];
    const candidate = linkedinAdapter.extractCandidate(card);
    expect(candidate?.kind).toBe("article");
    expect(candidate?.text).toContain("What multilingual retrieval benchmarks actually measure");
    expect(candidate?.author).toBe("Marta Chen");
  });

  it("detects repost, sponsored, and job kinds", () => {
    document.body.innerHTML = loadFixture("linkedin-repost.html");
    const repost = linkedinAdapter.extractCandidate(findLinkedInPosts(document)[0]);
    expect(repost?.kind).toBe("repost");
    expect(repost?.text).toContain("Alex reposted this");

    document.body.innerHTML = loadFixture("linkedin-sponsored.html");
    const sponsored = linkedinAdapter.extractCandidate(findLinkedInPosts(document)[0]);
    expect(sponsored?.kind).toBe("ad");
    expect(inferLinkedInKind(findLinkedInPosts(document)[0], sponsored?.text ?? "")).toBe("ad");

    document.body.innerHTML = loadFixture("linkedin-job-post.html");
    const job = linkedinAdapter.extractCandidate(findLinkedInPosts(document)[0]);
    expect(job?.kind).toBe("job");
    expect(job?.text.length).toBeLessThanOrEqual(3003);
  });

  it("detects native action buttons without interacting with them", () => {
    document.body.innerHTML = loadFixture("linkedin-feed.html");
    const buttons = getLinkedInActionButtons(findLinkedInPosts(document)[0]);
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "React to Priya's post",
      "Comment on Priya's post",
      "Repost Priya's post",
      "Send in a private message"
    ]);
  });

  it("finds modern LinkedIn feed cards without collapsing the main feed container", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-modern-feed.html");

    const cards = findLinkedInPosts(document);
    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.getAttribute("role") === "listitem")).toBe(true);
    expect(cards.some((card) => card.getAttribute("data-testid") === "mainFeed")).toBe(false);
  });

  it("extracts modern LinkedIn author, body text, url, and relative timestamp", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-modern-feed.html");

    const card = findLinkedInPosts(document)[0];
    const candidate = extractLinkedInPost(card);
    expect(candidate?.author).toBe("Sahil Maheshwari");
    expect(candidate?.timestamp).toBe("1d");
    expect(candidate?.url).toContain("urn:li:activity:2001");
    expect(candidate?.text).toContain("Anthropic just rolled out some significant updates for Claude users");
    expect(candidate?.text).not.toContain("Feed post");
  });

  it("detects modern visible-text action controls and sponsored cards", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-modern-feed.html");

    const [postCard, sponsoredCard] = findLinkedInPosts(document);
    const buttons = getLinkedInActionButtons(postCard);
    expect(buttons.map((button) => button.textContent?.trim() || button.getAttribute("aria-label"))).toEqual([
      "Like",
      "Comment",
      "Repost",
      "Send"
    ]);

    const sponsored = extractLinkedInPost(sponsoredCard);
    expect(sponsored?.kind).toBe("ad");
  });

  it("injects before the modern top-right control menu button", () => {
    window.history.replaceState({}, "", "/feed/");
    document.body.innerHTML = loadFixture("linkedin-modern-feed.html");

    const card = findLinkedInPosts(document)[0];
    const injectionTarget = getLinkedInInjectionTarget(card);
    renderPill(injectionTarget, {
      ok: true,
      result: {
        label: "useful",
        confidence: 0.91,
        reason: "Helpful update",
        action: "label"
      }
    }, {
      onHide: vi.fn()
    });

    const host = injectionTarget.element.querySelector("[data-sift-root-host='true']") as HTMLDivElement | null;
    expect(injectionTarget.mode).toBe("inline");
    expect(injectionTarget.before?.getAttribute("aria-label")).toContain("Open control menu for post by Sahil Maheshwari");
    expect(host?.nextElementSibling).toBe(injectionTarget.before ?? null);
  });

  it("injects the pill before the control menu instead of inside the action row", () => {
    document.body.innerHTML = loadFixture("linkedin-feed.html");
    const card = findLinkedInPosts(document)[0];
    const injectionTarget = getLinkedInInjectionTarget(card);
    renderPill(injectionTarget, {
      ok: true,
      result: {
        label: "maybe",
        confidence: 0.72,
        reason: "Needs review",
        action: "label"
      }
    }, {
      onHide: vi.fn()
    });

    const host = injectionTarget.element.querySelector("[data-sift-root-host='true']") as HTMLDivElement | null;
    const controlMenu = injectionTarget.before;
    const actionBar = card.querySelector(".feed-shared-social-action-bar");
    expect(injectionTarget.mode).toBe("inline");
    expect(host?.nextElementSibling).toBe(controlMenu);
    expect(actionBar?.contains(host ?? null)).toBe(false);
  });

  it("hides and restores the full LinkedIn card reversibly", () => {
    document.body.innerHTML = loadFixture("linkedin-feed.html");
    const card = findLinkedInPosts(document)[0];

    linkedinAdapter.hideElement(card);
    expect(card.style.display).toBe("none");
    expect(card.previousElementSibling?.textContent).toContain("Sift hid this post");

    linkedinAdapter.restoreElement(card);
    expect(card.style.display).toBe("");
    expect(document.querySelector(".sift-hidden-placeholder")).toBeNull();
  });

  it("handles later DOM additions for infinite-scroll style feeds", () => {
    document.body.innerHTML = loadFixture("linkedin-feed.html");
    expect(findLinkedInPosts(document)).toHaveLength(3);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = loadFixture("linkedin-job-post.html");
    const nextCard = wrapper.querySelector("[data-id*='urn:li:activity']");
    document.body.appendChild(nextCard as HTMLElement);

    expect(findLinkedInPosts(document)).toHaveLength(4);
  });
});
