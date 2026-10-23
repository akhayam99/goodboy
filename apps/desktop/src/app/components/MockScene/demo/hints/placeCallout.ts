import type { DemoRect } from '../director/demoProtocol';
import type { HintSide } from './demoHintTypes';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly target: DemoRect;
  readonly callout: Size;
  readonly bounds: Size;
  readonly side: HintSide;
  readonly gap: number;
  readonly margin: number;
};

export type CalloutPlacement = {
  readonly side: HintSide;
  readonly x: number;
  readonly y: number;
};

const SIDE_ORDER: ReadonlyArray<HintSide> = ['right', 'bottom', 'top', 'left'];

type ClampParams = {
  readonly value: number;
  readonly low: number;
  readonly high: number;
};

const clamp = ({ value, low, high }: ClampParams): number =>
  Math.min(Math.max(value, low), Math.max(low, high));

type RoomParams = Params;

const roomOf = ({ target, callout, bounds, side, gap, margin }: RoomParams): number => {
  switch (side) {
    case 'bottom':
      return bounds.height - margin - (target.y + target.height + gap) - callout.height;
    case 'top':
      return target.y - gap - margin - callout.height;
    case 'right':
      return bounds.width - margin - (target.x + target.width + gap) - callout.width;
    case 'left':
      return target.x - gap - margin - callout.width;
    default: {
      const unreachable: never = side;
      return unreachable;
    }
  }
};

const placeOn = ({ target, callout, bounds, side, gap, margin }: RoomParams): CalloutPlacement => {
  const centerX = clamp({
    value: target.x + target.width / 2 - callout.width / 2,
    low: margin,
    high: bounds.width - margin - callout.width,
  });
  const centerY = clamp({
    value: target.y + target.height / 2 - callout.height / 2,
    low: margin,
    high: bounds.height - margin - callout.height,
  });
  switch (side) {
    case 'bottom':
      return { side, x: centerX, y: target.y + target.height + gap };
    case 'top':
      return { side, x: centerX, y: target.y - gap - callout.height };
    case 'right':
      return { side, x: target.x + target.width + gap, y: centerY };
    case 'left':
      return { side, x: target.x - gap - callout.width, y: centerY };
    default: {
      const unreachable: never = side;
      return unreachable;
    }
  }
};

export const placeCallout = ({
  target,
  callout,
  bounds,
  side: preferred,
  gap,
  margin,
}: Params): CalloutPlacement => {
  const base = { target, callout, bounds, gap, margin };
  const order = [preferred, ...SIDE_ORDER.filter((side) => side !== preferred)];
  const fitting = order.find((side) => roomOf({ ...base, side }) >= 0);
  if (fitting !== undefined) {
    return placeOn({ ...base, side: fitting });
  }
  const side =
    [...order].sort(
      (left, right) => roomOf({ ...base, side: right }) - roomOf({ ...base, side: left }),
    )[0] ?? preferred;
  const placed = placeOn({ ...base, side });
  return {
    side,
    x: clamp({ value: placed.x, low: margin, high: bounds.width - margin - callout.width }),
    y: clamp({ value: placed.y, low: margin, high: bounds.height - margin - callout.height }),
  };
};
