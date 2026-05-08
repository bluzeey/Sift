import { beforeEach, describe, expect, it } from "vitest";
import { hideElement, restoreElement } from "../src/content/dom/hideManager";
import { renderPill } from "../src/content/dom/pillRenderer";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("injected UI", () => {
  it("injects a shadow-root pill", () => {
    const target = document.createElement("article");
    target.textContent = "Visible post text";
    document.body.appendChild(target);

    renderPill(target, {
      ok: true,
      result: {
        label: "slop",
        confidence: 0.88,
        reason: "Off topic",
        action: "hide"
      }
    });

    const host = target.querySelector("[data-sift-root-host='true']") as HTMLDivElement | null;
    expect(host?.shadowRoot?.textContent).toContain("Slop");
    expect(host?.shadowRoot?.textContent).toContain("Off topic");
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
