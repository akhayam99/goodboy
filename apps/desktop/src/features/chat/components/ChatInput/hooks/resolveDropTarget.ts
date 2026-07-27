import { currentZoom } from '../../../../../shared/lib/zoom';

type Point = {
  readonly x: number;
  readonly y: number;
};

export type DropTargetResult = {
  readonly hit: boolean;
  readonly ambiguousMiss: boolean;
};

const isVisible = (el: HTMLElement): boolean => el.offsetParent !== null;

const getVisibleComposers = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-drop-composer]')).filter(isVisible);

const isInsideRect = ({
  x,
  y,
  el,
}: {
  readonly x: number;
  readonly y: number;
  readonly el: HTMLElement;
}): boolean => {
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

const findHit = ({
  point,
  elements,
}: {
  readonly point: Point;
  readonly elements: ReadonlyArray<HTMLElement>;
}): HTMLElement | null =>
  elements.find((el) => isInsideRect({ x: point.x, y: point.y, el })) ?? null;

export const resolveDropTarget = ({
  px,
  py,
  composer,
}: {
  readonly px: number;
  readonly py: number;
  readonly composer: HTMLElement;
}): DropTargetResult => {
  const visible = getVisibleComposers();
  if (visible.length <= 1) {
    return { hit: visible.length === 1 && visible[0] === composer, ambiguousMiss: false };
  }

  const zoom = currentZoom();
  const dpr = window.devicePixelRatio || 1;
  const logical: Point = { x: px / zoom, y: py / zoom };
  const physical: Point = { x: px / (dpr * zoom), y: py / (dpr * zoom) };

  const logicalHit = findHit({ point: logical, elements: visible });
  if (logicalHit !== null) {
    return { hit: logicalHit === composer, ambiguousMiss: false };
  }

  const physicalHit = findHit({ point: physical, elements: visible });
  if (physicalHit !== null) {
    return { hit: physicalHit === composer, ambiguousMiss: false };
  }

  return { hit: false, ambiguousMiss: true };
};
