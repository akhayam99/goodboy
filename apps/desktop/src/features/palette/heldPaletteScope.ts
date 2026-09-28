import type { CommitScope } from './types';

type HoldParams = {
  readonly element: Element;
  readonly scope: CommitScope;
};

const held = new WeakMap<Element, CommitScope>();

export const holdPaletteScope = ({ element, scope }: HoldParams): (() => void) => {
  held.set(element, scope);
  return () => {
    if (held.get(element) === scope) {
      held.delete(element);
    }
  };
};

export const focusedPaletteScope = (): CommitScope | null => {
  let node: Element | null = typeof document === 'undefined' ? null : document.activeElement;
  while (node !== null) {
    const scope = held.get(node);
    if (scope !== undefined) {
      return scope;
    }
    node = node.parentElement;
  }
  return null;
};
