// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { Trail } from '../components/Trail';

afterEach(cleanup);

describe('Trail', () => {
  it('marks the last segment as the page and lets an ancestor go up', () => {
    const onOverview = vi.fn();
    render(
      <Trail
        segments={[
          { id: 'overview', label: 'Overview', icon: Circle, onSelect: onOverview },
          { id: 'review', label: 'Review', icon: Circle, onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByText('Review').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onOverview).toHaveBeenCalledTimes(1);
  });

  it('draws one chevron between segments', () => {
    const { container } = render(
      <Trail
        lead={<span data-testid="lead" />}
        segments={[
          { id: 'overview', label: 'Overview', icon: Circle },
          { id: 'pages', label: 'Pages', icon: Circle },
          { id: 'run', label: 'Ship a fix', icon: Circle },
        ]}
      />,
    );

    expect(screen.getByTestId('lead')).toBeDefined();
    expect(container.querySelectorAll('[data-trail-segment]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-trail-segment] > svg')).toHaveLength(2);
  });

  it('turns the anchor into an icon from depth four and keeps the last two full', () => {
    const { container } = render(
      <Trail
        segments={['Overview', 'Workflows', 'Ship a fix', 'Wire checkout'].map((label) => ({
          id: label,
          label,
          icon: Circle,
          onSelect: vi.fn(),
        }))}
      />,
    );

    const states = Array.from(container.querySelectorAll('[data-trail-segment]')).map((node) =>
      node.getAttribute('data-trail-state'),
    );
    expect(states).toEqual(['icon', 'full', 'full', 'full']);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeDefined();
  });

  it('folds middle ancestors behind an ellipsis after the anchor when the band is narrow', () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 260,
    });
    try {
      const { container } = render(
        <Trail
          segments={[
            'Overview',
            'Workflows',
            'Ship webhook retries',
            'implementer',
            'Wire checkout errors',
            'Answers',
          ].map((label) => ({ id: label, label, icon: Circle, onSelect: vi.fn() }))}
        />,
      );

      const fold = container.querySelector('[data-trail-fold]');
      expect(fold).not.toBeNull();
      const first = container.querySelector('[data-trail-segment]');
      expect(first?.getAttribute('data-trail-segment')).toBe('Overview');
      expect(first?.nextElementSibling).toBe(fold);
      fireEvent.click(screen.getByRole('button', { name: 'Show folded crumbs' }));
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
    } finally {
      if (width !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
      }
    }
  });
});
