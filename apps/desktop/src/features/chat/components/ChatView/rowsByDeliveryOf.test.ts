import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
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

describe('echo rows of messages Auto has not read', () => {
  it('draws no echo of a message that no delivery lists yet', () => {
    const rows = [
      reply('planner'),
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['planner']);
  });

  it('draws no echo of a withdrawn message, whatever the rows around it say', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      echo({ key: 'u2', text: TEXT, offsetMs: 900, outboxId: 'row-b' }),
      reply('planner'),
      delivery({ key: 'd1', text: 'next turn', outboxIds: ['row-b'] }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['planner', 'u2', 'd1']);
  });

  it('keeps the echo of a message Auto dropped, so its words stay in the chat', () => {
    const rows = [
      echo({ key: 'dropped', text: 'Cover chargebacks', offsetMs: 0, outboxId: 'row-1' }),
      echo({ key: 'waiting', text: 'And refunds', offsetMs: 1_000, outboxId: 'row-2' }),
    ];

    const shown = rowsByDeliveryOf({ rows, droppedEchoIds: ['row-1'] });

    expect(shown.map((row) => row.key)).toEqual(['dropped']);
  });

  it('keeps the echo of an older message that has no id', () => {
    const rows = [echo({ key: 'old', text: TEXT, offsetMs: -3_600_000 })];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['old']);
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

    const placed = rowsByDeliveryOf({ rows });

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

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['planner', 'u1', 'u2', 'd1']);
  });

  it('places each echo at the delivery that lists its id, even when texts repeat', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      echo({ key: 'u2', text: TEXT, offsetMs: 900, outboxId: 'row-b' }),
      reply('planner'),
      delivery({ key: 'd1', text: 'results mention nothing', outboxIds: ['row-b'] }),
      delivery({ key: 'd2', text: 'next turn', outboxIds: ['row-a'] }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['planner', 'u2', 'd1', 'u1', 'd2']);
  });

  it('does not seat an echo at a delivery that only mentions its text when ids are known', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500, outboxId: 'row-a' }),
      reply('planner'),
      delivery({ key: 'd1', text: `RESULT: ${TEXT}`, outboxIds: ['row-z'] }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['planner', 'd1']);
  });

  it('leaves an echo that already sits next to its delivery', () => {
    const rows = [
      echo({ key: 'u1', text: TEXT, offsetMs: 500 }),
      delivery({ key: 'd1', text: `1. The user wrote:\n${TEXT}` }),
    ];

    expect(keysOf(rowsByDeliveryOf({ rows }))).toEqual(['u1', 'd1']);
  });
});
