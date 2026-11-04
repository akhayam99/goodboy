import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import type { TakenEcho, TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { ConversationRow } from '../../utils/conversationRows';
import { rowsByDeliveryOf } from './rowsByDeliveryOf';

const SENT_AT = Date.UTC(2026, 9, 20, 12, 10, 0);
const at = ({ offsetMs }: { readonly offsetMs: number }) =>
  brandId<IsoDateTime>({ value: new Date(SENT_AT + offsetMs).toISOString() });

const itemRow = (item: TranscriptItem): ConversationRow => ({ kind: 'item', key: item.key, item });

const echo = ({ key, text, offsetMs, outboxId }: EchoParams): ConversationRow =>
  itemRow({
    kind: 'user_text',
    key,
    text,
    isOperatorEcho: true,
    ...(outboxId !== undefined && { outboxId }),
    at: at({ offsetMs }),
  });

type EchoParams = {
  readonly key: string;
  readonly text: string;
  readonly offsetMs: number;
  readonly outboxId?: string;
};

type DeliveryParams = {
  readonly key: string;
  readonly text: string;
  readonly outboxIds?: ReadonlyArray<string>;
};

const delivery = ({ key, text, outboxIds }: DeliveryParams) =>
  itemRow({
    kind: 'auto_delivery',
    key,
    runId: brandId<ProviderRunId>({ value: 'run-1' }),
    text,
    ...(outboxIds !== undefined && { outboxIds }),
    at: at({ offsetMs: 60_000 }),
  });

const reply = (key: string): ConversationRow => itemRow({ kind: 'assistant_text', key, text: key });

const keysOf = (rows: ReadonlyArray<ConversationRow>) => rows.map((row) => row.key);

const TEXT = 'Keep the retry window at 30 seconds.';

const takes = (
  echoes: ReadonlyArray<Pick<TakenEcho, 'text' | 'sentAtMs'>>,
): TranscriptInsertion => ({
  key: 'auto-pending',
  beforeMs: null,
  node: null,
  takesOver: echoes.map((echo, index) => ({ ...echo, key: `row-${index}`, line: null })),
});

describe('echo rows of messages Auto has not read', () => {
  it('takes the echo of a waiting message out of the transcript', () => {
    const rows = [reply('planner'), echo({ key: 'u1', text: TEXT, offsetMs: 500 })];

    const placed = rowsByDeliveryOf({
      rows,
      insertions: [takes([{ text: TEXT, sentAtMs: SENT_AT }])],
    });

    expect(keysOf(placed)).toEqual(['planner']);
  });

  it('takes one echo per waiting message, in send order, and keeps an older identical one', () => {
    const rows = [
      echo({ key: 'old', text: TEXT, offsetMs: -3_600_000 }),
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      echo({ key: 'u2', text: TEXT, offsetMs: 9_000 }),
    ];

    const placed = rowsByDeliveryOf({
      rows,
      insertions: [
        takes([
          { text: TEXT, sentAtMs: SENT_AT },
          { text: TEXT, sentAtMs: SENT_AT + 8_000 },
        ]),
      ],
    });

    expect(keysOf(placed)).toEqual(['old']);
  });

  it('puts a delivered echo at its delivery, after the rows that came before it was read', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      reply('planner'),
      delivery({
        key: 'd1',
        text: `MESSAGES FROM THE USER, OLDEST FIRST\n1. The user wrote:\n${TEXT}`,
      }),
    ];

    const placed = rowsByDeliveryOf({ rows, insertions: [] });

    expect(keysOf(placed)).toEqual(['planner', 'u1', 'd1']);
  });

  it('keeps send order when the second echo already sits next to the delivery', () => {
    const second = 'Add a test for the second retry.';
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      reply('planner'),
      echo({ key: 'u2', text: second, offsetMs: 900 }),
      delivery({ key: 'd1', text: `${TEXT}\n${second}` }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows, insertions: [] }))).toEqual([
      'planner',
      'u1',
      'u2',
      'd1',
    ]);
  });

  it('takes the echo that carries the id of the waiting message, not an older identical one', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      echo({ key: 'u2', text: TEXT, offsetMs: 900, outboxId: 'row-b' }),
    ];

    const placed = rowsByDeliveryOf({
      rows,
      insertions: [
        {
          key: 'auto-pending',
          beforeMs: null,
          node: null,
          takesOver: [{ key: 'row-b', text: TEXT, sentAtMs: SENT_AT, line: null }],
        },
      ],
    });

    expect(keysOf(placed)).toEqual(['u1']);
  });

  it('does not hide an echo already delivered when the same text is sent again at once', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      delivery({ key: 'd1', text: `1. The user wrote:\n${TEXT}` }),
      echo({ key: 'u2', text: TEXT, offsetMs: 1_000 }),
    ];

    const placed = rowsByDeliveryOf({
      rows,
      insertions: [takes([{ text: TEXT, sentAtMs: SENT_AT + 900 }])],
    });

    expect(keysOf(placed)).toEqual(['u1', 'd1']);
  });

  it('places each echo at the delivery that lists its id, even when texts repeat', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      echo({ key: 'u2', text: TEXT, offsetMs: 900, outboxId: 'row-b' }),
      reply('planner'),
      delivery({ key: 'd1', text: 'results mention nothing', outboxIds: ['row-b'] }),
      delivery({ key: 'd2', text: 'next turn', outboxIds: ['row-a'] }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows, insertions: [] }))).toEqual([
      'planner',
      'u2',
      'd1',
      'u1',
      'd2',
    ]);
  });

  it('ignores a delivery that only mentions the text when ids are known', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      reply('planner'),
      delivery({ key: 'd1', text: `RESULT: ${TEXT}`, outboxIds: ['row-z'] }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows, insertions: [] }))).toEqual(['u1', 'planner', 'd1']);
  });

  it('leaves an echo that already sits next to its delivery', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      delivery({ key: 'd1', text: `1. The user wrote:\n${TEXT}` }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows, insertions: [] }))).toEqual(['u1', 'd1']);
  });
});
