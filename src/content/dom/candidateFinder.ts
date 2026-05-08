import type { PostCandidate, SiteAdapter } from "../../shared/types";

export function collectCandidates(adapter: SiteAdapter, root: ParentNode): PostCandidate[] {
  return adapter
    .findCandidates(root)
    .map((element) => adapter.extractCandidate(element))
    .filter((candidate): candidate is PostCandidate => candidate !== null);
}
