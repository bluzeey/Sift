import type { PostCandidate, SiteAdapter } from "../../shared/types";
import { buildCandidateId, hideElement, restoreElement } from "./baseAdapter";
import { cleanText, isGoodCandidateText, readNodeText } from "../dom/textExtractor";

export const substackAdapter: SiteAdapter = {
  site: "substack",
  matchesLocation(location) {
    return location.hostname === "substack.com" || location.hostname.endsWith(".substack.com");
  },
  findCandidates(root) {
    const previews = Array.from(root.querySelectorAll(".post-preview")) as HTMLElement[];
    if (previews.length > 0) {
      return previews;
    }

    const articleLike = (Array.from(root.querySelectorAll("article, .post")) as HTMLElement[]).filter((element) => {
      const text = cleanText(readNodeText(element), { site: "substack", kind: "article" });
      return Boolean(element.querySelector("h1")) && text.length > 500;
    });

    if (articleLike.length > 0) {
      return Array.from(new Set(articleLike));
    }

    return (Array.from(root.querySelectorAll("main")) as HTMLElement[]).filter((element) => {
      const text = cleanText(readNodeText(element), { site: "substack", kind: "article" });
      return Boolean(element.querySelector("h1")) && text.length > 500;
    });
  },
  extractCandidate(element): PostCandidate | null {
    const titleEl =
      (element.querySelector(".post-preview-title") as HTMLElement | null) ||
      (element.querySelector("h1") as HTMLElement | null);
    const descriptionEl = element.querySelector(".post-preview-description") as HTMLElement | null;
    const bodyEl = element.querySelector(".available-content, .markup, .body, .post") as HTMLElement | null;

    const kind = location.pathname.startsWith("/p/") ? "article" : "post";
    const title = cleanText(readNodeText(titleEl), { site: "substack", kind });
    const description = cleanText(readNodeText(descriptionEl), { site: "substack", kind });
    const body = cleanText(readNodeText(bodyEl), { site: "substack", kind });

    let text = cleanText([title, description, body].filter(Boolean).join("\n\n"), { site: "substack", kind });
    if (!text) {
      text = cleanText(readNodeText(element), { site: "substack", kind });
    }

    if (!isGoodCandidateText(text, element)) {
      return null;
    }

    const link = element.querySelector("a[href*='/p/']") as HTMLAnchorElement | null;

    return {
      id: buildCandidateId("substack", link?.href || `${location.href}:${text.slice(0, 180)}`),
      site: "substack",
      element,
      text,
      url: link?.href || location.href,
      kind
    };
  },
  getInjectionTarget(element) {
    return element;
  },
  hideElement,
  restoreElement
};
