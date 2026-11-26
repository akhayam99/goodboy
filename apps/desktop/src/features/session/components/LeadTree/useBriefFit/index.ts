import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { briefFitOf } from '../briefFitOf';

type Params = {
  readonly text: string;
};

type Fit = {
  readonly ref: RefObject<HTMLSpanElement | null>;
  readonly shown: string;
};

type MeasureParams = {
  readonly element: HTMLElement;
};

const measurerOf = ({ element }: MeasureParams): ((text: string) => number) | null => {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null || typeof context.measureText !== 'function') {
    return null;
  }
  const style = getComputedStyle(element);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return (text) => context.measureText(text).width;
};

export const useBriefFit = ({ text }: Params): Fit => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(text);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      setShown(text);
      return;
    }
    const fit = (): void => {
      const measure = measurerOf({ element });
      setShown(
        measure === null ? text : briefFitOf({ text, maxWidth: element.clientWidth, measure }),
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return { ref, shown };
};
