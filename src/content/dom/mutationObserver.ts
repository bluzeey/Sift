export function observeMutations(target: Node, onMutate: () => void): MutationObserver {
  const observer = new MutationObserver(() => onMutate());
  observer.observe(target, { childList: true, subtree: true });
  return observer;
}
