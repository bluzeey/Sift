import { sha256 } from "../../shared/hash";

type CacheKeyInput = {
  site: string;
  text: string;
  preferencesFingerprint: string;
  mediaSummary?: string;
  imageSources?: string[];
};

function normalizeTextForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function buildCandidateCacheKey({
  site,
  text,
  preferencesFingerprint,
  mediaSummary,
  imageSources = []
}: CacheKeyInput): Promise<string> {
  return sha256(
    JSON.stringify({
      site,
      preferencesFingerprint,
      text: normalizeTextForHash(text),
      mediaSummary: mediaSummary ? normalizeTextForHash(mediaSummary) : "",
      imageSources: imageSources.map((source) => normalizeTextForHash(source))
    })
  );
}
