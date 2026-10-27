// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import { firstUnseenRowKeyOf } from './firstUnseenRowKeyOf';

const RUN = brandId<ProviderRunId>({ value: 'run-ledger' });

const SEEN_UNTIL = Date.parse('2026-10-18T10:00:00.000Z');

type AtParams = {
  readonly minute: number;
};

const at = ({ minute }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(SEEN_UNTIL + minute * 60_000).toISOString() });

type UserParams = AtParams & {
  readonly key: string;
};

const userRow = ({ key, minute }: UserParams): ConversationRow => ({
  kind: 'item',
  key,
  item: { kind: 'user_text', key, text: 'Check the ledger export', at: at({ minute }) },
});

const replyRow = ({ key }: { readonly key: string }): ConversationRow => ({
  kind: 'item',
  key,
  item: { kind: 'assistant_text', key, text: 'The export is balanced.', runId: RUN },
});

const usageRow = ({ key, minute }: UserParams): ConversationRow => ({
  kind: 'item',
  key,
  item: {
    kind: 'usage',
    key,
    runId: RUN,
    at: at({ minute }),
    usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimatedCostUsd: 0 },
  },
});

describe('firstUnseenRowKeyOf', () => {
  it('marks the row after the last turn the reader saw, when a later turn ended while away', () => {
    const rows = [
      userRow({ key: 'user-1', minute: -30 }),
      replyRow({ key: 'reply-1' }),
      usageRow({ key: 'usage-1', minute: -25 }),
      userRow({ key: 'user-2', minute: -5 }),
      replyRow({ key: 'reply-2' }),
      usageRow({ key: 'usage-2', minute: 20 }),
    ];

    expect(firstUnseenRowKeyOf({ rows, sinceMs: SEEN_UNTIL })).toBe('reply-2');
  });

  it('marks a whole new turn that started after the reader left', () => {
    const rows = [
      userRow({ key: 'user-1', minute: -30 }),
      usageRow({ key: 'usage-1', minute: -25 }),
      userRow({ key: 'user-2', minute: 10 }),
      replyRow({ key: 'reply-2' }),
    ];

    expect(firstUnseenRowKeyOf({ rows, sinceMs: SEEN_UNTIL })).toBe('user-2');
  });

  it('marks nothing when everything was seen, when nothing was seen, or without a boundary', () => {
    const seen = [
      userRow({ key: 'user-1', minute: -30 }),
      usageRow({ key: 'usage-1', minute: -25 }),
    ];
    const unseen = [userRow({ key: 'user-1', minute: 5 }), usageRow({ key: 'usage-1', minute: 6 })];

    expect(firstUnseenRowKeyOf({ rows: seen, sinceMs: SEEN_UNTIL })).toBeNull();
    expect(firstUnseenRowKeyOf({ rows: unseen, sinceMs: SEEN_UNTIL })).toBeNull();
    expect(firstUnseenRowKeyOf({ rows: seen, sinceMs: null })).toBeNull();
    expect(firstUnseenRowKeyOf({ rows: [], sinceMs: SEEN_UNTIL })).toBeNull();
  });
});
