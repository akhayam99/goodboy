// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Trail } from '../components/Trail';

afterEach(cleanup);

describe('Trail', () => {
  it('marks the last segment as the page and lets an ancestor go up', () => {
    const onOverview = vi.fn();
    render(
      <Trail
        segments={[
          { id: 'overview', label: 'Overview', icon: null, onSelect: onOverview },
          { id: 'review', label: 'Review', icon: null, onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByText('Review').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onOverview).toHaveBeenCalledTimes(1);
  });

  it('draws one chevron between segments and hands a segment its own render', () => {
    const { container } = render(
      <Trail
        lead={<span data-testid="lead" />}
        segments={[
          { id: 'overview', label: 'Overview', icon: null },
          {
            id: 'pages',
            label: 'Pages',
            icon: null,
            render: <button type="button">Switch</button>,
          },
          { id: 'run', label: 'Ship a fix', icon: null },
        ]}
      />,
    );

    expect(screen.getByTestId('lead')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Switch' })).toBeDefined();
    expect(container.querySelectorAll('[data-trail-segment]')).toHaveLength(3);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
});
