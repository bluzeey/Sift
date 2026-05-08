import { buildClassifyPostsMessage } from "../../shared/messaging";
import type { ClassificationOutcome, SerializableCandidate } from "../../shared/types";

export async function classifyBatch(
  pageSessionId: string,
  items: Array<SerializableCandidate & { cacheKey: string }>
): Promise<Record<string, ClassificationOutcome>> {
  return chrome.runtime.sendMessage(buildClassifyPostsMessage(pageSessionId, items));
}
