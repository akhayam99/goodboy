import { describe, expect, it } from 'vitest';
import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import { resolveQueueCounts } from './resolveQueueCounts';

const rowOf = ({ status }: { readonly status: ResolveQueueStatus }): ResolveQueueRow =>
  ({ status }) as unknown as ResolveQueueRow;

describe('resolveQueueCounts', () => {
  it('reads zero on an empty queue instead of leaving the header blank', () => {
    expect(resolveQueueCounts({ rows: [] })).toEqual({
      queued: 0,
      working: 0,
      question: 0,
      failed: 0,
      published: 0,
    });
  });

  it('separates what waits on you, what runs, what asks and what ended', () => {
    const rows = [
      rowOf({ status: 'fix_ready' }),
      rowOf({ status: 'reply_ready' }),
      rowOf({ status: 'no_change' }),
      rowOf({ status: 'ready_to_push' }),
      rowOf({ status: 'working' }),
      rowOf({ status: 'agent_asked' }),
      rowOf({ status: 'run_failed' }),
      rowOf({ status: 'run_stopped' }),
      rowOf({ status: 'delivery_failed' }),
      rowOf({ status: 'pushed' }),
      rowOf({ status: 'wont_fix_sent' }),
    ];

    expect(resolveQueueCounts({ rows })).toEqual({
      queued: 4,
      working: 1,
      question: 1,
      failed: 3,
      published: 2,
    });
  });

  it('keeps a parked comment out of every count', () => {
    expect(resolveQueueCounts({ rows: [rowOf({ status: 'later' })] })).toEqual({
      queued: 0,
      working: 0,
      question: 0,
      failed: 0,
      published: 0,
    });
  });

  it('counts an unsent refusal as work still queued, never as published', () => {
    const counts = resolveQueueCounts({ rows: [rowOf({ status: 'wont_fix' })] });

    expect(counts.queued).toBe(1);
    expect(counts.published).toBe(0);
  });
});
