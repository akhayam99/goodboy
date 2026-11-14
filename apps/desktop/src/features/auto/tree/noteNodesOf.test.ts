import { describe, expect, it } from 'vitest';
import type { QueuedRow } from '../../chat/components/ChatInput/queuedRowsOf';
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

describe('noteNodesOf', () => {
  it('makes a queued row a Queued node with both actions', () => {
    const { nodes, timed } = noteNodesOf({
      rows: [row({})],
      createdAtById: new Map([['q1', 50]]),
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

  it('takes the actions away while a row is sending', () => {
    const { nodes } = noteNodesOf({
      rows: [row({ status: 'sending' })],
      createdAtById: new Map(),
    });
    expect(nodes[0]).toMatchObject({ canEdit: false, canRemove: false });
  });

  it('leaves no node for a row that is gone', () => {
    expect(noteNodesOf({ rows: [], createdAtById: new Map() }).nodes).toEqual([]);
  });
});
