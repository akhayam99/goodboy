import { useCallback, useState, type RefObject } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

const TREE_WIDTH_DEFAULT = 320;
export const TREE_WIDTH_MIN = 240;
export const TREE_WIDTH_MAX = 560;
export const TREE_WIDTH_SHARE = 0.3;

const widthPref = persistedPref<number>({
  key: STORAGE_KEYS.diffTreeWidth,
  parse: (raw) => {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  },
  serialize: (width) => String(Math.round(width)),
  fallback: TREE_WIDTH_DEFAULT,
});

export const clampTreeWidth = (width: number, paneWidth: number): number => {
  const ceiling = Math.max(TREE_WIDTH_MIN, Math.min(TREE_WIDTH_MAX, paneWidth * TREE_WIDTH_SHARE));
  return Math.round(Math.min(ceiling, Math.max(TREE_WIDTH_MIN, width)));
};

export type TreeWidth = {
  readonly width: number;
  readonly resizeTo: (width: number) => void;
  readonly paneWidth: () => number;
};

export const useTreeWidth = (rootRef: RefObject<HTMLElement | null>): TreeWidth => {
  const [width, setWidth] = useState(widthPref.read);
  const paneWidth = useCallback(() => rootRef.current?.clientWidth ?? 0, [rootRef]);
  const resizeTo = useCallback(
    (next: number) => {
      const clamped = clampTreeWidth(next, paneWidth());
      setWidth(clamped);
      widthPref.write(clamped);
    },
    [paneWidth],
  );
  return { width, resizeTo, paneWidth };
};
