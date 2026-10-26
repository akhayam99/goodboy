import { describe, expect, it } from 'vitest';
import { placeCallout } from './placeCallout';
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

  it('takes the side with the most room even when the preferred side fits', () => {
    const target = { x: 600, y: 200, width: 100, height: 32 };
    const placement = place({ target });
    expect(placement.side).toBe('left');
    expect(overlaps({ target, x: placement.x, y: placement.y })).toBe(false);
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
});
