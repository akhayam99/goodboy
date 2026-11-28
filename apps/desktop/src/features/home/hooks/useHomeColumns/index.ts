import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { columnsOf, type HomeColumns } from '../../grid/columnsOf';

type HomeColumnsResult = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly columns: HomeColumns;
};

export const useHomeColumns = (): HomeColumnsResult => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<HomeColumns>(4);
  const measure = useCallback(() => {
    const widthPx = ref.current?.getBoundingClientRect().width ?? 0;
    if (widthPx > 0) {
      setColumns(columnsOf({ widthPx }));
    }
  }, []);
  useEffect(() => {
    measure();
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);
  return { ref, columns };
};
