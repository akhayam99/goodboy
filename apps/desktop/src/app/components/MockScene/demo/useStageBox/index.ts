import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { StageBox } from '../stageFitOf';

type StageMeasure = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly box: StageBox;
  readonly hasRoom: boolean;
};

const EMPTY: StageBox = { width: 0, height: 0 };

export const useStageBox = (): StageMeasure => {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<StageBox>(EMPTY);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));
      setBox((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, box, hasRoom: box.width > 0 && box.height > 0 };
};
