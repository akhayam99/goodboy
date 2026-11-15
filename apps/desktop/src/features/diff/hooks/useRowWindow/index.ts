import { useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly isWindowed: boolean;
};

export type RowWindowMeasure = {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly scrollTop: number;
  readonly viewport: number;
};

type TrackedRefParams = {
  readonly onElement: (element: HTMLDivElement | null) => void;
};

const trackedRefOf = ({ onElement }: TrackedRefParams): RefObject<HTMLDivElement | null> => {
  let element: HTMLDivElement | null = null;
  return {
    get current() {
      return element;
    },
    set current(next: HTMLDivElement | null) {
      element = next;
      onElement(next);
    },
  };
};

export const useRowWindow = ({ isWindowed }: Params): RowWindowMeasure => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [viewportRef] = useState(() => trackedRefOf({ onElement: setElement }));

  useEffect(() => {
    if (element === null || !isWindowed) {
      return;
    }
    const measure = () => {
      setScrollTop(element.scrollTop);
      setViewport(element.clientHeight);
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [element, isWindowed]);

  return { viewportRef, scrollTop, viewport };
};
