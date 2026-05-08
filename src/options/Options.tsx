import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BASE_URLS,
  DEFAULT_DISLIKES_PLACEHOLDER,
  DEFAULT_INTERESTS_PLACEHOLDER
} from "../shared/constants";
import { buildClearSessionDataMessage, buildTestProviderMessage } from "../shared/messaging";
import { PRIVACY_COPY } from "../shared/privacy";
import { loadPreferences, savePreferences } from "../shared/storage";
import type { ExtensionPreferences, ProviderKind } from "../shared/types";

type SaveState = "idle" | "saving" | "saved" | "error";

const PRIVACY_POINTS = [
  "Post text or content",
  "Browsing history",
  "Classification logs",
  "Anything on our servers"
];

function preferencesEqual(left: ExtensionPreferences | null, right: ExtensionPreferences | null): boolean {
  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function saveButtonLabel(saveState: SaveState, dirty: boolean): string {
  if (saveState === "saving") {
    return "Saving changes";
  }

  if (saveState === "saved" && !dirty) {
    return "Saved";
  }

  if (saveState === "error") {
    return "Try saving again";
  }

  return dirty ? "Save changes" : "Save changes";
}

function saveStatusText(saveState: SaveState, dirty: boolean, errorMessage: string): string {
  if (saveState === "saving") {
    return "Saving your preferences locally.";
  }

  if (saveState === "saved" && !dirty) {
    return "Saved just now.";
  }

  if (saveState === "error") {
    return errorMessage || "We couldn't save your changes.";
  }

  return dirty ? "You have unsaved changes." : "Everything is up to date.";
}

function providerLabel(provider: ProviderKind): string {
  switch (provider) {
    case "anthropic-compatible":
      return "Anthropic-compatible";
    case "local":
      return "Local endpoint";
    default:
      return "OpenAI-compatible";
  }
}

export function Options(): JSX.Element {
  const [preferences, setPreferences] = useState<ExtensionPreferences | null>(null);
  const [lastSavedPreferences, setLastSavedPreferences] = useState<ExtensionPreferences | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const [testingProvider, setTestingProvider] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const saveFeedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    void loadPreferences().then((loaded) => {
      setPreferences(loaded);
      setLastSavedPreferences(loaded);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimer.current !== null) {
        window.clearTimeout(saveFeedbackTimer.current);
      }
    };
  }, []);

  const dirty = useMemo(() => !preferencesEqual(preferences, lastSavedPreferences), [preferences, lastSavedPreferences]);

  function scheduleSaveStateReset(): void {
    if (saveFeedbackTimer.current !== null) {
      window.clearTimeout(saveFeedbackTimer.current);
    }

    saveFeedbackTimer.current = window.setTimeout(() => {
      setSaveState((current) => (current === "saved" ? "idle" : current));
      saveFeedbackTimer.current = null;
    }, 2200);
  }

  async function persist(next: ExtensionPreferences): Promise<void> {
    setSaveState("saving");
    setSaveError("");

    try {
      const saved = await savePreferences(next);
      setPreferences(saved);
      setLastSavedPreferences(saved);
      setSaveState("saved");
      scheduleSaveStateReset();
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Failed to save preferences.");
    }
  }

  function update<K extends keyof ExtensionPreferences>(key: K, value: ExtensionPreferences[K]): void {
    setPreferences((current) => (current ? { ...current, [key]: value } : current));
    if (saveState !== "saving") {
      setSaveState("idle");
      setSaveError("");
    }
  }

  function resetDraft(): void {
    if (!lastSavedPreferences) {
      return;
    }

    setPreferences(lastSavedPreferences);
    setSaveState("idle");
    setSaveError("");
  }

  if (!preferences) {
    return (
      <main className="options-shell">
        <section className="hero-card loading-card">
          <span className="eyebrow">Sift Settings</span>
          <h1>Loading your local settings...</h1>
          <p>We are pulling your current preferences from extension storage.</p>
        </section>
      </main>
    );
  }

  const thresholdPercent = Math.round(((preferences.threshold - 0.5) / 0.45) * 100);
  const heroBadges = [
    { label: "No backend", tone: "mint" },
    { label: preferences.provider === "local" ? "Local mode" : "BYOK", tone: "cyan" },
    { label: preferences.storePreferencesOnDevice ? "Stored on device" : "Session-only", tone: "violet" },
    { label: "No analytics", tone: "slate" }
  ];

  return (
    <main className="options-shell">
      <section className="hero-card hero-card-rich">
        <div className="hero-copy">
          <span className="eyebrow">Sift Settings</span>
          <h1>Private by default. Local by design.</h1>
          <p>{PRIVACY_COPY}</p>
          <div className="hero-badges" aria-label="Privacy highlights">
            {heroBadges.map((badge) => (
              <span key={badge.label} className={`hero-badge hero-badge-${badge.tone}`}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <div className="hero-orbit" />
          <div className="hero-shield">
            <div className="hero-lock" />
          </div>
        </div>
      </section>

      <section className="settings-layout">
        <article className="panel taste-panel">
          <div className="panel-heading">
            <span className="panel-step">1</span>
            <div>
              <h2>Taste Profile</h2>
              <p>Tell Sift what counts as useful signal for you.</p>
            </div>
          </div>

          <div className="field-stack">
            <label className="field-block">
              <span className="field-label">Interests</span>
              <span className="field-hint">Use plain language, keywords, topics, or writing styles you want more of.</span>
              <textarea
                className="rich-textarea"
                rows={8}
                value={preferences.interests}
                placeholder={DEFAULT_INTERESTS_PLACEHOLDER}
                onChange={(event) => update("interests", event.target.value)}
              />
              <span className="field-meta">{preferences.interests.trim().length} characters</span>
            </label>

            <label className="field-block">
              <span className="field-label">Dislikes</span>
              <span className="field-hint">Describe patterns you want filtered more aggressively.</span>
              <textarea
                className="rich-textarea"
                rows={6}
                value={preferences.dislikes}
                placeholder={DEFAULT_DISLIKES_PLACEHOLDER}
                onChange={(event) => update("dislikes", event.target.value)}
              />
              <span className="field-meta">{preferences.dislikes.trim().length} characters</span>
            </label>
          </div>
        </article>

        <div className="settings-stack">
          <article className="panel behavior-panel">
            <div className="panel-heading">
              <span className="panel-step">2</span>
              <div>
                <h2>Filtering Behavior</h2>
                <p>Control how strict Sift should be when collapsing low-signal posts.</p>
              </div>
            </div>

            <label className="checkbox-card">
              <input checked={preferences.autoHide} type="checkbox" onChange={(event) => update("autoHide", event.target.checked)} />
              <span>
                <strong>Auto-hide slop</strong>
                <small>Sift will automatically hide low-quality or off-signal posts when confidence clears your threshold.</small>
              </span>
            </label>

            <div className="threshold-block">
              <div className="threshold-heading">
                <div>
                  <span className="field-label">Threshold</span>
                  <span className="field-hint">Higher thresholds hide less unless Sift is very confident.</span>
                </div>
                <span className="threshold-pill">{preferences.threshold.toFixed(2)}</span>
              </div>
              <input
                className="threshold-slider"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={preferences.threshold}
                style={{ ["--slider-fill" as string]: `${thresholdPercent}%` }}
                onChange={(event) => update("threshold", Number(event.target.value))}
              />
              <div className="range-scale" aria-hidden="true">
                <span>Lenient</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
            </div>
          </article>

          <article className="panel provider-panel">
            <div className="panel-heading">
              <span className="panel-step">3</span>
              <div>
                <h2>Model Provider</h2>
                <p>Your key stays inside the extension. Sift never sees it.</p>
              </div>
            </div>

            <div className="provider-grid">
              <label className="field-block compact-field">
                <span className="field-label">Provider</span>
                <select
                  value={preferences.provider}
                  onChange={(event) => {
                    const provider = event.target.value as ProviderKind;
                    setPreferences((current) =>
                      current
                        ? {
                            ...current,
                            provider,
                            baseUrl: DEFAULT_BASE_URLS[provider]
                          }
                        : current
                    );
                    if (saveState !== "saving") {
                      setSaveState("idle");
                      setSaveError("");
                    }
                  }}
                >
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="anthropic-compatible">Anthropic-compatible</option>
                  <option value="local">Local endpoint</option>
                </select>
              </label>

              <label className="field-block compact-field">
                <span className="field-label">Model</span>
                <input value={preferences.model} onChange={(event) => update("model", event.target.value)} />
              </label>

              <label className="field-block compact-field provider-grid-wide">
                <span className="field-label">Base URL</span>
                <input value={preferences.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} />
              </label>

              <label className="field-block compact-field provider-grid-wide">
                <span className="field-label">API key</span>
                <div className="input-with-action">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={preferences.apiKey}
                    disabled={preferences.provider === "local"}
                    placeholder={preferences.provider === "local" ? "Not required for local mode" : "Paste your API key"}
                    onChange={(event) => update("apiKey", event.target.value)}
                  />
                  <button
                    type="button"
                    className="ghost-icon-button"
                    disabled={preferences.provider === "local"}
                    onClick={() => setShowApiKey((current) => !current)}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="field-hint">Current mode: {providerLabel(preferences.provider)}</span>
              </label>
            </div>

            <div className="inline-actions">
              <button
                type="button"
                className="secondary action-with-icon"
                disabled={testingProvider}
                onClick={async () => {
                  setTestingProvider(true);
                  setTestMessage("Testing connection...");

                  try {
                    const result = await chrome.runtime.sendMessage(buildTestProviderMessage());
                    setTestMessage(result?.ok === false ? result.error : "Provider test succeeded.");
                  } finally {
                    setTestingProvider(false);
                  }
                }}
              >
                <span className={`circle-indicator ${testingProvider ? "is-spinning" : "is-idle"}`} aria-hidden="true" />
                Test connection
              </button>
              <span className="inline-message">{testMessage || "Checks connectivity and permissions with your configured provider."}</span>
            </div>
          </article>
        </div>
      </section>

      <section className="panel privacy-panel">
        <div className="panel-heading">
          <span className="panel-step">4</span>
          <div>
            <h2>Privacy &amp; Data</h2>
            <p>Storage and retention remain local to your browser session unless you opt in.</p>
          </div>
        </div>

        <div className="privacy-grid">
          <div className="privacy-mode-card">
            <div className="privacy-icon" aria-hidden="true">
              <div className="privacy-shield" />
            </div>
            <div>
              <strong>{preferences.storePreferencesOnDevice ? "Stored on this device" : "Session-only mode is active."}</strong>
              <p>
                {preferences.storePreferencesOnDevice
                  ? "Your preferences persist locally on this browser profile."
                  : "Post text, hashes, browsing history, and classifications are never persisted."}
              </p>
            </div>
          </div>

          <div className="privacy-list-block">
            <span className="field-label">Sift does not store:</span>
            <ul className="privacy-list">
              {PRIVACY_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="privacy-controls">
            <label className="checkbox-card">
              <input
                checked={preferences.storePreferencesOnDevice}
                type="checkbox"
                onChange={(event) => {
                  setPreferences((current) =>
                    current
                      ? {
                          ...current,
                          storePreferencesOnDevice: event.target.checked,
                          sessionOnly: !event.target.checked
                        }
                      : current
                  );
                  if (saveState !== "saving") {
                    setSaveState("idle");
                    setSaveError("");
                  }
                }}
              />
              <span>
                <strong>Store my preferences on this device</strong>
                <small>Keep your settings locally for a smoother experience across sessions.</small>
              </span>
            </label>

            <div className="inline-actions privacy-actions">
              <button
                type="button"
                className="danger"
                disabled={clearingSession}
                onClick={async () => {
                  setClearingSession(true);
                  setClearMessage("Clearing session data...");

                  try {
                    const result = await chrome.runtime.sendMessage(buildClearSessionDataMessage());
                    if (result?.ok === false) {
                      setClearMessage(result.error);
                      return;
                    }

                    const refreshed = await loadPreferences();
                    setPreferences(refreshed);
                    setLastSavedPreferences(refreshed);
                    setSaveState("idle");
                    setClearMessage("Cleared session data.");
                  } finally {
                    setClearingSession(false);
                  }
                }}
              >
                Clear session data
              </button>
              <span className="inline-message">{clearMessage || "This removes all temporary data from the current session."}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="save-bar-shell">
        <div className="save-bar panel">
          <div className="save-actions">
            <button
              type="button"
              className="save-button"
              disabled={saveState === "saving" || !dirty}
              onClick={() => void persist(preferences)}
            >
              <span className={`save-ring save-ring-${saveState}`} aria-hidden="true">
                <span className="save-ring-core" />
              </span>
              {saveButtonLabel(saveState, dirty)}
            </button>
            <button type="button" className="secondary" disabled={!dirty || saveState === "saving"} onClick={resetDraft}>
              Reset
            </button>
          </div>

          <div className="save-meta">
            <span className={`status-dot status-dot-${saveState === "error" ? "error" : dirty ? "dirty" : "ok"}`} aria-hidden="true" />
            <span>{saveStatusText(saveState, dirty, saveError)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
