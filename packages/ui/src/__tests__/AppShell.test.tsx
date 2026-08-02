// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppShell } from '../components/AppShell';

afterEach(cleanup);

describe('AppShell', () => {
  it('takes the hidden left sidebar out of the tab order', () => {
    const { rerender } = render(
      <AppShell
        leftSidebar={<button type="button">sessions</button>}
        main={<div>main</div>}
        rightSidebar={null}
      />,
    );
    const aside = screen.getByRole('button', { name: 'sessions' }).closest('aside');

    expect(aside?.hasAttribute('inert')).toBe(false);

    rerender(
      <AppShell
        leftSidebar={<button type="button">sessions</button>}
        leftHidden
        main={<div>main</div>}
        rightSidebar={null}
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
        rightSidebar={null}
      />,
    );
    const slot = screen.getByText('peek').parentElement;

    expect(slot?.style.gridRow).toBe('1 / 2');
    expect(slot?.style.gridColumn).toBe('1 / -1');
    expect(slot?.className).toContain('pointer-events-none');
  });

  it('omits the overlay slot when nothing is peeking', () => {
    render(
      <AppShell leftSidebar={<div>sessions</div>} main={<div>main</div>} rightSidebar={null} />,
    );

    expect(screen.queryByText('peek')).toBeNull();
  });
});
