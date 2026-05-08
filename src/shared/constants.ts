import type { ExtensionPreferences, ProviderKind, SupportedSite } from "./types";

export const PREFERENCES_STORAGE_KEY = "sift.preferences";

export const DEFAULT_BASE_URLS: Record<ProviderKind, string> = {
  "openai-compatible": "https://api.openai.com/v1/chat/completions",
  "anthropic-compatible": "https://api.anthropic.com/v1/messages",
  local: "http://127.0.0.1:11434/v1/chat/completions"
};

export const DEFAULT_INTERESTS_PLACEHOLDER =
  "I care about AI research, startups, software engineering, product building, economics, philosophy, useful technical writing, and serious long-form ideas.";

export const DEFAULT_DISLIKES_PLACEHOLDER =
  "I dislike ragebait, engagement farming, shallow memes, repetitive political outrage, celebrity gossip, spam, and low-effort motivational content.";

export const DEFAULT_PREFERENCES: ExtensionPreferences = {
  enabled: true,
  interests: "",
  dislikes: "",
  provider: "openai-compatible",
  model: "gpt-4o-mini",
  baseUrl: DEFAULT_BASE_URLS["openai-compatible"],
  apiKey: "",
  autoHide: false,
  threshold: 0.75,
  sessionOnly: true,
  storePreferencesOnDevice: false,
  pausedSites: {}
};

export const CLASSIFIER_SYSTEM_PROMPT =
  "You are Sift, a personal feed-quality classifier. Your job is to classify a social post, Reddit post, LinkedIn post, or newsletter/article preview according to the user's stated interests. Do not classify based only on agreement or disagreement. A post can challenge the user and still be useful. Prefer thoughtful, information-dense, novel, practical, educational, technical, or directly relevant content. Penalize low-effort memes, engagement bait, ragebait, spam, repetitive outrage, celebrity gossip, shallow takes, vague motivational filler, and content unrelated to the user's interests. Return strict JSON only.";

export const LINKEDIN_CLASSIFIER_PROMPT_ADDITION =
  "You are classifying LinkedIn feed posts. LinkedIn contains professional updates, reposts, hiring posts, company posts, creator posts, recommended posts, sponsored posts, and engagement bait. Prefer specific, useful, non-obvious, practical, technical, or thoughtful professional content. Penalize generic hustle content, fake vulnerability, vague motivational advice, engagement farming, comment-bait, repetitive AI-generated career advice, shallow corporate announcements, and irrelevant sponsored content. Do not punish thoughtful disagreement, credible self-promotion, or genuinely useful hiring/startup/product/technical content.";

export function getClassifierSystemPrompt(site?: SupportedSite): string {
  return site === "linkedin"
    ? `${CLASSIFIER_SYSTEM_PROMPT} ${LINKEDIN_CLASSIFIER_PROMPT_ADDITION}`
    : CLASSIFIER_SYSTEM_PROMPT;
}

export const REQUEST_TIMEOUT_MS = 20000;
export const DOM_SCAN_DEBOUNCE_MS = 500;
export const URL_POLL_INTERVAL_MS = 5000;
export const BATCH_SIZE = 5;
export const MAX_PROVIDER_CONCURRENCY = 3;
