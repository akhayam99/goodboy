import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly fallbackId: string;
};

type FocusParams = {
  readonly event: FocusEvent;
};

const ITEM_SELECTOR = '[role="treeitem"]';

export const useSpawnedFocusKeep = ({ rootRef, fallbackId }: Params): void => {
  const heldRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const onFocusIn = ({ event }: FocusParams): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      heldRef.current = target?.closest<HTMLElement>(ITEM_SELECTOR) ?? null;
    };
    const controller = new AbortController();
    root.addEventListener('focusin', (event) => onFocusIn({ event }), {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [rootRef]);

  useLayoutEffect(() => {
    const held = heldRef.current;
    const root = rootRef.current;
    if (held === null || root === null || held.isConnected) {
      return;
    }
    heldRef.current = null;
    if (document.activeElement !== document.body && document.activeElement !== null) {
      return;
    }
    const items = [...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    const heldId = held.dataset.treeId;
    const next =
      items.find((item) => item.dataset.treeId === heldId) ??
      items.find((item) => item.dataset.treeId === fallbackId) ??
      items[0];
    next?.focus();
  });
};
