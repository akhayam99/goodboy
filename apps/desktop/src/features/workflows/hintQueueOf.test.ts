// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aWorkflowRun } from '@goodboy/types/testing';
import { hintQueueOf } from './hintQueueOf';

const run = aWorkflowRun({
  orchestratorHints: [
    {
      id: 'read',
      text: 'Read',
      createdAt: '2026-11-01T10:00:00.000Z',
      consumedAt: '2026-11-01T10:05:00.000Z',
    },
    { id: 'reading', text: 'Reading', createdAt: '2026-11-01T10:01:00.000Z' },
    { id: 'queued', text: 'Queued', createdAt: '2026-11-01T10:02:00.000Z' },
  ],
});

describe('hintQueueOf', () => {
  it('keeps the reading hint on the list and out of the count', () => {
    const queue = hintQueueOf({ run, readingIds: ['reading'] });

    expect(queue.waiting.map((hint) => hint.id)).toEqual(['reading', 'queued']);
    expect(queue.queuedCount).toBe(1);
  });

  it('counts every waiting hint when none is being read', () => {
    expect(hintQueueOf({ run, readingIds: [] }).queuedCount).toBe(2);
  });
});
