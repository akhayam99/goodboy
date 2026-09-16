export type WireframeBox = Readonly<{ width: number; height: number }>;

type WireframeCanvasBox = Readonly<{ maxHeight: number; available: WireframeBox }>;

const CANVAS_GUTTER = 40;

const CANVAS_MIN_HEIGHT = 200;

const CANVAS_BOTTOM_INSET = 24;

type CanvasBoxParams = Readonly<{
  clientWidth: number;
  top: number;
  bottom: number;
}>;

export const wireframeCanvasBox = ({
  clientWidth,
  top,
  bottom,
}: CanvasBoxParams): WireframeCanvasBox => {
  const maxHeight = Math.max(CANVAS_MIN_HEIGHT, bottom - top - CANVAS_BOTTOM_INSET);
  return {
    maxHeight,
    available: {
      width: Math.max(0, clientWidth - CANVAS_GUTTER),
      height: Math.max(0, maxHeight - CANVAS_GUTTER),
    },
  };
};

type FitZoomParams = Readonly<{
  available: WireframeBox;
  frame: WireframeBox;
}>;

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

export const wireframeFitZoom = ({ available, frame }: FitZoomParams): number | null => {
  if (!isPositive(available.width) || !isPositive(available.height)) {
    return null;
  }
  if (!isPositive(frame.width) || !isPositive(frame.height)) {
    return null;
  }
  return Math.min(available.width / frame.width, available.height / frame.height);
};

type ScrollBottomParams = Readonly<{ node: HTMLElement; fallback: number }>;

export const wireframeScrollBottom = ({ node, fallback }: ScrollBottomParams): number => {
  let current = node.parentElement;
  while (current !== null) {
    const overflow = window.getComputedStyle(current).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') {
      return current.getBoundingClientRect().bottom;
    }
    current = current.parentElement;
  }
  return fallback;
};
