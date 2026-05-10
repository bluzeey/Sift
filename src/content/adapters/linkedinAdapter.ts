import type { InjectionTarget, PostCandidate, PostKind, SiteAdapter } from "../../shared/types";
import { extractPostMedia } from "../dom/mediaExtractor";
import { cleanText, isElementVisible, isGoodCandidatePayload, isGoodCandidateText, isIgnoredContainer, readNodeText } from "../dom/textExtractor";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";

const primaryCardSelectors = [
  ".feed-shared-update-v2",
  "article.update-components-article",
  "div[data-urn*='urn:li:activity']",
  "div[data-id*='urn:li:activity']",
  "div[role='listitem']"
];

const textSelectors = [
  "[data-testid='expandable-text-box']",
  ".update-components-update-v2__commentary",
  ".feed-shared-update-v2__description",
  ".feed-shared-text",
  ".update-components-text",
  ".break-words"
];

const authorSelectors = [
  ".update-components-actor__name",
  ".feed-shared-actor__name"
];

const articleTitleSelectors = [
  ".update-components-article__title",
  ".feed-shared-article__title",
  ".update-components-article__meta"
];

const resharedTextSelectors = [
  ".update-components-mini-update-v2",
  ".feed-shared-mini-update-v2"
];

const metadataSelectors = [
  "time",
  "a[href*='/posts/']",
  "a[href*='activity-']"
];

const controlMenuSelectors = [
  "button[aria-label^='Open control menu for post by']",
  "button[aria-label*='Open control menu for post by']",
  ".feed-shared-control-menu",
  ".feed-shared-update-v2__control-menu",
  ".feed-shared-update-v2__control-menu-container"
];

const headerSelectors = [
  ".update-components-actor",
  ".feed-shared-actor",
  "div[aria-label*='Profile']",
  "div[aria-label*='profile']",
  ".feed-shared-update-v2__content"
];

const actionButtonSelectors = [
  "button[aria-label*='React']",
  "button[aria-label*='Like']",
  "button[aria-label*='reaction']",
  "button[aria-label^='Reaction button state']",
  "button[aria-label*='Comment']",
  "button[aria-label*='comment']",
  "button[aria-label*='Repost']",
  "button[aria-label*='repost']",
  "button[aria-label*='Share']",
  "button[aria-label*='Send']",
  "button[aria-label*='Share in a private message']"
];

const uiOnlyLinePatterns = [
  /^feed post$/i,
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
    if (element && isElementVisible(element) && (readNodeText(element) || element.getAttribute("aria-label"))) {
      return element;
    }
  }

  return null;
}

function normalizeLinkedInAuthor(line: string): string {
  return line
    .replace(/\s*•\s*(?:1st|2nd|3rd\+?)$/i, "")
    .replace(/\s+Verified(?:\s+Profile)?$/i, "")
    .trim();
}

function extractLines(input: string): string[] {
  return input
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findFirstMatchingLine(input: string, predicate: (line: string) => boolean): string | undefined {
  return extractLines(input).find(predicate);
}

function findVisibleTopLinks(card: HTMLElement): HTMLAnchorElement[] {
  return (Array.from(card.querySelectorAll("a[href]")) as HTMLAnchorElement[])
    .filter((anchor) => isElementVisible(anchor))
    .filter((anchor) => anchor.href.includes("/in/") || anchor.href.includes("/company/"));
}

function findLikelyHeaderRoot(card: HTMLElement): HTMLElement | null {
  const directMatch = queryFirstVisible(card, headerSelectors);
  if (directMatch) {
    return (
      directMatch.closest("a[href*='/in/'], a[href*='/company/']") as HTMLElement | null
    ) ?? directMatch;
  }

  return findVisibleTopLinks(card)[0] ?? null;
}

function isLinkedInTimestampLine(line: string): boolean {
  return /^\d+\s*(?:s|m|h|d|w|mo|y|yr)s?\b/i.test(line.replace(/\s*•.*$/, "").trim());
}

function extractLinkedInAuthor(card: HTMLElement): string {
  const explicit = cleanLinkedInText(textFromFirst(card, authorSelectors));
  const explicitLine = findFirstMatchingLine(explicit, (line) => Boolean(normalizeLinkedInAuthor(line)));
  if (explicitLine) {
    return normalizeLinkedInAuthor(explicitLine);
  }

  const headerRoot = findLikelyHeaderRoot(card);
  const headerText = cleanLinkedInText(readNodeText(headerRoot));
  const line = findFirstMatchingLine(headerText, (candidate) => {
    const normalized = normalizeLinkedInAuthor(candidate);
    const lower = normalized.toLowerCase();
    if (!normalized || normalized.length > 120) {
      return false;
    }

    if (isLinkedInTimestampLine(normalized)) {
      return false;
    }

    return !(
      lower.startsWith("view ") ||
      lower.includes("followers") ||
      lower.includes("following") ||
      lower === "promoted" ||
      lower === "suggested" ||
      /^•\s*(?:1st|2nd|3rd\+?)$/i.test(normalized)
    );
  });

  return line ? normalizeLinkedInAuthor(line) : "";
}

function extractLinkedInTimestamp(card: HTMLElement): string | undefined {
  const timeElement = card.querySelector("time") as HTMLTimeElement | null;
  if (timeElement?.getAttribute("datetime")) {
    return timeElement.getAttribute("datetime") ?? undefined;
  }

  const headerRoot = findLikelyHeaderRoot(card);
  const headerText = cleanLinkedInText(readNodeText(headerRoot));
  const timestampLine = findFirstMatchingLine(headerText, isLinkedInTimestampLine);
  if (timestampLine) {
    return timestampLine.replace(/\s*•.*$/, "").trim();
  }

  const metadata = cleanLinkedInText(textFromFirst(card, metadataSelectors));
  const metadataLine = findFirstMatchingLine(metadata, isLinkedInTimestampLine);
  return metadataLine?.replace(/\s*•.*$/, "").trim();
}

function scoreLinkedInPostUrl(anchor: HTMLAnchorElement): number {
  let score = 0;
  if (anchor.href.includes("/feed/update/")) {
    score += 4;
  }
  if (anchor.href.includes("activity-")) {
    score += 3;
  }
  if (anchor.href.includes("urn:li:activity")) {
    score += 2;
  }
  if (anchor.href.includes("/posts/")) {
    score += 1;
  }
  if (anchor.href.includes("/in/") || anchor.href.includes("/company/")) {
    score -= 2;
  }
  return score;
}

function isLinkedInCardContainer(element: HTMLElement): boolean {
  return element.matches("[role='list'], [data-testid='mainFeed'], [data-component-type='LazyColumn']");
}

function isLinkedInActionElement(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute("aria-label")?.toLowerCase() ?? "";
  if (
    ariaLabel.includes("react") ||
    ariaLabel.includes("like") ||
    ariaLabel.includes("reaction") ||
    ariaLabel.includes("comment") ||
    ariaLabel.includes("repost") ||
    ariaLabel.includes("send") ||
    ariaLabel.includes("share")
  ) {
    return true;
  }

  const text = readNodeText(element).replace(/\s+/g, " ").trim().toLowerCase();
  return text === "like" || text === "comment" || text === "repost" || text === "send" || text === "share";
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

export function getLinkedInActionButtons(card: HTMLElement): HTMLElement[] {
  const explicitMatches = actionButtonSelectors.flatMap((selector) => Array.from(card.querySelectorAll(selector)) as HTMLElement[]);
  const textMatches = (Array.from(card.querySelectorAll("button, a[href]")) as HTMLElement[]).filter((element) =>
    isLinkedInActionElement(element)
  );

  return Array.from(new Set([...explicitMatches, ...textMatches])).filter((element) => isElementVisible(element));
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

  if (isLinkedInCardContainer(element)) {
    return false;
  }

  if (element.closest(".artdeco-modal, [role='dialog']")) {
    return false;
  }

  const text = cleanLinkedInText(readNodeText(element));
  if (text.length < 25) {
    return false;
  }

  const hasPostText = Boolean(queryFirstVisible(element, [
    "[data-testid='expandable-text-box']",
    ".update-components-update-v2__commentary",
    ".feed-shared-update-v2__description",
    ".feed-shared-text",
    ".update-components-text"
  ]));
  const hasControlMenu = Boolean(queryFirstVisible(element, controlMenuSelectors));
  const hasActivityUrn =
    element.matches("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']") ||
    Boolean(element.querySelector("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']"));

  return hasPostText || hasLinkedInActionButtons(element) || hasActivityUrn || hasControlMenu;
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

  const fallbackNodes = Array.from(root.querySelectorAll("div[role='listitem'], .feed-shared-update-v2, article.update-components-article")) as HTMLElement[];
  return dedupeNestedCards(
    fallbackNodes.filter((element) => {
      if (!isLikelyLinkedInPostCard(element)) {
        return false;
      }

      return (
        Boolean(element.querySelector("[data-testid='expandable-text-box'], .update-components-update-v2__commentary, .update-components-text")) ||
        Boolean(element.querySelector("[data-urn*='urn:li:activity'], [data-id*='urn:li:activity']")) ||
        Boolean(queryFirstVisible(element, controlMenuSelectors)) ||
        hasLinkedInActionButtons(element)
      );
    })
  );
}

export function findLinkedInPostUrl(card: HTMLElement): string | undefined {
  const anchors = Array.from(card.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  const rankedAnchors = anchors
    .filter((anchor) =>
      anchor.href.includes("/posts/") ||
      anchor.href.includes("activity-") ||
      anchor.href.includes("urn:li:activity") ||
      anchor.href.includes("/feed/update/")
    )
    .sort((left, right) => scoreLinkedInPostUrl(right) - scoreLinkedInPostUrl(left));

  return rankedAnchors[0]?.href;
}

function findTimestamp(card: HTMLElement): string | undefined {
  return extractLinkedInTimestamp(card);
}

export function inferLinkedInKind(card: HTMLElement, text: string): PostKind {
  const lower = text.toLowerCase();
  const rawLower = readNodeText(card).toLowerCase();

  if (rawLower.includes("promoted") || rawLower.includes("sponsored") || lower.includes("promoted") || lower.includes("sponsored")) {
    return "ad";
  }

  if (lower.includes("reposted this") || lower.includes("reposted")) {
    return "repost";
  }

  if (
    card.querySelector("a[href*='/jobs/'], a[href*='currentJobId=']") ||
    lower.includes("hiring") ||
    lower.includes("job") ||
    lower.includes("apply")
  ) {
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
  const author = extractLinkedInAuthor(card);
  const commentary = cleanLinkedInText(textFromFirst(card, textSelectors));
  const articleTitle = cleanLinkedInText(textFromFirst(card, articleTitleSelectors));
  const resharedText = cleanLinkedInText(textFromFirst(card, resharedTextSelectors));
  const media = extractPostMedia(card, {
    ignoredSelector: [
      ".update-components-actor",
      ".feed-shared-actor",
      ".feed-shared-update-v2__control-menu-container",
      "[aria-label*='Profile']",
      "[aria-label*='profile']"
    ].join(", ")
  });

  let text = cleanLinkedInText(
    [author ? `Author: ${author}` : "", commentary, articleTitle, resharedText].filter(Boolean).join("\n\n")
  );

  if (!text) {
    text = cleanLinkedInText(readNodeText(card));
  }

  const kind = inferLinkedInKind(card, text);
  const cappedText = capLinkedInText(text, kind);
  const isMediaOnly = !isGoodCandidateText(cappedText, card) && media.mediaType !== "none";
  if (!isGoodCandidatePayload({ text: cappedText, mediaSummary: media.mediaSummary, mediaType: media.mediaType, isMediaOnly }, card)) {
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
    kind,
    mediaType: media.mediaType,
    mediaSummary: media.mediaSummary || undefined,
    images: media.images,
    isMediaOnly
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
