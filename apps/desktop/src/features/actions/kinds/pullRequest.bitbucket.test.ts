// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { PULL_REQUEST_KIND } from './pullRequest';
import { pullRequestFacts, type PullRequestFacts } from './pullRequestFacts';

const PR: PullRequestState = {
  number: 42,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://bitbucket.org/harborline/payments-api/pull-requests/42',
  state: 'open',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-10-06T09:30:00Z',
  author: 'nadia-p',
};

const facts = (overrides: Partial<PullRequestFacts> = {}): PullRequestFacts => ({
  ...pullRequestFacts({
    sessionId: 'session-harborline' as SessionId,
    host: 'bitbucket',
    pr: PR,
    checks: null,
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
  }),
  ...overrides,
});

const definitions = PULL_REQUEST_KIND.actions;

const OWN_LIVE_TAIL = ['pullRequest.editDetails hover', 'pullRequest.requestReview section'];

const COPIES = ['pullRequest.copyLink menu', 'pullRequest.copyBranch menu'];

describe('pull request on Bitbucket', () => {
  it('offers Merge first and no draft control, and says it opens on Bitbucket', () => {
    expect(matrixOf({ definitions, facts: facts() })).toEqual([
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge primary',
      ...OWN_LIVE_TAIL,
      ...COPIES,
      'pullRequest.close menu',
    ]);
  });

  it('names the host in the open action', () => {
    const open = definitions.find((definition) => definition.id === 'pullRequest.openOnGithub');
    const label = open?.label;

    expect(typeof label === 'function' ? label({ facts: facts() }) : label).toBe(
      'Open on Bitbucket',
    );
  });

  it('keeps Merge enabled while the host gives no mergeability', () => {
    const merge = definitions.find((definition) => definition.id === 'pullRequest.merge');

    expect(facts().pr?.mergeable).toBeNull();
    expect(merge?.blockedReason?.({ facts: facts() })).toBeNull();
  });

  it('never offers Reopen on a declined pull request, only the doors', () => {
    expect(matrixOf({ definitions, facts: facts({ phase: 'closed' }) })).toEqual([
      'pullRequest.openOnGithub secondary',
      ...COPIES,
    ]);
  });

  it('offers nothing to create on Bitbucket without a pull request', () => {
    expect(
      matrixOf({ definitions, facts: facts({ phase: 'none', pr: null, number: null }) }),
    ).toEqual([]);
  });

  it('drops the draft entries where the host has no drafts', () => {
    const matrix = matrixOf({ definitions, facts: facts({ host: 'bitbucket' }) });

    expect(matrix.some((entry) => entry.startsWith('pullRequest.markReady'))).toBe(false);
    expect(matrix.some((entry) => entry.startsWith('pullRequest.convertToDraft'))).toBe(false);
    expect(matrix.some((entry) => entry.startsWith('pullRequest.reopen'))).toBe(false);
  });

  it('asks the three strategies and says why the pull request cannot be reopened', () => {
    const merge = definitions.find((definition) => definition.id === 'pullRequest.merge');
    const close = definitions.find((definition) => definition.id === 'pullRequest.close');
    const mergeConfirm = merge?.confirm?.({ facts: facts() });
    const closeConfirm = close?.confirm?.({ facts: facts() });

    expect(mergeConfirm?.choice?.options.map((option) => option.id)).toEqual([
      'squash',
      'merge',
      'rebase',
    ]);
    expect(mergeConfirm?.choice?.options.every((option) => option.disabledReason === null)).toBe(
      true,
    );
    expect(mergeConfirm?.description).toContain('Bitbucket checks this when you merge');
    expect(mergeConfirm?.description).not.toContain('GitHub');
    expect(closeConfirm?.description).toContain("Bitbucket can't reopen a declined pull request");
  });
});
