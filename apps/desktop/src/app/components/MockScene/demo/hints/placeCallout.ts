import type { DemoRect } from '../director/demoProtocol';
import type { HintAlign, HintSide } from './demoHintTypes';

type Size = {
  readonly width: number;
  readonly height: number;
};

type Params = {
  readonly target: DemoRect;
  readonly avoid: ReadonlyArray<DemoRect>;
  readonly chrome?: ReadonlyArray<DemoRect>;
  readonly lit: DemoRect | null;
  readonly callout: Size;
  readonly bounds: Size;
  readonly side: HintSide | undefined;
  readonly isLocked?: boolean;
  readonly previousSide?: HintSide;
  readonly align?: HintAlign;
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

type SideParams = Pick<Params, 'target' | 'callout' | 'bounds' | 'gap' | 'margin' | 'align'> & {
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

const crossOf = ({ target, callout, side, gap }: SideParams): number => {
  switch (side) {
    case 'bottom':
      return target.y + target.height + gap;
    case 'top':
      return target.y - gap - callout.height;
    case 'right':
      return target.x + target.width + gap;
    case 'left':
      return target.x - gap - callout.width;
    default: {
      const unreachable: never = side;
      return unreachable;
    }
  }
};

type Span = {
  readonly from: number;
  readonly to: number;
};

type Block = {
  readonly cross: Span;
  readonly along: Span;
};

type AlongParams = {
  readonly start: number;
  readonly length: number;
  readonly size: number;
  readonly limit: number;
  readonly cross: Span;
  readonly blocks: ReadonlyArray<Block>;
  readonly isEnd: boolean;
  readonly margin: number;
};

const alongOf = ({
  start,
  length,
  size,
  limit,
  cross,
  blocks,
  isEnd,
  margin,
}: AlongParams): number => {
  const middle = start + length / 2;
  const range = blocks
    .filter((block) => block.cross.from < cross.to && block.cross.to > cross.from)
    .reduce<Span>(
      (open, block) =>
        (block.along.from + block.along.to) / 2 >= middle
          ? { from: open.from, to: Math.min(open.to, block.along.from - margin - size) }
          : { from: Math.max(open.from, block.along.to + margin), to: open.to },
      { from: margin, to: limit - margin - size },
    );
  return clamp({
    value: isEnd ? start + length - size : middle - size / 2,
    low: range.from,
    high: range.to,
  });
};

type PlaceParams = SideParams & {
  readonly chrome: ReadonlyArray<DemoRect>;
};

const placeOn = ({ chrome, ...params }: PlaceParams): CalloutPlacement => {
  const { target, callout, bounds, side, margin, align = 'center' } = params;
  const isEnd = align === 'end';
  const cross = crossOf(params);
  if (side === 'top' || side === 'bottom') {
    const x = alongOf({
      start: target.x,
      length: target.width,
      size: callout.width,
      limit: bounds.width,
      cross: { from: cross, to: cross + callout.height },
      blocks: chrome.map((rect) => ({
        cross: { from: rect.y, to: rect.y + rect.height },
        along: { from: rect.x, to: rect.x + rect.width },
      })),
      isEnd,
      margin,
    });
    return { side, x, y: cross };
  }
  const y = alongOf({
    start: target.y,
    length: target.height,
    size: callout.height,
    limit: bounds.height,
    cross: { from: cross, to: cross + callout.width },
    blocks: chrome.map((rect) => ({
      cross: { from: rect.x, to: rect.x + rect.width },
      along: { from: rect.y, to: rect.y + rect.height },
    })),
    isEnd,
    margin,
  });
  return { side, x: cross, y };
};

type MeetParams = {
  readonly left: DemoRect;
  readonly right: DemoRect;
};

const isMeeting = ({ left, right }: MeetParams): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

type CoverParams = {
  readonly placement: CalloutPlacement;
  readonly callout: Size;
  readonly rects: ReadonlyArray<DemoRect>;
};

const isCovering = ({ placement, callout, rects }: CoverParams): boolean =>
  rects.some((rect) =>
    isMeeting({
      left: { x: placement.x, y: placement.y, width: callout.width, height: callout.height },
      right: rect,
    }),
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
  chrome = [],
  lit,
  callout,
  bounds,
  side: preferred,
  isLocked = false,
  previousSide,
  align,
  gap,
  margin,
}: Params): CalloutPlacement => {
  const aside = chrome.filter((rect) => !isMeeting({ left: rect, right: target }));
  const base = { target, callout, bounds, gap, margin, align, chrome: aside };
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
      isClear: !isCovering({ placement, callout, rects: [target, ...avoid, ...aside] }),
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
  const kept = candidates.find((candidate) => candidate.placement.side === previousSide);
  if (kept !== undefined && kept.room >= 0 && kept.isClear) {
    return kept.placement;
  }
  const best = [...candidates].sort((left, right) => {
    const byRank = rankOf(right) - rankOf(left);
    if (byRank !== 0) {
      return byRank;
    }
    const byLit = left.litBucket - right.litBucket;
    if (byLit !== 0) {
      return byLit;
    }
    return right.room - left.room;
  })[0];
  return best?.placement ?? placeOn({ ...base, side: preferred ?? 'right' });
};
