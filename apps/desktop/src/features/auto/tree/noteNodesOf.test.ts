import { describe, expect, it } from 'vitest';
import type { QueuedRow } from '../../chat/components/ChatInput/queuedRowsOf';
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
  it('makes a queued row a Queued node with both actions, switch off', () => {
    const { nodes, timed } = noteNodesOf({
      rows: [row({})],
      createdAtById: new Map([['q1', 50]]),
      isWork: false,
      read: [],
    });
    expect(nodes).toEqual([
      {
        id: 'q1',
        createdAt: 50,
        text: 'Also cover the batch endpoint',
        word: 'Queued',
        canEdit: true,
        canRemove: true,
      },
    ]);
    expect(timed).toEqual([{ id: 'q1', createdAt: 50 }]);
  });

  it('names a queued row Not read yet with both actions, switch on', () => {
    const { nodes } = noteNodesOf({
      rows: [row({ status: 'notDelivered' })],
      createdAtById: new Map(),
      isWork: true,
      read: [],
    });
    expect(nodes[0]).toMatchObject({ word: 'Not read yet', canEdit: true, canRemove: true });
  });

  it('makes a read note a node with its turn and no actions, switch on', () => {
    const { nodes, timed } = noteNodesOf({
      rows: [row({})],
      createdAtById: new Map([['q1', 50]]),
      isWork: true,
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

  it('shows no read note with the switch off', () => {
    const { nodes } = noteNodesOf({
      rows: [],
      createdAtById: new Map(),
      isWork: false,
      read: READ,
    });
    expect(nodes).toEqual([]);
  });

  it('takes the actions away while a row is sending', () => {
    const { nodes } = noteNodesOf({
      rows: [row({ status: 'sending' })],
      createdAtById: new Map(),
      isWork: true,
      read: [],
    });
    expect(nodes[0]).toMatchObject({ canEdit: false, canRemove: false });
  });

  it('leaves no node for a row that is gone', () => {
    expect(
      noteNodesOf({ rows: [], createdAtById: new Map(), isWork: true, read: [] }).nodes,
    ).toEqual([]);
  });
});
