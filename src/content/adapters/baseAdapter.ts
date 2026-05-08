import { hideElement as defaultHideElement, restoreElement as defaultRestoreElement } from "../dom/hideManager";

export function buildCandidateId(site: string, source: string): string {
  return `${site}:${source.trim().slice(0, 180)}`;
}

export function hideElement(element: HTMLElement): void {
  defaultHideElement(element);
}

export function restoreElement(element: HTMLElement): void {
  defaultRestoreElement(element);
}
