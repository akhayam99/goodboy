// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { matrixOf, slotCount } from '../../../__tests__/helpers/actionMatrix';
import { PULL_REQUEST_KIND } from './pullRequest';
import type { PullRequestFacts } from './pullRequestFacts';

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
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'mara-l',
};

const facts = (overrides: Partial<PullRequestFacts>): PullRequestFacts => ({
  sessionId: 'session-harborline' as SessionId,
  pr: PR,
  number: 318,
  phase: 'open',
  checks: 'green',
  failingChecks: [],
  runningChecks: 0,
  failingLogUrl: null,
  review: null,
  changesRequestedBy: [],
  hasConflicts: false,
  openComments: 0,
  isOwn: true,
  writeInFlight: null,
  isDraftAgentRunning: false,
  commentsNeedYou: 0,
  isFixRunLive: false,
  mergeMethods: ['squash', 'merge', 'rebase'],
  mergeMethodReasons: {},
  commitCount: 5,
  ...overrides,
});

const OWN_LIVE_TAIL = ['pullRequest.editDetails hover', 'pullRequest.requestReview section'];

const COPIES = ['pullRequest.copyLink menu', 'pullRequest.copyBranch menu'];

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: PullRequestFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'Draft',
    facts: facts({ phase: 'draft' }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.markReady primary',
      ...OWN_LIVE_TAIL,
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Checks running',
    facts: facts({ checks: 'pending', runningChecks: 2, review: 'review_required' }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (2 checks still running.)',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Checks failing',
    facts: facts({
      checks: 'failing',
      failingChecks: ['unit tests'],
      review: 'changes_requested',
      changesRequestedBy: ['kenji-w'],
      openComments: 3,
    }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (1 check failing: unit tests.)',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Checks unknown',
    facts: facts({ checks: 'unknown', review: 'approved' }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Checks unknown.)',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Changes requested',
    facts: facts({ review: 'changes_requested', changesRequestedBy: ['kenji-w'], openComments: 3 }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (kenji-w asked for changes.)',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Approved, green',
    facts: facts({ review: 'approved' }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge primary',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Conflicts with main',
    facts: facts({ review: 'approved', hasConflicts: true }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Conflicts with main. Rebase on main from the Branch header.)',
      ...OWN_LIVE_TAIL,
      'pullRequest.convertToDraft menu',
      ...COPIES,
      'pullRequest.close menu',
    ],
  },
  {
    name: 'Merged',
    facts: facts({ phase: 'merged', review: 'approved' }),
    expected: ['pullRequest.openOnGithub secondary', ...COPIES],
  },
  {
    name: 'Closed',
    facts: facts({ phase: 'closed' }),
    expected: ['pullRequest.openOnGithub secondary', 'pullRequest.reopen secondary', ...COPIES],
  },
  {
    name: "Someone else's PR",
    facts: facts({ review: 'review_required', isOwn: false }),
    expected: [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Needs an approving review.)',
      'pullRequest.writeReview secondary',
      ...COPIES,
    ],
  },
  {
    name: 'No PR yet',
    facts: facts({ phase: 'none', pr: null, number: null }),
    expected: ['pullRequest.create primary'],
  },
];

const definitions = PULL_REQUEST_KIND.actions;

describe.each(STATES)('pull request, $name', ({ facts: state, expected }) => {
  it('offers exactly the planned actions', () => {
    expect(matrixOf({ definitions, facts: state })).toEqual(expected);
  });

  it('stays in budget', () => {
    expect(slotCount({ definitions, facts: state, slot: 'primary' })).toBeLessThanOrEqual(1);
    expect(slotCount({ definitions, facts: state, slot: 'secondary' })).toBeLessThanOrEqual(3);
  });
});

describe('pull request, a write in flight', () => {
  it('blocks every write with the claim, and leaves the doors open', () => {
    const matrix = matrixOf({
      definitions,
      facts: facts({ review: 'approved', writeInFlight: 'Goodboy is already merging #318' }),
    });
    expect(matrix).toContain('pullRequest.merge secondary (Goodboy is already merging #318.)');
    expect(matrix).toContain('pullRequest.convertToDraft menu (Goodboy is already merging #318.)');
    expect(matrix).toContain('pullRequest.openOnGithub secondary');
  });
});
