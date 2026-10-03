const OUT_OF_FLOW = new Set(['absolute', 'fixed', 'hidden', 'sr-only']);

const isOutOfFlow = (element: Element): boolean =>
  (element.getAttribute('class') ?? '').split(/\s+/).some((token) => OUT_OF_FLOW.has(token));

export const inFlowBefore = (element: Element): ReadonlyArray<Element> => {
  const before: Element[] = [];
  for (
    let node = element.previousElementSibling;
    node !== null;
    node = node.previousElementSibling
  ) {
    if (!isOutOfFlow(node)) {
      before.unshift(node);
    }
  }
  return before;
};

export const isLaidOver = (element: Element, container: Element): boolean => {
  for (
    let node: Element | null = element;
    node !== null && node !== container;
    node = node.parentElement
  ) {
    if (isOutOfFlow(node)) {
      return node.parentElement === container;
    }
  }
  return false;
};
