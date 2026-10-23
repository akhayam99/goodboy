import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

type Params = {
  readonly width: number;
  readonly height: number;
};

type StageScale = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly scale: number;
  readonly hasRoom: boolean;
};

export const useStageScale = ({ width, height }: Params): StageScale => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    const measure = () => {
      const box = node.getBoundingClientRect();
      setScale(Math.min(box.width / width, box.height / height, 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height]);

  return { ref, scale, hasRoom: scale > 0 };
};
