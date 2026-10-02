// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime } from '@goodboy/types';
import { agentFixture } from '../../__tests__/helpers/actionFixtures';
import { recheckParentOf } from './recheckParentOf';

const resolver = ({
  id,
  ordinal,
  threadIds,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
}) =>
  agentFixture({
    id: id as AgentId,
    ordinal,
    sourceKind: 'review_comment',
    sourceThreadIds: threadIds,
  });

describe('recheckParentOf', () => {
  it('hangs the recheck under the latest resolver that worked the thread', () => {
    const agents = [
      resolver({ id: 'first', ordinal: 1, threadIds: ['t1'] }),
      resolver({ id: 'second', ordinal: 2, threadIds: ['t1', 't2'] }),
      resolver({ id: 'other', ordinal: 3, threadIds: ['t3'] }),
    ];

    expect(recheckParentOf({ agents, threadId: 't1' })).toBe('second');
  });

  it('never picks an earlier recheck or a deleted resolver', () => {
    const agents = [
      resolver({ id: 'kept', ordinal: 1, threadIds: ['t1'] }),
      agentFixture({
        id: 'recheck' as AgentId,
        ordinal: 2,
        sourceKind: 'comment_recheck',
        sourceThreadIds: ['t1'],
      }),
      {
        ...resolver({ id: 'gone', ordinal: 3, threadIds: ['t1'] }),
        deletedAt: '2026-10-01T00:00:00.000Z' as IsoDateTime,
      },
    ];

    expect(recheckParentOf({ agents, threadId: 't1' })).toBe('kept');
  });

  it('leaves the recheck at the top when no resolver worked the thread', () => {
    expect(recheckParentOf({ agents: [], threadId: 't1' })).toBeNull();
  });
});
