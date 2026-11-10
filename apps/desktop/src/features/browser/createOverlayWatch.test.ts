// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createOverlayWatch } from './createOverlayWatch';

type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type RectParams = {
  readonly element: Element;
  readonly rect: Rect;
};

type ElementParams = {
  readonly rect: Rect;
};

const VIEW_RECT = { x: 480, y: 96, width: 640, height: 720 };

const giveRect = ({ element, rect }: RectParams): void => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(rect.x, rect.y, rect.width, rect.height),
  });
};

const placedView = (): HTMLElement => {
  const view = document.createElement('div');
  view.setAttribute('data-browser-view', '');
  giveRect({ element: view, rect: VIEW_RECT });
  document.body.append(view);
  return view;
};

const roleless = ({ rect }: ElementParams): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-dropdown-portal', '');
  giveRect({ element: wrapper, rect: { x: 0, y: 400, width: 1440, height: 0 } });
  const popover = document.createElement('div');
  giveRect({ element: popover, rect });
  wrapper.append(popover);
  document.body.append(wrapper);
  return wrapper;
};

const coversView = (): boolean => {
  const view = placedView();
  const watch = createOverlayWatch();
  const isCovered = watch.covers({ view, rect: view.getBoundingClientRect() });
  watch.stop();
  return isCovered;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('createOverlayWatch', () => {
  it('measures a roleless popover, not its zero height portal wrapper', () => {
    roleless({ rect: { x: 900, y: 120, width: 240, height: 200 } });

    expect(coversView()).toBe(true);
  });

  it('ignores a zero height portal wrapper that crosses the view', () => {
    roleless({ rect: { x: 8, y: 600, width: 240, height: 200 } });

    expect(coversView()).toBe(false);
  });

  it('counts a tooltip over the view', () => {
    const tooltip = document.createElement('span');
    tooltip.setAttribute('role', 'tooltip');
    giveRect({ element: tooltip, rect: { x: 500, y: 80, width: 120, height: 28 } });
    document.body.append(tooltip);

    expect(coversView()).toBe(true);
  });

  it('leaves the view alone for a tooltip parked off screen', () => {
    const tooltip = document.createElement('span');
    tooltip.setAttribute('role', 'tooltip');
    giveRect({ element: tooltip, rect: { x: -9999, y: -9999, width: 120, height: 28 } });
    document.body.append(tooltip);

    expect(coversView()).toBe(false);
  });
});
