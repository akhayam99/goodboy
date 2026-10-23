import { describe, expect, it } from 'vitest';
import type { PullRequestReviewer, PullRequestReviewerState } from '@goodboy/types';
import { pullRequestReviewerGroupsOf } from '../pullRequestReviewerGroups';

type ReviewerParams = {
  readonly login: string;
  readonly state: PullRequestReviewerState;
};

const reviewer = ({ login, state }: ReviewerParams): PullRequestReviewer => ({
  person: { login, name: null, avatarUrl: null },
  state,
});

type ListParams = {
  readonly list: ReadonlyArray<PullRequestReviewer>;
};

const loginsOf = ({ list }: ListParams): ReadonlyArray<string> =>
  list.map((entry) => entry.person.login);

describe('pullRequestReviewerGroupsOf', () => {
  it('puts the bots that only commented apart and the asked reviewers first', () => {
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [
        reviewer({ login: 'portal-preview[bot]', state: 'commented' }),
        reviewer({ login: 'omar-t', state: 'approved' }),
        reviewer({ login: 'size-watch-bot', state: 'commented' }),
        reviewer({ login: 'dana-r', state: 'pending' }),
      ],
    });

    expect(loginsOf({ list: groups.people })).toEqual(['dana-r', 'omar-t']);
    expect(loginsOf({ list: groups.bots })).toEqual(['portal-preview[bot]', 'size-watch-bot']);
  });

  it('keeps a bot that gave a verdict with the people', () => {
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [reviewer({ login: 'release-gate[bot]', state: 'changes_requested' })],
    });

    expect(loginsOf({ list: groups.people })).toEqual(['release-gate[bot]']);
    expect(groups.bots).toEqual([]);
  });

  it('keeps a person who only commented with the people', () => {
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [reviewer({ login: 'kenji-w', state: 'commented' })],
    });

    expect(loginsOf({ list: groups.people })).toEqual(['kenji-w']);
  });
});
