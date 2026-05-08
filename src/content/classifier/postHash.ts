import { sha256 } from "../../shared/hash";

function normalizeTextForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function buildCandidateCacheKey(site: string, text: string, preferencesFingerprint: string): Promise<string> {
  return sha256(`${site}:${preferencesFingerprint}:${normalizeTextForHash(text)}`);
}
