import { useCallback, useLayoutEffect, useState, type MutableRefObject } from 'react';

export type DockLaneBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly columnRef: MutableRefObject<HTMLDivElement | null>;
};

type SameParams = {
  readonly was: DockLaneBox | null;
  readonly next: DockLaneBox;
};

const isSameBox = ({ was, next }: SameParams): boolean =>
  was !== null &&
  was.x === next.x &&
  was.y === next.y &&
  was.width === next.width &&
  was.height === next.height;

export const useDockLaneBox = ({ columnRef }: Params) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const setColumn = useCallback(
    (node: HTMLDivElement | null) => {
      columnRef.current = node;
      setRoot(node);
    },
    [columnRef],
  );
  const [lane, setLane] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<DockLaneBox | null>(null);
  useLayoutEffect(() => {
    if (lane === null || root === null) {
      setBox(null);
      return undefined;
    }
    const measure = () => {
      const outer = root.getBoundingClientRect();
      const inner = lane.getBoundingClientRect();
      if (inner.width <= 0 || inner.height <= 0) {
        setBox(null);
        return;
      }
      const next = {
        x: Math.round(inner.left - outer.left),
        y: Math.round(inner.top - outer.top),
        width: Math.round(inner.width),
        height: Math.round(inner.height),
      };
      setBox((was) => (isSameBox({ was, next }) ? was : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(lane);
    observer.observe(root);
    return () => observer.disconnect();
  }, [lane, root]);
  return { setColumn, setLane, box };
};
