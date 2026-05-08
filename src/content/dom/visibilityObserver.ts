export function createVisibilityObserver(onVisible: (element: HTMLElement) => void): IntersectionObserver {
  return new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          onVisible(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );
}
