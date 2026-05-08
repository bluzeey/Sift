import type { PostCandidate, SiteAdapter } from "../../shared/types";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";
import { cleanText, isGoodCandidateText, readNodeText } from "../dom/textExtractor";

export const redditAdapter: SiteAdapter = {
  site: "reddit",
  matchesLocation(location) {
    return location.hostname === "reddit.com" || location.hostname === "www.reddit.com";
  },
  findCandidates(root) {
    const primary = Array.from(root.querySelectorAll("shreddit-post")) as HTMLElement[];
    const secondary = (Array.from(root.querySelectorAll("article, div[data-testid='post-container']")) as HTMLElement[]).filter(
      (element) =>
        Boolean(element.querySelector("a[href*='/comments/']")) || /r\/[A-Za-z0-9_]+/.test(readNodeText(element))
    );

    return Array.from(new Set([...primary, ...secondary]));
  },
  extractCandidate(element): PostCandidate | null {
    const titleEl =
      (element.querySelector("[slot='title']") as HTMLElement | null) ||
      (element.querySelector("a[href*='/comments/']") as HTMLElement | null);
    const bodyEl = element.querySelector("[slot='text-body']") as HTMLElement | null;

    const title = cleanText(readNodeText(titleEl), { site: "reddit", kind: "post" });
    const body = cleanText(readNodeText(bodyEl), { site: "reddit", kind: "post" });
    let text = cleanText([title, body].filter(Boolean).join("\n\n"), { site: "reddit", kind: "post" });
    if (!text) {
      text = cleanText(readNodeText(element), { site: "reddit", kind: "post" });
    }

    if (!isGoodCandidateText(text, element)) {
      return null;
    }

    const link = element.querySelector("a[href*='/comments/']") as HTMLAnchorElement | null;
    const communityMatch = text.match(/r\/[A-Za-z0-9_]+/);

    return {
      id: buildCandidateId("reddit", link?.href || text),
      site: "reddit",
      element,
      text,
      url: link?.href,
      community: communityMatch?.[0],
      kind: "post"
    };
  },
  getInjectionTarget(element) {
    return element;
  },
  hideElement,
  restoreElement
};
