import type { ClassificationOutcome, ClassificationResult, InjectionTarget, UiLabel } from "../../shared/types";
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

const listenerControllers = new WeakMap<ShadowRoot, AbortController>();

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

type ActionButtonConfig = {
  label: string;
  onClick?: () => void;
  tone?: "default" | "danger";
};

function createActionConfigs(state: PillState, handlers: PillHandlers): ActionButtonConfig[] {
  const actions: ActionButtonConfig[] = [];

  if (handlers.onMarkUseful) {
    actions.push({ label: "Useful", onClick: handlers.onMarkUseful });
  }

  if (handlers.onMarkMaybe) {
    actions.push({ label: "Maybe", onClick: handlers.onMarkMaybe });
  }

  if (handlers.onMarkSlop) {
    actions.push({ label: "Slop", onClick: handlers.onMarkSlop, tone: "danger" });
  }

  if (state.label === "muted") {
    if (handlers.onShow) {
      actions.push({ label: "Show", onClick: handlers.onShow });
    }
  } else if (handlers.onHide) {
    actions.push({ label: "Hide", onClick: handlers.onHide });
  }

  if (state.label === "error" && handlers.onRetry) {
    actions.push({ label: "Retry", onClick: handlers.onRetry });
  }

  return actions;
}

export function renderPill(target: InjectionTarget, outcome: ClassificationOutcome | PillState, handlers: PillHandlers = {}): void {
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
  listenerControllers.get(shadowRoot)?.abort();
  const controller = new AbortController();
  listenerControllers.set(shadowRoot, controller);
  shadowRoot.innerHTML = "";

  const actionConfigs = createActionConfigs(state, handlers);

  const style = document.createElement("style");
  style.textContent = `
    .sift-root {
      font-family: ui-sans-serif, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      color: #0f172a;
    }
    .sift-shell {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sift-pill {
      border: 1px solid ${colors.border};
      background: ${colors.background};
      color: ${colors.foreground};
      border-radius: 999px;
      padding: 9px 15px;
      font-size: 14px;
      line-height: 1.1;
      font-weight: 700;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
      max-width: 240px;
    }
    .sift-meta {
      color: rgba(226, 232, 240, 0.92);
      background: rgba(15, 23, 42, 0.84);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
    }
    .sift-feedback-toggle,
    .sift-action {
      border: 1px solid rgba(148, 163, 184, 0.36);
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 14px;
      line-height: 1;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.22);
    }
    .sift-feedback-toggle[aria-expanded='true'] {
      background: rgba(30, 41, 59, 0.98);
    }
    .sift-pane {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-width: 210px;
      padding: 10px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(2, 6, 23, 0.96);
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(10px);
    }
    .sift-pane[hidden] {
      display: none;
    }
    .sift-action {
      width: 100%;
      justify-content: center;
      background: rgba(248, 250, 252, 0.94);
      color: #0f172a;
      border-color: rgba(203, 213, 225, 0.9);
      box-shadow: none;
    }
    .sift-action.sift-action-danger {
      background: rgba(254, 226, 226, 0.98);
      color: #991b1b;
      border-color: rgba(252, 165, 165, 0.9);
    }
    .sift-action:disabled,
    .sift-feedback-toggle:disabled {
      opacity: 0.45;
      cursor: default;
    }
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "sift-root";

  const shell = document.createElement("div");
  shell.className = "sift-shell";

  const pill = document.createElement("span");
  pill.className = "sift-pill";
  pill.textContent = labelText(state);
  shell.appendChild(pill);

  if (typeof state.confidence === "number") {
    const meta = document.createElement("span");
    meta.className = "sift-meta";
    meta.textContent = `${Math.round(state.confidence * 100)}%`;
    shell.appendChild(meta);
  }

  const feedbackButton = createMenuButton("Feedback", actionConfigs.length > 0 ? () => undefined : undefined);
  feedbackButton.className = "sift-feedback-toggle";
  feedbackButton.setAttribute("aria-haspopup", "dialog");
  feedbackButton.setAttribute("aria-expanded", "false");
  feedbackButton.disabled = actionConfigs.length === 0;
  shell.appendChild(feedbackButton);

  const pane = document.createElement("div");
  pane.className = "sift-pane";
  pane.hidden = true;

  const closePane = (): void => {
    pane.hidden = true;
    feedbackButton.setAttribute("aria-expanded", "false");
  };

  const togglePane = (): void => {
    const nextHidden = !pane.hidden;
    pane.hidden = nextHidden;
    feedbackButton.setAttribute("aria-expanded", String(!nextHidden));
  };

  for (const config of actionConfigs) {
    const actionButton = createMenuButton(config.label, config.onClick ? () => {
      closePane();
      config.onClick?.();
    } : undefined);
    actionButton.className = `sift-action${config.tone === "danger" ? " sift-action-danger" : ""}`;
    pane.appendChild(actionButton);
  }

  feedbackButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePane();
  }, { signal: controller.signal });

  pane.addEventListener("click", (event) => {
    event.stopPropagation();
  }, { signal: controller.signal });

  document.addEventListener("click", (event) => {
    const path = event.composedPath();
    if (path.includes(shadowRoot.host)) {
      return;
    }

    closePane();
  }, { capture: true, signal: controller.signal });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePane();
    }
  }, { signal: controller.signal });

  wrapper.append(shell, pane);

  shadowRoot.append(style, wrapper);
}

export function renderManualPill(target: InjectionTarget, result: ClassificationResult, handlers: PillHandlers = {}): void {
  renderPill(target, { ok: true, result }, handlers);
}
