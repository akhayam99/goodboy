import { describe, expect, it } from 'vitest';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import { groupConversationsByFile } from './groupConversationsByFile';

const row = ({
  threadId,
  path,
  line,
  createdAt = 1,
}: {
  readonly threadId: string;
  readonly path: string | null;
  readonly line: number | null;
  readonly createdAt?: number;
}): ResolveQueueRow =>
  ({
    thread: { threadId, createdAt },
    reviewerNote:
      path === null
        ? null
        : { body: 'Body', author: 'reviewer', createdAtMs: 1, location: null, path, line },
  }) as unknown as ResolveQueueRow;

describe('groupConversationsByFile', () => {
  it('groups by file, orders files by path and comments by line, and puts file-less ones last', () => {
    const groups = groupConversationsByFile({
      rows: [
        row({ threadId: 'metrics', path: 'src/webhooks/metrics.ts', line: 18 }),
        row({ threadId: 'general', path: null, line: null }),
        row({ threadId: 'jitter', path: 'src/webhooks/retryPolicy.ts', line: 61 }),
        row({ threadId: 'cap', path: 'src/webhooks/retryPolicy.ts', line: 42 }),
      ],
    });

    expect(groups.map((group) => group.path)).toEqual([
      'src/webhooks/metrics.ts',
      'src/webhooks/retryPolicy.ts',
      null,
    ]);
    expect(groups[1]?.rows.map((entry) => entry.thread.threadId)).toEqual(['cap', 'jitter']);
  });

  it('orders two comments on the same line by age', () => {
    const [group] = groupConversationsByFile({
      rows: [
        row({ threadId: 'late', path: 'src/a.ts', line: 3, createdAt: 9 }),
        row({ threadId: 'early', path: 'src/a.ts', line: 3, createdAt: 2 }),
      ],
    });

    expect(group?.rows.map((entry) => entry.thread.threadId)).toEqual(['early', 'late']);
  });
});
