// @vitest-environment happy-dom

import { createElement, useSyncExternalStore, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import {
  DrawerColumn,
  READER_DRAWER_STORAGE_KEY,
  RIGHT_DRAWER_STORAGE_KEY,
  type DrawerColumnFrame,
} from '../components/DrawerColumn';
import {
  DRAWER_INSET,
  READER_DRAWER_DEFAULT,
  READER_DRAWER_MAX,
  READER_DRAWER_MIN,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_MIN,
  DRAWER_EXIT_MAX_ELEMENTS,
  DRAWER_EXIT_MS,
  canDrawerPush,
  drawerAsideWidthOf,
  drawerLayoutOf,
  type DrawerSizing,
} from '../drawerGeometry';
import { registerEscapeLayer } from '../escape';
import { FOLD_MS } from '../motionTimings';

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

const driveColumnWidth = (initial: number) => {
  const callbacks: ObserverCallback[] = [];
  class DrivenObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
      callbacks.push(callback);
    }
    observe() {
      this.callback([{ contentRect: { width: initial } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', DrivenObserver);
  return (width: number) =>
    act(() => {
      callbacks.forEach((callback) => callback([{ contentRect: { width } }]));
    });
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

const renderSized = (sizing: DrawerSizing, frame: DrawerColumnFrame = 'none') =>
  render(
    <DrawerColumn
      main={<div>main</div>}
      drawer={<div>plan</div>}
      sizing={sizing}
      frame={frame}
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });
const card = () => panel().querySelector<HTMLElement>('[data-drawer-card]');
const content = () => panel().querySelector<HTMLElement>('[data-drawer-content]');
const scrim = () => document.querySelector<HTMLElement>('[data-drawer-scrim]');
const pageOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-container="page"]') as HTMLElement;
const handle = () => screen.queryByRole('separator', { name: 'Resize side panel' });
const handleOf = () => screen.getByRole('separator', { name: 'Resize side panel' });

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
    expect(card()?.dataset['container']).toBe('drawer');
    expect(card()?.className).toContain('rounded-frame');
    expect(card()?.className).toContain('bg-drawer');
    expect(card()?.className).not.toContain('shadow');
  });

  it('keeps the 8px inset and the full border on the pushing card', () => {
    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(card()?.parentElement?.className).toContain('py-2');
    expect(card()?.parentElement?.className).toContain('pr-2');
    expect(card()?.className).toMatch(/(^|\s)border(\s|$)/);
  });

  it('opens a reader drawer at 720 and pushes it when the page container keeps its room', () => {
    stubColumnWidth(2000);
    renderSized('reader');

    expect(panel().getAttribute('data-drawer-sizing')).toBe('reader');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    expect(handle()).not.toBeNull();
  });

  it('never squeezes a reader drawer: with too little room it lies over the page at 720', () => {
    stubColumnWidth(1100);
    renderSized('reader');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET}px`);
  });

  it('shows the handle for the side tier and for the reader tier', () => {
    stubColumnWidth(2000);
    const side = renderSized('side');
    expect(handle()).not.toBeNull();
    side.unmount();
    const reader = renderSized('reader');
    expect(handle()).not.toBeNull();
    reader.unmount();
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
    expect(className).toContain('bg-drawer');

    expect(card()?.parentElement?.className).not.toContain('py-2');
    expect(card()?.parentElement?.className).not.toContain('pr-2');
    expect(className).toContain('rounded-l-frame');
    expect(className).not.toMatch(/(^|\s)rounded-frame(\s|$)/);
    expect(className).toContain('border-l');
    expect(className).not.toMatch(/(^|\s)border(\s|$)/);
    expect(className).not.toMatch(/border-[trb](\s|$)/);
    expect(className).toContain('shadow-xl');
  });

  it('keeps the reader at min(saved, page - 16) over a page too narrow to fit it beside', () => {
    stubColumnWidth(900);
    renderSized('reader');
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET}px`);
    cleanup();

    stubColumnWidth(600);
    renderSized('reader');
    expect(panel().style.width).toBe(`${600 - 16 + DRAWER_INSET}px`);
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

  it('keeps focus in a field while the scrim is pressed, so a draft answers first', () => {
    stubColumnWidth(678);
    renderColumn('drafts');

    const isDefaultAllowed = fireEvent.mouseDown(scrim() as HTMLElement);

    expect(isDefaultAllowed).toBe(false);
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
  it('reads the side width back clamped to its range', () => {
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

  it('keeps the two tiers apart: each reads and writes only its own saved width', () => {
    stubColumnWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '500');
    const side = renderSized('side');
    expect(panel().style.width).toBe(`${500 + DRAWER_INSET * 2}px`);
    side.unmount();

    const reader = renderSized('reader');
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    fireEvent.keyDown(handleOf(), { key: 'ArrowLeft' });

    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBe(String(READER_DRAWER_DEFAULT + 8));
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe('500');
    reader.unmount();

    renderSized('side');
    expect(panel().style.width).toBe(`${500 + DRAWER_INSET * 2}px`);
  });

  it('reads the reader width back clamped to 480 and 1000', () => {
    stubColumnWidth(2600);
    localStorage.setItem(READER_DRAWER_STORAGE_KEY, '1500');
    const high = renderSized('reader');
    expect(panel().style.width).toBe(`${READER_DRAWER_MAX + DRAWER_INSET * 2}px`);
    high.unmount();

    localStorage.setItem(READER_DRAWER_STORAGE_KEY, '300');
    renderSized('reader');
    expect(panel().style.width).toBe(`${READER_DRAWER_MIN + DRAWER_INSET * 2}px`);
  });

  it('writes the reader width once, at the end of a drag', () => {
    stubColumnWidth(2600);
    renderSized('reader');
    const setItem = vi.spyOn(localStorage, 'setItem');

    fireEvent.mouseDown(handleOf(), { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 900 });
    fireEvent.mouseMove(window, { clientX: 800 });

    expect(setItem).not.toHaveBeenCalled();
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + 200 + DRAWER_INSET * 2}px`);

    fireEvent.mouseUp(window);

    expect(setItem).toHaveBeenCalledOnce();
    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBe(
      String(READER_DRAWER_DEFAULT + 200),
    );
  });

  it('resets the reader to 720 on a double click', () => {
    stubColumnWidth(2600);
    localStorage.setItem(READER_DRAWER_STORAGE_KEY, '900');
    renderSized('reader');
    expect(panel().style.width).toBe(`${900 + DRAWER_INSET * 2}px`);

    fireEvent.doubleClick(handleOf());

    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBe(String(READER_DRAWER_DEFAULT));
  });

  it('stops a reader drag at min(1000, room) while it pushes, so it never flips to overlay', () => {
    stubColumnWidth(1500);
    renderSized('reader');
    const { dragMax } = drawerLayoutOf({ main: 1500, sizing: 'reader', savedWidth: 720 });

    fireEvent.mouseDown(handleOf(), { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 0 });
    fireEvent.mouseUp(window);

    expect(dragMax).toBe(876);
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBe(String(dragMax));
  });

  it('saves a resize under the side drawer key', () => {
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
    const resizer = handleOf();

    fireEvent.mouseDown(resizer, { button: 0, clientX: 1000 });
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
      sizing: 'side',
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
    const resizer = handleOf();

    expect(resizer.getAttribute('aria-valuenow')).toBe(String(RIGHT_DRAWER_MAX));
    expect(resizer.getAttribute('aria-valuemin')).toBe(String(RIGHT_DRAWER_MIN));
    expect(resizer.getAttribute('aria-valuemax')).toBe(String(RIGHT_DRAWER_MAX));
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
      (['side', 'reader'] as const).map((sizing) => ({
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
        savedWidth: sizing === 'reader' ? READER_DRAWER_DEFAULT : RIGHT_DRAWER_DEFAULT,
      });
      const aside = drawerAsideWidthOf({ width, mode });
      const inner = card()?.parentElement ?? null;
      const gutter = inner?.firstElementChild ?? null;

      expect(aside).toBeLessThanOrEqual(columnWidth);
      expect(panel().getAttribute('data-drawer-mode')).toBe(mode);
      expect(panel().style.width).toBe(`${aside}px`);
      expect(gutter?.className).toContain('w-2');
      expect(gutter?.className).toContain('shrink-0');
      expect(card()?.className).toContain('min-w-0');
      expect(card()?.className).toContain('overflow-hidden');
      if (mode === 'overlay') {
        expect(inner?.style.minWidth).toBe(`${aside}px`);
      }
      if (mode === 'push') {
        expect(inner?.style.minWidth).toBe('0');
        expect(panel().style.getPropertyValue('--goodboy-drawer-track')).toBe(`${aside}px`);
        expect(panel().className).toContain('overflow-clip');
        expect(card()?.parentElement?.className).toContain('pr-2');
      }
    },
  );
});

describe('DrawerColumn as two containers', () => {
  const containers = (container: HTMLElement) => ({
    page: container.querySelector<HTMLElement>('[data-container="page"]'),
    drawer: container.querySelector<HTMLElement>('[data-container="drawer"]'),
  });

  it('stands the drawer container beside the page container, never inside it', () => {
    stubColumnWidth(2000);
    const { container } = renderSized('reader', 'sheet');
    const { page, drawer } = containers(container);

    expect(page).not.toBeNull();
    expect(drawer).not.toBeNull();
    expect(page?.contains(drawer)).toBe(false);
    expect(drawer?.contains(page)).toBe(false);
    expect(page?.parentElement).toBe(container.firstElementChild);
    expect(panel().parentElement).toBe(container.firstElementChild);
    expect(panel().contains(drawer)).toBe(true);
  });

  it('frames the page container as a sheet on all four corners while the drawer pushes', () => {
    stubColumnWidth(2000);
    const { container } = renderSized('reader', 'sheet');
    const { page, drawer } = containers(container);

    expect(page?.dataset['sheet']).toBe('pushed');
    expect(page?.className).toContain('rounded-frame');
    expect(page?.className).toContain('border-frame-edge');
    expect(drawer?.className).toContain('rounded-frame');
    expect(drawer?.className).toContain('border-frame-edge');
    expect(drawer?.parentElement?.className).not.toContain('py-2');
  });

  it('keeps the wrapped sheet shape while the drawer is closed or lies over the page', () => {
    stubColumnWidth(2000);
    const closed = render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={null}
        frame="sheet"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    expect(containers(closed.container).page?.dataset['sheet']).toBe('wrapped');
    expect(containers(closed.container).page?.className).toContain('rounded-l-frame');
    closed.unmount();

    stubColumnWidth(900);
    const over = renderSized('reader', 'sheet');
    expect(containers(over.container).page?.dataset['sheet']).toBe('wrapped');
    expect(containers(over.container).drawer?.className).toContain('rounded-l-frame');
  });

  it('draws no frame around the page container when the host owns the sheet', () => {
    stubColumnWidth(2000);
    const { container } = renderSized('reader');
    const { page } = containers(container);

    expect(page?.hasAttribute('data-sheet')).toBe(false);
    expect(page?.className).not.toContain('border');
  });

  it('paints the drawer container with the quieter drawer surface in every mode', () => {
    stubColumnWidth(2000);
    const pushed = renderSized('reader', 'sheet');
    expect(containers(pushed.container).drawer?.className).toContain('bg-drawer');
    expect(containers(pushed.container).page?.className).toContain('bg-background');
    pushed.unmount();

    stubColumnWidth(900);
    const over = renderSized('reader', 'sheet');
    expect(containers(over.container).drawer?.className).toContain('bg-drawer');
  });
});

describe('DrawerColumn one rule for every width', () => {
  it.each([
    ['side', 1023, 'overlay'],
    ['side', 1024, 'push'],
    ['reader', 1343, 'overlay'],
    ['reader', 1344, 'push'],
  ] as const)('lays the %s drawer at a %i column as %s', (sizing, width, mode) => {
    stubColumnWidth(width);
    renderSized(sizing);

    expect(panel().getAttribute('data-drawer-mode')).toBe(mode);
  });

  it.each([1094, 800])('keeps a fixed overlay drawer over a %i column at 720', (width) => {
    stubColumnWidth(width);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>New</div>}
        sizing="reader"
        placement="overlay"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe(`${READER_DRAWER_DEFAULT + DRAWER_INSET}px`);
    expect(scrim()).not.toBeNull();
  });

  it('keeps a fixed overlay drawer over even a column wide enough to push', () => {
    stubColumnWidth(2400);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>New</div>}
        sizing="reader"
        placement="overlay"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
  });

  it('keeps the focus inside the drawer while a resize takes it from pushing to over the page', () => {
    const resize = driveColumnWidth(1200);
    render(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={<textarea aria-label="Ask" />}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Ask' });
    field.focus();
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');

    resize(900);

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(screen.getByRole('textbox', { name: 'Ask' })).toBe(field);
    expect(document.activeElement).toBe(field);

    resize(1200);

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(screen.getByRole('textbox', { name: 'Ask' })).toBe(field);
    expect(document.activeElement).toBe(field);
  });

  it('moves the focus into the drawer when a resize puts it over the focused page', () => {
    const resize = driveColumnWidth(1200);
    render(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={<button type="button">Close panel</button>}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    screen.getByRole('button', { name: 'page action' }).focus();

    resize(900);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' }));
  });
});

describe('DrawerColumn closing', () => {
  const column = (drawer: string | null) => (
    <DrawerColumn
      main={<button type="button">page action</button>}
      drawer={drawer === null ? null : <div>{drawer}</div>}
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />
  );
  const required = (node: HTMLElement | null): HTMLElement => {
    if (node === null) {
      throw new Error('element is not mounted');
    }
    return node;
  };
  const page = () => required(document.querySelector<HTMLElement>('[data-drawer-main]'));
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const openThenClose = (columnWidth: number) => {
    stubColumnWidth(columnWidth);
    const view = render(column('drafts'));
    view.rerender(column(null));
    return view;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the exit for 160ms, as long as the entry', () => {
    expect(DRAWER_EXIT_MS).toBe(160);
  });

  it.each([0, 16, 200])(
    'never moves the page when it closes from over the page, read at %ims',
    (elapsed) => {
      openThenClose(678);
      const before = page().className;
      advance(elapsed);

      expect(panel().className).toContain('absolute');
      expect(panel().className).not.toContain('transition-[width]');
      expect(panel().className).not.toMatch(/(^|\s)relative(\s|$)/);
      expect(page().className).toBe(before);
      expect(page().style.width).toBe('');
      expect(page().hasAttribute('inert')).toBe(false);
    },
  );

  it('keeps the card and the scrim mounted for the exit, then unmounts both', () => {
    openThenClose(678);

    expect(card()).not.toBeNull();
    expect(scrim()).not.toBeNull();
    expect(card()?.textContent).toBe('drafts');
    expect(panel().getAttribute('data-drawer-exit')).toBe('');

    advance(DRAWER_EXIT_MS - 1);
    expect(card()).not.toBeNull();

    advance(1);

    expect(card()).toBeNull();
    expect(scrim()).toBeNull();
    expect(panel().getAttribute('data-drawer-exit')).toBeNull();
    expect(panel().style.width).toBe('0px');
  });

  it('fades the card and the scrim out instead of cutting them', () => {
    openThenClose(678);

    expect(card()?.className).toContain('animate-drawer-overlay-out');
    expect(card()?.className).toContain('motion-reduce:animate-drawer-fade-out');
    expect(scrim()?.className).toContain('animate-drawer-fade-out');
  });

  it('treats the drawer as closed the moment the exit starts', () => {
    const under = vi.fn();
    cleanups.push(registerEscapeLayer(under));
    openThenClose(678);

    expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel().hasAttribute('inert')).toBe(true);
    expect(card()?.hasAttribute('inert')).toBe(true);
    expect(card()?.className).toContain('pointer-events-none');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(under).toHaveBeenCalledOnce();
  });

  it('lets a click on the page behind go through at once: the scrim catches nothing', () => {
    const over = vi.fn();
    cleanups.push(registerEscapeLayer(over));
    openThenClose(678);

    expect(scrim()?.className).toContain('pointer-events-none');
    fireEvent.click(required(scrim()));
    const isDefaultAllowed = fireEvent.mouseDown(required(scrim()));

    expect(over).not.toHaveBeenCalled();
    expect(isDefaultAllowed).toBe(true);
  });

  it('cancels the exit when the drawer reopens during it, without playing the entry again', () => {
    const view = openThenClose(678);
    advance(80);

    view.rerender(column('drafts'));
    advance(300);

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().getAttribute('data-drawer-exit')).toBeNull();
    expect(card()?.textContent).toBe('drafts');
    expect(card()?.className).not.toContain('animate-drawer-overlay-out');
    expect(card()?.className).not.toContain('animate-drawer-overlay-in');
    expect(card()?.hasAttribute('inert')).toBe(false);
    expect(scrim()?.className).not.toContain('pointer-events-none');
    expect(scrim()?.className).not.toContain('animate-fade-in');
  });

  it('plays the entry again when it reopens after the exit is over', () => {
    const view = openThenClose(678);
    advance(300);

    view.rerender(column('drafts'));

    expect(card()?.className).toContain('animate-drawer-overlay-in');
    expect(scrim()?.className).toContain('animate-fade-in');
  });

  it('remembers it closed from over the page: the aside stays out of the flow at 0px', () => {
    openThenClose(678);
    advance(300);

    expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel().className).toContain('absolute');
    expect(panel().className).not.toContain('transition-[width]');
    expect(panel().style.width).toBe('0px');
  });

  it('closes from pushing at once when the card has no layout to animate: no scrim, no exit', () => {
    openThenClose(1094);

    expect(panel().className).toMatch(/(^|\s)relative(\s|$)/);
    expect(panel().className).toContain('transition-[width]');
    expect(panel().style.width).toBe('0px');
    expect(panel().getAttribute('data-drawer-exit')).toBeNull();
    expect(card()).toBeNull();
    expect(scrim()).toBeNull();
  });

  describe('with a laid out card', () => {
    const layOut = () => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 600 }),
      );
    };
    const reduceMotion = (isReduced: boolean) => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: isReduced && query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps the pushing card in the flow while its width eases to 0 and its content fades', () => {
      layOut();
      reduceMotion(false);
      openThenClose(1094);

      expect(panel().getAttribute('data-drawer-exit')).toBe('');
      expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
      expect(panel().className).toMatch(/(^|\s)relative(\s|$)/);
      expect(panel().className).not.toContain('absolute');
      expect(panel().style.width).toBe('0px');
      expect(scrim()).toBeNull();
      expect(card()?.textContent).toBe('drafts');
      expect(card()?.className).not.toContain('animate-drawer-overlay-out');
      expect(content()?.className).toContain('motion-safe:animate-drawer-content-out');
      expect(page().hasAttribute('inert')).toBe(false);

      advance(FOLD_MS - 1);
      expect(card()).not.toBeNull();

      advance(1);
      expect(card()).toBeNull();
      expect(panel().getAttribute('data-drawer-exit')).toBeNull();
    });

    it('closes a pushing drawer at once under reduced motion', () => {
      layOut();
      reduceMotion(true);
      openThenClose(1094);

      expect(card()).toBeNull();
      expect(panel().getAttribute('data-drawer-exit')).toBeNull();
      expect(panel().style.width).toBe('0px');
    });

    it('copies the content as it was when the host empties it in the same commit', () => {
      layOut();
      reduceMotion(false);
      stubColumnWidth(678);
      let panelText: string | null = 'drafts';
      const listeners = new Set<() => void>();
      const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };
      const read = () => panelText;
      const Host = () => {
        const text = useSyncExternalStore(subscribe, read);
        return text === null ? null : <div>{text}</div>;
      };
      const Column = () => {
        const text = useSyncExternalStore(subscribe, read);
        return (
          <DrawerColumn
            main={<button type="button">page action</button>}
            drawer={text === null ? null : <Host />}
            ariaLabel="Side panel"
            resizeLabel="Resize side panel"
          />
        );
      };
      render(<Column />);

      act(() => {
        panelText = null;
        listeners.forEach((listener) => listener());
      });

      expect(panel().getAttribute('data-drawer-exit')).toBe('');
      expect(card()?.textContent).toBe('drafts');
    });
  });

  it('opens from a drawer closed from pushing with the push transition intact', () => {
    stubColumnWidth(1094);
    const view = render(column('drafts'));
    view.rerender(column(null));
    view.rerender(column('drafts'));

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().className).toContain('transition-[width]');
    expect(content()?.className).toContain('motion-safe:animate-drawer-content-in');
  });

  it('drops the exit when the column widens into pushing during it', () => {
    const resize = driveColumnWidth(678);
    const view = render(column('drafts'));
    view.rerender(column(null));

    resize(1094);
    advance(DRAWER_EXIT_MS);

    expect(card()).toBeNull();
    expect(panel().getAttribute('data-drawer-exit')).toBeNull();
  });

  const expectClosedAtOnce = () => {
    expect(card()).toBeNull();
    expect(scrim()).toBeNull();
    expect(panel().getAttribute('data-drawer-exit')).toBeNull();
    expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel().className).toContain('absolute');
    expect(panel().style.width).toBe('0px');
    expect(page().hasAttribute('inert')).toBe(false);
  };

  const closeDrawerHolding = (content: ReactNode) => {
    stubColumnWidth(678);
    const view = render(
      <DrawerColumn
        main={<button type="button">page action</button>}
        drawer={content}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    view.rerender(column(null));
  };

  it.each([
    ['canvas', <canvas key="c" aria-label="Terminal" />],
    ['iframe', <iframe key="i" title="Wireframe" />],
    ['video', <video key="v" />],
    ['audio', <audio key="a" />],
    ['webview', createElement('webview', { key: 'w' })],
  ])('closes at once, with no exit copy, a drawer whose content holds a %s', (_name, element) => {
    closeDrawerHolding(<div>{element}</div>);

    expectClosedAtOnce();
  });

  it('closes at once a drawer that holds more elements than the exit copy allows', () => {
    const rows = Array.from({ length: DRAWER_EXIT_MAX_ELEMENTS + 1 }, (_, index) => (
      <span key={index} />
    ));
    closeDrawerHolding(<div>{rows}</div>);

    expectClosedAtOnce();
  });

  it('still copies and animates a drawer that sits just under the element cap', () => {
    const rows = Array.from({ length: DRAWER_EXIT_MAX_ELEMENTS - 10 }, (_, index) => (
      <span key={index} />
    ));
    closeDrawerHolding(<div>{rows}</div>);

    expect(card()).not.toBeNull();
    expect(scrim()).not.toBeNull();
    expect(panel().getAttribute('data-drawer-exit')).toBe('');
    expect(card()?.querySelectorAll('span').length).toBe(DRAWER_EXIT_MAX_ELEMENTS - 10);
  });

  it('copies the drawer once, as one deep copy of its content, when it closes over the page', () => {
    const clone = vi.spyOn(Node.prototype, 'cloneNode');
    stubColumnWidth(678);
    const view = render(column('drafts'));
    clone.mockClear();
    view.rerender(column(null));

    expect(clone.mock.calls[0]).toEqual([true]);
    expect(clone.mock.contexts[0]).toBeInstanceOf(HTMLDivElement);
    expect(card()?.textContent).toBe('drafts');
    expect(panel().getAttribute('data-drawer-exit')).toBe('');
    clone.mockRestore();
  });

  it('copies nothing when the drawer closes from pushing', () => {
    const clone = vi.spyOn(Node.prototype, 'cloneNode');
    stubColumnWidth(1440);
    const view = render(column('drafts'));
    clone.mockClear();
    view.rerender(column(null));

    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
  });
});
