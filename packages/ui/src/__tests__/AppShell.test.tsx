// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppShell } from '../components/AppShell';

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
});
