const hosts = new WeakMap<HTMLElement, HTMLDivElement>();

export function ensureShadowRoot(target: HTMLElement): ShadowRoot {
  const existing = hosts.get(target);
  if (existing?.shadowRoot) {
    return existing.shadowRoot;
  }

  const host = document.createElement("div");
  host.dataset.siftRootHost = "true";
  host.dataset.siftUi = "true";
  host.style.display = "block";
  host.style.margin = "0 0 8px 0";

  const shadowRoot = host.attachShadow({ mode: "open" });
  target.prepend(host);
  hosts.set(target, host);
  return shadowRoot;
}

export function removeInjectedUi(root: ParentNode = document): void {
  root.querySelectorAll("[data-sift-root-host='true'], [data-sift-ui='true']").forEach((node) => node.remove());
}
