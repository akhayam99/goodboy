// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ACTIVITY_TOGGLES,
  DEFAULT_ACTIVITY_FILTER,
  hiddenActivityToggles,
  type ActivityCounts,
} from '../../../../../timeline/activityFilter';
import { ActivityFilterPanel } from './index';

afterEach(cleanup);

const COUNTS = Object.fromEntries(ACTIVITY_TOGGLES.map((toggle) => [toggle, 1])) as ActivityCounts;

const open = ({ onMarkAllSeen }: { readonly onMarkAllSeen: (() => void) | null }) => {
  render(
    <ActivityFilterPanel
      filter={DEFAULT_ACTIVITY_FILTER}
      hidden={hiddenActivityToggles({ filter: DEFAULT_ACTIVITY_FILTER })}
      hiddenRows={0}
      preset="everything"
      counts={COUNTS}
      visibleCount={4}
      totalCount={4}
      onToggle={vi.fn()}
      onPreset={vi.fn()}
      onMarkAllSeen={onMarkAllSeen}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filter the activity feed' }));
  return screen.getByRole('dialog', { name: 'Activity filter' });
};

describe('Mark all seen inside the activity filter', () => {
  it('marks everything seen and closes the filter', () => {
    const onMarkAllSeen = vi.fn();
    const panel = open({ onMarkAllSeen });

    fireEvent.click(within(panel).getByRole('button', { name: 'Mark all seen' }));

    expect(onMarkAllSeen).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Activity filter' })).toBeNull();
  });

  it('stays out of the filter when nothing is unread', () => {
    const panel = open({ onMarkAllSeen: null });

    expect(within(panel).queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });
});
