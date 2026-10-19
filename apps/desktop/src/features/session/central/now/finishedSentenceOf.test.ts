// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PullRequestChecks, PullRequestStateKind } from '@goodboy/types';
import { branchFactsOf } from '../branches/branchFactsOf';
import { aMountRow, aRequest } from '../branches/testing/aMountRow';
import { finishedSentenceOf } from './finishedSentenceOf';

const NOW = Date.UTC(2026, 9, 18, 10, 30, 0);

type FactsParams = {
  readonly provider?: 'github' | 'gitlab';
  readonly number?: number;
  readonly state?: PullRequestStateKind;
  readonly isDraft?: boolean;
  readonly checks?: PullRequestChecks;
  readonly minutesAgo?: number;
  readonly hasRequest?: boolean;
};

const factsOf = ({
  provider = 'github',
  number = 309,
  state = 'open',
  isDraft = false,
  checks = null,
  minutesAgo = 1,
  hasRequest = true,
}: FactsParams) => {
  const row = aMountRow({
    key: 'api',
    projectName: 'payments-api',
    branch: 'ak/eng-1190-tenant-limits',
    request: hasRequest ? aRequest({ provider, number, state, isDraft, checks }) : null,
  });
  return branchFactsOf({
    rows: [row],
    fetchedAtByMountId: new Map([[row.mountId, new Date(NOW - minutesAgo * 60_000).toISOString()]]),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    now: NOW,
  });
};

describe('finishedSentenceOf', () => {
  it('says checks passed and the request is ready for review', () => {
    expect(finishedSentenceOf({ facts: factsOf({ checks: 'success' }) })).toBe(
      'Checks passed on #309. Ready for review.',
    );
  });

  it('says a draft with passing checks is still a draft', () => {
    expect(
      finishedSentenceOf({
        facts: factsOf({ checks: 'success', state: 'draft', isDraft: true }),
      }),
    ).toBe('Checks passed on #309. Still a draft.');
  });

  it('says failing or running checks alone, never ready', () => {
    expect(finishedSentenceOf({ facts: factsOf({ checks: 'failure' }) })).toBe(
      'Checks failed on #309.',
    );
    expect(finishedSentenceOf({ facts: factsOf({ checks: 'pending' }) })).toBe(
      'Checks are running on #309.',
    );
  });

  it('names the request and its state when checks are unknown', () => {
    expect(finishedSentenceOf({ facts: factsOf({ checks: null }) })).toBe(
      '#309 is ready for review.',
    );
  });

  it('drops the checks word of a stale read', () => {
    expect(finishedSentenceOf({ facts: factsOf({ checks: 'success', minutesAgo: 12 }) })).toBe(
      '#309 is ready for review.',
    );
  });

  it('says merged and closed alone', () => {
    expect(finishedSentenceOf({ facts: factsOf({ state: 'merged', checks: 'success' }) })).toBe(
      '#309 is merged.',
    );
    expect(finishedSentenceOf({ facts: factsOf({ state: 'closed' }) })).toBe('#309 is closed.');
  });

  it('uses the GitLab noun', () => {
    expect(
      finishedSentenceOf({ facts: factsOf({ provider: 'gitlab', number: 42, checks: 'success' }) }),
    ).toBe('Checks passed on !42. Ready for review.');
  });

  it('says nothing without a request or with several branches', () => {
    expect(finishedSentenceOf({ facts: factsOf({ hasRequest: false }) })).toBeNull();
    expect(finishedSentenceOf({ facts: [] })).toBeNull();
    const [one] = factsOf({ checks: 'success' });
    expect(finishedSentenceOf({ facts: one === undefined ? [] : [one, one] })).toBeNull();
  });
});
