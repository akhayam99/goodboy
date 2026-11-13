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

    expect(viewBoundsOf({ view, overlays: createOverlayWatch() })).toEqual(PAGE);
  });

  it('reports a capped, centered rectangle inside the placeholder', () => {
    const view = mountPage();

    const bounds = viewBoundsOf({ view, overlays: createOverlayWatch(), maxWidth: 390 });

    expect(bounds).toEqual({ x: 605, y: 96, width: 390, height: 720 });
    expect(bounds !== null && bounds.x >= PAGE.x).toBe(true);
    expect(bounds !== null && bounds.x + bounds.width <= PAGE.x + PAGE.width).toBe(true);
  });

  it('keeps the whole placeholder when it is already narrower than the cap', () => {
    const view = mountPage();

    expect(viewBoundsOf({ view, overlays: createOverlayWatch(), maxWidth: 768 })).toEqual(PAGE);
  });
});
