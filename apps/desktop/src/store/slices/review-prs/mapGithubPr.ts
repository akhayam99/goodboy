import type { RepoPullRequest } from '@goodboy/core';
import type { ReviewablePr } from '@goodboy/types';

type Params = {
  pr: RepoPullRequest;
  currentUser: string | null;
  repo: string;
};

export const mapGithubPr = ({ pr, currentUser, repo }: Params): ReviewablePr => {
  const login = currentUser != null && currentUser !== '' ? currentUser.toLowerCase() : null;
  return {
    id: `github:${pr.number}`,
    provider: 'github',
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    authorAvatarUrl: pr.author !== '' ? `https://github.com/${pr.author}.png` : null,
    mine: login != null && pr.author.toLowerCase() === login,
    reviewRequested: login != null && pr.reviewRequestLogins.some((l) => l.toLowerCase() === login),
    state: pr.state,
    baseBranch: pr.baseBranch,
    headBranch: pr.headBranch,
    isDraft: pr.isDraft,
    updatedAt: pr.updatedAt,
  };
};
