// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrDetail } from '@goodboy/types';
import { branchFactsOf, type BranchFacts } from './branchFactsOf';
import { branchDetailOf, needsBranchDetail } from './branchDetailOf';
import { aMountRow, aRequest } from './testing/aMountRow';

const NOW = Date.UTC(2026, 9, 18, 10, 30, 0);

type FactParams = {
  readonly checks: 'success' | 'failure' | 'pending';
  readonly isStale?: boolean;
  readonly state?: 'open' | 'merged';
};

const factOf = ({ checks, isStale = false, state = 'open' }: FactParams): BranchFacts => {
  const row = aMountRow({
    key: 'api',
    projectName: 'payments-api',
    branch: 'ak/eng-1190-tenant-limits',
    request: aRequest({ provider: 'github', number: 309, checks, state }),
  });
  const [fact] = branchFactsOf({
    rows: [row],
    fetchedAtByMountId: new Map([
      [row.mountId, new Date(NOW - (isStale ? 12 : 1) * 60_000).toISOString()],
    ]),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    now: NOW,
  });
  if (fact === undefined) {
    throw new Error('One row gives one fact.');
  }
  return fact;
};

const detailOf = ({ prNumber }: { readonly prNumber: number }): PrDetail => ({
  prNumber,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [
    { name: 'static-analysis', conclusion: 'failure', detailsUrl: null, durationMs: null },
    { name: 'unit-tests', conclusion: 'timed_out', detailsUrl: null, durationMs: null },
    { name: 'lint', conclusion: 'failure', detailsUrl: null, durationMs: null },
    { name: 'build', conclusion: 'success', detailsUrl: null, durationMs: null },
  ],
});

describe('needsBranchDetail', () => {
  it('reads only an open, fresh branch whose checks fail', () => {
    expect(needsBranchDetail({ fact: factOf({ checks: 'failure' }) })).toBe(true);
    expect(needsBranchDetail({ fact: factOf({ checks: 'success' }) })).toBe(false);
    expect(needsBranchDetail({ fact: factOf({ checks: 'failure', isStale: true }) })).toBe(false);
    expect(needsBranchDetail({ fact: factOf({ checks: 'failure', state: 'merged' }) })).toBe(false);
  });
});

describe('branchDetailOf', () => {
  it('names the first two failing checks and counts the rest', () => {
    const words = branchDetailOf({
      fact: factOf({ checks: 'failure' }),
      detail: detailOf({ prNumber: 309 }),
    });
    expect(words?.failingChecks).toEqual(['static-analysis', 'unit-tests', '1 more']);
    expect(words?.openThreads).toBe(0);
  });

  it('drops the detail of another pull request and an absent detail', () => {
    const fact = factOf({ checks: 'failure' });
    expect(branchDetailOf({ fact, detail: detailOf({ prNumber: 100 }) })).toBeNull();
    expect(branchDetailOf({ fact, detail: null })).toBeNull();
    expect(branchDetailOf({ fact, detail: undefined })).toBeNull();
  });
});
