import type { ClassificationResult, ProviderConfig, SerializableCandidate, UserPreferences } from "../../shared/types";
import { classifyWithOpenAICompatible } from "./openAICompatible";

export async function classifyWithLocalEndpoint(
  candidate: SerializableCandidate,
  config: ProviderConfig,
  preferences: UserPreferences
): Promise<ClassificationResult> {
  return classifyWithOpenAICompatible(candidate, { ...config, apiKey: "" }, preferences);
}
