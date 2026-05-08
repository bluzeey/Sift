import { useEffect, useState } from "react";
import { loadPreferences, savePreferences, updateSitePause } from "../shared/storage";
import type { ExtensionPreferences, PopupState } from "../shared/types";

async function loadPopupState(): Promise<PopupState> {
  return chrome.runtime.sendMessage({ type: "sift:get-popup-state" });
}

async function refreshActiveTab(tabId: number | null, type: "sift:refresh-state" | "sift:rescan"): Promise<void> {
  if (typeof tabId !== "number") {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type });
  } catch {
    // No content script on the active tab.
  }
}

export function Popup(): JSX.Element {
  const [state, setState] = useState<PopupState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPopupState().then(setState);
  }, []);

  async function updatePreferences(updater: (preferences: ExtensionPreferences) => ExtensionPreferences): Promise<void> {
    setBusy(true);
    const current = await loadPreferences();
    await savePreferences(updater(current));
    const nextState = await loadPopupState();
    setState(nextState);
    await refreshActiveTab(nextState.tabId, "sift:refresh-state");
    setBusy(false);
  }

  if (!state) {
    return <main className="popup-shell">Loading...</main>;
  }

  return (
    <main className="popup-shell">
      <section className="popup-card">
        <div className="popup-title-row">
          <div>
            <h1>Sift</h1>
            <p>DOM-first feed filtering with BYOK.</p>
          </div>
          <span className={`badge ${state.enabled ? "badge-live" : "badge-paused"}`}>
            {state.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="status-grid">
          <div>
            <span className="label">Site</span>
            <strong>{state.site ? state.site : "Unsupported"}</strong>
          </div>
          <div>
            <span className="label">State</span>
            <strong>{state.paused ? "Paused" : state.supported ? "Watching" : "Idle"}</strong>
          </div>
        </div>

        <label className="toggle-row">
          <span>Sift enabled</span>
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={busy}
            onChange={(event) =>
              void updatePreferences((preferences) => ({
                ...preferences,
                enabled: event.target.checked
              }))
            }
          />
        </label>

        <label className="toggle-row">
          <span>Auto-hide slop</span>
          <input
            type="checkbox"
            checked={state.autoHide}
            disabled={busy}
            onChange={(event) =>
              void updatePreferences((preferences) => ({
                ...preferences,
                autoHide: event.target.checked
              }))
            }
          />
        </label>

        <label className="slider-row">
          <span>Threshold</span>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={state.threshold}
            disabled={busy}
            onChange={(event) => {
              const threshold = Number(event.target.value);
              setState((current) => (current ? { ...current, threshold } : current));
            }}
            onMouseUp={() =>
              void updatePreferences((preferences) => ({
                ...preferences,
                threshold: state.threshold
              }))
            }
          />
          <strong>{state.threshold.toFixed(2)}</strong>
        </label>

        <div className="button-stack">
          <button type="button" onClick={() => void refreshActiveTab(state.tabId, "sift:rescan")} disabled={!state.supported}>
            Re-scan visible posts
          </button>
          <button
            type="button"
            disabled={!state.site || busy}
            onClick={async () => {
              if (!state.site) {
                return;
              }

              setBusy(true);
              await updateSitePause(state.site, !state.paused);
              const nextState = await loadPopupState();
              setState(nextState);
              await refreshActiveTab(nextState.tabId, "sift:refresh-state");
              setBusy(false);
            }}
          >
            {state.paused ? "Resume this site" : "Pause for this site"}
          </button>
          <button type="button" className="secondary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open settings
          </button>
        </div>
      </section>
    </main>
  );
}
