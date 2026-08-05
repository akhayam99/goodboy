import { describe, expect, it } from 'vitest';
import { bitbucketCheckConclusion } from './bitbucketCheckConclusion';
import { bitbucketCheckRuns } from './bitbucketCheckRuns';
import type { BitbucketStatus } from './client';

const status = (overrides: Partial<BitbucketStatus> = {}): BitbucketStatus => ({
  key: 'PIPELINE',
  name: 'build',
  state: 'SUCCESSFUL',
  url: 'https://bitbucket.org/acme/rocket/pipelines/1',
  description: null,
  refname: null,
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T10:02:00Z',
  ...overrides,
});

describe('bitbucketCheckConclusion', () => {
  it.each([
    ['SUCCESSFUL', 'success'],
    ['FAILED', 'failure'],
    ['INPROGRESS', 'pending'],
    ['STOPPED', 'cancelled'],
  ] as const)('maps %s to %s', (state, expected) => {
    expect(bitbucketCheckConclusion({ state })).toBe(expected);
  });
});

describe('bitbucketCheckRuns', () => {
  it('turns build statuses into check runs with a duration', () => {
    const [run] = bitbucketCheckRuns({ statuses: [status()] });
    expect(run).toEqual({
      name: 'build',
      conclusion: 'success',
      detailsUrl: 'https://bitbucket.org/acme/rocket/pipelines/1',
      durationMs: 120000,
    });
  });

  it('falls back to the status key when the name is empty', () => {
    const [run] = bitbucketCheckRuns({ statuses: [status({ name: '' })] });
    expect(run?.name).toBe('PIPELINE');
  });

  it('reports no duration when the timestamps are unusable', () => {
    const [run] = bitbucketCheckRuns({ statuses: [status({ updatedOn: 'not-a-date' })] });
    expect(run?.durationMs).toBeNull();
  });
});
