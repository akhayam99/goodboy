import { describe, expect, it } from 'vitest';
import type { QueuedRow } from '../../chat/queuedMessages/queuedRow';
import type { AutoReadMessage } from '../../../store/slices/auto-view/state';
import { noteNodesOf } from './noteNodesOf';

const row = (overrides: Partial<QueuedRow>): QueuedRow => ({
  id: 'q1',
  source: 'agent',
  content: 'Also cover the batch endpoint',
  images: [],
  imageCount: 0,
  override: undefined,
  status: 'queued',
  statusText: 'Waits for this reply',
  reason: null,
  action: 'sendNow',
  ...overrides,
});

const READ: ReadonlyArray<AutoReadMessage> = [
  { rowId: 'r1', createdAt: 40, text: 'Keep the ledger export as it is', turn: 3 },
];

describe('noteNodesOf', () => {
  it('makes a queued row a Not read yet node with both actions', () => {
    const { nodes, timed } = noteNodesOf({
      rows: [row({})],
      createdAtById: new Map([['q1', 50]]),
      read: [],
    });
    expect(nodes).toEqual([
      {
        id: 'q1',
        createdAt: 50,
        text: 'Also cover the batch endpoint',
        word: 'Not read yet',
        canEdit: true,
        canRemove: true,
      },
    ]);
    expect(timed).toEqual([{ id: 'q1', createdAt: 50 }]);
  });

  it('names a row that was not delivered Not read yet with both actions', () => {
    const { nodes } = noteNodesOf({
      rows: [row({ status: 'notDelivered' })],
      createdAtById: new Map(),
      read: [],
    });
    expect(nodes[0]).toMatchObject({ word: 'Not read yet', canEdit: true, canRemove: true });
  });

  it('makes a read note a node with its turn and no actions', () => {
    const { nodes, timed } = noteNodesOf({
      rows: [row({})],
      createdAtById: new Map([['q1', 50]]),
      read: READ,
    });
    expect(nodes[0]).toEqual({
      id: 'r1',
      createdAt: 40,
      text: 'Keep the ledger export as it is',
      word: 'Read at turn 3',
      canEdit: false,
      canRemove: false,
    });
    expect(timed).toEqual([
      { id: 'r1', createdAt: 40 },
      { id: 'q1', createdAt: 50 },
    ]);
  });

  it('takes the actions away while a row is sending', () => {
    const { nodes } = noteNodesOf({
      rows: [row({ status: 'sending' })],
      createdAtById: new Map(),
      read: [],
    });
    expect(nodes[0]).toMatchObject({ canEdit: false, canRemove: false });
  });

  it('leaves no node for a row that is gone', () => {
    expect(noteNodesOf({ rows: [], createdAtById: new Map(), read: [] }).nodes).toEqual([]);
  });
});
