import type { DemoRect } from '../director/demoProtocol';
import type { HintSide } from './demoHintTypes';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly target: DemoRect;
  readonly avoid: ReadonlyArray<DemoRect>;
  readonly lit: DemoRect | null;
  readonly callout: Size;
  readonly bounds: Size;
  readonly side: HintSide | undefined;
  readonly isLocked?: boolean;
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

type SideParams = Pick<Params, 'target' | 'callout' | 'bounds' | 'gap' | 'margin'> & {
  readonly side: HintSide;
};

const roomOf = ({ target, callout, bounds, side, gap, margin }: SideParams): number => {
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

const placeOn = ({ target, callout, bounds, side, gap, margin }: SideParams): CalloutPlacement => {
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

type CoverParams = {
  readonly placement: CalloutPlacement;
  readonly callout: Size;
  readonly rects: ReadonlyArray<DemoRect>;
};

const isCovering = ({ placement, callout, rects }: CoverParams): boolean =>
  rects.some(
    (rect) =>
      placement.x < rect.x + rect.width &&
      placement.x + callout.width > rect.x &&
      placement.y < rect.y + rect.height &&
      placement.y + callout.height > rect.y,
  );

type OverlapParams = {
  readonly placement: CalloutPlacement;
  readonly callout: Size;
  readonly rect: DemoRect | null;
};

const overlapAreaOf = ({ placement, callout, rect }: OverlapParams): number => {
  if (rect === null) {
    return 0;
  }
  const width =
    Math.min(placement.x + callout.width, rect.x + rect.width) - Math.max(placement.x, rect.x);
  const height =
    Math.min(placement.y + callout.height, rect.y + rect.height) - Math.max(placement.y, rect.y);
  return width > 0 && height > 0 ? width * height : 0;
};

type Candidate = {
  readonly room: number;
  readonly placement: CalloutPlacement;
  readonly isClear: boolean;
  readonly litBucket: number;
};

const LIT_BUCKETS = 8;

const rankOf = ({ isClear, room }: Candidate): number => (isClear ? 2 : 0) + (room >= 0 ? 1 : 0);

export const placeCallout = ({
  target,
  avoid,
  lit,
  callout,
  bounds,
  side: preferred,
  isLocked = false,
  gap,
  margin,
}: Params): CalloutPlacement => {
  const base = { target, callout, bounds, gap, margin };
  const order = [
    ...(preferred === undefined ? [] : [preferred]),
    ...SIDE_ORDER.filter((side) => side !== preferred),
  ];
  const candidates = order.map((side): Candidate => {
    const room = roomOf({ ...base, side });
    const placed = placeOn({ ...base, side });
    const placement =
      room >= 0
        ? placed
        : {
            side,
            x: clamp({ value: placed.x, low: margin, high: bounds.width - margin - callout.width }),
            y: clamp({
              value: placed.y,
              low: margin,
              high: bounds.height - margin - callout.height,
            }),
          };
    const share =
      overlapAreaOf({ placement, callout, rect: lit }) / (callout.width * callout.height);
    return {
      room,
      placement,
      isClear: !isCovering({ placement, callout, rects: [target, ...avoid] }),
      litBucket: Math.ceil(share * LIT_BUCKETS),
    };
  });
  const wanted = candidates[0];
  if (
    isLocked &&
    preferred !== undefined &&
    wanted !== undefined &&
    wanted.room >= 0 &&
    !isCovering({ placement: wanted.placement, callout, rects: [target] })
  ) {
    return wanted.placement;
  }
  const best = [...candidates].sort(
    (left, right) =>
      rankOf(right) - rankOf(left) || left.litBucket - right.litBucket || right.room - left.room,
  )[0];
  return best?.placement ?? placeOn({ ...base, side: preferred ?? 'right' });
};
