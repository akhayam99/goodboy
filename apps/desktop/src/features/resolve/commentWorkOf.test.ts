// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import type { ResolveWord } from './commentProjection';
import { commentWorkOf } from './commentWorkOf';

const RUN_AGENT = agentIdOf({ value: 'agent-run' });
const OWN_AGENT = agentIdOf({ value: 'agent-own' });

type EntryParams = {
  readonly threadId: string;
  readonly resolveWord?: ResolveWord;
  readonly isQueued?: boolean;
  readonly createdAt?: number | null;
  readonly agentId?: AgentId;
};

const entryOf = ({
  threadId,
  resolveWord = 'working',
  isQueued = false,
  createdAt = null,
  agentId = RUN_AGENT,
}: EntryParams) => ({
  threadId,
  resolveWord,
  isQueued,
  row: { attempt: createdAt === null ? null : { agentId, createdAt } },
});

describe('commentWorkOf', () => {
  it('reads Fixing for the comment in work and Queued with its place for the rest', () => {
    const works = commentWorkOf({
      entries: [
        entryOf({ threadId: 'config', resolveWord: 'to_review', createdAt: 1 }),
        entryOf({ threadId: 'idempotency', isQueued: true }),
        entryOf({ threadId: 'metrics', createdAt: 2 }),
        entryOf({ threadId: 'retry', isQueued: true, createdAt: 3 }),
      ],
      runThreadIds: ['config', 'metrics', 'idempotency', 'retry'],
      runAgentId: RUN_AGENT,
    });

    expect(works.get('config')).toBeUndefined();
    expect(works.get('metrics')).toEqual({
      state: 'fixing',
      detail: null,
      agentId: RUN_AGENT,
      batchSize: 4,
    });
    expect(works.get('retry')).toEqual({
      state: 'queued',
      detail: '2nd in this fix',
      agentId: RUN_AGENT,
      batchSize: 4,
    });
    expect(works.get('idempotency')?.detail).toBe('3rd in this fix');
  });

  it('stops a queued comment through the agent of the fix, never its own unstarted one', () => {
    const works = commentWorkOf({
      entries: [
        entryOf({ threadId: 'idempotency', isQueued: true, createdAt: 4, agentId: OWN_AGENT }),
      ],
      runThreadIds: ['idempotency'],
      runAgentId: RUN_AGENT,
    });

    expect(works.get('idempotency')?.agentId).toBe(RUN_AGENT);
  });

  it('keeps a single fix outside the run on its own agent, with no place', () => {
    const works = commentWorkOf({
      entries: [entryOf({ threadId: 'config', createdAt: 5, agentId: OWN_AGENT })],
      runThreadIds: [],
      runAgentId: null,
    });

    expect(works.get('config')).toEqual({
      state: 'fixing',
      detail: null,
      agentId: OWN_AGENT,
      batchSize: 1,
    });
  });

  it('counts the place from 1st when nothing of the fix has started yet', () => {
    const works = commentWorkOf({
      entries: [
        entryOf({ threadId: 'config', isQueued: true }),
        entryOf({ threadId: 'metrics', isQueued: true }),
      ],
      runThreadIds: ['config', 'metrics'],
      runAgentId: RUN_AGENT,
    });

    expect([works.get('config')?.detail, works.get('metrics')?.detail]).toEqual([
      '1st in this fix',
      '2nd in this fix',
    ]);
  });
});
