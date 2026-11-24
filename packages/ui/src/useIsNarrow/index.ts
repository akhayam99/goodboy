import { useCallback, useEffect, useState } from 'react';

type Params = {
  readonly below: number;
};

type NarrowWatch = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly isNarrow: boolean;
};

export const useIsNarrow = ({ below }: Params): NarrowWatch => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);

  useEffect(() => {
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }
      const { width } = entry.contentRect;
      setIsNarrow(width > 0 && width < below);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, below]);

  return { ref, isNarrow };
};
