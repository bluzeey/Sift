import type {
  ClassifyPostsRequest,
  ClearSessionDataRequest,
  GetRuntimeStateRequest,
  RuntimeMessage,
  SerializableCandidate,
  TestProviderRequest
} from "./types";

export function buildGetRuntimeStateMessage(): GetRuntimeStateRequest {
  return { type: "sift:get-runtime-state" };
}

export function buildClassifyPostsMessage(
  pageSessionId: string,
  items: Array<SerializableCandidate & { cacheKey: string }>
): ClassifyPostsRequest {
  return {
    type: "sift:classify-posts",
    pageSessionId,
    items
  };
}

export function buildTestProviderMessage(): TestProviderRequest {
  return { type: "sift:test-provider" };
}

export function buildClearSessionDataMessage(): ClearSessionDataRequest {
  return { type: "sift:clear-session-data" };
}

export function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return typeof message === "object" && message !== null && "type" in message;
}
