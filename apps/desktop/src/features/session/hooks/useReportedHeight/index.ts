import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { DetailHeightParams } from '../../timeline/decisionChangeLines';

type Params = {
  readonly rowId: string;
  readonly onMeasured: (params: DetailHeightParams) => void;
};

export const useReportedHeight = ({
  rowId,
  onMeasured,
}: Params): RefObject<HTMLDivElement | null> => {
  const body = useRef<HTMLDivElement | null>(null);
  const measuredRef = useRef(onMeasured);
  measuredRef.current = onMeasured;

  useLayoutEffect(() => {
    const element = body.current;
    if (element === null) {
      return;
    }
    const measure = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height > 0) {
        measuredRef.current({ rowId, height });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowId]);

  return body;
};
