import type { PostCandidate, SiteAdapter } from "../../shared/types";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";
import { cleanText, isGoodCandidateText, readNodeText } from "../dom/textExtractor";

export const xAdapter: SiteAdapter = {
  site: "x",
  matchesLocation(location) {
    return location.hostname === "x.com" || location.hostname === "twitter.com";
  },
  findCandidates(root) {
    const primary = Array.from(root.querySelectorAll("article[data-testid='tweet']")) as HTMLElement[];
    const secondary = (Array.from(root.querySelectorAll("article[role='article'], article")) as HTMLElement[]).filter(
      (element) =>
        Boolean(element.querySelector("[data-testid='tweetText']")) ||
        Boolean(element.querySelector("a[href*='/status/']")) ||
        Boolean(element.querySelector("time"))
    );

    return Array.from(new Set([...primary, ...secondary]));
  },
  extractCandidate(element): PostCandidate | null {
    const tweetText = readNodeText(element.querySelector("[data-testid='tweetText']"));
    const fallbackText = cleanText(readNodeText(element), { site: "x", kind: "post" });
    const text = cleanText(tweetText || fallbackText, { site: "x", kind: "post" });

    if (!isGoodCandidateText(text, element)) {
      return null;
    }

    const statusLink = element.querySelector("a[href*='/status/']") as HTMLAnchorElement | null;
    const authorEl = element.querySelector("[data-testid='User-Name']");
    const timestampEl = element.querySelector("time");

    return {
      id: buildCandidateId("x", statusLink?.href || text),
      site: "x",
      element,
      text,
      url: statusLink?.href,
      author: readNodeText(authorEl),
      timestamp: timestampEl?.getAttribute("datetime") ?? undefined,
      kind: "post"
    };
  },
  getInjectionTarget(element) {
    return { element, mode: "overlay" };
  },
  hideElement,
  restoreElement
};
