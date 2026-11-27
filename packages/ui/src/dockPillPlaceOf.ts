import {
  PILL_HEIGHT_PX,
  type DockAnchor,
  type DockDropZone,
  type DockRect,
} from './dockDropZonesOf';

type Params = {
  readonly zone: DockDropZone;
  readonly outline: DockRect | null;
};

type ShiftParams = {
  readonly zone: DockDropZone;
  readonly shift: { readonly x: number; readonly y: number };
};

type AxisParams = {
  readonly pill: DockRect;
  readonly outline: DockRect;
};

const PILL_BASE_WIDTH_PX = 36;
const PILL_CHAR_WIDTH_PX = 7;
const RING_CLEARANCE_PX = 6;

const widthOf = ({ zone }: Pick<Params, 'zone'>): number =>
  PILL_BASE_WIDTH_PX + zone.label.length * PILL_CHAR_WIDTH_PX;

const pillOf = ({ zone }: Pick<Params, 'zone'>): DockRect => {
  const width = widthOf({ zone });
  const { x, y, align } = zone.anchor;
  const left = align === 'start' ? x : align === 'end' ? x - width : x - width / 2;
  return { x: left, y: y - PILL_HEIGHT_PX / 2, width, height: PILL_HEIGHT_PX };
};

type SpanParams = {
  readonly from: number;
  readonly to: number;
  readonly low: number;
  readonly high: number;
};

const isOverlap = ({ from, to, low, high }: SpanParams): boolean => from < high && to > low;

const verticalShiftOf = ({ pill, outline }: AxisParams): number => {
  if (
    !isOverlap({
      from: pill.x,
      to: pill.x + pill.width,
      low: outline.x,
      high: outline.x + outline.width,
    })
  ) {
    return 0;
  }
  return [outline.y, outline.y + outline.height].reduce((shift, line) => {
    const top = pill.y + shift;
    const bottom = top + pill.height;
    if (
      !isOverlap({
        from: top,
        to: bottom,
        low: line - RING_CLEARANCE_PX,
        high: line + RING_CLEARANCE_PX,
      })
    ) {
      return shift;
    }
    return top + pill.height / 2 < line
      ? shift + (line - RING_CLEARANCE_PX - bottom)
      : shift + (line + RING_CLEARANCE_PX - top);
  }, 0);
};

const horizontalShiftOf = ({ pill, outline }: AxisParams): number => {
  if (
    !isOverlap({
      from: pill.y,
      to: pill.y + pill.height,
      low: outline.y,
      high: outline.y + outline.height,
    })
  ) {
    return 0;
  }
  return [outline.x, outline.x + outline.width].reduce((shift, line) => {
    const left = pill.x + shift;
    const right = left + pill.width;
    if (
      !isOverlap({
        from: left,
        to: right,
        low: line - RING_CLEARANCE_PX,
        high: line + RING_CLEARANCE_PX,
      })
    ) {
      return shift;
    }
    return left + pill.width / 2 < line
      ? shift + (line - RING_CLEARANCE_PX - right)
      : shift + (line + RING_CLEARANCE_PX - left);
  }, 0);
};

type ClampParams = {
  readonly value: number;
  readonly low: number;
  readonly high: number;
};

const clampedOf = ({ value, low, high }: ClampParams): number =>
  high < low ? (low + high) / 2 : Math.min(high, Math.max(low, value));

const withinHitOf = ({ zone, shift }: ShiftParams): DockAnchor => {
  const pill = pillOf({ zone });
  const { rect } = zone;
  const left = clampedOf({
    value: pill.x + shift.x,
    low: rect.x,
    high: rect.x + rect.width - pill.width,
  });
  const top = clampedOf({
    value: pill.y + shift.y,
    low: rect.y,
    high: rect.y + rect.height - pill.height,
  });
  return {
    ...zone.anchor,
    x: zone.anchor.x + (left - pill.x),
    y: zone.anchor.y + (top - pill.y),
  };
};

export const dockPillPlaceOf = ({ zone, outline }: Params): DockAnchor => {
  if (outline === null) {
    return withinHitOf({ zone, shift: { x: 0, y: 0 } });
  }
  const pill = pillOf({ zone });
  const dy = verticalShiftOf({ pill, outline });
  const moved = { ...pill, y: pill.y + dy };
  const dx = horizontalShiftOf({ pill: moved, outline });
  return withinHitOf({ zone, shift: { x: dx, y: dy } });
};
