// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { BROWSER_BUDGETS } from './browserBudgets';
import { createOverlayWatch } from './createOverlayWatch';
import { viewBoundsOf } from './viewBoundsOf';

const FRAMES = 300;
const ROWS = 500;
const MENUS = 4;

type RectParams = { readonly element: Element; readonly x: number };

const giveRect = ({ element, x }: RectParams) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(x, 96, 640, 720),
  });
  Object.defineProperty(element, 'checkVisibility', { configurable: true, value: () => true });
};

const mountPage = (): HTMLElement => {
  const page = document.createElement('div');
  for (let row = 0; row < ROWS; row += 1) {
    const message = document.createElement('p');
    message.textContent = `Message ${row} in payments-api`;
    page.append(message);
  }
  for (let menu = 0; menu < MENUS; menu += 1) {
    const popup = document.createElement('div');
    popup.setAttribute('role', 'menu');
    giveRect({ element: popup, x: 40 + menu });
    page.append(popup);
  }
  const view = document.createElement('div');
  view.setAttribute('data-browser-view', '');
  page.append(view);
  document.body.append(page);
  return view;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('one placement frame while the page holds a long conversation and open menus', () => {
  it('measures the view inside the frame budget', () => {
    const view = mountPage();
    giveRect({ element: view, x: 480 });
    const overlays = createOverlayWatch();

    const startedAt = performance.now();
    for (let frame = 0; frame < FRAMES; frame += 1) {
      giveRect({ element: view, x: 480 + (frame % 8) });
      viewBoundsOf({ view, overlays });
    }
    const perFrameMs = (performance.now() - startedAt) / FRAMES;
    overlays.stop();

    expect(perFrameMs).toBeLessThan(BROWSER_BUDGETS.placementMeasureMsPerFrame);
  });
});
