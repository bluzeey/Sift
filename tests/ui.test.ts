import { beforeEach, describe, expect, it, vi } from "vitest";
import { hideElement, restoreElement } from "../src/content/dom/hideManager";
import { renderPill } from "../src/content/dom/pillRenderer";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("injected UI", () => {
  it("injects a top-right overlay with collapsed feedback controls", () => {
    const target = document.createElement("article");
    target.textContent = "Visible post text";
    document.body.appendChild(target);

    const onMarkUseful = vi.fn();

    renderPill(target, {
      ok: true,
      result: {
        label: "slop",
        confidence: 0.88,
        reason: "Off topic",
        action: "hide"
      }
    }, {
      onMarkUseful,
      onMarkMaybe: vi.fn(),
      onMarkSlop: vi.fn(),
      onHide: vi.fn()
    });

    const host = target.querySelector("[data-sift-root-host='true']") as HTMLDivElement | null;
    const shadowRoot = host?.shadowRoot;
    const feedbackButton = shadowRoot?.querySelector(".sift-feedback-toggle") as HTMLButtonElement | null;
    const pane = shadowRoot?.querySelector(".sift-pane") as HTMLDivElement | null;

    expect(host?.style.position).toBe("absolute");
    expect(host?.style.right).toBe("12px");
    expect(target.style.position).toBe("relative");
    expect(shadowRoot?.querySelector(".sift-pill")?.textContent).toContain("Slop");
    expect(shadowRoot?.querySelector(".sift-pill")?.textContent).toContain("Off topic");
    expect(feedbackButton?.textContent).toBe("Feedback");
    expect(pane?.hidden).toBe(true);

    feedbackButton?.click();

    expect(pane?.hidden).toBe(false);
    expect(shadowRoot?.querySelectorAll(".sift-action")).toHaveLength(4);

    const usefulButton = Array.from(shadowRoot?.querySelectorAll(".sift-action") ?? []).find(
      (button) => button.textContent === "Useful"
    ) as HTMLButtonElement | undefined;

    usefulButton?.click();

    expect(pane?.hidden).toBe(true);
    expect(onMarkUseful).toHaveBeenCalledTimes(1);

    feedbackButton?.click();
    expect(pane?.hidden).toBe(false);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(pane?.hidden).toBe(true);
  });

  it("hides and restores candidates without deleting them", () => {
    const target = document.createElement("article");
    target.textContent = "Visible post text";
    document.body.appendChild(target);

    hideElement(target);
    expect(target.style.display).toBe("none");
    expect(document.querySelector(".sift-hidden-placeholder")?.textContent).toContain("Sift hid this post");

    restoreElement(target);
    expect(target.style.display).toBe("");
    expect(document.querySelector(".sift-hidden-placeholder")).toBeNull();
    expect(target.isConnected).toBe(true);
  });
});
