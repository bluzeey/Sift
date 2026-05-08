import type { SupportedSite } from "./types";

export function getSupportedSiteFromUrl(urlString: string): SupportedSite | null {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "x.com" || host === "twitter.com") {
      return "x";
    }

    if (host === "reddit.com" || host === "www.reddit.com") {
      return "reddit";
    }

    if (host === "substack.com" || host.endsWith(".substack.com")) {
      return "substack";
    }

    return null;
  } catch {
    return null;
  }
}

export function getSupportedSiteFromLocation(location: Location): SupportedSite | null {
  return getSupportedSiteFromUrl(location.href);
}
