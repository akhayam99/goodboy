// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createOverlayWatch } from './createOverlayWatch';
import { viewBoundsOf } from './viewBoundsOf';

const PAGE = { x: 480, y: 96, width: 640, height: 720 };

const mountPage = (): HTMLElement => {
  const view = document.createElement('div');
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(PAGE.x, PAGE.y, PAGE.width, PAGE.height),
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
  document.body.append(view);
  return view;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('the page rectangle the host places the view at', () => {
  it('reports the whole placeholder when no width cap is given', () => {
    const view = mountPage();

    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 1 })).toEqual(PAGE);
  });

  it('reports a capped, centered rectangle inside the placeholder', () => {
    const view = mountPage();

    const bounds = viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 1, maxWidth: 390 });

    expect(bounds).toEqual({ x: 605, y: 96, width: 390, height: 720 });
    expect(bounds !== null && bounds.x >= PAGE.x).toBe(true);
    expect(bounds !== null && bounds.x + bounds.width <= PAGE.x + PAGE.width).toBe(true);
  });

  it('keeps the whole placeholder when it is already narrower than the cap', () => {
    const view = mountPage();

    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 1, maxWidth: 768 })).toEqual(
      PAGE,
    );
  });
});

describe('the page rectangle under app zoom', () => {
  it.each([
    { zoom: 0.8, expected: { x: 384, y: 77, width: 512, height: 576 } },
    { zoom: 1.25, expected: { x: 600, y: 120, width: 800, height: 900 } },
    { zoom: 1.5, expected: { x: 720, y: 144, width: 960, height: 1080 } },
  ])('scales the placeholder to window points at $zoom', ({ zoom, expected }) => {
    const view = mountPage();

    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), zoom })).toEqual(expected);
  });

  it('scales the capped device width with the placeholder at 150%', () => {
    const view = mountPage();

    const bounds = viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 1.5, maxWidth: 390 });

    expect(bounds).toEqual({ x: 908, y: 144, width: 585, height: 1080 });
  });

  it('keeps the right and bottom edges on the placeholder edges when the rect is fractional', () => {
    const view = document.createElement('div');
    Object.defineProperty(view, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(247.5, 36.5, 477.3, 864.3),
    });
    Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
    document.body.append(view);

    const bounds = viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 1.1 });

    expect(bounds).toEqual({ x: 272, y: 40, width: 525, height: 951 });
    expect(bounds !== null && bounds.x + bounds.width).toBe(Math.round((247.5 + 477.3) * 1.1));
    expect(bounds !== null && bounds.y + bounds.height).toBe(Math.round((36.5 + 864.3) * 1.1));
  });

  it('falls back to no scale when the zoom is not a usable number', () => {
    const view = mountPage();

    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: Number.NaN })).toEqual(PAGE);
    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), zoom: 0 })).toEqual(PAGE);
  });
});
