// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { placeFloating, type FloatingRect, type FloatingSide } from '../placeFloating';

const VIEWPORT = { width: 800, height: 600 };
const GAP = 6;
const EDGE = 6;
const TIP = { width: 120, height: 28 };

type RectParams = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type PlaceParams = {
  readonly anchor: FloatingRect;
  readonly side: FloatingSide;
};

type OverlapParams = {
  readonly coords: { readonly top: number; readonly left: number };
  readonly anchor: FloatingRect;
};

const rectAt = ({ left, top, width, height }: RectParams): FloatingRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const tipRect = rectAt({ left: 0, top: 0, ...TIP });

const anchorAt = ({ left, top }: { readonly left: number; readonly top: number }): FloatingRect =>
  rectAt({ left, top, width: 28, height: 28 });

const place = ({ anchor, side }: PlaceParams) =>
  placeFloating({ anchor, tip: tipRect, side, gap: GAP, edge: EDGE });

const overlaps = ({ coords, anchor }: OverlapParams): boolean =>
  coords.left < anchor.right &&
  coords.left + TIP.width > anchor.left &&
  coords.top < anchor.bottom &&
  coords.top + TIP.height > anchor.top;

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT.width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT.height, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'innerWidth');
  Reflect.deleteProperty(window, 'innerHeight');
});

describe('placeFloating for a tooltip', () => {
  it('opens on the asked side when it fits', () => {
    const anchor = anchorAt({ left: 400, top: 300 });
    const coords = place({ anchor, side: 'top' });

    expect(coords.side).toBe('top');
    expect(coords.top).toBe(anchor.top - TIP.height - GAP);
  });

  it('flips below a control at the top edge so it never sits under the window edge', () => {
    const anchor = anchorAt({ left: 400, top: 4 });
    const coords = place({ anchor, side: 'top' });

    expect(coords.side).toBe('bottom');
    expect(coords.top).toBe(anchor.bottom + GAP);
    expect(overlaps({ coords, anchor })).toBe(false);
  });

  it('flips above a control at the bottom edge', () => {
    const anchor = anchorAt({ left: 400, top: VIEWPORT.height - 32 });
    const coords = place({ anchor, side: 'bottom' });

    expect(coords.side).toBe('top');
    expect(overlaps({ coords, anchor })).toBe(false);
  });

  it('flips to the left of a control at the right edge', () => {
    const anchor = anchorAt({ left: VIEWPORT.width - 32, top: 300 });
    const coords = place({ anchor, side: 'right' });

    expect(coords.side).toBe('left');
    expect(overlaps({ coords, anchor })).toBe(false);
  });

  it('flips when the label would cross the edge margin by a few pixels', () => {
    const anchor = anchorAt({ left: 400, top: TIP.height + GAP + EDGE - 3 });
    const coords = place({ anchor, side: 'top' });

    expect(coords.side).toBe('bottom');
    expect(overlaps({ coords, anchor })).toBe(false);
  });

  it('shifts along the edge instead of leaving the window', () => {
    const anchor = anchorAt({ left: 2, top: 300 });
    const coords = place({ anchor, side: 'top' });

    expect(coords.left).toBe(EDGE);
    expect(coords.side).toBe('top');
  });

  it('keeps the label inside the window for a control in the corner', () => {
    const anchor = anchorAt({ left: VIEWPORT.width - 30, top: VIEWPORT.height - 30 });
    const coords = place({ anchor, side: 'bottom' });

    expect(coords.left + TIP.width).toBeLessThanOrEqual(VIEWPORT.width - EDGE);
    expect(coords.top + TIP.height).toBeLessThanOrEqual(VIEWPORT.height - EDGE);
    expect(overlaps({ coords, anchor })).toBe(false);
  });

  it('picks the side with more room when neither side fits', () => {
    const tall = rectAt({ left: 0, top: 0, width: 120, height: 400 });
    const anchor = anchorAt({ left: 400, top: 230 });
    const coords = placeFloating({ anchor, tip: tall, side: 'top', gap: GAP, edge: EDGE });

    expect(coords.side).toBe('bottom');
  });
});
