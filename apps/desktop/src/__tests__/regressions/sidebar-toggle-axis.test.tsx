// @vitest-environment happy-dom

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ColumnToggleButton } from '../../app/components/SideColumn/ColumnToggleButton';
import { shortcutGlyphs } from '../../shared/keyboard/registry';
import { tooltipTextOf } from '../helpers/tooltip';

vi.mock('../../store', () => ({}));

const SIDE_COLUMN = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'index.tsx'),
  'utf8',
);
const TOGGLE = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'ColumnToggleButton.tsx'),
  'utf8',
);
const TOP_BAR = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'AppTopBar', 'index.tsx'),
  'utf8',
);
const COLUMN_RAIL = readFileSync(
  join(__dirname, '..', '..', 'app', 'components', 'SideColumn', 'ColumnRail.tsx'),
  'utf8',
);

afterEach(cleanup);

describe('the sidebar toggle axis', () => {
  it('draws one column toggle that names the sidebar and the chord', () => {
    const open = render(<ColumnToggleButton isCollapsed={false} onToggle={vi.fn()} />);
    const openToggle = open.container.querySelector('[data-sidebar-toggle]') as HTMLElement;
    expect(openToggle.getAttribute('aria-pressed')).toBe('true');
    expect(openToggle.getAttribute('aria-label')).toBe('Hide sidebar');
    expect(tooltipTextOf({ element: openToggle })).toBe(
      `Hide sidebar${shortcutGlyphs('column.toggle')}`,
    );
    open.unmount();

    const closed = render(<ColumnToggleButton isCollapsed onToggle={vi.fn()} />);
    expect(
      closed.container.querySelector('[data-sidebar-toggle]')?.getAttribute('aria-label'),
    ).toBe('Show sidebar');
  });

  it('keeps one main sidebar toggle, first in the top bar left zone, and none in the column or its rail', () => {
    expect(SIDE_COLUMN).not.toContain('<ColumnToggleButton');
    expect(COLUMN_RAIL).not.toContain('<ColumnToggleButton');
    expect(TOGGLE).toContain('size="sm"');
    const leftZone = TOP_BAR.indexOf('col-start-1');
    const toggle = TOP_BAR.indexOf('<ColumnToggleButton');
    expect(toggle).toBeGreaterThan(leftZone);
    expect(toggle).toBeLessThan(TOP_BAR.indexOf('<WorkspaceIdentityRow'));
    expect(toggle).toBeLessThan(TOP_BAR.indexOf('col-start-2'));
    expect(toggle).toBeLessThan(TOP_BAR.indexOf('<NavCluster'));
  });
});
