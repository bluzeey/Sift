import type { PostCandidate, PostKind, SiteAdapter } from "../../shared/types";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";
import { extractPostMedia } from "../dom/mediaExtractor";
import { cleanText, isGoodCandidatePayload, isGoodCandidateText, readNodeText } from "../dom/textExtractor";

const noteSelector = "[role='article'][aria-label='Note']";

function getUniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements));
}

function isNoteElement(element: HTMLElement): boolean {
  return element.matches(noteSelector);
}

function getSubstackKind(element: HTMLElement): PostKind {
  if (isNoteElement(element) || location.pathname.includes("/note/")) {
    return "note";
  }

  if (location.pathname.startsWith("/p/") || Boolean(element.querySelector("h1"))) {
    return "article";
  }

  return "post";
}

export const substackAdapter: SiteAdapter = {
  site: "substack",
  matchesLocation(location) {
    return location.hostname === "substack.com" || location.hostname.endsWith(".substack.com");
  },
  findCandidates(root) {
    const previews = Array.from(root.querySelectorAll(".post-preview")) as HTMLElement[];
    const notes = (Array.from(root.querySelectorAll(noteSelector)) as HTMLElement[]).filter(
      (element) => !element.parentElement?.closest(noteSelector)
    );

    const articleLike = (Array.from(root.querySelectorAll("article, .post")) as HTMLElement[]).filter((element) => {
      const text = cleanText(readNodeText(element), { site: "substack", kind: "article" });
      return Boolean(element.querySelector("h1")) && text.length > 500;
    });

    const directCandidates = getUniqueElements([...previews, ...notes, ...articleLike]);
    if (directCandidates.length > 0) {
      return directCandidates;
    }

    return (Array.from(root.querySelectorAll("main")) as HTMLElement[]).filter((element) => {
      const text = cleanText(readNodeText(element), { site: "substack", kind: "article" });
      return Boolean(element.querySelector("h1")) && text.length > 500;
    });
  },
  extractCandidate(element): PostCandidate | null {
    const kind = getSubstackKind(element);
    const titleEl =
      (element.querySelector(".post-preview-title") as HTMLElement | null) ||
      (element.querySelector("h1") as HTMLElement | null);
    const descriptionEl = element.querySelector(".post-preview-description") as HTMLElement | null;
    const bodyEl = element.querySelector(".available-content, .markup, .body, .post") as HTMLElement | null;
    const noteBodyEl = element.querySelector(".FeedProseMirror") as HTMLElement | null;
    const sharedPreviewEl = element.querySelector("a.postAttachment-eYV3fM[href*='/p/']") as HTMLElement | null;

    const title = cleanText(readNodeText(titleEl), { site: "substack", kind });
    const description = cleanText(readNodeText(descriptionEl), { site: "substack", kind });
    const body = cleanText(readNodeText(bodyEl), { site: "substack", kind });
    const noteBody = cleanText(readNodeText(noteBodyEl), { site: "substack", kind });
    const sharedPreview = cleanText(readNodeText(sharedPreviewEl), { site: "substack", kind });

    let text = cleanText([title, description, body, noteBody, sharedPreview].filter(Boolean).join("\n\n"), {
      site: "substack",
      kind
    });
    if (!text) {
      text = cleanText(readNodeText(element), { site: "substack", kind });
    }

    const media = extractPostMedia(element, {
      ignoredSelector: ".post-meta, .post-preview-byline, .post-preview-author, .avatar, header"
    });
    const isMediaOnly = !isGoodCandidateText(text, element) && media.mediaType !== "none";

    if (!isGoodCandidatePayload({ text, mediaSummary: media.mediaSummary, mediaType: media.mediaType, isMediaOnly }, element)) {
      return null;
    }

    const noteLink = element.querySelector("a[href*='/note/']") as HTMLAnchorElement | null;
    const postLink = element.querySelector("a[href*='/p/']") as HTMLAnchorElement | null;
    const link = kind === "note" ? noteLink || postLink : postLink;

    return {
      id: buildCandidateId("substack", link?.href || `${location.href}:${text.slice(0, 180)}`),
      site: "substack",
      element,
      text,
      url: link?.href || location.href,
      kind,
      mediaType: media.mediaType,
      mediaSummary: media.mediaSummary || undefined,
      images: media.images,
      isMediaOnly
    };
  },
  getInjectionTarget(element) {
    return { element, mode: "overlay" };
  },
  hideElement,
  restoreElement
};
