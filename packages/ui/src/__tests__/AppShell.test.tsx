// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell, LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_STORAGE_KEY } from '../components/AppShell';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

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

  it('paints the backdrop once on the window, so the sidebar column shows it and the main pane stays flat', () => {
    const { container } = render(
      <AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />,
    );

    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop.className).toContain('bg-backdrop');
    expect(backdrop.hasAttribute('data-app-backdrop')).toBe(true);
    expect(container.querySelectorAll('.bg-backdrop')).toHaveLength(1);
    expect(screen.getByText('sessions').closest('aside')?.className).not.toMatch(/\bbg-/);
    const page = screen.getByText('main').closest('[data-container="page"]');
    expect(page?.className).toContain('bg-background');
    expect(page?.className).not.toContain('bg-backdrop');
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

  it('keeps the footer in its own row while a studio is open', () => {
    render(
      <AppShell
        leftSidebar={<div>sessions</div>}
        footer={<div>status</div>}
        main={<div>main</div>}
        studio={<div>settings studio</div>}
      />,
    );

    expect(screen.getByText('status').parentElement?.style.gridArea).toBe('footer');
  });
});

describe('AppShell studio in the main slot', () => {
  it('puts the studio inside the sheet over the page, leaving the column live', () => {
    render(
      <AppShell
        leftSidebar={<button type="button">doors</button>}
        main={<div>main</div>}
        studio={<div>inbox studio</div>}
      />,
    );
    const slot = screen.getByText('inbox studio').parentElement;
    const sheet = document.querySelector<HTMLElement>('[data-drawer-main]');

    expect(slot?.dataset.studioSlot).toBe('content');
    expect(slot?.className).toContain('z-studio');
    expect(slot?.style.gridArea).toBe('');
    expect(sheet?.contains(slot ?? null)).toBe(true);
    expect(screen.getByText('main').parentElement?.hasAttribute('inert')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'doors' }).closest('aside')?.hasAttribute('inert'),
    ).toBe(false);
  });

  it('keeps the page mounted and live once the studio closes', () => {
    const { rerender } = render(
      <AppShell
        leftSidebar={<div>doors</div>}
        main={<input aria-label="page field" />}
        studio={<div>tasks studio</div>}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'page field', hidden: true });

    rerender(
      <AppShell
        leftSidebar={<div>doors</div>}
        main={<input aria-label="page field" />}
        studio={null}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'page field' })).toBe(field);
    expect(field.parentElement?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('[data-studio-slot]')).toBeNull();
  });

  it('drops the sheet frame while a studio draws its own sheets', () => {
    render(
      <AppShell
        leftSidebar={<div>doors</div>}
        main={<div>main</div>}
        studio={<div data-studio-sheet-owner="">chat studio</div>}
      />,
    );
    const column = document.querySelector<HTMLElement>('[data-drawer-main]')?.parentElement;

    expect(column?.className).toContain(
      '[&>[data-drawer-main]:has([data-studio-sheet-owner])]:border-0',
    );
    expect(column?.className).toContain(
      '[&>[data-drawer-main]:has([data-studio-sheet-owner])]:bg-transparent',
    );
  });

  it('draws the peek after the studio, so the peeked column floats over a studio too', () => {
    render(
      <AppShell
        leftSidebar={<div>rail</div>}
        leftSidebarCollapsed
        leftOverlay={<div>peek</div>}
        main={<div>main</div>}
        studio={<div>chat studio</div>}
      />,
    );
    const studio = screen.getByText('chat studio').parentElement as HTMLElement;
    const peek = screen.getByText('peek').parentElement as HTMLElement;

    expect(studio.compareDocumentPosition(peek) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(peek.style.gridColumn).toBe('1 / -1');
  });

  it('opens the column at 240px by default within 200 to 400, on a fresh saved key', () => {
    expect(LEFT_SIDEBAR_DEFAULT).toBe(240);
    expect(LEFT_SIDEBAR_STORAGE_KEY).toBe('goodboy:left-sidebar-width:v3');
  });
});

describe('AppShell right drawer', () => {
  it('keeps a closed drawer as a zero-width, inert column beside the main area', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />);

    const grid = screen
      .getByText('main')
      .closest('[style*="grid-template-columns"]') as HTMLElement;
    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(grid.style.gridTemplateAreas).toBe('"left lhandle main"');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.style.width).toBe('0px');
  });

  it('opens the drawer inside the main area', () => {
    render(<AppShell main={<div>main</div>} drawer={<div>drafts</div>} />);

    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(panel.closest('main')).not.toBeNull();
    expect(screen.getByText('drafts')).toBeDefined();
  });

  it('drags the sidebar through a CSS variable and saves its width once, on release', () => {
    const { container } = render(
      <AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />,
    );
    const setItem = vi.spyOn(localStorage, 'setItem');
    const grid = container.querySelector<HTMLElement>('[style*="grid-template-areas"]');
    const handle = screen.getByRole('separator', { name: 'Resize left sidebar' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 340 });
    Array.from({ length: 50 }).forEach((_, index) =>
      fireEvent.mouseMove(window, { clientX: 340 + index }),
    );

    expect(setItem).not.toHaveBeenCalled();
    expect(grid?.style.getPropertyValue('--goodboy-left-sidebar-width')).toBe(
      `${LEFT_SIDEBAR_DEFAULT + 49}px`,
    );

    fireEvent.mouseUp(window);

    expect(setItem).toHaveBeenCalledOnce();
    expect(localStorage.getItem(LEFT_SIDEBAR_STORAGE_KEY)).toBe(String(LEFT_SIDEBAR_DEFAULT + 49));
  });

  it('hands a fixed overlay placement to the drawer column', () => {
    class WideObserver {
      private readonly callback: (
        entries: ReadonlyArray<{ contentRect: { width: number } }>,
      ) => void;
      constructor(callback: (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 2400 } }]);
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', WideObserver);
    const { rerender } = render(
      <AppShell main={<div>main</div>} drawer={<div>New</div>} drawerSizing="reader" />,
    );
    const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');

    rerender(
      <AppShell
        main={<div>main</div>}
        drawer={<div>New</div>}
        drawerSizing="reader"
        drawerPlacement="overlay"
      />,
    );

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    vi.unstubAllGlobals();
  });
});
