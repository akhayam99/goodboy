import { describe, expect, it } from 'vitest';
import { EMPTY_USER_FACTS } from '@goodboy/core/auto';
import type { AutoOutboxRow } from '@goodboy/db';
import { brandId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import { aDelegation, aTree } from '../../../features/auto/testing/autoViewFixtures';
import { readMessagesOf } from './readMessagesOf';

type RowParams = {
  readonly id: string;
  readonly text: string;
  readonly origin?: string;
  readonly userText?: string;
  readonly createdAt?: number;
  readonly turn?: number;
  readonly generation?: number;
};

const rowOf = ({
  id,
  text,
  origin,
  userText,
  createdAt = 100,
  turn = 3,
  generation = 1,
}: RowParams): AutoOutboxRow => {
  const payload = {
    kind: 'user',
    text,
    facts: EMPTY_USER_FACTS,
    ...(origin !== undefined && { origin }),
    ...(userText !== undefined && { userText }),
    delivery: { text, rowIds: [id], turn },
  };
  return {
    id: brandId<AutoOutboxId>({ value: id }),
    treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
    generation,
    kind: 'user',
    joinKey: `user:${id}`,
    payload,
    payloadJson: JSON.stringify(payload),
    state: 'accepted',
    claimedBy: null,
    claimExpiresAt: null,
    acceptedRunId: 'run-1',
    droppedReason: null,
    createdAt,
  };
};

const WORKING = [
  {
    ...aDelegation({ key: 'implementer', role: 'implementer', state: 'running' }),
    generation: 1,
    createdAt: 10,
  },
];

const readOf = (rows: ReadonlyArray<AutoOutboxRow>) =>
  readMessagesOf({ tree: aTree({ phase: 'deciding' }), accepted: rows, delegations: WORKING });

describe('readMessagesOf', () => {
  it('keeps the words of an operator row as typed', () => {
    const rows = [
      rowOf({
        id: 'r1',
        origin: 'operator',
        userText: 'rename the guard',
        text: 'Denied Read. rename the guard',
      }),
    ];

    expect(readOf(rows)).toEqual([
      { rowId: 'r1', createdAt: 100, text: 'rename the guard', turn: 3 },
    ]);
  });

  it('keeps only the words of a denial reason, with no Denied prefix', () => {
    const rows = [
      rowOf({
        id: 'r1',
        origin: 'permission',
        userText: 'use the ledger-core client',
        text: 'Denied Grep. use the ledger-core client',
      }),
    ];

    expect(readOf(rows).map((message) => message.text)).toEqual(['use the ledger-core client']);
  });

  it.each([
    ['permission', 'Permission for Grep is now granted.\nRetry the tool call that was blocked.'],
    ['continue', 'Continue the Implementer that stopped (delegation d1) from where it left off.'],
    ['answers', '<<oq-answers>>\nQ: ok\n<</oq-answers>>'],
    ['system', 'Adopt the run of notify-relay.'],
  ])('leaves a %s row out of the notes', (origin, text) => {
    expect(readOf([rowOf({ id: 'r1', origin, text })])).toEqual([]);
  });

  it('leaves out a row with an origin it does not know', () => {
    expect(
      readOf([rowOf({ id: 'r1', origin: 'robot', userText: 'hello', text: 'hello' })]),
    ).toEqual([]);
  });

  it('leaves out an operator row with no words', () => {
    expect(readOf([rowOf({ id: 'r1', origin: 'operator', userText: '  ', text: 'x' })])).toEqual(
      [],
    );
  });

  it('shows no note for a row written before origin existed', () => {
    const rows = [
      rowOf({ id: 'old-note', text: 'Denied Read. keep the export as it is', createdAt: 100 }),
      rowOf({ id: 'old-plain', text: 'Also cover the batch endpoint', createdAt: 120 }),
    ];

    expect(readOf(rows)).toEqual([]);
  });

  it('keeps two Leads apart by generation', () => {
    const rows = [
      rowOf({ id: 'r1', origin: 'operator', userText: 'first', text: 'first', generation: 1 }),
      rowOf({ id: 'r2', origin: 'operator', userText: 'second', text: 'second', generation: 2 }),
    ];

    expect(readOf(rows).map((message) => message.rowId)).toEqual(['r1']);
  });
});
