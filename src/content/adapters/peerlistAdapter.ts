import type { InjectionTarget, PostCandidate, SiteAdapter } from "../../shared/types";
import { extractPostMedia } from "../dom/mediaExtractor";
import { cleanText, isElementVisible, isGoodCandidatePayload, isGoodCandidateText, isIgnoredContainer, readNodeText } from "../dom/textExtractor";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";

const peerlistTitleSelectors = [
  "p.font-semibold",
  "h2",
  "h3"
];

const peerlistBodySelectors = [
  ".post-caption",
  ".rich-text-paragraph-regular",
  ".break-words"
];

const peerlistMetaSelectors = [
  ".text-gray-500.text-xs",
  ".text-xs"
];

const peerlistUiOnlyPatterns = [
  /^follow$/i,
  /^comment$/i,
  /^reshare(?:\s+or\s+repost)?$/i,
  /^repost$/i,
  /^upvote$/i,
  /^screenshot$/i,
  /^[\d,.]+[kmb]?$/i
];

function queryFirstVisible(root: ParentNode, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector) as HTMLElement | null;
    if (element && isElementVisible(element)) {
      return element;
    }
  }

  return null;
}

function cleanPeerlistText(input: string): string {
  const lines = input
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !peerlistUiOnlyPatterns.some((pattern) => pattern.test(line)));

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(line);
  }

  return deduped.join("\n").trim();
}

function getPeerlistActionRow(card: HTMLElement): HTMLElement | null {
  return queryFirstVisible(card, ["#reaction-box"]);
}

function isLikelyPeerlistPostCard(element: HTMLElement): boolean {
  if (!element.isConnected || !isElementVisible(element) || isIgnoredContainer(element)) {
    return false;
  }

  const actionRow = getPeerlistActionRow(element);
  if (!actionRow) {
    return false;
  }

  const title = readNodeText(queryFirstVisible(element, peerlistTitleSelectors));
  const body = readNodeText(queryFirstVisible(element, peerlistBodySelectors));
  const text = cleanPeerlistText([title, body].filter(Boolean).join("\n"));
  return text.length >= 20;
}

function extractPeerlistAuthor(card: HTMLElement): string {
  return cleanText(readNodeText(queryFirstVisible(card, ["h3"])), { site: "peerlist", kind: "post" });
}

function extractPeerlistTimestamp(card: HTMLElement): string | undefined {
  const metaText = cleanPeerlistText(readNodeText(queryFirstVisible(card, peerlistMetaSelectors)));
  return metaText.match(/\b\d+\s*(?:s|m|h|d|w|mo)\b/i)?.[0];
}

function findPeerlistPostUrl(card: HTMLElement): string | undefined {
  const anchors = Array.from(card.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  return anchors.find((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    return href.startsWith("/post/") || href.includes("/scroll/") || href.includes("/launchpad/");
  })?.href;
}

export function getPeerlistInjectionTarget(card: HTMLElement): InjectionTarget {
  const actionRow = getPeerlistActionRow(card);
  if (actionRow?.parentElement) {
    return {
      element: actionRow.parentElement,
      mode: "inline",
      before: actionRow
    };
  }

  return { element: card, mode: "overlay" };
}

export const peerlistAdapter: SiteAdapter = {
  site: "peerlist",
  matchesLocation(location) {
    return location.hostname === "peerlist.io" || location.hostname === "www.peerlist.io";
  },
  findCandidates(root) {
    const primary = Array.from(root.querySelectorAll("article[role='none']")) as HTMLElement[];
    return primary.filter((element) => isLikelyPeerlistPostCard(element));
  },
  extractCandidate(element): PostCandidate | null {
    if (isIgnoredContainer(element)) {
      return null;
    }

    const author = extractPeerlistAuthor(element);
    const title = cleanText(readNodeText(queryFirstVisible(element, peerlistTitleSelectors)), { site: "peerlist", kind: "post" });
    const body = cleanText(readNodeText(queryFirstVisible(element, peerlistBodySelectors)), { site: "peerlist", kind: "post" });
    let text = cleanText([author ? `Author: ${author}` : "", title, body].filter(Boolean).join("\n\n"), {
      site: "peerlist",
      kind: "post"
    });

    const media = extractPostMedia(element, {
      ignoredSelector: ".rounded-full, img[alt*='avatar']",
      videoSelector: "video, mux-player, mux-video, media-controller",
      minWidth: 120,
      minHeight: 120
    });
    const isMediaOnly = !isGoodCandidateText(text, element) && media.mediaType !== "none";

    if (!text) {
      text = cleanText(cleanPeerlistText(readNodeText(element)), { site: "peerlist", kind: "post" });
    }

    if (!isGoodCandidatePayload({ text, mediaSummary: media.mediaSummary, mediaType: media.mediaType, isMediaOnly }, element)) {
      return null;
    }

    const url = findPeerlistPostUrl(element);
    const topicMatch = cleanPeerlistText(readNodeText(queryFirstVisible(element, peerlistMetaSelectors))).match(/#[A-Za-z0-9_]+/);

    return {
      id: buildCandidateId("peerlist", url || `${author}\n${title}\n${body || media.mediaSummary || text}`),
      site: "peerlist",
      element,
      text,
      url,
      author: author || undefined,
      community: topicMatch?.[0],
      timestamp: extractPeerlistTimestamp(element),
      kind: "post",
      mediaType: media.mediaType,
      mediaSummary: media.mediaSummary || undefined,
      images: media.images,
      isMediaOnly
    };
  },
  getInjectionTarget(element) {
    return getPeerlistInjectionTarget(element);
  },
  hideElement,
  restoreElement
};
