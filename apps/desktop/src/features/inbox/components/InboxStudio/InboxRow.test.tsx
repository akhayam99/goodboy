import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListGrid } from '@goodboy/ui';
import type { InboxRecord } from '../../types';
import { InboxRow } from './InboxRow';
import { TASK_COLUMNS } from './taskColumns';

const issue: InboxRecord = {
  key: 'linear:issue:412',
  provider: 'linear',
  kind: 'issue',
  identifier: 'HBL-412',
  title: 'Ledger export times out over 10k rows',
  state: 'active',
  stateLabel: 'In progress',
  updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  url: 'https://example.invalid/linear/HBL-412',
  context: 'Ledger',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: '412',
      identifier: 'HBL-412',
      title: 'Ledger export times out over 10k rows',
      description: null,
      url: 'https://example.invalid/linear/HBL-412',
      state: { name: 'In progress', type: 'started' },
      team: { key: 'HBL' },
      priority: 2,
      priorityLabel: 'High',
      updatedAt: '',
    },
    sessionId: null,
  },
};

type RenderParams = {
  readonly record?: InboxRecord;
  readonly isSelected?: boolean;
  readonly isCursor?: boolean;
  readonly isNew?: boolean;
  readonly onSelect?: (record: InboxRecord) => void;
};

const renderRow = ({
  record = issue,
  isSelected = false,
  isCursor = false,
  isNew = false,
  onSelect = vi.fn(),
}: RenderParams = {}) =>
  render(
    <ListGrid label="Task items" columns={TASK_COLUMNS}>
      <InboxRow
        record={record}
        selected={isSelected}
        isCursor={isCursor}
        isNew={isNew}
        onSelect={onSelect}
      />
    </ListGrid>,
  );

afterEach(cleanup);

const cell = (key: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-list-grid-cell="${key}"]`);
  if (found === null) {
    throw new Error(`no ${key} cell`);
  }
  return found;
};

describe('InboxRow new dot', () => {
  it('draws a 6 px dot named New before the title of an arrival, and none otherwise', () => {
    renderRow({ isNew: true });

    const dot = within(cell('title')).getByRole('img', { name: 'New' });
    expect(dot.hasAttribute('data-task-new')).toBe(true);
    within(cell('title')).getByText(issue.title);
    cleanup();

    renderRow();

    expect(within(cell('title')).queryByRole('img', { name: 'New' })).toBeNull();
  });
});

describe('InboxRow', () => {
  it('fills every column of the shared grid: source, key, title, status, priority, age', () => {
    renderRow();

    const option = screen.getByRole('option', {
      name: 'HBL-412 Ledger export times out over 10k rows, In progress, High priority',
    });
    const cells = Array.from(option.querySelectorAll('[data-list-grid-cell]')).map((node) =>
      node.getAttribute('data-list-grid-cell'),
    );
    expect(cells).toEqual(['source', 'key', 'title', 'status', 'priority', 'updated']);
    expect(cell('key').textContent).toBe('HBL-412');
    within(cell('status')).getByRole('img', { name: 'Status: In progress' });
    within(cell('priority')).getByRole('img', { name: 'Priority: High' });
    expect(cell('updated').textContent).toBe('2h ago');
  });

  it('says what a status or priority glyph means in a tooltip on hover', () => {
    vi.useFakeTimers();
    try {
      renderRow();

      fireEvent.mouseEnter(within(cell('status')).getByRole('img'));
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByRole('tooltip').textContent).toBe('Status: In progress');
      fireEvent.mouseLeave(within(cell('status')).getByRole('img'));
      act(() => {
        vi.advanceTimersByTime(1_000);
      });

      fireEvent.mouseEnter(within(cell('priority')).getByRole('img'));
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByRole('tooltip').textContent).toBe('Priority: High');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names a thread with no status by its title alone', () => {
    renderRow({
      record: {
        ...issue,
        provider: 'slack',
        identifier: '#payments',
        stateLabel: 'Open',
        kind: 'thread',
        payload: {
          provider: 'slack',
          kind: 'thread',
          channel: { id: 'C1', name: 'payments', isMember: true, topic: null, memberCount: 1 },
          head: {
            ts: '1',
            threadTs: '1',
            userId: null,
            botId: null,
            text: 'Ledger export times out over 10k rows',
            subtype: null,
            replyCount: 1,
            replyUserCount: 1,
            postedAt: null,
            latestReplyAt: null,
            reactions: [],
          },
          sessionId: null,
        },
      },
    });

    screen.getByRole('option', { name: '#payments Ledger export times out over 10k rows' });
    expect(cell('status').childElementCount).toBe(0);
  });

  it('keeps an empty priority cell for a source without priorities, so columns stay aligned', () => {
    renderRow({
      record: {
        ...issue,
        provider: 'github',
        payload: {
          provider: 'github',
          kind: 'issue',
          issue: {
            number: 512,
            title: 'Export button stays disabled',
            body: '',
            url: '',
            state: 'OPEN',
            labels: [],
            updatedAt: '',
          },
          sessionId: null,
        },
      },
    });

    expect(cell('priority').childElementCount).toBe(0);
  });

  it('marks a cursor row quietly: not selected, only the cursor mark', () => {
    renderRow({ isCursor: true });

    const option = screen.getByRole('option');
    expect(option.getAttribute('aria-selected')).toBe('false');
    expect(option.getAttribute('data-cursor')).toBe('true');
  });

  it('is one button: a click selects it, and it holds no buttons of its own', () => {
    const onSelect = vi.fn();
    renderRow({ onSelect, isSelected: true });

    const option = screen.getByRole('option');
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(within(option).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(issue);
  });
});
