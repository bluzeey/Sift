import { useEffect, useState } from "react";
import {
  DEFAULT_BASE_URLS,
  DEFAULT_DISLIKES_PLACEHOLDER,
  DEFAULT_INTERESTS_PLACEHOLDER
} from "../shared/constants";
import { buildClearSessionDataMessage, buildTestProviderMessage } from "../shared/messaging";
import { PRIVACY_COPY } from "../shared/privacy";
import { loadPreferences, savePreferences } from "../shared/storage";
import type { ExtensionPreferences, ProviderKind } from "../shared/types";

export function Options(): JSX.Element {
  const [preferences, setPreferences] = useState<ExtensionPreferences | null>(null);
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPreferences().then(setPreferences);
  }, []);

  async function persist(next: ExtensionPreferences): Promise<void> {
    setSaving(true);
    const saved = await savePreferences(next);
    setPreferences(saved);
    setStatus("Saved settings.");
    setSaving(false);
  }

  function update<K extends keyof ExtensionPreferences>(key: K, value: ExtensionPreferences[K]): void {
    setPreferences((current) => (current ? { ...current, [key]: value } : current));
  }

  if (!preferences) {
    return <main className="options-shell">Loading...</main>;
  }

  return (
    <main className="options-shell">
      <section className="hero-card">
        <span className="eyebrow">Sift Settings</span>
        <h1>Private by default, local by design.</h1>
        <p>{PRIVACY_COPY}</p>
      </section>

      <section className="options-grid">
        <article className="panel">
          <h2>Interests</h2>
          <textarea
            rows={7}
            value={preferences.interests}
            placeholder={DEFAULT_INTERESTS_PLACEHOLDER}
            onChange={(event) => update("interests", event.target.value)}
          />

          <h2>Dislikes</h2>
          <textarea
            rows={6}
            value={preferences.dislikes}
            placeholder={DEFAULT_DISLIKES_PLACEHOLDER}
            onChange={(event) => update("dislikes", event.target.value)}
          />
        </article>

        <article className="panel">
          <h2>Provider</h2>
          <label>
            Provider
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
              }}
            >
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="anthropic-compatible">Anthropic-compatible</option>
              <option value="local">Local endpoint</option>
            </select>
          </label>

          <label>
            Model
            <input value={preferences.model} onChange={(event) => update("model", event.target.value)} />
          </label>

          <label>
            Base URL
            <input value={preferences.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} />
          </label>

          <label>
            API key
            <input
              type="password"
              value={preferences.apiKey}
              disabled={preferences.provider === "local"}
              placeholder={preferences.provider === "local" ? "Not required for local mode" : "Paste your API key"}
              onChange={(event) => update("apiKey", event.target.value)}
            />
          </label>

          <div className="toggle-pair">
            <label className="checkbox-row">
              <input checked={preferences.autoHide} type="checkbox" onChange={(event) => update("autoHide", event.target.checked)} />
              Auto-hide slop above threshold
            </label>
            <label>
              Threshold
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={preferences.threshold}
                onChange={(event) => update("threshold", Number(event.target.value))}
              />
              <strong>{preferences.threshold.toFixed(2)}</strong>
            </label>
          </div>

          <label className="checkbox-row">
            <input
              checked={preferences.storePreferencesOnDevice}
              type="checkbox"
              onChange={(event) =>
                setPreferences((current) =>
                  current
                    ? {
                        ...current,
                        storePreferencesOnDevice: event.target.checked,
                        sessionOnly: !event.target.checked
                      }
                    : current
                )
              }
            />
            Store my preferences on this device.
          </label>

          <p className="helper-text">Session-only mode is on by default. Post text, hashes, browsing history, and classification logs are never persisted.</p>
        </article>
      </section>

      <section className="panel action-panel">
        <div className="action-row">
          <button type="button" disabled={saving} onClick={() => void persist(preferences)}>
            Save preferences
          </button>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              setStatus("Testing provider...");
              const result = await chrome.runtime.sendMessage(buildTestProviderMessage());
              setStatus(result?.ok === false ? result.error : "Provider test succeeded.");
            }}
          >
            Test provider
          </button>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              setStatus("Clearing session data...");
              const result = await chrome.runtime.sendMessage(buildClearSessionDataMessage());
              if (result?.ok === false) {
                setStatus(result.error);
                return;
              }

              setPreferences(await loadPreferences());
              setStatus("Cleared session data.");
            }}
          >
            Clear session data
          </button>
        </div>
        <p className="status-line">{status}</p>
      </section>
    </main>
  );
}
