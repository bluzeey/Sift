import type { PostKind, SupportedSite } from "../../shared/types";

const ACTION_LABELS = new Set([
  "reply",
  "repost",
  "like",
  "views",
  "share",
  "save",
  "follow",
  "promoted",
  "more",
  "show more",
  "hide",
  "show"
]);

export function readNodeText(node: Element | null | undefined): string {
  if (!node) {
    return "";
  }

  const raw = (node as HTMLElement).innerText ?? node.textContent ?? "";
  return raw.trim();
}

function isMostlyUiLine(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return ACTION_LABELS.has(normalized) || /^[\d,.]+[kmb]?$/.test(normalized);
}

export function getTextLimit(site: SupportedSite, kind: PostKind | undefined): number {
  if (site === "substack" && kind === "article") {
    return 3200;
  }

  return 4000;
}

export function cleanText(input: string, options?: { site?: SupportedSite; kind?: PostKind }): string {
  const actionSuffixPattern = /\b(?:Reply|Repost|Like|Views|Share|Save|Follow)(?:\s+(?:Reply|Repost|Like|Views|Share|Save|Follow))+$/i;
  const lines = input
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim().replace(actionSuffixPattern, "").trim())
    .filter(Boolean)
    .filter((line) => !isMostlyUiLine(line));

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

  const text = deduped.join("\n").trim();
  const limit = options?.site ? getTextLimit(options.site, options.kind) : 4000;
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trim()}...`;
}

export function isElementVisible(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false;
  }

  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  if (!style) {
    return true;
  }

  return style.display !== "none" && style.visibility !== "hidden";
}

export function isIgnoredContainer(element: HTMLElement): boolean {
  return Boolean(
    element.closest(
      [
        "nav",
        "header",
        "footer",
        "aside",
        "dialog",
        "[role='dialog']",
        "[aria-modal='true']",
        "[data-sift-root-host='true']",
        ".sift-hidden-placeholder"
      ].join(",")
    )
  );
}

export function isGoodCandidateText(text: string, element?: HTMLElement): boolean {
  if (!text || text.trim().length < 25) {
    return false;
  }

  if (element && (!isElementVisible(element) || isIgnoredContainer(element))) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const uiWords = words.filter((word) => ACTION_LABELS.has(word.toLowerCase()));
  return uiWords.length / words.length < 0.35;
}
