// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX } from '../components/AppShell';
import { DrawerColumn, RIGHT_DRAWER_STORAGE_KEY } from '../components/DrawerColumn';
import {
  DRAWER_INSET,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  canDrawerPush,
  drawerTrackOf,
  drawerWidthOf,
} from '../drawerGeometry';

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

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DrawerColumn', () => {
  it('pushes the main column at 1440 wide, as a floating card with no shadow', () => {
    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    const card = panel().querySelector('[data-drawer-card]');
    expect(card?.className).toContain('rounded-frame');
    expect(card?.className).toContain('bg-subtle');
    expect(card?.className).not.toContain('shadow');
  });

  it('lies over the main column at 1024 wide, with a shadow', () => {
    stubColumnWidth(678);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().className).toContain('absolute');
    expect(panel().querySelector('[data-drawer-card]')?.className).toContain('shadow-lg');
  });

  it('opens at half the column and pushes when the main area keeps its 560px', () => {
    stubColumnWidth(2000);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>plan</div>}
        sizing="half"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-sizing')).toBe('half');
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('1000px');
    expect(screen.queryByRole('separator', { name: 'Resize side panel' })).toBeNull();
  });

  it('caps a half drawer so it still pushes, the main area keeping its 560px', () => {
    stubColumnWidth(1100);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>plan</div>}
        sizing="half"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe('492px');
  });

  it('lies over the page at half width when even the capped drawer cannot push', () => {
    stubColumnWidth(900);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>plan</div>}
        sizing="half"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe('450px');
  });

  it('keeps the main content first and on its left edge, open or closed', () => {
    stubColumnWidth(1094);
    const { rerender, container } = renderColumn(null);
    const mainOf = () => container.querySelector('[data-drawer-main]') as HTMLElement;
    const closed = mainOf();

    rerender(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>drafts</div>}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(mainOf()).toBe(closed);
    expect(mainOf().parentElement?.firstElementChild).toBe(mainOf());
    expect(mainOf().className).not.toMatch(/\b(mx-auto|justify-center|ml-auto|items-center)\b/);
    expect(panel().previousElementSibling).toBe(mainOf());
  });

  it('fills the whole column when expanded, over the page', () => {
    stubColumnWidth(2000);
    render(
      <DrawerColumn
        main={<div>main</div>}
        drawer={<div>plan</div>}
        sizing="full"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().style.width).toBe('2000px');
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

  it('shares one saved width, read back clamped to its range', () => {
    stubColumnWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');
    renderColumn('drafts');

    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
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
      const width = drawerWidthOf({
        sizing,
        columnWidth,
        resizableWidth: RIGHT_DRAWER_DEFAULT,
      });
      const track = drawerTrackOf(width);
      const card = panel().querySelector<HTMLElement>('[data-drawer-card]');
      const inner = card?.parentElement ?? null;
      const handle = inner?.firstElementChild ?? null;

      expect(DRAWER_INSET).toBe(8);
      expect(track).toBeLessThanOrEqual(columnWidth);
      expect(panel().style.width).toBe(`${track}px`);
      expect(panel().className).toContain('overflow-hidden');
      expect(inner?.style.minWidth).toBe(`${track}px`);
      expect(handle?.className).toContain('w-2');
      expect(handle?.className).toContain('shrink-0');
      expect(card?.className).toContain('mr-2');
      expect(card?.className).toContain('min-w-0');
      expect(card?.className).toContain('overflow-hidden');
    },
  );
});
