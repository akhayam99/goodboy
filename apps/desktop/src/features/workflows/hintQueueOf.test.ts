// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import { hintQueueOf } from './hintQueueOf';

const AT = brandId<IsoDateTime>({ value: '2026-11-01T10:00:00.000Z' });

const run = aWorkflowRun({
  orchestratorHints: [
    {
      id: 'read',
      text: 'Read',
      createdAt: AT,
      consumedAt: AT,
    },
    { id: 'reading', text: 'Reading', createdAt: AT },
    { id: 'queued', text: 'Queued', createdAt: AT },
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
