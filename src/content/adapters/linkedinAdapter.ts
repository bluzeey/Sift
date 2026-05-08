import type { InjectionTarget, PostCandidate, PostKind, SiteAdapter } from "../../shared/types";
import { cleanText, isElementVisible, isGoodCandidateText, isIgnoredContainer, readNodeText } from "../dom/textExtractor";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";

const primaryCardSelectors = [
  ".feed-shared-update-v2",
  "article.update-components-article",
  "div[data-urn*='urn:li:activity']",
  "div[data-id*='urn:li:activity']"
];

const textSelectors = [
  ".update-components-update-v2__commentary",
  ".feed-shared-update-v2__description",
  ".feed-shared-text",
  ".update-components-text",
  ".break-words",
  "[dir='ltr']"
];

const authorSelectors = [
  ".update-components-actor__name",
  ".feed-shared-actor__name",
  ".update-components-actor__title",
  "a[href*='/in/']",
  "a[href*='/company/']"
];

const articleTitleSelectors = [
  ".update-components-article__title",
  ".feed-shared-article__title",
  ".update-components-article__meta",
  "h2",
  "h3"
];

const resharedTextSelectors = [
  ".update-components-mini-update-v2",
  ".feed-shared-mini-update-v2"
];

const metadataSelectors = [
  ".update-components-actor__description",
  ".feed-shared-actor__description",
  ".update-components-actor__sub-description",
  "time",
  "a[href*='/posts/']",
  "a[href*='activity-']"
];

const controlMenuSelectors = [
  ".feed-shared-control-menu",
  ".feed-shared-update-v2__control-menu",
  ".feed-shared-update-v2__control-menu-container"
];

const headerSelectors = [
  ".update-components-actor",
  ".feed-shared-actor",
  ".feed-shared-update-v2__content"
];

const actionButtonSelectors = [
  "button[aria-label*='React']",
  "button[aria-label*='Like']",
  "button[aria-label*='reaction']",
  "button[aria-label*='Comment']",
  "button[aria-label*='comment']",
  "button[aria-label*='Repost']",
  "button[aria-label*='repost']",
  "button[aria-label*='Share']",
  "button[aria-label*='Send']",
  "button[aria-label*='Share in a private message']"
];

const uiOnlyLinePatterns = [
  /^(?:like|comment|repost|send|share|follow|connect|message|view profile)$/i,
  /^(?:view more|see more|show more|show less)$/i,
  /^(?:send in a private message|open reactions menu|react|celebrate|support|love|insightful|funny)$/i,
  /^activate to view larger image$/i,
  /^click to see more$/i,
  /^hashtag$/i,
  /^[\d,.]+\s+(?:comments|comment|reposts|repost|reactions|reaction)$/i
];

function queryFirstVisible(root: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector) as HTMLElement | null;
    if (element && isElementVisible(element) && readNodeText(element)) {
      return element;
    }
  }

  return null;
}

export function textFromFirst(root: HTMLElement, selectors: string[]): string {
  return readNodeText(queryFirstVisible(root, selectors));
}

function lineIsUiOnly(line: string): boolean {
  const normalized = line.replace(/\s+/g, " ").trim();
  return uiOnlyLinePatterns.some((pattern) => pattern.test(normalized));
}

export function cleanLinkedInText(input: string): string {
  const normalizedLines = input
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !lineIsUiOnly(line));

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of normalizedLines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(line);
  }

  return cleanText(deduped.join("\n"), { site: "linkedin", kind: "post" });
}

export function getLinkedInActionButtons(card: HTMLElement): HTMLButtonElement[] {
  const buttons = actionButtonSelectors.flatMap((selector) => Array.from(card.querySelectorAll(selector)) as HTMLButtonElement[]);
  return Array.from(new Set(buttons)).filter((button) => isElementVisible(button));
}

function hasLinkedInActionButtons(card: HTMLElement): boolean {
  return getLinkedInActionButtons(card).length > 0;
}

export function dedupeNestedCards(cards: HTMLElement[]): HTMLElement[] {
  return cards.filter((card) => !cards.some((other) => other !== card && other.contains(card)));
}

export function isLikelyLinkedInPostCard(element: HTMLElement): boolean {
  if (!element || !element.isConnected) {
    return false;
  }

  if (element.closest("[data-sift-root-host='true']") || isIgnoredContainer(element) || !isElementVisible(element)) {
    return false;
  }

  if (element.closest(".artdeco-modal, [role='dialog']")) {
    return false;
  }

  const text = cleanLinkedInText(readNodeText(element));
  if (text.length < 40) {
    return false;
  }

  const hasPostText = Boolean(queryFirstVisible(element, [
    ".update-components-update-v2__commentary",
    ".feed-shared-update-v2__description",
    ".feed-shared-text",
    "[dir='ltr']"
  ]));
  const hasActivityUrn =
    element.matches("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']") ||
    Boolean(element.querySelector("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']"));

  return hasPostText || hasLinkedInActionButtons(element) || hasActivityUrn;
}

export function findLinkedInPosts(root: ParentNode): HTMLElement[] {
  const collected: HTMLElement[] = [];
  for (const selector of primaryCardSelectors) {
    const nodes = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    const candidates = nodes.filter((element) => isLikelyLinkedInPostCard(element));
    if (candidates.length > 0) {
      collected.push(...candidates);
    }
  }

  if (collected.length > 0) {
    return dedupeNestedCards(Array.from(new Set(collected)));
  }

  const fallbackNodes = Array.from(root.querySelectorAll("article, div, li")) as HTMLElement[];
  return dedupeNestedCards(
    fallbackNodes.filter((element) => {
      if (!isLikelyLinkedInPostCard(element)) {
        return false;
      }

      return (
        Boolean(element.querySelector(".update-components-update-v2__commentary")) ||
        Boolean(element.querySelector("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']")) ||
        hasLinkedInActionButtons(element)
      );
    })
  );
}

export function findLinkedInPostUrl(card: HTMLElement): string | undefined {
  const anchors = Array.from(card.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  return anchors.find((anchor) =>
    anchor.href.includes("/posts/") ||
    anchor.href.includes("activity-") ||
    anchor.href.includes("urn:li:activity") ||
    anchor.href.includes("/feed/update/")
  )?.href;
}

function findTimestamp(card: HTMLElement): string | undefined {
  const timeElement = card.querySelector("time") as HTMLTimeElement | null;
  if (timeElement?.getAttribute("datetime")) {
    return timeElement.getAttribute("datetime") ?? undefined;
  }

  const metadata = cleanLinkedInText(textFromFirst(card, metadataSelectors));
  return metadata || undefined;
}

export function inferLinkedInKind(card: HTMLElement, text: string): PostKind {
  const lower = text.toLowerCase();

  if (lower.includes("promoted") || lower.includes("sponsored")) {
    return "ad";
  }

  if (lower.includes("reposted this") || lower.includes("reposted")) {
    return "repost";
  }

  if (lower.includes("hiring") || lower.includes("job") || lower.includes("apply")) {
    return "job";
  }

  if (card.querySelector(".update-components-article__title, .feed-shared-article__title")) {
    return "article";
  }

  return "post";
}

function capLinkedInText(text: string, kind: PostKind): string {
  const limit = kind === "repost" ? 4500 : kind === "article" || kind === "job" ? 3000 : 4000;
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trim()}...`;
}

export function extractLinkedInPost(card: HTMLElement): PostCandidate | null {
  const author = cleanLinkedInText(textFromFirst(card, authorSelectors));
  const commentary = cleanLinkedInText(textFromFirst(card, textSelectors));
  const articleTitle = cleanLinkedInText(textFromFirst(card, articleTitleSelectors));
  const resharedText = cleanLinkedInText(textFromFirst(card, resharedTextSelectors));

  let text = cleanLinkedInText(
    [author ? `Author: ${author}` : "", commentary, articleTitle, resharedText].filter(Boolean).join("\n\n")
  );

  if (!text) {
    text = cleanLinkedInText(readNodeText(card));
  }

  const kind = inferLinkedInKind(card, text);
  const cappedText = capLinkedInText(text, kind);
  if (!isGoodCandidateText(cappedText, card)) {
    return null;
  }

  const url = findLinkedInPostUrl(card);

  return {
    id: buildCandidateId("linkedin", url || cappedText.slice(0, 500)),
    site: "linkedin",
    element: card,
    text: cappedText,
    url,
    author: author || undefined,
    timestamp: findTimestamp(card),
    kind
  };
}

export function getLinkedInInjectionTarget(card: HTMLElement): InjectionTarget {
  const controlArea = queryFirstVisible(card, controlMenuSelectors);
  if (controlArea?.parentElement) {
    return {
      element: controlArea.parentElement,
      mode: "inline",
      before: controlArea
    };
  }

  const header = queryFirstVisible(card, headerSelectors);
  if (header) {
    return {
      element: header,
      mode: "inline"
    };
  }

  return { element: card, mode: "overlay" };
}

export const linkedinAdapter: SiteAdapter = {
  site: "linkedin",
  matchesLocation(location) {
    return location.hostname === "www.linkedin.com" || location.hostname === "linkedin.com";
  },
  findCandidates(root) {
    return findLinkedInPosts(root);
  },
  extractCandidate(element) {
    return extractLinkedInPost(element);
  },
  getInjectionTarget(element) {
    return getLinkedInInjectionTarget(element);
  },
  hideElement,
  restoreElement
};
