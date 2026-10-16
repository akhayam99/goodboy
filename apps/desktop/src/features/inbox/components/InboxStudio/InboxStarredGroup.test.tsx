import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListGrid } from '@goodboy/ui';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';
import type { StarredRow } from '../../useInboxStars';
import { InboxStarredGroup } from './InboxStarredGroup';
import { TASK_COLUMNS } from './taskColumns';

afterEach(cleanup);

const issue = (patch: Partial<StarredIssue>): StarredIssue => ({
  workspaceId: 'ws-harborline' as WorkspaceId,
  provider: 'jira',
  externalId: 'j-142',
  identifier: 'NW-142',
  container: null,
  title: 'Reconcile the payout ledger',
  url: 'https://example.invalid/jira/NW-142',
  state: 'open',
  stateLabel: 'In Progress',
  starredAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
  refreshedAt: null,
  ...patch,
});

const record = (key: string, identifier: string): InboxRecord =>
  ({
    key,
    provider: 'jira',
    kind: 'issue',
    identifier,
    title: `Reconcile the payout ledger ${identifier}`,
    state: 'open',
    stateLabel: 'In Progress',
    updatedAt: '2026-09-25T10:00:00Z',
    url: '',
    context: 'Task',
    payload: { provider: 'jira', kind: 'issue', sessionId: null, issue: {} },
  }) as unknown as InboxRecord;

type RenderParams = {
  readonly rows: ReadonlyArray<StarredRow>;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly unstarredCount?: number;
};

const on = {
  onExpand: vi.fn(),
  onCollapse: vi.fn(),
  onSelect: vi.fn(),
  onActivate: vi.fn(),
  onUnstar: vi.fn(),
  onUnstarClosed: vi.fn(),
  onUndoUnstar: vi.fn(),
};

const renderGroup = ({ rows, records, unstarredCount = 0 }: RenderParams) =>
  render(
    <ListGrid label="Task items" columns={TASK_COLUMNS} isGrouped>
      <InboxStarredGroup
        rows={rows}
        records={records}
        isExpanded={false}
        selectedKey={null}
        cursorKey={null}
        unstarredCount={unstarredCount}
        {...on}
      />
    </ListGrid>,
  );

describe('InboxStarredGroup', () => {
  it('lists starred records first under one Starred label with their count', () => {
    renderGroup({
      rows: [{ issue: issue({}), record: record('jira:issue:j-142', 'NW-142') }],
      records: [record('jira:issue:j-142', 'NW-142')],
    });

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeDefined();
    expect(screen.getByRole('option', { name: /NW-142/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Unstar closed' })).toBeNull();
  });

  it('offers Unstar closed once one is closed, then Undo', () => {
    const rows = [
      { issue: issue({}), record: record('jira:issue:j-142', 'NW-142') },
      { issue: issue({ externalId: 'j-44', identifier: 'OPS-44', state: 'done' }), record: null },
    ];
    const view = renderGroup({ rows, records: [record('jira:issue:j-142', 'NW-142')] });

    fireEvent.click(screen.getByRole('button', { name: 'Unstar closed' }));
    expect(on.onUnstarClosed).toHaveBeenCalledOnce();

    view.unmount();
    renderGroup({ rows: rows.slice(0, 1), records: [], unstarredCount: 1 });

    expect(screen.getByText('Unstarred 1 closed issue')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(on.onUndoUnstar).toHaveBeenCalledOnce();
  });

  it('caps a long starred list at five rows', () => {
    const records = Array.from({ length: 7 }, (_, index) =>
      record(`jira:issue:${index}`, `NW-${index}`),
    );
    renderGroup({ rows: [], records });

    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show all' })).toBeDefined();
  });
});
