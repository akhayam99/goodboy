// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY_FILTER,
  type ActivityFilter,
} from '../../../../timeline/activityFilter';
import { ActivityFilterButton } from './ActivityFilterButton';

afterEach(cleanup);

type RenderParams = {
  readonly filter?: ActivityFilter;
  readonly onCategory?: (params: {
    readonly category: (typeof ACTIVITY_CATEGORIES)[number];
    readonly enabled: boolean;
  }) => void;
};

const open = ({ filter = DEFAULT_ACTIVITY_FILTER, onCategory = () => {} }: RenderParams = {}) => {
  const hiddenCount = Object.values(filter).filter((enabled) => !enabled).length;
  render(
    <ActivityFilterButton filter={filter} hiddenCount={hiddenCount} onCategory={onCategory} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filter the activity feed' }));
};

describe('ActivityFilterButton', () => {
  it('lists every activity group as a toggleable item', () => {
    open();
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(ACTIVITY_CATEGORIES.length);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('carries the active state on the row itself', () => {
    open();
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Workflows' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Decisions' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('flips the group when the row is clicked', () => {
    const onCategory = vi.fn();
    open({ onCategory });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Workflows' }));
    expect(onCategory).toHaveBeenCalledWith({ category: 'workflows', enabled: false });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Decisions' }));
    expect(onCategory).toHaveBeenCalledWith({ category: 'decisions', enabled: true });
  });

  it('gives each row the concept glyph of its own kind', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    expect(row.querySelector('svg')).not.toBeNull();
    expect(row.querySelector('svg')?.getAttribute('class')).toContain('text-accent');
  });

  it('dims the glyph of an inactive row', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Decisions' });
    expect(row.querySelector('svg')?.getAttribute('class')).toContain('text-muted-foreground/50');
  });

  it('closes a visible row with an open eye at the trailing edge', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    const eye = row.querySelector('.lucide-eye');
    expect(eye).not.toBeNull();
    expect(row.querySelector('.lucide-eye-off')).toBeNull();
    expect(row.lastElementChild?.classList.contains('lucide-eye')).toBe(true);
  });

  it('marks a hidden row with a dimmer closed eye', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Decisions' });
    const eye = row.querySelector('.lucide-eye-off');
    expect(eye).not.toBeNull();
    expect(row.querySelector('.lucide-eye')).toBeNull();
    expect(eye?.getAttribute('class')).toContain('text-muted-foreground/40');
  });
});
