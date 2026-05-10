import { DOM_SCAN_DEBOUNCE_MS, URL_POLL_INTERVAL_MS } from "../shared/constants";
import { buildGetRuntimeStateMessage } from "../shared/messaging";
import type { ClassificationOutcome, ClassificationResult, RuntimeState, SerializableCandidate, SiteAdapter } from "../shared/types";
import { getAdapterForLocation } from "./siteRouter";
import { BatchQueue } from "./classifier/batchQueue";
import { buildCandidateCacheKey } from "./classifier/postHash";
import { SessionCache } from "./classifier/sessionCache";
import { observeMutations } from "./dom/mutationObserver";
import { renderPill } from "./dom/pillRenderer";
import { removeInjectedUi } from "./dom/safeInject";
import { createVisibilityObserver } from "./dom/visibilityObserver";
import { restoreAllHidden } from "./dom/hideManager";

class SiftContentController {
  private static readonly observedAttribute = "data-sift-observed";
  private readonly adapter: SiteAdapter;
  private runtimeState: RuntimeState | null = null;
  private pageSessionId = crypto.randomUUID();
  private queue = new BatchQueue(this.pageSessionId);
  private readonly cache = new SessionCache();
  private readonly visibilityObserver = createVisibilityObserver((element) => {
    void this.processVisibleElement(element);
  });
  private mutationObserver: MutationObserver | null = null;
  private currentUrl = location.href;
  private scanTimer: number | null = null;
  private readonly candidateByElement = new WeakMap<HTMLElement, SerializableCandidate & { cacheKey: string }>();
  private readonly cacheKeyByElement = new WeakMap<HTMLElement, string>();

  constructor(adapter: SiteAdapter) {
    this.adapter = adapter;
  }

  async start(): Promise<void> {
    this.runtimeState = await chrome.runtime.sendMessage(buildGetRuntimeStateMessage());
    this.bindMessages();
    this.startObservers();
    this.scan(document);
    window.setInterval(() => {
      if (location.href !== this.currentUrl) {
        this.currentUrl = location.href;
        void this.resetForNavigation();
      }
    }, URL_POLL_INTERVAL_MS);
  }

  private bindMessages(): void {
    chrome.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message.type === "sift:refresh-state") {
        void this.refreshState(true);
      }

      if (message.type === "sift:rescan") {
        void this.refreshState(false).then(() => this.scan(document));
      }
    });
  }

  private startObservers(): void {
    if (document.body) {
      this.mutationObserver = observeMutations(document.body, () => this.scheduleScan());
    }
  }

  private async refreshState(clearUi: boolean): Promise<void> {
    const nextState = (await chrome.runtime.sendMessage(buildGetRuntimeStateMessage())) as RuntimeState;
    const fingerprintChanged =
      this.runtimeState?.preferencesFingerprint && this.runtimeState.preferencesFingerprint !== nextState.preferencesFingerprint;

    this.runtimeState = nextState;

    if (clearUi || fingerprintChanged) {
      this.cache.clear();
      this.queue.clear();
      this.visibilityObserver.disconnect();
      this.clearObservedMarkers();
      restoreAllHidden();
      removeInjectedUi(document);
    }

    if (this.isActive()) {
      this.scan(document);
    }
  }

  private async resetForNavigation(): Promise<void> {
    this.pageSessionId = crypto.randomUUID();
    this.queue = new BatchQueue(this.pageSessionId);
    this.cache.clear();
    this.visibilityObserver.disconnect();
    this.clearObservedMarkers();
    restoreAllHidden();
    removeInjectedUi(document);
    this.runtimeState = await chrome.runtime.sendMessage(buildGetRuntimeStateMessage());
    this.scan(document);
  }

  private isActive(): boolean {
    return Boolean(this.runtimeState?.enabled) && !this.runtimeState?.paused;
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
    }

    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      const run = () => this.scan(document);
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(run);
      } else {
        run();
      }
    }, DOM_SCAN_DEBOUNCE_MS);
  }

  private scan(root: ParentNode): void {
    if (!this.isActive()) {
      return;
    }

    for (const element of this.adapter.findCandidates(root)) {
      if (element.getAttribute(SiftContentController.observedAttribute) === "true") {
        continue;
      }

      element.setAttribute(SiftContentController.observedAttribute, "true");
      this.visibilityObserver.observe(element);
    }
  }

  private clearObservedMarkers(): void {
    document
      .querySelectorAll(`[${SiftContentController.observedAttribute}='true']`)
      .forEach((element) => element.removeAttribute(SiftContentController.observedAttribute));
  }

  private async processVisibleElement(element: HTMLElement): Promise<void> {
    if (!this.isActive()) {
      return;
    }

    const candidate = this.adapter.extractCandidate(element);
    if (!candidate || !this.runtimeState) {
      return;
    }

    const cacheKey = await buildCandidateCacheKey({
      site: candidate.site,
      text: candidate.text,
      preferencesFingerprint: this.runtimeState.preferencesFingerprint,
      mediaSummary: candidate.mediaSummary,
      imageSources: candidate.images?.map((image) => image.src)
    });
    const serializableCandidate: SerializableCandidate & { cacheKey: string } = {
      id: candidate.id,
      site: candidate.site,
      text: candidate.text,
      url: candidate.url,
      author: candidate.author,
      community: candidate.community,
      timestamp: candidate.timestamp,
      kind: candidate.kind,
      mediaType: candidate.mediaType,
      mediaSummary: candidate.mediaSummary,
      images: candidate.images,
      isMediaOnly: candidate.isMediaOnly,
      cacheKey
    };

    this.candidateByElement.set(element, serializableCandidate);
    this.cacheKeyByElement.set(element, cacheKey);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.applyOutcome(element, cached);
      return;
    }

    const inflight = this.cache.getInFlight(cacheKey);
    if (inflight) {
      this.applyOutcome(element, await inflight);
      return;
    }

    const pending = this.queue.enqueue(serializableCandidate).catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Classification failed"
    } as ClassificationOutcome));
    this.cache.track(cacheKey, pending);
    const outcome = await pending;
    this.cache.resolve(cacheKey, outcome);
    this.applyOutcome(element, outcome);
  }

  private applyOutcome(element: HTMLElement, outcome: ClassificationOutcome): void {
    if (!element.isConnected) {
      return;
    }

    const showElement = () => this.adapter.restoreElement(element);
    const hideElement = () => this.adapter.hideElement(element);

    renderPill(this.adapter.getInjectionTarget(element), outcome, {
      onRetry: () => {
        const cacheKey = this.cacheKeyByElement.get(element);
        if (cacheKey) {
          this.cache.delete(cacheKey);
        }

        showElement();
        void this.processVisibleElement(element);
      },
      onMarkUseful: () => this.applyManualLabel(element, "useful"),
      onMarkMaybe: () => this.applyManualLabel(element, "maybe"),
      onMarkSlop: () => this.applyManualLabel(element, "slop"),
      onHide: hideElement,
      onShow: showElement
    });

    if (this.shouldAutoHide(element, outcome)) {
      hideElement();
    }
  }

  private shouldAutoHide(element: HTMLElement, outcome: ClassificationOutcome): boolean {
    if (!outcome.ok || !this.runtimeState?.autoHide) {
      return false;
    }

    if (outcome.result.label !== "slop" || outcome.result.confidence < this.runtimeState.threshold) {
      return false;
    }

    const candidate = this.candidateByElement.get(element);
    if (!candidate) {
      return true;
    }

    if (candidate.mediaType === "video") {
      return false;
    }

    if (outcome.result.needsVision) {
      return false;
    }

    if (candidate.mediaType === "image" && outcome.result.mediaMode !== "image-vision") {
      return false;
    }

    return true;
  }

  private applyManualLabel(element: HTMLElement, label: ClassificationResult["label"]): void {
    const manualResult: ClassificationResult = {
      label,
      confidence: 1,
      reason: "Session override",
      action: label === "slop" ? "hide" : "label",
      mediaMode: "none",
      needsVision: false
    };

    showElement(element, this.adapter);
    renderPill(this.adapter.getInjectionTarget(element), { ok: true, result: manualResult }, {
      onMarkUseful: () => this.applyManualLabel(element, "useful"),
      onMarkMaybe: () => this.applyManualLabel(element, "maybe"),
      onMarkSlop: () => this.applyManualLabel(element, "slop"),
      onHide: () => this.adapter.hideElement(element),
      onShow: () => this.adapter.restoreElement(element)
    });

    const cacheKey = this.cacheKeyByElement.get(element);
    if (cacheKey) {
      this.cache.resolve(cacheKey, { ok: true, result: manualResult });
    }
  }
}

function showElement(element: HTMLElement, adapter: SiteAdapter): void {
  adapter.restoreElement(element);
}

const adapter = getAdapterForLocation(location);
if (adapter) {
  const controller = new SiftContentController(adapter);
  void controller.start();
}
