import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

const FILE_RAIL_DOCK_MIN_PX = 880;

const foldedPref = persistedPref<boolean>({
  key: STORAGE_KEYS.diffFileRailFolded,
  parse: (raw) => raw === '1',
  serialize: (isFolded) => (isFolded ? '1' : '0'),
  fallback: false,
});

type Params = {
  readonly page: HTMLElement | null;
};

export type FileRail = {
  readonly isShown: boolean;
  readonly isOverlay: boolean;
  readonly open: () => void;
  readonly fold: () => void;
  readonly dismiss: () => void;
};

export const useFileRail = ({ page }: Params): FileRail => {
  const [isFolded, setIsFolded] = useState(foldedPref.read);
  const [isPeeking, setIsPeeking] = useState(false);
  const [pageWidth, setPageWidth] = useState<number | null>(null);

  useEffect(() => {
    if (page === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setPageWidth(entry.contentRect.width);
      }
    });
    observer.observe(page);
    return () => observer.disconnect();
  }, [page]);

  const isNarrow = pageWidth !== null && pageWidth < FILE_RAIL_DOCK_MIN_PX;

  useEffect(() => {
    if (!isNarrow) {
      setIsPeeking(false);
    }
  }, [isNarrow]);

  const setFolded = useCallback((isNowFolded: boolean) => {
    setIsFolded(isNowFolded);
    foldedPref.write(isNowFolded);
  }, []);

  const open = useCallback(() => {
    if (isNarrow) {
      setIsPeeking(true);
      return;
    }
    setFolded(false);
  }, [isNarrow, setFolded]);

  const fold = useCallback(() => {
    if (isNarrow) {
      setIsPeeking(false);
      return;
    }
    setFolded(true);
  }, [isNarrow, setFolded]);

  const dismiss = useCallback(() => setIsPeeking(false), []);

  return {
    isShown: isNarrow ? isPeeking : !isFolded,
    isOverlay: isNarrow,
    open,
    fold,
    dismiss,
  };
};
