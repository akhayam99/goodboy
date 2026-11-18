import { describe, expect, it } from 'vitest';
import { placeCallout } from './placeCallout';
import { GUIDE_HINTS } from './guideHints';
import type { DemoRect } from '../director/demoProtocol';

const BOUNDS = { width: 1000, height: 600 };
const CALLOUT = { width: 240, height: 90 };

type OverlapParams = {
  readonly target: DemoRect;
  readonly x: number;
  readonly y: number;
};

const overlaps = ({ target, x, y }: OverlapParams): boolean =>
  x < target.x + target.width &&
  x + CALLOUT.width > target.x &&
  y < target.y + target.height &&
  y + CALLOUT.height > target.y;

type PlaceParams = {
  readonly target: DemoRect;
};

const place = ({ target }: PlaceParams) =>
  placeCallout({
    target,
    avoid: [],
    lit: null,
    callout: CALLOUT,
    bounds: BOUNDS,
    side: 'right',
    gap: 12,
    margin: 16,
  });

describe('callout placement', () => {
  it('sits beside the target on the preferred side when there is room', () => {
    const target = { x: 200, y: 200, width: 100, height: 32 };
    expect(place({ target })).toMatchObject({ side: 'right', x: 312 });
  });

  it('lines a top callout up with the far end of a wide target when asked', () => {
    const target = { x: 100, y: 300, width: 500, height: 28 };
    const placement = placeCallout({
      target,
      avoid: [],
      lit: null,
      callout: CALLOUT,
      bounds: BOUNDS,
      side: 'top',
      isLocked: true,
      align: 'end',
      gap: 12,
      margin: 16,
    });
    expect(placement).toEqual({ side: 'top', x: 360, y: 198 });
  });

  it('takes the side with the most room even when the preferred side fits', () => {
    const target = { x: 600, y: 200, width: 100, height: 32 };
    const placement = place({ target });
    expect(placement.side).toBe('left');
    expect(overlaps({ target, x: placement.x, y: placement.y })).toBe(false);
  });

  it('keeps a locked side while it fits and covers nothing, even over a lit region', () => {
    const target = { x: 600, y: 200, width: 100, height: 32 };
    const lit = { x: 300, y: 150, width: 300, height: 200 };
    const placement = placeCallout({
      target,
      avoid: [],
      lit,
      callout: CALLOUT,
      bounds: BOUNDS,
      side: 'right',
      isLocked: true,
      gap: 12,
      margin: 16,
    });
    expect(placement.side).toBe('right');
  });

  it('goes to the left of a control near the right edge, where the room is', () => {
    const target = { x: 900, y: 200, width: 80, height: 32 };
    const placement = place({ target });
    expect(placement.side).toBe('left');
    expect(overlaps({ target, x: placement.x, y: placement.y })).toBe(false);
  });

  it('flips to the other side when there is no room below or above either', () => {
    const target = { x: 900, y: 20, width: 80, height: 700 };
    const placement = place({ target });
    expect(placement.side).toBe('left');
    expect(placement.x + CALLOUT.width).toBe(888);
  });

  it('goes above or below a target as wide as the stage and never covers it', () => {
    const target = { x: 20, y: 500, width: 960, height: 40 };
    const placement = place({ target });
    expect(placement.side).toBe('top');
    expect(overlaps({ target, x: placement.x, y: placement.y })).toBe(false);
  });

  it('stays inside the stage margins', () => {
    const target = { x: 0, y: 0, width: 30, height: 30 };
    const placement = place({ target });
    expect(placement.y).toBeGreaterThanOrEqual(16);
    expect(placement.x + CALLOUT.width).toBeLessThanOrEqual(BOUNDS.width - 16);
  });

  it('keeps the side it already had while that side still fits, even if another has more room', () => {
    const target = { x: 300, y: 150, width: 422, height: 292 };
    const base = {
      target,
      avoid: [],
      lit: null,
      callout: CALLOUT,
      bounds: BOUNDS,
      side: undefined,
      gap: 12,
      margin: 16,
    };
    expect(placeCallout(base).side).toBe('bottom');
    expect(placeCallout({ ...base, previousSide: 'right' }).side).toBe('right');
  });

  it('leaves the side it had once that side has no room or covers an opened panel', () => {
    const target = { x: 300, y: 150, width: 422, height: 292 };
    const base = {
      target,
      lit: null,
      callout: CALLOUT,
      bounds: BOUNDS,
      side: undefined,
      gap: 12,
      margin: 16,
    };
    const opened = { x: 740, y: 200, width: 200, height: 200 };
    expect(placeCallout({ ...base, avoid: [opened], previousSide: 'right' }).side).toBe('bottom');
    const wide = { ...target, width: 440 };
    expect(placeCallout({ ...base, target: wide, avoid: [], previousSide: 'right' }).side).toBe(
      'bottom',
    );
  });

  it('puts the Add comment callout under the button, clear of the prepared comment above it', () => {
    const step = GUIDE_HINTS.find((hint) => hint.id === 'plan-comment');
    const button = { x: 865, y: 180, width: 70, height: 30 };
    const commentText = { x: 588, y: 139, width: 340, height: 12 };
    const placement = placeCallout({
      target: button,
      avoid: [],
      lit: null,
      callout: { width: 240, height: 50 },
      bounds: { width: 966, height: 398 },
      side: step?.side,
      isLocked: step?.isSideLocked,
      align: step?.align,
      gap: 6,
      margin: 16,
    });
    expect(placement.side).toBe('bottom');
    expect(placement.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(placement.y).toBeGreaterThan(commentText.y + commentText.height);
  });
});
