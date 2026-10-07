import { useCallback, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';
import { dockedRailLimitOf } from '../../treeRailMode';

const TREE_WIDTH_DEFAULT = 280;
export const TREE_WIDTH_MIN = 240;
export const TREE_WIDTH_MAX = 400;
export const TREE_OVERLAY_WIDTH = 280;

const widthPref = persistedPref<number>({
  key: STORAGE_KEYS.diffTreeWidth,
  parse: (raw) => {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  },
  serialize: (width) => String(Math.round(width)),
  fallback: TREE_WIDTH_DEFAULT,
});

type ClampParams = {
  readonly width: number;
  readonly paneWidth: number;
};

export const clampTreeWidth = ({ width, paneWidth }: ClampParams): number => {
  const ceiling = Math.max(
    TREE_WIDTH_MIN,
    Math.min(TREE_WIDTH_MAX, dockedRailLimitOf({ paneWidth })),
  );
  return Math.round(Math.min(ceiling, Math.max(TREE_WIDTH_MIN, width)));
};

export type TreeWidth = {
  readonly width: number;
  readonly resizeTo: (params: ClampParams) => void;
};

export const useTreeWidth = (): TreeWidth => {
  const [width, setWidth] = useState(widthPref.read);
  const resizeTo = useCallback(({ width: next, paneWidth }: ClampParams) => {
    const clamped = clampTreeWidth({ width: next, paneWidth });
    setWidth(clamped);
    widthPref.write(clamped);
  }, []);
  return { width, resizeTo };
};
