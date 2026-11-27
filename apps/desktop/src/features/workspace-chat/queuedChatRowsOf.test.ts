import { describe, expect, it } from 'vitest';
import type { QueuedChatTurn } from '../../store/slices/chatQueue/types';
import { queuedChatRowsOf } from './queuedChatRowsOf';

const turn = (id: string, overrides: Partial<QueuedChatTurn> = {}): QueuedChatTurn => ({
  id,
  content: `message ${id}`,
  attachments: [],
  status: 'queued',
  failure: null,
  ...overrides,
});

describe('queuedChatRowsOf', () => {
  it('words every row as waiting for this reply while an answer streams', () => {
    const rows = queuedChatRowsOf({ queue: [turn('a'), turn('b')], isStreaming: true });

    expect(rows.map((row) => [row.id, row.status, row.statusText, row.action])).toEqual([
      ['a', 'queued', 'Waits for this reply', null],
      ['b', 'queued', 'Waits for this reply', null],
    ]);
  });

  it('offers Send now on the first row only once nothing streams', () => {
    const rows = queuedChatRowsOf({ queue: [turn('a'), turn('b')], isStreaming: false });

    expect(rows.map((row) => [row.statusText, row.action])).toEqual([
      ['Sends after your next reply', 'sendNow'],
      ['Sends after your next reply', null],
    ]);
  });

  it('draws a failed send as not delivered with its reason and Retry', () => {
    const [row] = queuedChatRowsOf({
      queue: [turn('a', { status: 'failed', failure: 'disk full' })],
      isStreaming: false,
    });

    expect(row).toMatchObject({
      status: 'notDelivered',
      statusText: 'Not delivered',
      reason: 'disk full',
      action: 'retry',
    });
  });

  it('counts the images of a message with no text', () => {
    const image = new File([new Uint8Array([1])], 'acme-trace.png', { type: 'image/png' });
    const [row] = queuedChatRowsOf({
      queue: [
        turn('a', {
          content: '',
          attachments: [
            { id: 'img', fileName: image.name, mimeType: image.type, blob: image, relPath: null },
          ],
        }),
      ],
      isStreaming: true,
    });

    expect(row).toMatchObject({ content: '', imageCount: 1 });
  });
});
