// @vitest-environment happy-dom

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SidebarToggleButton } from '../../features/session/components/SessionNavSidebar/parts/SidebarToggleButton';
import { CollapsedRail } from '../../features/session/components/SessionNavSidebar/parts/CollapsedRail';
import { ColumnToggleButton } from '../../app/components/SideColumn/ColumnToggleButton';

vi.mock('../../store', () => ({}));

const SIDE_COLUMN = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'index.tsx'),
  'utf8',
);
const TOGGLE = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'ColumnToggleButton.tsx'),
  'utf8',
);
const COLUMN_RAIL = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'ColumnRail.tsx'),
  'utf8',
);

afterEach(cleanup);

describe('the sidebar toggle axis', () => {
  it('draws the same size-8 button first in the classic rail and first in the classic sidebar row', () => {
    const rail = render(<CollapsedRail onToggleSidebar={vi.fn()} />);
    const railToggle = rail.container.querySelector('[data-sidebar-toggle]') as HTMLElement;
    const railFirst = rail.container.querySelector('button');
    expect(railFirst).toBe(railToggle);
    expect(railToggle.className).toContain('size-8');
    rail.unmount();

    const open = render(<SidebarToggleButton isCollapsed={false} onToggle={vi.fn()} />);
    const openToggle = open.container.querySelector('[data-sidebar-toggle]') as HTMLElement;
    expect(openToggle.className).toContain('size-8');
    expect(openToggle.getAttribute('aria-label')).toMatch(/^Hide sessions/);
  });

  it('draws one column toggle that names the sidebar and the chord', () => {
    const open = render(<ColumnToggleButton isCollapsed={false} onToggle={vi.fn()} />);
    const openToggle = open.container.querySelector('[data-sidebar-toggle]') as HTMLElement;
    expect(openToggle.getAttribute('aria-pressed')).toBe('true');
    expect(openToggle.getAttribute('aria-label')).toMatch(/^Hide sidebar \(/);
    open.unmount();

    const closed = render(<ColumnToggleButton isCollapsed onToggle={vi.fn()} />);
    expect(
      closed.container.querySelector('[data-sidebar-toggle]')?.getAttribute('aria-label'),
    ).toMatch(/^Show sidebar \(/);
  });

  it('centers the column toggle in a 44px box, the rail width, so both land on one axis', () => {
    expect(SIDE_COLUMN).toMatch(/className="flex w-11 shrink-0 items-center justify-center"/);
    expect(TOGGLE).toContain('flex size-8 shrink-0');
    expect(SIDE_COLUMN.indexOf('<ColumnToggleButton')).toBeLessThan(
      SIDE_COLUMN.indexOf('<NewSessionRow'),
    );
    expect(COLUMN_RAIL).toContain('items-center');
    expect(COLUMN_RAIL.indexOf('<ColumnToggleButton')).toBeLessThan(
      COLUMN_RAIL.indexOf('<RailButton'),
    );
  });
});
