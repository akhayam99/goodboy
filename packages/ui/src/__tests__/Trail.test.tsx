// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { Trail } from '../components/Trail';
import type { CrumbMenuModel, CrumbMenuRow } from '../components/Trail/crumbMenuTypes';

afterEach(cleanup);

const rowOf = ({ id, label }: { readonly id: string; readonly label: string }): CrumbMenuRow => ({
  id,
  lead: { kind: 'icon', icon: Circle },
  label,
  secondary: null,
  metaA: null,
  state: null,
  isCurrent: id === 'pages',
  isDisabled: false,
  indent: 0,
  onSelect: vi.fn(),
});

const MENU: CrumbMenuModel = {
  title: 'Pages',
  context: null,
  count: null,
  triggerLabel: 'Switch page',
  groups: [
    {
      id: 'pages',
      label: null,
      rows: [rowOf({ id: 'pages', label: 'Pages' }), rowOf({ id: 'runs', label: 'Runs' })],
    },
  ],
  actions: [],
  width: 'narrow',
  filterPlaceholder: null,
};

const lastTailOf = (segment: Element): Element | null => {
  const tails = segment.querySelectorAll('[data-trail-tail]');
  return tails.item(tails.length - 1);
};

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

  it('ends every segment but the page with the same chevron, with or without a menu', () => {
    const { container } = render(
      <Trail
        lead={<span data-testid="lead" />}
        segments={[
          { id: 'overview', label: 'Overview', icon: Circle },
          { id: 'pages', label: 'Pages', icon: Circle, menu: MENU, onSelect: vi.fn() },
          { id: 'run', label: 'Ship a fix', icon: Circle },
        ]}
      />,
    );

    expect(screen.getByTestId('lead')).toBeDefined();
    const segments = Array.from(container.querySelectorAll('[data-trail-segment]'));
    expect(segments).toHaveLength(3);
    const [withoutMenu, withMenu, page] = segments;
    const plain = lastTailOf(withoutMenu!);
    const menu = lastTailOf(withMenu!);
    expect(plain).not.toBeNull();
    expect(menu).not.toBeNull();
    expect(plain?.tagName).not.toBe(menu?.tagName);
    expect(plain?.className).toContain('w-6');
    expect(menu?.className).toContain('w-6');
    expect(plain?.querySelector('svg')?.getAttribute('class')).toContain('lucide-chevron-right');
    expect(menu?.querySelector('svg')?.getAttribute('class')).toContain('lucide-chevron-right');
    expect(page?.querySelector('[data-trail-tail]')).toBeNull();
    expect(container.querySelectorAll('[data-trail-tail]')).toHaveLength(2);
  });

  it('keeps the menu chevron visible at rest', () => {
    render(
      <Trail
        segments={[
          { id: 'pages', label: 'Pages', icon: Circle, menu: MENU, onSelect: vi.fn() },
          { id: 'run', label: 'Ship a fix', icon: Circle },
        ]}
      />,
    );

    const chevron = screen.getByRole('button', { name: 'Switch page: Pages' });
    expect(chevron.className).not.toContain('opacity-0');
  });

  it('measures the segments once for ten renders with the same input', () => {
    const reads = vi.fn();
    const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        reads();
        return 80;
      },
    });
    try {
      const make = () => [
        { id: 'overview', label: 'Overview', icon: Circle },
        { id: 'run', label: 'Ship a fix', icon: Circle },
      ];
      const { rerender } = render(<Trail segments={make()} />);
      const afterFirst = reads.mock.calls.length;
      expect(afterFirst).toBeGreaterThan(0);
      for (let index = 0; index < 10; index += 1) {
        rerender(<Trail segments={make()} />);
      }
      expect(reads.mock.calls.length).toBe(afterFirst);
    } finally {
      if (scrollWidth !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth);
      }
    }
  });

  it('keeps the anchor named at depth four', () => {
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
    expect(states).toEqual(['full', 'full', 'full', 'full']);
    screen.getByRole('button', { name: 'Overview' });
  });

  it('draws an ancestor without an action as plain text', () => {
    render(
      <Trail
        segments={[
          { id: 'settings', label: 'Settings', icon: Circle },
          { id: 'general', label: 'General', icon: Circle },
        ]}
      />,
    );

    screen.getByText('Settings');
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(screen.getByText('Settings').closest('[data-trail-piece]')?.className).not.toContain(
      'hover:bg-hover',
    );
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
