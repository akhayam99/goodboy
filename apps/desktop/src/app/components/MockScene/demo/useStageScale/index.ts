import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

type Params = {
  readonly width: number;
  readonly height: number;
  readonly inset: number;
};

type StageScale = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly scale: number;
  readonly hasRoom: boolean;
};

export const useStageScale = ({ width, height, inset }: Params): StageScale => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    const measure = () => {
      const box = node.getBoundingClientRect();
      const room = Math.min((box.width - inset * 2) / width, (box.height - inset * 2) / height, 1);
      setScale(Math.max(0, room));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height, inset]);

  return { ref, scale, hasRoom: scale > 0 };
};
