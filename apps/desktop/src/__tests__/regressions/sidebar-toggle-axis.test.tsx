// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SidebarToggleButton } from '../../features/session/components/SessionNavSidebar/parts/SidebarToggleButton';
import { CollapsedRail } from '../../features/session/components/SessionNavSidebar/parts/CollapsedRail';

vi.mock('../../store', () => ({}));

afterEach(cleanup);

describe('the sidebar toggle axis', () => {
  it('draws the same size-8 button first in the rail and first in the sidebar row', () => {
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
});
