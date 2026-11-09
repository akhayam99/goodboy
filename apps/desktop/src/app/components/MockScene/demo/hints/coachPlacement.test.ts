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

  describe('the text a hint talks about', () => {
    const ORIGIN = { x: 265, y: 141 };
    const RING = 4;
    const SPOKEN = { width: 240, height: 56 };
    const MAX_COVERED_SHARE = 0.05;

    type ShareParams = {
      readonly rect: DemoRect;
      readonly placement: { readonly x: number; readonly y: number };
    };

    const coveredShareOf = ({ rect, placement }: ShareParams): number => {
      const width =
        Math.min(placement.x + SPOKEN.width, rect.x + rect.width) - Math.max(placement.x, rect.x);
      const height =
        Math.min(placement.y + SPOKEN.height, rect.y + rect.height) - Math.max(placement.y, rect.y);
      return width > 0 && height > 0 ? (width * height) / (rect.width * rect.height) : 0;
    };

    type ScreenRect = {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };

    type CaseParams = {
      readonly id: string;
      readonly target: ScreenRect;
      readonly text: ReadonlyArray<ScreenRect>;
      readonly lit: ScreenRect | null;
    };

    const stageOf = ({ rect }: { readonly rect: ScreenRect }): DemoRect => ({
      x: rect.x - ORIGIN.x,
      y: rect.y - ORIGIN.y,
      width: rect.width,
      height: rect.height,
    });

    const CASES: ReadonlyArray<CaseParams> = [
      {
        id: 'story-choose',
        target: { x: 767, y: 669, width: 531, height: 28 },
        text: [{ x: 742, y: 648, width: 280, height: 18 }],
        lit: { x: 733, y: 615, width: 577, height: 250 },
      },
      {
        id: 'plan-open',
        target: { x: 737, y: 683, width: 565, height: 32 },
        text: [{ x: 732, y: 633, width: 540, height: 38 }],
        lit: { x: 737, y: 683, width: 565, height: 32 },
      },
      {
        id: 'plan-mark',
        target: { x: 1285, y: 794, width: 93, height: 32 },
        text: [{ x: 821, y: 797, width: 540, height: 38 }],
        lit: { x: 821, y: 650, width: 557, height: 220 },
      },
      {
        id: 'plan-comment',
        target: { x: 1283, y: 756, width: 94, height: 34 },
        text: [{ x: 821, y: 765, width: 110, height: 16 }],
        lit: { x: 821, y: 650, width: 557, height: 150 },
      },
      {
        id: 'plan-send',
        target: { x: 1266, y: 838, width: 100, height: 30 },
        text: [
          { x: 822, y: 737, width: 550, height: 58 },
          { x: 830, y: 846, width: 70, height: 14 },
        ],
        lit: { x: 808, y: 800, width: 570, height: 80 },
      },
      {
        id: 'plan-approve',
        target: { x: 1226, y: 231, width: 148, height: 24 },
        text: [
          { x: 822, y: 261, width: 270, height: 14 },
          { x: 1115, y: 235, width: 100, height: 16 },
        ],
        lit: { x: 808, y: 176, width: 570, height: 120 },
      },
    ];

    it.each(CASES)('keeps the $id callout off the text it talks about', (scene) => {
      const hint = hints.find((entry) => entry.id === scene.id);
      const target = stageOf({ rect: scene.target });
      const placement = placeCallout({
        target: {
          x: target.x - RING,
          y: target.y - RING,
          width: target.width + RING * 2,
          height: target.height + RING * 2,
        },
        avoid: [],
        lit: scene.lit === null ? null : stageOf({ rect: scene.lit }),
        callout: SPOKEN,
        bounds: BOUNDS,
        side: hint?.side,
        isLocked: hint?.isSideLocked === true,
        gap: GAP,
        margin: MARGIN,
      });
      expect(hint?.isSideLocked).toBe(true);
      expect(placement.side).toBe(hint?.side);
      for (const text of scene.text) {
        expect(
          coveredShareOf({ rect: stageOf({ rect: text }), placement }),
          `${scene.id} text at ${text.x},${text.y}`,
        ).toBeLessThanOrEqual(MAX_COVERED_SHARE);
      }
    });
  });

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
