import { useCallback, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';

export type WidthVar = `--${string}`;

type Bounds = {
  readonly min: number;
  readonly max: number;
};

type ReadParams = Bounds & {
  readonly storageKey: string;
  readonly fallback: number;
};

type Params = Bounds & {
  readonly storageKey: string;
  readonly defaultWidth: number;
  readonly cssVar: WidthVar;
  readonly onPreview?: (width: number) => void;
};

export type ResizableHandleProps = Bounds & {
  readonly value: number;
  readonly onChange: (width: number) => void;
  readonly onCommit: (width: number) => void;
  readonly onReset: () => void;
};

export type ResizableWidth<T extends HTMLElement> = {
  readonly width: number;
  readonly targetRef: RefObject<T | null>;
  readonly style: CSSProperties & Readonly<Record<WidthVar, string>>;
  readonly handleProps: ResizableHandleProps;
};

const clampWidth = ({ value, min, max }: Bounds & { readonly value: number }): number =>
  Math.round(Math.max(min, Math.min(max, value)));

export const readStoredWidth = ({ storageKey, fallback, min, max }: ReadParams): number => {
  try {
    const parsed = Number.parseInt(localStorage.getItem(storageKey) ?? '', 10);
    return Number.isNaN(parsed) ? fallback : clampWidth({ value: parsed, min, max });
  } catch {
    return fallback;
  }
};

const writeStoredWidth = ({
  storageKey,
  width,
}: {
  readonly storageKey: string;
  readonly width: number;
}): void => {
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    return;
  }
};

export const useResizableWidth = <T extends HTMLElement>({
  storageKey,
  defaultWidth,
  min,
  max,
  cssVar,
  onPreview,
}: Params): ResizableWidth<T> => {
  const [width, setWidth] = useState(() =>
    readStoredWidth({ storageKey, fallback: defaultWidth, min, max }),
  );
  const targetRef = useRef<T | null>(null);
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;

  const preview = useCallback(
    (next: number) => {
      const clamped = clampWidth({ value: next, min, max });
      if (previewRef.current !== undefined) {
        previewRef.current(clamped);
        return;
      }
      targetRef.current?.style.setProperty(cssVar, `${clamped}px`);
    },
    [cssVar, max, min],
  );

  const commit = useCallback(
    (next: number) => {
      const clamped = clampWidth({ value: next, min, max });
      preview(clamped);
      setWidth(clamped);
      writeStoredWidth({ storageKey, width: clamped });
    },
    [max, min, preview, storageKey],
  );

  const reset = useCallback(() => commit(defaultWidth), [commit, defaultWidth]);

  const style = useMemo(() => ({ [cssVar]: `${width}px` }), [cssVar, width]);

  return {
    width,
    targetRef,
    style,
    handleProps: { value: width, min, max, onChange: preview, onCommit: commit, onReset: reset },
  };
};
