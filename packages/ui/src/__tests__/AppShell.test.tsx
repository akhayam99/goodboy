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

  it('frames the window and the sidebar column on chrome, one step behind the main pane', () => {
    const { container } = render(
      <AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} />,
    );

    expect((container.firstElementChild as HTMLElement).className).toContain('bg-chrome');
    expect(screen.getByText('sessions').closest('aside')?.className).toContain('bg-chrome');
    const main = screen.getByText('main').closest('main');
    expect(main?.className).toContain('bg-background');
    expect(main?.className).not.toContain('bg-chrome');
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

describe('AppShell studio beside the column', () => {
  it('puts the studio in the main area as its own sheet, leaving the column live', () => {
    render(
      <AppShell
        leftSidebar={<button type="button">doors</button>}
        main={<div>main</div>}
        studio={<div>inbox studio</div>}
        studioCoversLeft={false}
      />,
    );
    const slot = screen.getByText('inbox studio').parentElement;

    expect(slot?.style.gridArea).toBe('main');
    expect(slot?.style.gridColumn).toBe('');
    expect(slot?.dataset.studioSlot).toBe('content');
    expect(
      screen.getByRole('button', { name: 'doors' }).closest('aside')?.hasAttribute('inert'),
    ).toBe(false);
  });

  it('draws the peek after the studio, so the peeked column floats over a studio too', () => {
    render(
      <AppShell
        leftSidebar={<div>rail</div>}
        leftSidebarCollapsed
        leftOverlay={<div>peek</div>}
        main={<div>main</div>}
        studio={<div>chat studio</div>}
        studioCoversLeft={false}
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
});
