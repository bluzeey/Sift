import type { SiteAdapter } from "../shared/types";
import { linkedinAdapter } from "./adapters/linkedinAdapter";
import { peerlistAdapter } from "./adapters/peerlistAdapter";
import { redditAdapter } from "./adapters/redditAdapter";
import { substackAdapter } from "./adapters/substackAdapter";
import { xAdapter } from "./adapters/xAdapter";

const adapters: SiteAdapter[] = [xAdapter, redditAdapter, substackAdapter, linkedinAdapter, peerlistAdapter];

export function getAdapterForLocation(location: Location): SiteAdapter | null {
  return adapters.find((adapter) => adapter.matchesLocation(location)) ?? null;
}
