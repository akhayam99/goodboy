import { useLayoutEffect, type RefObject } from 'react';
import { anchorShift } from '../../../../shared/hooks/useScrollAnchor/anchorShift';
import { spawnedTreeItemsOf } from '../spawnedTreeItemsOf';

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
};

type ElementParams = {
  readonly element: HTMLElement;
};

type Anchor = Readonly<{
  id: string;
  offset: number;
}>;

const SCROLLING = new Set(['auto', 'scroll', 'overlay']);

const scrollParentOf = ({ element }: ElementParams): HTMLElement | null => {
  let parent = element.parentElement;
  while (parent !== null) {
    if (SCROLLING.has(getComputedStyle(parent).overflowY)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

export const useSpawnedScrollHold = ({ rootRef }: Params): void => {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof MutationObserver === 'undefined') {
      return;
    }
    const scroller = scrollParentOf({ element: root });
    if (scroller === null) {
      return;
    }
    let anchor: Anchor | null = null;

    const record = () => {
      const top = scroller.getBoundingClientRect().top;
      const row = spawnedTreeItemsOf({ element: root }).find(
        (item) => item.getBoundingClientRect().bottom > top,
      );
      const id = row?.dataset.treeId;
      anchor =
        row === undefined || id === undefined
          ? null
          : { id, offset: row.getBoundingClientRect().top - top };
    };

    const hold = () => {
      const saved = anchor;
      const row =
        saved === null
          ? undefined
          : spawnedTreeItemsOf({ element: root }).find((item) => item.dataset.treeId === saved.id);
      if (saved !== null && row !== undefined) {
        const shift = anchorShift({
          savedOffset: saved.offset,
          currentOffset: row.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
          isHeld: scroller.scrollTop <= 0,
        });
        if (shift !== 0) {
          scroller.scrollTop += shift;
        }
      }
      record();
    };

    const observer = new MutationObserver(hold);
    observer.observe(root, { childList: true, subtree: true });
    scroller.addEventListener('scroll', record, { passive: true });
    record();
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', record);
    };
  }, [rootRef]);
};
