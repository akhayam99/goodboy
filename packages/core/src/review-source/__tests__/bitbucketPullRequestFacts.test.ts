import { describe, expect, it } from 'vitest';
import {
  bitbucketChecksOf,
  bitbucketPrStateKind,
  bitbucketReviewDecisionOf,
  bitbucketReviewersOf,
} from '../bitbucketPullRequestFacts';
import type { BitbucketStatusState } from '../bitbucketPullRequestTypes';
import { KENJI, NADIA, OMAR, PRIYA, participant } from './bitbucketPullRequestFixture';

const statuses = (...states: ReadonlyArray<BitbucketStatusState>) =>
  states.map((state) => ({ state }));

describe('bitbucketPrStateKind', () => {
  it.each([
    ['OPEN', 'open'],
    ['MERGED', 'merged'],
    ['DECLINED', 'closed'],
    ['SUPERSEDED', 'closed'],
    ['ARCHIVED', 'open'],
  ] as const)('reads %s as %s', (state, kind) => {
    expect(bitbucketPrStateKind({ state })).toBe(kind);
  });
});

describe('bitbucketChecksOf', () => {
  it.each([
    ['no statuses', [], null],
    ['one failed', ['SUCCESSFUL', 'FAILED'], 'failure'],
    ['one stopped', ['SUCCESSFUL', 'STOPPED'], 'failure'],
    ['failed beats in progress', ['INPROGRESS', 'FAILED'], 'failure'],
    ['one in progress', ['SUCCESSFUL', 'INPROGRESS'], 'pending'],
    ['all successful', ['SUCCESSFUL', 'SUCCESSFUL'], 'success'],
  ] as const)('%s', (_label, states, expected) => {
    expect(bitbucketChecksOf({ statuses: statuses(...states) })).toBe(expected);
  });
});

describe('bitbucketReviewDecisionOf', () => {
  it('is null without reviewers, ignoring the author and other participants', () => {
    expect(bitbucketReviewDecisionOf({ participants: [] })).toBeNull();
    expect(
      bitbucketReviewDecisionOf({
        participants: [participant(NADIA, { role: 'PARTICIPANT', approved: true })],
      }),
    ).toBeNull();
  });

  it('asks for review while reviewers exist and none approved', () => {
    expect(
      bitbucketReviewDecisionOf({ participants: [participant(KENJI), participant(PRIYA)] }),
    ).toBe('review_required');
  });

  it('is approved when one reviewer approved and none asked for changes', () => {
    expect(
      bitbucketReviewDecisionOf({
        participants: [
          participant(KENJI, { approved: true, state: 'approved' }),
          participant(PRIYA),
        ],
      }),
    ).toBe('approved');
  });

  it('is changes requested as soon as one reviewer asks, even beside an approval', () => {
    expect(
      bitbucketReviewDecisionOf({
        participants: [
          participant(KENJI, { approved: true, state: 'approved' }),
          participant(OMAR, { state: 'changes_requested' }),
        ],
      }),
    ).toBe('changes_requested');
  });
});

describe('bitbucketReviewersOf', () => {
  it('keeps reviewers only and reads each state from the participant', () => {
    expect(
      bitbucketReviewersOf({
        participants: [
          participant(OMAR, { state: 'changes_requested' }),
          participant(KENJI, { approved: true }),
          participant(PRIYA),
          participant(NADIA, { role: 'PARTICIPANT' }),
          { user: null, role: 'REVIEWER', approved: false, state: null },
        ],
      }).map((reviewer) => [reviewer.person.login, reviewer.state]),
    ).toEqual([
      ['omar-t', 'changes_requested'],
      ['kenji-w', 'approved'],
      ['priya-n', 'pending'],
    ]);
  });
});
