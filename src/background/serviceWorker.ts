import { isRuntimeMessage } from "../shared/messaging";
import { getSupportedSiteFromUrl } from "../shared/site";
import {
  buildPopupState,
  buildRuntimeState,
  clearSessionPreferences,
  configureStorageAccess,
  loadPreferences
} from "../shared/storage";
import type { ClassificationResult, RuntimeMessage } from "../shared/types";
import { classifyCandidates, testProvider } from "./providerRouter";

const classificationCache = new Map<string, ClassificationResult>();

async function bootstrapStorage(): Promise<void> {
  await configureStorageAccess();
  await loadPreferences();
}

function clearCaches(): void {
  classificationCache.clear();
}

async function withActiveTabUrl(): Promise<{ tabId: number | null; url?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    tabId: tab?.id ?? null,
    url: tab?.url
  };
}

async function notifyActiveTab(type: "sift:refresh-state" | "sift:rescan"): Promise<void> {
  const { tabId } = await withActiveTabUrl();
  if (typeof tabId !== "number") {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type });
  } catch {
    // No content script on the current tab.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrapStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrapStorage();
});

void bootstrapStorage();

chrome.storage.onChanged.addListener((changes) => {
  if (changes["sift.preferences"]) {
    clearCaches();
    void notifyActiveTab("sift:refresh-state");
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage | { type: "sift:get-popup-state" }, sender, sendResponse) => {
  if (!isRuntimeMessage(message) && message.type !== "sift:get-popup-state") {
    return undefined;
  }

  void (async () => {
    if (message.type === "sift:get-popup-state") {
      const activeTab = await withActiveTabUrl();
      sendResponse(await buildPopupState(activeTab.tabId, activeTab.url));
      return;
    }

    switch (message.type) {
      case "sift:get-runtime-state": {
        const currentUrl = sender.tab?.url ?? "";
        sendResponse(await buildRuntimeState(currentUrl));
        return;
      }
      case "sift:classify-posts": {
        sendResponse(await classifyCandidates(message.items, message.pageSessionId, classificationCache));
        return;
      }
      case "sift:test-provider": {
        await testProvider();
        sendResponse({ ok: true });
        return;
      }
      case "sift:clear-session-data": {
        clearCaches();
        await clearSessionPreferences();
        await bootstrapStorage();
        sendResponse({ ok: true });
        return;
      }
      default:
        return;
    }
  })().catch((error: unknown) => {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    sendResponse({ ok: false, error: messageText, supportedSite: getSupportedSiteFromUrl(sender.tab?.url ?? "") });
  });

  return true;
});
