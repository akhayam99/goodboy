// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  AppShell,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_STORAGE_KEY,
  canDrawerPush,
} from '../components/AppShell';

afterEach(cleanup);

describe('AppShell', () => {
  it('takes the hidden left sidebar out of the tab order', () => {
    const { rerender } = render(
      <AppShell leftSidebar={<button type="button">sessions</button>} main={<div>main</div>} />,
    );
    const aside = screen.getByRole('button', { name: 'sessions' }).closest('aside');

    expect(aside?.hasAttribute('inert')).toBe(false);

    rerender(
      <AppShell
        leftSidebar={<button type="button">sessions</button>}
        leftHidden
        main={<div>main</div>}
      />,
    );

    expect(aside?.hasAttribute('inert')).toBe(true);
  });

  it('renders the left overlay over the first grid row', () => {
    render(
      <AppShell
        leftSidebar={<div>sessions</div>}
        leftHidden
        leftOverlay={<div>peek</div>}
        main={<div>main</div>}
      />,
    );
    const slot = screen.getByText('peek').parentElement;

    expect(slot?.style.gridRow).toBe('1 / 2');
    expect(slot?.style.gridColumn).toBe('1 / -1');
    expect(slot?.className).toContain('pointer-events-none');
  });

  it('lets the footer size its own track, so a divider never pushes it past the row', () => {
    render(<AppShell footer={<div>status</div>} main={<div>main</div>} />);
    const grid = screen.getByText('status').closest('[style*="grid-template-rows"]');

    expect(grid?.getAttribute('style')).toContain('grid-template-rows: minmax(0,1fr) auto');
  });

  it('omits the overlay slot when nothing is peeking', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />);

    expect(screen.queryByText('peek')).toBeNull();
  });

  it('hides the studio slot when the studio renders nothing', () => {
    const Empty = () => null;
    const { container } = render(<AppShell main={<div>main</div>} studio={<Empty />} />);

    const slot = container.querySelector('.z-studio');
    expect(slot?.className).toContain('empty:hidden');
    expect(slot?.childElementCount).toBe(0);
  });

  it('spans the studio across every column of the work row, above the peek', () => {
    render(
      <AppShell
        leftSidebar={<div>sessions</div>}
        leftOverlay={<div>peek</div>}
        footer={<div>status</div>}
        main={<div>main</div>}
        studio={<div>settings studio</div>}
      />,
    );
    const slot = screen.getByText('settings studio').parentElement;
    const peek = screen.getByText('peek').parentElement;

    expect(slot?.style.gridColumn).toBe('1 / -1');
    expect(slot?.style.gridRow).toBe('1 / 2');
    expect(slot?.className).toContain('z-studio');
    expect(peek?.className).toContain('z-20');
    expect(screen.getByText('status').parentElement?.style.gridArea).toBe('footer');
  });
});

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubGridWidth = (width: number) => {
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

const gridOf = (text: string) =>
  screen.getByText(text).closest('[style*="grid-template-columns"]') as HTMLElement;

describe('AppShell right drawer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a closed drawer as a zero-width, inert column', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />);

    const grid = gridOf('main');
    expect(grid.style.gridTemplateAreas).toBe('"left lhandle main rhandle right"');
    expect(grid.style.gridTemplateColumns.endsWith('0px 0px')).toBe(true);
    expect(screen.getByRole('complementary', { name: 'Side panel' }).hasAttribute('inert')).toBe(
      true,
    );
  });

  it('opens as a grid column at the default width and pushes the main area', () => {
    stubGridWidth(1512);
    render(
      <AppShell
        leftSidebar={<div>sessions</div>}
        main={<div>main</div>}
        drawer={<div>drafts</div>}
      />,
    );

    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(panel.getAttribute('data-drawer-mode')).toBe('push');
    expect(panel.style.gridArea).toBe('right');
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(gridOf('main').style.gridTemplateColumns).toContain(`6px ${RIGHT_DRAWER_DEFAULT}px`);
    expect(screen.getByRole('separator', { name: 'Resize side panel' })).toBeDefined();
  });

  it('lies over the main area when pushing would squeeze the column under its floor', () => {
    stubGridWidth(1280);
    render(
      <AppShell
        leftSidebar={<div>sessions</div>}
        main={<div>main</div>}
        drawer={<div>drafts</div>}
      />,
    );

    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(panel.getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel.style.gridArea).toBe('main');
    expect(panel.className).toContain('shadow-xl');
    expect(gridOf('main').style.gridTemplateColumns.endsWith('0px 0px')).toBe(true);
  });

  it('pushes only when the main area keeps a 560px column beside the drawer', () => {
    expect(canDrawerPush({ mainWidthPx: 1166, drawerWidthPx: 400 })).toBe(true);
    expect(canDrawerPush({ mainWidthPx: 934, drawerWidthPx: 400 })).toBe(false);
  });

  it('reads the saved width back clamped to its range', () => {
    stubGridWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');
    render(<AppShell main={<div>main</div>} drawer={<div>drafts</div>} />);

    expect(gridOf('main').style.gridTemplateColumns).toContain(`${RIGHT_DRAWER_MAX}px`);
  });
});
