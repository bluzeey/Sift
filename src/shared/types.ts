export type SupportedSite = "x" | "reddit" | "substack";

export type ClassificationLabel = "useful" | "maybe" | "slop";
export type UiLabel = ClassificationLabel | "muted" | "error";

export type ProviderKind = "openai-compatible" | "anthropic-compatible" | "local";

export type PostKind = "post" | "comment" | "article" | "note" | "unknown";

export type PostCandidate = {
  id: string;
  site: SupportedSite;
  element: HTMLElement;
  text: string;
  url?: string;
  author?: string;
  community?: string;
  timestamp?: string;
  kind?: PostKind;
};

export type SerializableCandidate = Omit<PostCandidate, "element">;

export type ClassificationResult = {
  label: ClassificationLabel;
  confidence: number;
  reason: string;
  action: "show" | "label" | "hide";
};

export type ClassificationOutcome =
  | { ok: true; result: ClassificationResult }
  | { ok: false; error: string };

export type UserPreferences = {
  interests: string;
  dislikes: string;
  provider: ProviderKind;
  model: string;
  autoHide: boolean;
  threshold: number;
  sessionOnly: boolean;
};

export type ExtensionPreferences = UserPreferences & {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  storePreferencesOnDevice: boolean;
  pausedSites: Partial<Record<SupportedSite, boolean>>;
};

export type RuntimeState = {
  enabled: boolean;
  autoHide: boolean;
  threshold: number;
  site: SupportedSite | null;
  paused: boolean;
  preferencesFingerprint: string;
};

export type SiteAdapter = {
  site: SupportedSite;
  matchesLocation(location: Location): boolean;
  findCandidates(root: ParentNode): HTMLElement[];
  extractCandidate(element: HTMLElement): PostCandidate | null;
  getInjectionTarget(element: HTMLElement): HTMLElement;
  hideElement(element: HTMLElement): void;
  restoreElement(element: HTMLElement): void;
};

export type PopupState = {
  site: SupportedSite | null;
  supported: boolean;
  enabled: boolean;
  paused: boolean;
  autoHide: boolean;
  threshold: number;
  tabId: number | null;
};

export type ClassifyPostsRequest = {
  type: "sift:classify-posts";
  pageSessionId: string;
  items: Array<SerializableCandidate & { cacheKey: string }>;
};

export type GetRuntimeStateRequest = {
  type: "sift:get-runtime-state";
};

export type TestProviderRequest = {
  type: "sift:test-provider";
};

export type ClearSessionDataRequest = {
  type: "sift:clear-session-data";
};

export type RuntimeMessage =
  | ClassifyPostsRequest
  | GetRuntimeStateRequest
  | TestProviderRequest
  | ClearSessionDataRequest;

export type ContentRefreshMessage = {
  type: "sift:refresh-state" | "sift:rescan";
};

export type ProviderConfig = Pick<ExtensionPreferences, "provider" | "baseUrl" | "apiKey" | "model">;
