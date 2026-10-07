// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PullRequestState, SessionId } from '@goodboy/types';
import { pullRequestFacts } from './pullRequestFacts';

const SESSION = 'session-harborline' as SessionId;

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-10-05T10:00:00Z',
};

const RUN = (conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name: 'unit tests',
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const factsOf = (patch: Partial<Parameters<typeof pullRequestFacts>[0]> = {}) =>
  pullRequestFacts({
    sessionId: SESSION,
    pr: PR,
    checks: null,
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isDraftAgentRunning: false,
    ...patch,
  });

describe('pullRequestFacts checks phase', () => {
  it('reads green, pending and failing from the runs', () => {
    expect(factsOf({ checks: [RUN('success')] }).checks).toBe('green');
    expect(factsOf({ checks: [RUN('success'), RUN('pending')] }).checks).toBe('pending');
    expect(factsOf({ checks: [RUN('failure')] }).checks).toBe('failing');
  });

  it('falls back to the rollup of the list when no runs are loaded', () => {
    expect(factsOf({ pr: { ...PR, checks: 'failure' } }).checks).toBe('failing');
    expect(factsOf({ pr: { ...PR, checks: null } }).checks).toBe('none');
  });

  it('is unknown, never none, when the list read could not see the checks', () => {
    expect(factsOf({ pr: { ...PR, checks: null, checksUnknown: true } }).checks).toBe('unknown');
  });

  it.each(['denied', 'failed'] as const)(
    'is unknown when the detail read of the checks is %s',
    (checksRead) => {
      expect(factsOf({ checks: [], checksRead }).checks).toBe('unknown');
      expect(factsOf({ pr: { ...PR, checks: 'success' }, checks: [], checksRead }).checks).toBe(
        'unknown',
      );
    },
  );

  it('trusts the runs when the detail read of the checks is ok', () => {
    expect(factsOf({ checks: [RUN('success')], checksRead: 'ok' }).checks).toBe('green');
  });
});
