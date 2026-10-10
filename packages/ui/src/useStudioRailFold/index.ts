import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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

const readFolded = ({ surface }: SurfaceParams): boolean => {
  try {
    return localStorage.getItem(studioRailFoldKey({ surface })) === FOLDED;
  } catch {
    return false;
  }
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
};

export type StudioRailFold = {
  readonly paneRef: RefObject<HTMLDivElement | null>;
  readonly isCollapsed: boolean;
  readonly canDock: boolean;
  readonly setFolded: (isFolded: boolean) => void;
};

export const useStudioRailFold = ({
  surface,
  foldBelow = STUDIO_RAIL_FOLD_BELOW,
}: Params): StudioRailFold => {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [isFolded, setIsFolded] = useState(() => readFolded({ surface }));
  const [paneWidth, setPaneWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = paneRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setPaneWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const setFolded = useCallback(
    (next: boolean) => {
      setIsFolded(next);
      writeFolded({ surface, isFolded: next });
    },
    [surface],
  );

  const isNarrow = paneWidth !== null && paneWidth < foldBelow;

  return { paneRef, isCollapsed: isFolded || isNarrow, canDock: !isNarrow, setFolded };
};
