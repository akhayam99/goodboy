import type { DockAnchor, DockDropZone, DockRect } from './dockDropZonesOf';
import { dockPillRectOf } from './dockPillRectOf';

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

const RING_CLEARANCE_PX = 6;

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
  const pill = dockPillRectOf({ zone });
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
  const pill = dockPillRectOf({ zone });
  const dy = verticalShiftOf({ pill, outline });
  const moved = { ...pill, y: pill.y + dy };
  const dx = horizontalShiftOf({ pill: moved, outline });
  return withinHitOf({ zone, shift: { x: dx, y: dy } });
};
