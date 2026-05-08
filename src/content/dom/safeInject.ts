type HostEntry = {
  host: HTMLDivElement;
  adjustedPosition: boolean;
  previousPosition: string;
};

const hosts = new Map<HTMLElement, HostEntry>();

export function ensureShadowRoot(target: HTMLElement): ShadowRoot {
  const existing = hosts.get(target);
  if (existing?.host.isConnected && existing.host.shadowRoot) {
    return existing.host.shadowRoot;
  }

  const computedStyle = target.ownerDocument.defaultView?.getComputedStyle(target);
  const previousPosition = target.style.position;
  const adjustedPosition = computedStyle?.position === "static" || !computedStyle?.position;

  if (adjustedPosition) {
    target.style.position = "relative";
  }

  const host = document.createElement("div");
  host.dataset.siftRootHost = "true";
  host.dataset.siftUi = "true";
  host.style.position = "absolute";
  host.style.top = "12px";
  host.style.right = "12px";
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "auto";
  host.style.maxWidth = "min(340px, calc(100% - 24px))";

  const shadowRoot = host.attachShadow({ mode: "open" });
  target.append(host);
  hosts.set(target, {
    host,
    adjustedPosition,
    previousPosition
  });

  return shadowRoot;
}

export function removeInjectedUi(root: ParentNode = document): void {
  for (const [target, entry] of hosts.entries()) {
    const inScope = root === document || root === target || root.contains(target) || root.contains(entry.host);
    if (!inScope) {
      continue;
    }

    entry.host.remove();
    if (entry.adjustedPosition) {
      target.style.position = entry.previousPosition;
    }

    hosts.delete(target);
  }

  root.querySelectorAll("[data-sift-ui='true']").forEach((node) => node.remove());
}
