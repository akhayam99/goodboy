import { describe, expect, it } from 'vitest';
import type { DemoRect } from '../director/demoProtocol';
import { DEMO_CHAPTERS } from '../demoChapters';
import type { HintSide } from './demoHintTypes';
import { placeCallout } from './placeCallout';

const BOUNDS = { width: 1156, height: 740 };
const CALLOUT = { width: 240, height: 56 };
const GAP = 6;
const MARGIN = 16;

const TARGET_SIZES = [
  { width: 112, height: 34 },
  { width: 36, height: 36 },
  { width: 520, height: 44 },
  { width: 44, height: 360 },
  { width: 700, height: 88 },
] as const;

const COLUMNS = [24, 300, 560, 820, 1090] as const;
const ROWS = [20, 160, 330, 520, 690] as const;

type RectsParams = {
  readonly left: DemoRect;
  readonly right: { readonly x: number; readonly y: number };
};

const isOverlapping = ({ left, right }: RectsParams): boolean =>
  right.x < left.x + left.width &&
  right.x + CALLOUT.width > left.x &&
  right.y < left.y + left.height &&
  right.y + CALLOUT.height > left.y;

type GapParams = {
  readonly target: DemoRect;
  readonly side: HintSide;
  readonly x: number;
  readonly y: number;
};

const gapOf = ({ target, side, x, y }: GapParams): number => {
  switch (side) {
    case 'bottom':
      return y - (target.y + target.height);
    case 'top':
      return target.y - (y + CALLOUT.height);
    case 'right':
      return x - (target.x + target.width);
    case 'left':
      return target.x - (x + CALLOUT.width);
    default: {
      const unreachable: never = side;
      return unreachable;
    }
  }
};

const targets = (): ReadonlyArray<DemoRect> =>
  TARGET_SIZES.flatMap((size) =>
    COLUMNS.flatMap((left) =>
      ROWS.flatMap((top) => {
        const x = Math.min(left, BOUNDS.width - size.width);
        const y = Math.min(top, BOUNDS.height - size.height);
        return [{ x, y, width: size.width, height: size.height }];
      }),
    ),
  );

const hints = DEMO_CHAPTERS.flatMap((chapter) => chapter.hints);

describe('coach placement for every hint', () => {
  it.each(hints.map((hint) => [hint.id, hint.side ?? 'right'] as const))(
    '%s never covers its target and touches it',
    (_id, side) => {
      for (const target of targets()) {
        const placement = placeCallout({
          target,
          avoid: [],
          lit: null,
          callout: CALLOUT,
          bounds: BOUNDS,
          side,
          gap: GAP,
          margin: MARGIN,
        });
        const isNarrowTarget = target.width <= 112 || target.height <= 88;
        if (isNarrowTarget) {
          expect(isOverlapping({ left: target, right: placement })).toBe(false);
          expect(gapOf({ target, side: placement.side, x: placement.x, y: placement.y })).toBe(GAP);
        }
        expect(placement.x).toBeGreaterThanOrEqual(MARGIN);
        expect(placement.y).toBeGreaterThanOrEqual(MARGIN);
        expect(placement.x + CALLOUT.width).toBeLessThanOrEqual(BOUNDS.width - MARGIN);
        expect(placement.y + CALLOUT.height).toBeLessThanOrEqual(BOUNDS.height - MARGIN);
      }
    },
  );

  it('keeps clear of what the press opened', () => {
    const target = { x: 500, y: 40, width: 112, height: 34 };
    const opened = { x: 400, y: 100, width: 340, height: 300 };
    for (const side of ['right', 'bottom', 'top', 'left'] as const) {
      const placement = placeCallout({
        target,
        avoid: [opened],
        lit: null,
        callout: CALLOUT,
        bounds: BOUNDS,
        side,
        gap: GAP,
        margin: MARGIN,
      });
      expect(isOverlapping({ left: target, right: placement })).toBe(false);
      expect(isOverlapping({ left: opened, right: placement })).toBe(false);
    }
  });
});
