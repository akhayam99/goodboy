// @vitest-environment happy-dom

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CHILD_TOGGLES,
  ACTIVITY_FILTER_PRESETS,
  ACTIVITY_TOGGLES,
  DEFAULT_ACTIVITY_FILTER,
  activityFilterPresetOf,
  hiddenActivityToggles,
  type ActivityCounts,
  type ActivityFilter,
  type ActivityPreset,
} from '../../../../../timeline/activityFilter';
import { ActivityFilterPanel } from './index';

afterEach(cleanup);

const COUNTS = Object.fromEntries(
  ACTIVITY_TOGGLES.map((toggle, index) => [toggle, index + 1]),
) as ActivityCounts;

type OpenParams = {
  readonly filter?: ActivityFilter;
  readonly preset?: ActivityPreset | null;
  readonly onToggle?: ComponentProps<typeof ActivityFilterPanel>['onToggle'];
  readonly onPreset?: ComponentProps<typeof ActivityFilterPanel>['onPreset'];
};

const open = ({
  filter = DEFAULT_ACTIVITY_FILTER,
  preset,
  onToggle = vi.fn(),
  onPreset = vi.fn(),
}: OpenParams = {}) => {
  render(
    <ActivityFilterPanel
      filter={filter}
      hidden={hiddenActivityToggles({ filter })}
      preset={preset === undefined ? activityFilterPresetOf({ filter }) : preset}
      counts={COUNTS}
      visibleCount={68}
      totalCount={81}
      onToggle={onToggle}
      onPreset={onPreset}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filter the activity feed' }));
  return screen.getByRole('dialog', { name: 'Activity filter' });
};

describe('ActivityFilterPanel', () => {
  it('lays every toggle out at once in three named groups, with no inner scroller', () => {
    const panel = open();

    expect(within(panel).getAllByRole('checkbox')).toHaveLength(
      ACTIVITY_CATEGORIES.length + ACTIVITY_CHILD_TOGGLES.length,
    );
    expect(
      within(panel)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Work', 'Outputs', 'Session log']);
    expect(panel.querySelector('[class*="max-h-"]')).toBeNull();
  });

  it('keeps plans, reports and wireframes under Artifacts in the Outputs group', () => {
    const panel = open();
    const outputs = within(panel).getByRole('group', { name: 'Outputs' });

    for (const name of ['Artifacts', 'Plans', 'Reports', 'Wireframes', 'Pull requests']) {
      expect(within(outputs).getByRole('checkbox', { name })).toBeDefined();
    }
  });

  it('shows the count of every row next to its name', () => {
    const panel = open();
    const agents = within(panel).getByRole('checkbox', { name: 'Agents' });

    expect(agents.closest('label')?.textContent).toBe(`Agents${COUNTS.agents}`);
    expect(within(panel).getByText('Showing 68 of 81 rows')).toBeDefined();
  });

  it('flips one toggle from its checkbox', () => {
    const onToggle = vi.fn();
    const panel = open({ onToggle });

    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Decisions' }));

    expect(onToggle).toHaveBeenCalledWith({ toggle: 'decisions', enabled: false });
  });

  it('disables and unchecks the children while their parent is hidden', () => {
    const onToggle = vi.fn();
    const panel = open({ filter: { ...DEFAULT_ACTIVITY_FILTER, artifacts: false }, onToggle });

    for (const name of ['Plans', 'Reports', 'Wireframes']) {
      const child = within(panel).getByRole('checkbox', { name });
      expect(child.hasAttribute('disabled')).toBe(true);
      expect((child as HTMLInputElement).checked).toBe(false);
    }
  });

  it('names what is hidden on the trigger and in the footer', () => {
    const panel = open({
      filter: { ...DEFAULT_ACTIVITY_FILTER, wireframes: false, resolver: false, session: false },
    });

    expect(screen.getByRole('button', { name: 'Filter the activity feed' }).textContent).toBe(
      'Filter3 hidden',
    );
    expect(
      within(panel).getByText('Wireframes, Resolver, and Session events are hidden'),
    ).toBeDefined();
    expect(within(panel).getByRole('tab', { name: 'Custom' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('applies a preset from the segmented control and restores everything from the footer', () => {
    const onPreset = vi.fn();
    const panel = open({ filter: ACTIVITY_FILTER_PRESETS.work, onPreset });

    expect(within(panel).getByRole('tab', { name: 'Work' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(within(panel).queryByRole('tab', { name: 'Custom' })).toBeNull();
    fireEvent.click(within(panel).getByRole('tab', { name: 'Needs you' }));
    expect(onPreset).toHaveBeenCalledWith({ preset: 'needsYou' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Show everything' }));
    expect(onPreset).toHaveBeenCalledWith({ preset: 'everything' });
  });

  it('says Needs you on the trigger while that preset holds the feed', () => {
    const panel = open({ preset: 'needsYou' });

    expect(screen.getByRole('button', { name: 'Filter the activity feed' }).textContent).toBe(
      'FilterNeeds you',
    );
    expect(within(panel).getByText('Only what needs you is showing')).toBeDefined();
  });

  it('offers no Show everything while everything already shows', () => {
    const panel = open();

    expect(within(panel).getByText('Everything is showing')).toBeDefined();
    expect(within(panel).queryByRole('button', { name: 'Show everything' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter the activity feed' }).textContent).toBe(
      'Filter',
    );
  });
});
