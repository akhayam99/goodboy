import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListGrid } from '@goodboy/ui';
import type { InboxRecord } from '../../types';
import { TaskGroupRows, type TaskLine } from './TaskGroupRows';
import { TASK_COLUMNS } from './taskColumns';

const { rowRenders } = vi.hoisted(() => ({ rowRenders: { current: 0 } }));

vi.mock('../../../../shared/hooks/useNow', () => ({
  useNow: () => {
    rowRenders.current += 1;
    return Date.parse('2026-10-16T09:00:00.000Z');
  },
}));

const NOW = Date.parse('2026-10-16T09:00:00.000Z');

const record = (index: number): InboxRecord => ({
  key: `github:issue:${index}`,
  provider: 'github',
  kind: 'issue',
  identifier: `#${500 + index}`,
  title: `Webhook retry ${index}`,
  state: 'open',
  stateLabel: 'Open',
  updatedAt: new Date(NOW - index * 60_000).toISOString(),
  url: '',
  context: 'payments-api',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 500 + index,
      title: '',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: null,
  },
});

const many = (count: number): ReadonlyArray<InboxRecord> =>
  Array.from({ length: count }, (_, index) => record(index));

const THREE = many(3);

const onSelect = vi.fn();
const onActivate = vi.fn();
const onToggleStar = vi.fn();
const starOf = () => false;

type RenderParams = {
  readonly records?: ReadonlyArray<InboxRecord>;
  readonly isExpanded?: boolean;
  readonly selectedKey?: string | null;
  readonly cursorKey?: string | null;
  readonly lines?: ReadonlyArray<TaskLine>;
  readonly onExpand?: () => void;
  readonly onCollapse?: () => void;
};

const group = ({
  records = THREE,
  isExpanded = false,
  selectedKey = null,
  cursorKey = null,
  lines = [],
  onExpand = vi.fn(),
  onCollapse = vi.fn(),
}: RenderParams = {}) => (
  <ListGrid label="Task items" columns={TASK_COLUMNS} isGrouped>
    <TaskGroupRows
      label="GitHub"
      records={records}
      isExpanded={isExpanded}
      canCollapse
      lines={lines}
      selectedKey={selectedKey}
      cursorKey={cursorKey}
      onExpand={onExpand}
      onCollapse={onCollapse}
      onSelect={onSelect}
      onActivate={onActivate}
      starOf={starOf}
      onToggleStar={onToggleStar}
    />
  </ListGrid>
);

beforeEach(() => {
  rowRenders.current = 0;
});

afterEach(cleanup);

describe('TaskGroupRows', () => {
  it('names the group with its count and shows every row of a small group', () => {
    render(group());

    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('caps a group at five rows and offers Show all with the full count', () => {
    const onExpand = vi.fn();
    render(group({ records: many(38), onExpand }));

    expect(screen.getAllByRole('option')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 38' }));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('shows every row once expanded, with Show fewer to fold it back', () => {
    const onCollapse = vi.fn();
    render(group({ records: many(38), isExpanded: true, onCollapse }));

    expect(screen.getAllByRole('option')).toHaveLength(38);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('draws a window of a large expanded group and names the cursor position', () => {
    render(group({ records: many(312), isExpanded: true, cursorKey: 'github:issue:40' }));

    expect(screen.getAllByRole('option').length).toBeLessThan(312);
    expect(screen.getByText('41 of 312')).toBeDefined();
    expect(document.querySelector('[data-row-key="github:issue:40"]')).not.toBeNull();
    expect(
      screen.getByRole('listbox', { name: 'GitHub' }).getAttribute('aria-activedescendant'),
    ).toBe('inbox-option-github_issue_40');
  });

  it('puts a source that did not load as one gray line that retries on click', () => {
    const onClick = vi.fn();
    render(group({ lines: [{ key: 'linear', text: 'Linear is rate limited. Retry', onClick }] }));

    fireEvent.click(screen.getByRole('button', { name: 'Linear is rate limited. Retry' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('re-renders only the rows that gain or lose the selection', () => {
    const view = render(group({ selectedKey: 'github:issue:0' }));
    rowRenders.current = 0;

    view.rerender(group({ selectedKey: 'github:issue:1' }));

    expect(rowRenders.current).toBe(2);
  });
});
