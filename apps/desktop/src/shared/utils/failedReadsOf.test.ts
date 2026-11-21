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

  it('keeps the error itself when one read failed', () => {
    const only = new Error('rate limited');
    const result = failedReadsOf({
      reads: [
        { label: 'pull requests', error: only },
        { label: 'review throughput', error: null },
      ],
    });
    expect(result.labels).toEqual(['pull requests']);
    expect(result.error).toBe(only);
  });

  it('names every failed read with its own message when several failed', () => {
    const result = failedReadsOf({
      reads: [
        { label: 'pull requests', error: new Error('rate limited') },
        { label: 'review throughput', error: null },
        { label: 'linked issues', error: new Error('offline') },
      ],
    });
    expect(result.labels).toEqual(['pull requests', 'linked issues']);
    expect(result.error?.message).toBe('pull requests: rate limited; linked issues: offline');
  });
});
