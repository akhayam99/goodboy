import { describe, expect, it } from 'vitest';
import { failedReadsOf } from './failedReadsOf';

describe('failedReadsOf', () => {
  it('has no error when every read worked', () => {
    expect(
      failedReadsOf({
        reads: [
          { label: 'pull requests', error: null },
          { label: 'review throughput', error: null },
        ],
      }),
    ).toEqual({ labels: [], error: null });
  });

  it('names only the reads that failed and keeps the first error', () => {
    const first = new Error('rate limited');
    const result = failedReadsOf({
      reads: [
        { label: 'pull requests', error: first },
        { label: 'review throughput', error: null },
        { label: 'linked issues', error: new Error('offline') },
      ],
    });
    expect(result.labels).toEqual(['pull requests', 'linked issues']);
    expect(result.error).toBe(first);
  });
});
