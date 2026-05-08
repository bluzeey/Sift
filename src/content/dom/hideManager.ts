const hiddenState = new WeakMap<HTMLElement, { placeholder: HTMLDivElement; previousDisplay: string }>();
const hiddenElements = new Set<HTMLElement>();

function createPlaceholder(element: HTMLElement): HTMLDivElement {
  const placeholder = document.createElement("div");
  placeholder.className = "sift-hidden-placeholder";
  placeholder.dataset.siftUi = "true";
  placeholder.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  placeholder.style.borderRadius = "12px";
  placeholder.style.padding = "10px 12px";
  placeholder.style.margin = "8px 0";
  placeholder.style.background = "rgba(15, 23, 42, 0.06)";
  placeholder.style.fontSize = "13px";
  placeholder.style.lineHeight = "1.4";
  placeholder.style.color = "inherit";

  const text = document.createElement("span");
  text.textContent = "Sift hid this post — ";

  const button = document.createElement("button");
  button.className = "sift-show-button";
  button.type = "button";
  button.textContent = "show";
  button.style.border = "none";
  button.style.background = "transparent";
  button.style.color = "#2563eb";
  button.style.cursor = "pointer";
  button.style.padding = "0";
  button.addEventListener("click", () => restoreElement(element));

  placeholder.append(text, button);
  return placeholder;
}

export function hideElement(element: HTMLElement): void {
  if (hiddenState.has(element)) {
    return;
  }

  const placeholder = createPlaceholder(element);
  const previousDisplay = element.style.display;
  element.insertAdjacentElement("beforebegin", placeholder);
  element.style.display = "none";

  hiddenState.set(element, { placeholder, previousDisplay });
  hiddenElements.add(element);
}

export function restoreElement(element: HTMLElement): void {
  const state = hiddenState.get(element);
  if (!state) {
    return;
  }

  state.placeholder.remove();
  element.style.display = state.previousDisplay;
  hiddenState.delete(element);
  hiddenElements.delete(element);
}

export function restoreAllHidden(): void {
  for (const element of Array.from(hiddenElements)) {
    restoreElement(element);
  }
}
