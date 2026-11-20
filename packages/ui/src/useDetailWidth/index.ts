import { useCallback, useRef, useState } from 'react';
import { detailWidthKeyOf } from '../detailWidthKeyOf';
import { DRAWER_TIERS, type DrawerSizing } from '../drawerGeometry';
import { TIER_WIDTH_KEYS } from '../drawerWidthKeys';
import { readStoredWidth, type ResizableHandleProps } from '../useResizableWidth';

type Params = {
  readonly kind: string | null;
  readonly sizing: DrawerSizing;
  readonly onPreview: (width: number) => void;
};

type DetailWidth = {
  readonly width: number;
  readonly handleProps: ResizableHandleProps;
};

type KeyParams = {
  readonly storageKey: string;
  readonly sizing: DrawerSizing;
};

type WriteParams = {
  readonly storageKey: string;
  readonly width: number;
};

type ClampParams = {
  readonly value: number;
  readonly sizing: DrawerSizing;
};

const clampOf = ({ value, sizing }: ClampParams): number => {
  const tier = DRAWER_TIERS[sizing];
  return Math.round(Math.max(tier.min, Math.min(tier.max, value)));
};

const writeWidth = ({ storageKey, width }: WriteParams): void => {
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    return;
  }
};

const startWidthOf = ({ storageKey, sizing }: KeyParams): number => {
  const tier = DRAWER_TIERS[sizing];
  const bounds = { min: tier.min, max: tier.max };
  const seeded = readStoredWidth({
    storageKey: TIER_WIDTH_KEYS[sizing],
    fallback: tier.fallback,
    ...bounds,
  });
  return readStoredWidth({ storageKey, fallback: seeded, ...bounds });
};

export const useDetailWidth = ({ kind, sizing, onPreview }: Params): DetailWidth => {
  const storageKey = detailWidthKeyOf({ kind, sizing });
  const [stored, setStored] = useState(() => ({
    kind,
    storageKey,
    sizing,
    width: startWidthOf({ storageKey, sizing }),
  }));
  const isClosing = kind === null && stored.kind !== null;
  const current =
    isClosing || (stored.storageKey === storageKey && stored.sizing === sizing)
      ? stored
      : { kind, storageKey, sizing, width: startWidthOf({ storageKey, sizing }) };
  if (current !== stored) {
    setStored(current);
  }
  const shown = current.sizing;
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  const preview = useCallback(
    (next: number) => previewRef.current(clampOf({ value: next, sizing: shown })),
    [shown],
  );
  const commit = useCallback(
    (next: number) => {
      const width = clampOf({ value: next, sizing: current.sizing });
      previewRef.current(width);
      setStored({
        kind: current.kind,
        storageKey: current.storageKey,
        sizing: current.sizing,
        width,
      });
      writeWidth({ storageKey: current.storageKey, width });
    },
    [current.kind, current.storageKey, current.sizing],
  );
  const reset = useCallback(() => commit(DRAWER_TIERS[shown].fallback), [commit, shown]);
  const tier = DRAWER_TIERS[shown];
  return {
    width: clampOf({ value: current.width, sizing: shown }),
    handleProps: {
      value: current.width,
      min: tier.min,
      max: tier.max,
      onChange: preview,
      onCommit: commit,
      onReset: reset,
    },
  };
};
