import { DEFAULT_BASE_URLS, DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY } from "./constants";
import { sha256 } from "./hash";
import { getSupportedSiteFromUrl } from "./site";
import type { ExtensionPreferences, PopupState, RuntimeState, SupportedSite } from "./types";

function normalizePreferences(input?: Partial<ExtensionPreferences>): ExtensionPreferences {
  const provider = input?.provider ?? DEFAULT_PREFERENCES.provider;

  return {
    ...DEFAULT_PREFERENCES,
    ...input,
    provider,
    baseUrl: input?.baseUrl || DEFAULT_BASE_URLS[provider],
    pausedSites: {
      ...DEFAULT_PREFERENCES.pausedSites,
      ...(input?.pausedSites ?? {})
    },
    sessionOnly: input?.storePreferencesOnDevice ? false : (input?.sessionOnly ?? DEFAULT_PREFERENCES.sessionOnly),
    storePreferencesOnDevice: input?.storePreferencesOnDevice ?? false
  };
}

export async function configureStorageAccess(): Promise<void> {
  if (chrome.storage.session.setAccessLevel) {
    await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }

  if (chrome.storage.local.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }
}

export function toPersistedPreferences(preferences: ExtensionPreferences): ExtensionPreferences {
  return normalizePreferences({
    ...preferences,
    sessionOnly: !preferences.storePreferencesOnDevice
  });
}

export async function loadPreferences(): Promise<ExtensionPreferences> {
  const sessionData = await chrome.storage.session.get(PREFERENCES_STORAGE_KEY);
  const sessionPreferences = sessionData[PREFERENCES_STORAGE_KEY] as ExtensionPreferences | undefined;

  if (sessionPreferences) {
    return normalizePreferences(sessionPreferences);
  }

  const localData = await chrome.storage.local.get(PREFERENCES_STORAGE_KEY);
  const localPreferences = localData[PREFERENCES_STORAGE_KEY] as ExtensionPreferences | undefined;
  const next = normalizePreferences(localPreferences);

  await chrome.storage.session.set({
    [PREFERENCES_STORAGE_KEY]: next
  });

  return next;
}

export async function savePreferences(preferences: ExtensionPreferences): Promise<ExtensionPreferences> {
  const next = normalizePreferences({
    ...preferences,
    sessionOnly: !preferences.storePreferencesOnDevice
  });

  await chrome.storage.session.set({
    [PREFERENCES_STORAGE_KEY]: next
  });

  if (next.storePreferencesOnDevice) {
    await chrome.storage.local.set({
      [PREFERENCES_STORAGE_KEY]: toPersistedPreferences(next)
    });
  } else {
    await chrome.storage.local.remove(PREFERENCES_STORAGE_KEY);
  }

  return next;
}

export async function clearSessionPreferences(): Promise<void> {
  await chrome.storage.session.remove(PREFERENCES_STORAGE_KEY);
}

export async function buildPreferencesFingerprint(preferences: ExtensionPreferences): Promise<string> {
  return sha256(
    JSON.stringify({
      interests: preferences.interests,
      dislikes: preferences.dislikes,
      provider: preferences.provider,
      model: preferences.model,
      baseUrl: preferences.baseUrl
    })
  );
}

export async function buildRuntimeState(currentUrl: string, preferences?: ExtensionPreferences): Promise<RuntimeState> {
  const resolvedPreferences = preferences ?? (await loadPreferences());
  const site = getSupportedSiteFromUrl(currentUrl);
  const paused = site ? Boolean(resolvedPreferences.pausedSites[site]) : false;

  return {
    enabled: resolvedPreferences.enabled,
    autoHide: resolvedPreferences.autoHide,
    threshold: resolvedPreferences.threshold,
    site,
    paused,
    preferencesFingerprint: await buildPreferencesFingerprint(resolvedPreferences)
  };
}

export async function buildPopupState(tabId: number | null, currentUrl: string | undefined): Promise<PopupState> {
  const preferences = await loadPreferences();
  const site = currentUrl ? getSupportedSiteFromUrl(currentUrl) : null;

  return {
    site,
    supported: site !== null,
    enabled: preferences.enabled,
    paused: site ? Boolean(preferences.pausedSites[site]) : false,
    autoHide: preferences.autoHide,
    threshold: preferences.threshold,
    tabId
  };
}

export async function updateSitePause(site: SupportedSite, paused: boolean): Promise<ExtensionPreferences> {
  const preferences = await loadPreferences();
  return savePreferences({
    ...preferences,
    pausedSites: {
      ...preferences.pausedSites,
      [site]: paused
    }
  });
}
