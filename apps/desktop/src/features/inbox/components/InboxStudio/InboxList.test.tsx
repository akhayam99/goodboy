import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxList } from './InboxList';

type RenderParams = {
  readonly totalCount?: number;
  readonly visibleCount?: number;
  readonly connectedCount?: number;
  readonly failureCount?: number;
  readonly isLoading?: boolean;
  readonly onOpenSettings?: () => void;
  readonly onClearFilters?: () => void;
};

const renderList = ({
  totalCount = 2,
  visibleCount = 2,
  connectedCount = 1,
  failureCount = 0,
  isLoading = false,
  onOpenSettings = vi.fn(),
  onClearFilters = vi.fn(),
}: RenderParams = {}) =>
  render(
    <InboxList
      totalCount={totalCount}
      visibleCount={visibleCount}
      connectedCount={connectedCount}
      failureCount={failureCount}
      isLoading={isLoading}
      hasFiltersActive
      onOpenSettings={onOpenSettings}
      onClearFilters={onClearFilters}
    >
      <li>rows</li>
    </InboxList>,
  );

afterEach(cleanup);

describe('InboxList', () => {
  it('holds every group in one list on the shared task grid', () => {
    renderList();

    const list = screen.getByRole('list', { name: 'Task items' });
    expect(list.style.gridTemplateColumns).toBe('0px 16px 88px minmax(0,1fr) 16px 16px 48px 0px');
  });

  it('shows skeleton rows only until the first row arrives', () => {
    renderList({ isLoading: true, totalCount: 0, visibleCount: 0 });

    expect(screen.getByRole('status', { name: 'Loading tasks' })).toBeDefined();
  });

  it('asks to connect a tool when none is connected', () => {
    const onOpenSettings = vi.fn();
    renderList({ totalCount: 0, visibleCount: 0, connectedCount: 0, onOpenSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Connect a tool' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('says what will be here the first time, when connected tools return nothing', () => {
    renderList({ totalCount: 0, visibleCount: 0 });

    expect(screen.getByText('No items yet')).toBeDefined();
  });

  it('offers to clear filters when they hide every item', () => {
    const onClearFilters = vi.fn();
    renderList({ visibleCount: 0, onClearFilters });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('keeps the failure and the first-time state apart: a failed load never says "No items yet"', () => {
    renderList({ totalCount: 0, visibleCount: 0, failureCount: 1 });

    expect(screen.queryByText('No items yet')).toBeNull();
  });
});
