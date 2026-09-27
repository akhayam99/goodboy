// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn() }));
vi.mock('../../../../shared/lib/editor', () => ({ openUrl }));

import { InboxStarredGroup } from './InboxStarredGroup';

afterEach(cleanup);

const issue = (patch: Partial<StarredIssue>): StarredIssue => ({
  workspaceId: 'ws-harborline' as WorkspaceId,
  provider: 'jira',
  externalId: 'j-142',
  identifier: 'NW-142',
  container: null,
  title: 'Reconcile the payout ledger',
  url: 'https://northwind.atlassian.net/browse/NW-142',
  state: 'open',
  stateLabel: 'In Progress',
  starredAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
  refreshedAt: null,
  ...patch,
});

const record = {
  key: 'jira:issue:j-142',
  provider: 'jira',
  kind: 'issue',
  identifier: 'NW-142',
  title: 'Reconcile the payout ledger',
  state: 'open',
  stateLabel: 'In Progress',
  updatedAt: '2026-09-25T10:00:00Z',
  url: 'https://northwind.atlassian.net/browse/NW-142',
  context: 'Task',
  payload: { provider: 'jira', kind: 'issue', sessionId: null, issue: {} },
} as unknown as InboxRecord;

const handlers = () => ({
  onSelect: vi.fn(),
  onUnstar: vi.fn(),
  onUnstarClosed: vi.fn(),
  onUndoUnstar: vi.fn(),
});

describe('InboxStarredGroup', () => {
  it('lists starred issues with a lit star and unstars from it', () => {
    const on = handlers();
    render(
      <InboxStarredGroup
        rows={[{ issue: issue({}), record }]}
        selectedKey={null}
        unstarredCount={0}
        {...on}
      />,
    );

    expect(screen.getByText('Starred')).toBeDefined();
    const star = screen.getByRole('button', { name: 'Star NW-142' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(star);
    expect(on.onUnstar).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Unstar closed' })).toBeNull();
  });

  it('offers Unstar closed once one is closed, then Undo', () => {
    const on = handlers();
    const { rerender } = render(
      <InboxStarredGroup
        rows={[
          { issue: issue({}), record },
          {
            issue: issue({ externalId: 'j-44', identifier: 'OPS-44', state: 'done' }),
            record: null,
          },
        ]}
        selectedKey={null}
        unstarredCount={0}
        {...on}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unstar closed' }));
    expect(on.onUnstarClosed).toHaveBeenCalled();

    rerender(
      <InboxStarredGroup
        rows={[{ issue: issue({}), record }]}
        selectedKey={null}
        unstarredCount={1}
        {...on}
      />,
    );
    expect(screen.getByText('Unstarred 1 closed issue')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(on.onUndoUnstar).toHaveBeenCalled();
  });

  it('says when a starred issue cannot be reached anymore, from the last copy', () => {
    render(
      <InboxStarredGroup
        rows={[{ issue: issue({ identifier: 'NW-230', state: 'missing' }), record: null }]}
        selectedKey={null}
        unstarredCount={0}
        {...handlers()}
      />,
    );

    expect(screen.getByText("Can't reach NW-230 anymore")).toBeDefined();
    expect(screen.getByText('Reconcile the payout ledger')).toBeDefined();
  });

  it('opens the detail panel from the snapshot, not the tool URL, for a star not refreshed yet', () => {
    const on = handlers();
    render(
      <InboxStarredGroup
        rows={[{ issue: issue({}), record: null }]}
        selectedKey={null}
        unstarredCount={0}
        {...on}
      />,
    );

    fireEvent.click(screen.getByTitle('Reconcile the payout ledger'));

    expect(openUrl).not.toHaveBeenCalled();
    expect(on.onSelect).toHaveBeenCalledTimes(1);
    const [selected] = on.onSelect.mock.calls[0] as [InboxRecord];
    expect(selected.identifier).toBe('NW-142');
    expect(selected.title).toBe('Reconcile the payout ledger');
    expect(selected.provider).toBe('jira');

    fireEvent.click(screen.getByTitle('Open NW-142 in Jira'));
    expect(openUrl).toHaveBeenCalledWith('https://northwind.atlassian.net/browse/NW-142');
  });
});
