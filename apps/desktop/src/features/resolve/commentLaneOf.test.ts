// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import { commentLaneOf } from './commentLaneOf';
import { queueRowAt } from './testing/queueRow';

const BROAD =
  'This header should live in the layout. Follow the payouts route as the model: AppLayout owns the header. Write new components.';

type RowParams = {
  readonly threadId: string;
  readonly body: string;
  readonly stage?: ResolveStage;
};

const rowOf = ({ threadId, body, stage = 'new' }: RowParams): ResolveQueueRow => ({
  ...queueRowAt({ stage, threadId }),
  reviewerNote: {
    source: 'note',
    body,
    author: 'You',
    createdAtMs: 1,
    location: null,
    path: 'src/routes/ledger/LedgerPage.tsx',
    line: 24,
  },
});

const NO_RUNS: ReadonlySet<string> = new Set();

describe('commentLaneOf puts each open comment in one lane', () => {
  it('sends a small comment to the fix and a broad one to a run', () => {
    expect(
      commentLaneOf({
        row: rowOf({ threadId: 'note:typo', body: 'Typo here.' }),
        inRunThreadIds: NO_RUNS,
      }),
    ).toBe('fix');
    expect(
      commentLaneOf({
        row: rowOf({ threadId: 'note:layout', body: BROAD }),
        inRunThreadIds: NO_RUNS,
      }),
    ).toBe('run');
  });

  it('keeps a comment already in a run out of both, small or broad', () => {
    const inRunThreadIds = new Set(['note:typo', 'note:layout']);
    expect(
      commentLaneOf({ row: rowOf({ threadId: 'note:typo', body: 'Typo here.' }), inRunThreadIds }),
    ).toBe('in_run');
    expect(
      commentLaneOf({ row: rowOf({ threadId: 'note:layout', body: BROAD }), inRunThreadIds }),
    ).toBe('in_run');
  });

  it('gives no lane to a comment that is not open', () => {
    expect(
      commentLaneOf({
        row: rowOf({ threadId: 'note:working', body: BROAD, stage: 'working' }),
        inRunThreadIds: NO_RUNS,
      }),
    ).toBeNull();
  });

  it('sends a comment with no text to the fix', () => {
    expect(
      commentLaneOf({
        row: queueRowAt({ stage: 'new', threadId: 'PRRT_1' }),
        inRunThreadIds: NO_RUNS,
      }),
    ).toBe('fix');
  });
});
