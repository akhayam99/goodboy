// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import { DrawerColumn, RIGHT_DRAWER_STORAGE_KEY } from '../components/DrawerColumn';
import {
  DRAWER_INSET,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_MIN,
  canDrawerPush,
  drawerAsideWidthOf,
  drawerLayoutOf,
  type DrawerSizing,
} from '../drawerGeometry';
import { registerEscapeLayer } from '../escape';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

const renderColumn = (drawer: string | null) =>
  render(
    <DrawerColumn
      main={<div>main</div>}
      drawer={drawer === null ? null : <div>{drawer}</div>}
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const renderSized = (sizing: DrawerSizing) =>
  render(
    <DrawerColumn
      main={<div>main</div>}
      drawer={<div>plan</div>}
      sizing={sizing}
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });
const card = () => panel().querySelector<HTMLElement>('[data-drawer-card]');
const scrim = () => document.querySelector<HTMLElement>('[data-drawer-scrim]');
const pageOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-drawer-main]') as HTMLElement;

const cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('DrawerColumn pushing', () => {
  it('pushes the main column at 1440 wide, as an inset card with no shadow', () => {
    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    expect(card()?.className).toContain('rounded-frame');
    expect(card()?.className).toContain('bg-subtle');
    expect(card()?.className).not.toContain('shadow');
  });

  it('keeps the 8px inset and the full border on the pushing card', () => {
    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(card()?.className).toContain('my-2');
    expect(card()?.className).toContain('mr-2');
    expect(card()?.className).toMatch(/(^|\s)border(\s|$)/);
  });

  it('opens a wide drawer at 560 and pushes it when the main area keeps its 560px', () => {
    stubColumnWidth(2000);
    renderSized('half');

    expect(panel().getAttribute('data-drawer-sizing')).toBe('half');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
    expect(screen.queryByRole('separator', { name: 'Resize side panel' })).toBeNull();
  });

  it('narrows a wide drawer to the room left, so it still pushes', () => {
    stubColumnWidth(1100);
    renderSized('half');

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('492px');
  });

  it('keeps the main content first and on its left edge, open or closed', () => {
    stubColumnWidth(1094);
    const { rerender, container } = renderColumn(null);
    const closed = pageOf(container);

    rerender(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>drafts</div>}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(pageOf(container)).toBe(closed);
    expect(pageOf(container).parentElement?.firstElementChild).toBe(pageOf(container));
    expect(pageOf(container).className).not.toMatch(
      /\b(mx-auto|justify-center|ml-auto|items-center)\b/,
    );
    expect(panel().previousElementSibling).toBe(pageOf(container));
  });

  it('keeps a closed column empty, zero wide and inert', () => {
    stubColumnWidth(1094);
    renderColumn(null);

    expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel().style.width).toBe('0px');
    expect(panel().hasAttribute('inert')).toBe(true);
  });

  it('pushes only when the main area keeps a 560px column beside the drawer track', () => {
    expect(canDrawerPush({ mainWidthPx: 1166, drawerWidthPx: 400 })).toBe(true);
    expect(canDrawerPush({ mainWidthPx: 1024, drawerWidthPx: 400 })).toBe(true);
    expect(canDrawerPush({ mainWidthPx: 1023, drawerWidthPx: 400 })).toBe(false);
    expect(canDrawerPush({ mainWidthPx: 934, drawerWidthPx: 400 })).toBe(false);
  });

  it('adds no scrim, no inert page and no focus move while it pushes', () => {
    stubColumnWidth(1094);
    const { container, rerender } = render(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={null}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    const action = screen.getByRole('button', { name: 'page action' });
    action.focus();

    rerender(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={<button type="button">Close</button>}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(scrim()).toBeNull();
    expect(pageOf(container).hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(action);
  });
});

describe('DrawerColumn over the page', () => {
  it('lies over the main column at 1024 wide, flush with the sheet and its right edge', () => {
    stubColumnWidth(678);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().className).toContain('absolute');
    expect(panel().className).toContain('inset-y-0');
    expect(panel().className).toContain('right-0');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET}px`);
  });

  it('draws the overlay card with left corners, a left border only and a large shadow', () => {
    stubColumnWidth(678);
    renderColumn('drafts');
    const className = card()?.className ?? '';

    expect(className).not.toContain('my-2');
    expect(className).not.toContain('mr-2');
    expect(className).toContain('rounded-l-frame');
    expect(className).not.toMatch(/(^|\s)rounded-frame(\s|$)/);
    expect(className).toContain('border-l');
    expect(className).not.toMatch(/(^|\s)border(\s|$)/);
    expect(className).not.toMatch(/border-[trb](\s|$)/);
    expect(className).toContain('shadow-xl');
  });

  it('keeps the wide drawer at 560 over a page too narrow to fit it beside', () => {
    stubColumnWidth(900);
    renderSized('half');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET}px`);
  });

  it('fills the whole column when expanded, over the page', () => {
    stubColumnWidth(2000);
    renderSized('full');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe(`${2000 - DRAWER_INSET}px`);
  });

  it('covers the page with a scrim only while it lies over it', () => {
    stubColumnWidth(678);
    const { unmount } = renderColumn('drafts');

    expect(scrim()?.getAttribute('aria-hidden')).toBe('true');
    expect(scrim()?.className).toContain('bg-scrim');
    expect(scrim()?.className).toContain('inset-0');
    unmount();

    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(scrim()).toBeNull();
  });

  it('draws no scrim for a closed drawer, however narrow the column', () => {
    stubColumnWidth(678);
    renderColumn(null);

    expect(scrim()).toBeNull();
  });

  it('puts the scrim under the card and over the page', () => {
    stubColumnWidth(678);
    const { container } = renderColumn('drafts');
    const order = Array.from(container.firstElementChild?.children ?? []);

    expect(order.indexOf(pageOf(container))).toBeLessThan(order.indexOf(scrim() as HTMLElement));
    expect(order.indexOf(scrim() as HTMLElement)).toBeLessThan(order.indexOf(panel()));
  });

  it('answers a scrim click with the layer on top of the escape stack, once', () => {
    stubColumnWidth(678);
    const under = vi.fn();
    const over = vi.fn();
    cleanups.push(registerEscapeLayer(under), registerEscapeLayer(over));
    renderColumn('drafts');

    fireEvent.click(scrim() as HTMLElement);

    expect(over).toHaveBeenCalledOnce();
    expect(under).not.toHaveBeenCalled();
  });

  it('leaves the page inert only while the drawer lies over it', () => {
    stubColumnWidth(678);
    const over = renderColumn('drafts');

    expect(pageOf(over.container).hasAttribute('inert')).toBe(true);
    over.rerender(
      <DrawerColumn
        main={<div>main</div>}
        drawer={null}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(pageOf(over.container).hasAttribute('inert')).toBe(false);
  });

  it('moves focus into the card when it opens over the page', () => {
    stubColumnWidth(678);
    const { rerender } = render(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={null}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    screen.getByRole('button', { name: 'page action' }).focus();

    rerender(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={
          <header>
            <button type="button">Close panel</button>
            <button type="button">Copy</button>
          </header>
        }
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' }));
    expect(card()?.contains(document.activeElement)).toBe(true);
  });

  it('leaves focus where the drawer put it itself, such as a composer', () => {
    stubColumnWidth(678);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={
          <div>
            <button type="button">Close panel</button>
            <textarea aria-label="Ask" autoFocus />
          </div>
        }
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Ask' }));
  });

  it('focuses the card itself when the drawer holds nothing to focus', () => {
    stubColumnWidth(678);
    renderColumn('plain text');

    expect(document.activeElement).toBe(card());
  });
});

describe('DrawerColumn sizes', () => {
  it('shares one saved width, read back clamped to its range', () => {
    stubColumnWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');
    renderColumn('drafts');

    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
  });

  it('reads a width saved before the 384 floor back at the floor', () => {
    stubColumnWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '340');
    renderColumn('drafts');

    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MIN + DRAWER_INSET * 2}px`);
  });

  it('saves a resize under the one drawer key', () => {
    stubColumnWidth(2400);
    renderColumn('drafts');

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize side panel' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe(String(RIGHT_DRAWER_DEFAULT + 8));
  });

  it('follows a drag on the panel itself and saves once, on release', () => {
    stubColumnWidth(2400);
    renderColumn('drafts');
    const setItem = vi.spyOn(localStorage, 'setItem');
    const handle = screen.getByRole('separator', { name: 'Resize side panel' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 1000 });
    Array.from({ length: 50 }).forEach((_, index) =>
      fireEvent.mouseMove(window, { clientX: 1000 - index }),
    );

    expect(setItem).not.toHaveBeenCalled();
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + 49 + DRAWER_INSET * 2}px`);

    fireEvent.mouseUp(window);

    expect(setItem).toHaveBeenCalledOnce();
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe(String(RIGHT_DRAWER_DEFAULT + 49));
  });

  it('stops a drag at the room left while it pushes, so the drawer never flips to overlay', () => {
    stubColumnWidth(1100);
    renderColumn('drafts');
    const room = drawerLayoutOf({
      main: 1100,
      sizing: 'default',
      savedWidth: RIGHT_DRAWER_DEFAULT,
    }).dragMax;
    const handle = screen.getByRole('separator', { name: 'Resize side panel' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 0 });

    expect(panel().style.width).toBe(`${room + DRAWER_INSET * 2}px`);

    fireEvent.mouseUp(window);

    expect(room).toBe(476);
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe(String(room));
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
  });

  it('offers the handle the width on screen and the ceiling of the mode it is in', () => {
    stubColumnWidth(1100);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(RIGHT_DRAWER_MAX));
    renderColumn('drafts');
    const handle = screen.getByRole('separator', { name: 'Resize side panel' });

    expect(handle.getAttribute('aria-valuenow')).toBe('476');
    expect(handle.getAttribute('aria-valuemin')).toBe(String(RIGHT_DRAWER_MIN));
    expect(handle.getAttribute('aria-valuemax')).toBe('476');
  });

  it('lets a drag over the page reach the scale max', () => {
    stubColumnWidth(800);
    renderColumn('drafts');
    const handle = screen.getByRole('separator', { name: 'Resize side panel' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 0 });
    fireEvent.mouseUp(window);

    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET}px`);
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
  });

  const FIT_CASES = [1280, 1440].flatMap((windowPx) =>
    [LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX].flatMap((sidebarPx) =>
      (['default', 'half', 'full'] as const).map((sizing) => ({
        sizing,
        columnWidth: windowPx - sidebarPx,
      })),
    ),
  );

  it.each(FIT_CASES)(
    'keeps the $sizing card inside its aside over a $columnWidth column',
    ({ sizing, columnWidth }) => {
      stubColumnWidth(columnWidth);
      render(
        <DrawerColumn
          main={<div>main</div>}
          drawer={<div>Fix run</div>}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />,
      );
      const { mode, width } = drawerLayoutOf({
        main: columnWidth,
        sizing,
        savedWidth: RIGHT_DRAWER_DEFAULT,
      });
      const aside = drawerAsideWidthOf({ width, mode });
      const inner = card()?.parentElement ?? null;
      const handle = inner?.firstElementChild ?? null;

      expect(aside).toBeLessThanOrEqual(columnWidth);
      expect(panel().getAttribute('data-drawer-mode')).toBe(mode);
      expect(panel().style.width).toBe(`${aside}px`);
      expect(inner?.style.minWidth).toBe(`${aside}px`);
      expect(handle?.className).toContain('w-2');
      expect(handle?.className).toContain('shrink-0');
      expect(card()?.className).toContain('min-w-0');
      expect(card()?.className).toContain('overflow-hidden');
      if (mode === 'push') {
        expect(panel().className).toContain('overflow-hidden');
        expect(card()?.className).toContain('mr-2');
      }
    },
  );
});
