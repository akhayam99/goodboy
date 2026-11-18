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

describe('placeFloating edge cases in the smallest window', () => {
  const SMALL = { width: 1024, height: 700 };
  const MARGIN = 8;
  const CARD_MARGIN = 12;

  type InsideParams = {
    readonly coords: { readonly top: number; readonly left: number; readonly maxHeight: number };
    readonly size: { readonly width: number; readonly height: number };
    readonly margin: number;
  };

  const isInside = ({ coords, size, margin }: InsideParams): boolean =>
    coords.left >= margin &&
    coords.top >= margin &&
    coords.left + size.width <= SMALL.width - margin &&
    coords.top + Math.min(size.height, coords.maxHeight) <= SMALL.height - margin;

  it('opens a card from the foot of the rail to its right, its bottom on the anchor bottom', () => {
    const anchor = rectAt({ left: 12, top: 640, width: 40, height: 36 });
    const size = { width: 300, height: 260 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'right',
      gap: 8,
      edge: CARD_MARGIN,
      alignment: 'end',
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'right', left: 60, isFlipped: false, growth: 'up' });
    expect(coords.top + size.height).toBe(anchor.bottom);
    expect(isInside({ coords, size, margin: CARD_MARGIN })).toBe(true);
  });

  it('slides a sheet taller than the room above the rail foot down to the margin', () => {
    const anchor = rectAt({ left: 12, top: 600, width: 40, height: 36 });
    const size = { width: 560, height: 640 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'right',
      gap: 8,
      edge: CARD_MARGIN,
      alignment: 'end',
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'right', top: 48, growth: 'down', maxHeight: 676 });
    expect(coords.shift).toBe(-552);
    expect(isInside({ coords, size, margin: CARD_MARGIN })).toBe(true);
  });

  it('keeps the bell popover end edge on the bell end edge', () => {
    const anchor = rectAt({ left: 960, top: 8, width: 28, height: 28 });
    const size = { width: 384, height: 400 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'bottom',
      gap: 4,
      edge: MARGIN,
      alignment: 'end',
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'bottom', top: 40, shift: 0 });
    expect(coords.left + size.width).toBe(anchor.right);
    expect(isInside({ coords, size, margin: MARGIN })).toBe(true);
  });

  it('flips a menu at the bottom of the window above its trigger and shifts it off the side', () => {
    const anchor = rectAt({ left: 884, top: 624, width: 100, height: 28 });
    const size = { width: 240, height: 200 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'bottom',
      gap: 4,
      edge: MARGIN,
      alignment: 'start',
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'top', isFlipped: true, left: 776, shift: -108 });
    expect(coords.top + size.height).toBe(anchor.top - 4);
    expect(coords.growth).toBe('up');
    expect(isInside({ coords, size, margin: MARGIN })).toBe(true);
  });

  it('bounds a list taller than the window to the room left and lets it scroll', () => {
    const anchor = rectAt({ left: 120, top: 8, width: 160, height: 28 });
    const size = { width: 384, height: 1200 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'bottom',
      gap: 4,
      edge: MARGIN,
      alignment: 'start',
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'bottom', top: 40, left: 120, maxHeight: 652 });
    expect(isInside({ coords, size, margin: MARGIN })).toBe(true);
  });

  it('stops above a reserved bottom inset', () => {
    const anchor = rectAt({ left: 40, top: 100, width: 60, height: 28 });
    const coords = placeFloating({
      anchor,
      tip: { width: 240, height: 800 },
      side: 'bottom',
      gap: 4,
      edge: MARGIN,
      alignment: 'start',
      bottomInset: 36,
      viewport: SMALL,
    });

    expect(coords.maxHeight).toBe(SMALL.height - MARGIN - 36 - anchor.bottom - 4);
  });

  it('opens a tooltip of the right tool rail to its left, centred on the tool', () => {
    const anchor = rectAt({ left: 984, top: 200, width: 28, height: 28 });
    const size = { width: 96, height: 24 };
    const coords = placeFloating({
      anchor,
      tip: size,
      side: 'left',
      gap: 6,
      edge: 6,
      viewport: SMALL,
    });

    expect(coords).toMatchObject({ side: 'left', left: 882, top: 202, isFlipped: false });
  });

  it('keeps a context menu at the pointer when it fits', () => {
    const point = rectAt({ left: 100, top: 100, width: 0, height: 0 });
    const coords = placeFloating({
      anchor: point,
      tip: { width: 200, height: 300 },
      side: 'right',
      gap: 0,
      edge: MARGIN,
      alignment: 'start',
      viewport: { width: 1000, height: 800 },
    });

    expect(coords).toMatchObject({ left: 100, top: 100, maxHeight: 784 });
  });

  it('flips a context menu left at the right edge and slides it up to stay 8px inside', () => {
    const point = rectAt({ left: 900, top: 700, width: 0, height: 0 });
    const coords = placeFloating({
      anchor: point,
      tip: { width: 200, height: 300 },
      side: 'right',
      gap: 0,
      edge: MARGIN,
      alignment: 'start',
      viewport: { width: 1000, height: 800 },
    });

    expect(coords).toMatchObject({ side: 'left', isFlipped: true, left: 700, top: 492 });
  });
});
