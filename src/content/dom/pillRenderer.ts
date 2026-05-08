import type { ClassificationOutcome, ClassificationResult, UiLabel } from "../../shared/types";
import { ensureShadowRoot } from "./safeInject";

export type PillHandlers = {
  onRetry?: () => void;
  onMarkUseful?: () => void;
  onMarkMaybe?: () => void;
  onMarkSlop?: () => void;
  onHide?: () => void;
  onShow?: () => void;
};

type PillState = {
  label: UiLabel;
  reason?: string;
  confidence?: number;
  hidden?: boolean;
};

function labelText(state: PillState): string {
  switch (state.label) {
    case "useful":
      return "Useful";
    case "maybe":
      return "Maybe";
    case "slop":
      return state.reason ? `Slop · ${state.reason}` : "Slop";
    case "muted":
      return "Hidden · show";
    case "error":
      return "Error · retry";
  }
}

function pillColor(label: UiLabel): { background: string; foreground: string; border: string } {
  switch (label) {
    case "useful":
      return { background: "#dcfce7", foreground: "#166534", border: "#86efac" };
    case "maybe":
      return { background: "#e0f2fe", foreground: "#075985", border: "#7dd3fc" };
    case "slop":
      return { background: "#fee2e2", foreground: "#991b1b", border: "#fca5a5" };
    case "muted":
      return { background: "#e2e8f0", foreground: "#334155", border: "#cbd5e1" };
    case "error":
      return { background: "#fef3c7", foreground: "#92400e", border: "#fcd34d" };
  }
}

function createMenuButton(label: string, onClick?: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = !onClick;
  button.addEventListener("click", () => onClick?.());
  return button;
}

export function renderPill(target: HTMLElement, outcome: ClassificationOutcome | PillState, handlers: PillHandlers = {}): void {
  const state: PillState = "ok" in outcome
    ? outcome.ok
      ? {
          label: outcome.result.label,
          reason: outcome.result.reason,
          confidence: outcome.result.confidence
        }
      : { label: "error", reason: outcome.error }
    : outcome;

  const colors = pillColor(state.label);
  const shadowRoot = ensureShadowRoot(target);
  shadowRoot.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
    .sift-root { font-family: ui-sans-serif, system-ui, sans-serif; display: inline-flex; align-items: center; gap: 8px; }
    .sift-pill { border: 1px solid ${colors.border}; background: ${colors.background}; color: ${colors.foreground}; border-radius: 999px; padding: 4px 10px; font-size: 12px; line-height: 1; font-weight: 600; }
    .sift-meta { color: rgba(15, 23, 42, 0.65); font-size: 11px; }
    .sift-menu { display: inline-flex; gap: 4px; flex-wrap: wrap; }
    .sift-menu button { border: 1px solid rgba(148, 163, 184, 0.45); background: rgba(255, 255, 255, 0.82); border-radius: 999px; padding: 2px 8px; font-size: 11px; cursor: pointer; }
    .sift-menu button:disabled { opacity: 0.45; cursor: default; }
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "sift-root";

  const pill = document.createElement("span");
  pill.className = "sift-pill";
  pill.textContent = labelText(state);
  wrapper.appendChild(pill);

  if (typeof state.confidence === "number") {
    const meta = document.createElement("span");
    meta.className = "sift-meta";
    meta.textContent = `${Math.round(state.confidence * 100)}%`;
    wrapper.appendChild(meta);
  }

  const menu = document.createElement("div");
  menu.className = "sift-menu";
  menu.append(
    createMenuButton("Useful", handlers.onMarkUseful),
    createMenuButton("Maybe", handlers.onMarkMaybe),
    createMenuButton("Slop", handlers.onMarkSlop),
    createMenuButton("Hide", handlers.onHide),
    createMenuButton("Show", handlers.onShow),
    createMenuButton("Retry", handlers.onRetry)
  );
  wrapper.appendChild(menu);

  shadowRoot.append(style, wrapper);
}

export function renderManualPill(target: HTMLElement, result: ClassificationResult, handlers: PillHandlers = {}): void {
  renderPill(target, { ok: true, result }, handlers);
}
