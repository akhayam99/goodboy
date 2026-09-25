import { describe, expect, it } from 'vitest';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveUiState } from './resolveRowState';
import { selectionApproval } from './selectionApproval';

const row = ({
  threadId,
  status,
  proposalKind = 'fix',
}: {
  readonly threadId: string;
  readonly status: ResolveUiState;
  readonly proposalKind?: ResolveQueueRow['proposalKind'];
}): ResolveQueueRow =>
  ({ thread: { threadId }, status, proposalKind }) as unknown as ResolveQueueRow;

describe('selectionApproval', () => {
  it('approves only the selected proposals and counts the rest', () => {
    const rows = [
      row({ threadId: 'fix', status: 'ready' }),
      row({ threadId: 'reply', status: 'ready', proposalKind: 'reply_only' }),
      row({ threadId: 'empty', status: 'ready', proposalKind: 'none' }),
      row({ threadId: 'new', status: 'new' }),
      row({ threadId: 'unselected', status: 'ready' }),
    ];

    const result = selectionApproval({
      rows,
      threadIds: new Set(['fix', 'reply', 'empty', 'new']),
    });

    expect(result.approvable.map((entry) => entry.thread.threadId)).toEqual(['fix', 'reply']);
    expect(result.nothingToApprove).toBe(2);
  });
});
