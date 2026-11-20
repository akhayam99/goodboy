import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { studioRailPaneStore } from '../studioRailPaneStore';

type SurfaceParams = {
  readonly surface: string;
};

type WriteParams = SurfaceParams & {
  readonly isFolded: boolean;
};

export const studioRailFoldKey = ({ surface }: SurfaceParams): string =>
  `goodboy:studio-rail-folded:${surface}:v1`;

export const STUDIO_RAIL_FOLD_BELOW = 880;

const FOLDED = '1';
const DOCKED = '0';

type ReadParams = SurfaceParams & {
  readonly foldedByDefaultBelow: number | null;
};

const readFolded = ({ surface, foldedByDefaultBelow }: ReadParams): boolean => {
  try {
    const saved = localStorage.getItem(studioRailFoldKey({ surface }));
    if (saved !== null) {
      return saved === FOLDED;
    }
  } catch {
    return false;
  }
  return foldedByDefaultBelow !== null && window.innerWidth < foldedByDefaultBelow;
};

const writeFolded = ({ surface, isFolded }: WriteParams): void => {
  try {
    localStorage.setItem(studioRailFoldKey({ surface }), isFolded ? FOLDED : DOCKED);
  } catch {
    return;
  }
};

type Params = SurfaceParams & {
  readonly foldBelow?: number;
  readonly foldedByDefaultBelow?: number;
  readonly pane?: HTMLElement | null;
};

export type StudioRailFold = {
  readonly isCollapsed: boolean;
  readonly canDock: boolean;
  readonly setFolded: (isFolded: boolean) => void;
};

export const useStudioRailFold = ({
  surface,
  foldBelow = STUDIO_RAIL_FOLD_BELOW,
  foldedByDefaultBelow,
  pane = null,
}: Params): StudioRailFold => {
  const [isFolded, setIsFolded] = useState(() =>
    readFolded({ surface, foldedByDefaultBelow: foldedByDefaultBelow ?? null }),
  );
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => studioRailPaneStore.subscribe({ listener }),
    [],
  );
  const layoutWidth = useSyncExternalStore(subscribe, () => studioRailPaneStore.width({ surface }));
  const [isOpenedNarrow, setIsOpenedNarrow] = useState(false);
  const width = pane === null ? layoutWidth : paneWidth;
  const isNarrow = width !== null && width < foldBelow;

  useEffect(() => {
    if (!isNarrow) {
      setIsOpenedNarrow(false);
    }
    studioRailPaneStore.setNarrow({ surface, isNarrow });
  }, [surface, isNarrow]);

  useEffect(() => () => studioRailPaneStore.setNarrow({ surface, isNarrow: false }), [surface]);

  useEffect(() => {
    if (pane === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setPaneWidth(entry.contentRect.width);
      }
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }, [pane]);

  const setFolded = useCallback(
    (isNowFolded: boolean) => {
      if (isNarrow) {
        setIsOpenedNarrow(!isNowFolded);
        return;
      }
      setIsFolded(isNowFolded);
      writeFolded({ surface, isFolded: isNowFolded });
    },
    [surface, isNarrow],
  );

  const isCollapsed = isNarrow ? !isOpenedNarrow : isFolded;

  return { isCollapsed, canDock: !isNarrow, setFolded };
};
