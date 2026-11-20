// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContext } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '../components/AppShell';
import { ShellRailContext } from '../shellRailContext';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AppShell', () => {
  it('paints the backdrop once on the window, so the places rail shows it and the main pane stays flat', () => {
    const { container } = render(
      <AppShell leftRail={<nav aria-label="Places">places</nav>} main={<div>main</div>} />,
    );

    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop.className).toContain('bg-backdrop');
    expect(backdrop.hasAttribute('data-app-backdrop')).toBe(true);
    expect(container.querySelectorAll('.bg-backdrop')).toHaveLength(1);
    expect(screen.getByText('places').closest('aside')?.className).not.toMatch(/\bbg-/);
    const page = screen.getByText('main').closest('[data-container="page"]');
    expect(page?.className).toContain('bg-background');
    expect(page?.className).not.toContain('bg-backdrop');
  });

  it('lets the footer size its own track, so a divider never pushes it past the row', () => {
    render(<AppShell footer={<div>status</div>} main={<div>main</div>} />);
    const grid = screen.getByText('status').closest('[style*="grid-template-rows"]');

    expect(grid?.getAttribute('style')).toContain('grid-template-rows: minmax(0,1fr) auto');
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
        leftRail={<nav aria-label="Places" />}
        footer={<div>status</div>}
        main={<div>main</div>}
        studio={<div>settings studio</div>}
      />,
    );

    expect(screen.getByText('status').parentElement?.style.gridArea).toBe('footer');
  });
});

describe('AppShell studio in the main slot', () => {
  it('puts the studio inside the sheet over the page, leaving the rail live', () => {
    render(
      <AppShell
        leftRail={<button type="button">doors</button>}
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
        leftRail={<nav aria-label="Places" />}
        main={<input aria-label="page field" />}
        studio={<div>tasks studio</div>}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'page field', hidden: true });

    rerender(
      <AppShell
        leftRail={<nav aria-label="Places" />}
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
        leftRail={<nav aria-label="Places" />}
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

  it('keeps the right rail at the sheet edge beside the page, never under it', () => {
    render(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div>main</div>}
        rightRail={<div role="toolbar" aria-label="Tools" />}
        studio={<div>impact studio</div>}
      />,
    );
    const rail = screen.getByRole('toolbar', { name: 'Tools' });
    const slot = document.querySelector('[data-studio-slot]');

    expect(rail.closest('[data-drawer-main]')).not.toBeNull();
    expect(slot?.contains(rail)).toBe(false);
    expect(rail.parentElement?.contains(slot ?? null)).toBe(true);
  });

  it('tells the page whether the shell draws the right rail', () => {
    const Probe = () => <span>{useContext(ShellRailContext) ? 'shell rail' : 'own rail'}</span>;
    const { rerender } = render(<AppShell main={<Probe />} />);
    screen.getByText('own rail');

    rerender(<AppShell main={<Probe />} rightRail={<div>tools</div>} />);
    screen.getByText('shell rail');
  });

  it('shows a drawer beside a page when the caller says it is not parked', () => {
    render(
      <AppShell
        main={<div>main</div>}
        studio={<div>tasks studio</div>}
        drawer={<div>terminal dock</div>}
        isDrawerParked={false}
      />,
    );
    const aside = screen.getByText('terminal dock').closest('aside');

    expect(aside?.hasAttribute('data-drawer-parked')).toBe(false);
    expect(aside?.hasAttribute('inert')).toBe(false);
  });

  it('keeps the page layer under an overlay dock, so a narrow window still shows the dock', () => {
    render(
      <AppShell
        main={<div>main</div>}
        studio={<div>tasks studio</div>}
        drawer={<div>terminal dock</div>}
        isDrawerParked={false}
      />,
    );
    const host = screen.getByText('tasks studio').closest('[data-studio-host]');

    expect(host?.className.split(' ')).toContain('isolate');
    expect(host?.contains(screen.getByText('terminal dock'))).toBe(false);
  });

  it('paints the slot opaque, so the page never shows through while a studio fades in', () => {
    render(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div>main</div>}
        studio={<div>impact studio</div>}
      />,
    );
    const slot = screen.getByText('impact studio').parentElement;

    expect(slot?.className).toContain('bg-background');
    expect(slot?.className).toContain('has-[[data-studio-sheet-owner]]:bg-chrome');
  });

  it('parks the drawer under a studio: mounted, hidden, inert, out of the flow, with no exit', () => {
    const { rerender } = render(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div>main</div>}
        drawer={<input aria-label="decision draft" />}
      />,
    );
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'decision draft' });
    fireEvent.change(field, { target: { value: 'ship on Friday' } });

    rerender(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div>main</div>}
        drawer={<input aria-label="decision draft" />}
        studio={<div>tasks studio</div>}
      />,
    );
    const panel = screen.getByRole('complementary', { name: 'Side panel', hidden: true });

    expect(panel.hasAttribute('data-drawer-parked')).toBe(true);
    expect(panel.getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel.hasAttribute('data-drawer-exit')).toBe(false);
    const parkedCard = panel.querySelector<HTMLElement>('[data-drawer-card]');
    expect(parkedCard?.hasAttribute('inert')).toBe(true);
    expect(parkedCard?.className).toContain('invisible');
    expect(parkedCard?.className).toContain('absolute');
    expect(panel.style.width).toBe('0px');
    expect(document.querySelector('[data-drawer-main]')?.getAttribute('data-sheet')).not.toBe(
      'pushed',
    );
    expect(screen.getByRole('textbox', { name: 'decision draft', hidden: true })).toBe(field);

    rerender(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div>main</div>}
        drawer={<input aria-label="decision draft" />}
      />,
    );

    expect(panel.hasAttribute('data-drawer-parked')).toBe(false);
    const openCard = panel.querySelector<HTMLElement>('[data-drawer-card]');
    expect(openCard?.hasAttribute('inert')).toBe(false);
    expect(openCard?.className).not.toContain('invisible');
    expect(screen.getByRole('textbox', { name: 'decision draft' })).toBe(field);
    expect(field.value).toBe('ship on Friday');
  });

  it('sizes the places rail by its own width, with no resize handle and no saved width', () => {
    const setItem = vi.spyOn(localStorage, 'setItem');
    render(
      <AppShell
        leftRail={<nav aria-label="Places">places</nav>}
        footer={<div>status</div>}
        main={<div>main</div>}
      />,
    );

    const grid = screen.getByText('main').closest<HTMLElement>('[style*="grid-template-columns"]');
    expect(grid?.style.gridTemplateColumns).toBe('auto minmax(0,1fr)');
    expect(grid?.style.gridTemplateAreas).toBe('"left main" "footer footer"');
    const places = screen.getByRole('navigation', { name: 'Places' });
    expect(places.parentElement?.tagName).toBe('ASIDE');
    expect(screen.queryByRole('separator')).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('AppShell right drawer', () => {
  it('keeps a closed drawer without a rail as a zero-width column beside the main area', () => {
    render(<AppShell leftRail={<nav aria-label="Places" />} main={<div>main</div>} />);

    const grid = screen
      .getByText('main')
      .closest('[style*="grid-template-columns"]') as HTMLElement;
    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(grid.style.gridTemplateAreas).toBe('"left main"');
    expect(panel.querySelector('[data-drawer-card]')).toBeNull();
    expect(panel.style.width).toBe('0px');
  });

  it('opens the drawer inside the main area', () => {
    render(<AppShell main={<div>main</div>} drawer={<div>drafts</div>} />);

    const panel = screen.getByRole('complementary', { name: 'Side panel' });
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(panel.closest('main')).not.toBeNull();
    expect(screen.getByText('drafts')).toBeDefined();
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
