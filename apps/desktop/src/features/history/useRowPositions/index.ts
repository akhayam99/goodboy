import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { HISTORY_GRAPH } from '../historyGraphGeometry';

export type RowPositions = {
  readonly height: number;
  readonly y: ReadonlyMap<string, number>;
};

type Params = {
  readonly listRef: RefObject<HTMLElement | null>;
  readonly layoutKey: string;
};

const EMPTY: RowPositions = { height: 0, y: new Map() };

const topWithin = ({ row, list }: { readonly row: HTMLElement; readonly list: HTMLElement }) => {
  let top = 0;
  let node: HTMLElement | null = row;
  while (node !== null && node !== list) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
};

const measure = ({ list }: { readonly list: HTMLElement }): RowPositions => {
  const y = new Map<string, number>();
  for (const row of list.querySelectorAll<HTMLElement>('[data-graph-key]')) {
    y.set(
      row.dataset.graphKey ?? '',
      topWithin({ row, list }) + Math.min(row.offsetHeight / 2, HISTORY_GRAPH.nodeOffset),
    );
  }
  return { height: list.scrollHeight, y };
};

const isSame = ({ left, right }: { readonly left: RowPositions; readonly right: RowPositions }) =>
  left.height === right.height &&
  left.y.size === right.y.size &&
  [...left.y].every(([key, value]) => right.y.get(key) === value);

export const useRowPositions = ({ listRef, layoutKey }: Params): RowPositions => {
  const [positions, setPositions] = useState<RowPositions>(EMPTY);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    const update = () => {
      const next = measure({ list });
      setPositions((current) => (isSame({ left: current, right: next }) ? current : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, layoutKey]);

  return positions;
};
