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

  it('puts a bot apart whatever its verdict', () => {
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [reviewer({ login: 'release-gate[bot]', state: 'changes_requested' })],
    });

    expect(groups.people).toEqual([]);
    expect(loginsOf({ list: groups.bots })).toEqual(['release-gate[bot]']);
  });

  it('knows a review app by the host author type when its login has no bot suffix', () => {
    const app: PullRequestReviewer = {
      person: { login: 'acme-review', name: null, avatarUrl: null, isBot: true },
      state: 'commented',
    };
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [app, reviewer({ login: 'omar-t', state: 'approved' })],
    });

    expect(loginsOf({ list: groups.people })).toEqual(['omar-t']);
    expect(loginsOf({ list: groups.bots })).toEqual(['acme-review']);
  });

  it('keeps the login suffix as the fallback when the host says a person', () => {
    const machine: PullRequestReviewer = {
      person: { login: 'cascadia-lint-bot', name: null, avatarUrl: null, isBot: false },
      state: 'commented',
    };

    expect(loginsOf({ list: pullRequestReviewerGroupsOf({ reviewers: [machine] }).bots })).toEqual([
      'cascadia-lint-bot',
    ]);
  });

  it('keeps a person who only commented with the people', () => {
    const groups = pullRequestReviewerGroupsOf({
      reviewers: [reviewer({ login: 'kenji-w', state: 'commented' })],
    });

    expect(loginsOf({ list: groups.people })).toEqual(['kenji-w']);
  });
});
