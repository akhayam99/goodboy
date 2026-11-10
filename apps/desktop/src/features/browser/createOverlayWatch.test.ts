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

  it('hides a view under a page, and keeps a docked view that floats over the page', () => {
    const sheet = document.createElement('div');
    const slot = document.createElement('div');
    slot.setAttribute('data-studio-slot', 'content');
    giveRect({ element: slot, rect: { x: 0, y: 40, width: 1440, height: 860 } });
    const under = document.createElement('div');
    giveRect({ element: under, rect: VIEW_RECT });
    sheet.append(under, slot);
    const docked = placedView();
    document.body.prepend(sheet);
    const watch = createOverlayWatch();

    expect(watch.covers({ view: under, rect: under.getBoundingClientRect() })).toBe(true);
    expect(watch.covers({ view: docked, rect: docked.getBoundingClientRect() })).toBe(false);
    watch.stop();
  });

  it('hides a page view under an overlay dock, and keeps the view inside the dock', () => {
    const column = document.createElement('div');
    const main = document.createElement('div');
    main.setAttribute('data-drawer-main', '');
    main.setAttribute('inert', '');
    const page = document.createElement('div');
    giveRect({ element: page, rect: VIEW_RECT });
    main.append(page);
    const aside = document.createElement('aside');
    const docked = document.createElement('div');
    giveRect({ element: docked, rect: { x: 900, y: 96, width: 480, height: 720 } });
    aside.append(docked);
    column.append(main, aside);
    document.body.append(column);
    const watch = createOverlayWatch();

    expect(watch.covers({ view: page, rect: page.getBoundingClientRect() })).toBe(true);
    expect(watch.covers({ view: docked, rect: docked.getBoundingClientRect() })).toBe(false);
    main.removeAttribute('inert');
    expect(watch.covers({ view: page, rect: page.getBoundingClientRect() })).toBe(false);
    watch.stop();
  });

  it('leaves the view alone for a tooltip parked off screen', () => {
    const tooltip = document.createElement('span');
    tooltip.setAttribute('role', 'tooltip');
    giveRect({ element: tooltip, rect: { x: -9999, y: -9999, width: 120, height: 28 } });
    document.body.append(tooltip);

    expect(coversView()).toBe(false);
  });
});
