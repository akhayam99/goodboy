import type { PullRequestStateKind, ReviewablePr } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';

type Params = {
  mr: GitlabMergeRequest;
  currentUserName: string;
  projectPath: string;
};

const deriveState = ({ mr }: { mr: GitlabMergeRequest }): PullRequestStateKind => {
  if (mr.state === 'merged') {
    return 'merged';
  }
  if (mr.state === 'closed' || mr.state === 'locked') {
    return 'closed';
  }
  if (mr.draft) {
    return 'draft';
  }
  return 'open';
};

export const mapGitlabMr = ({ mr, currentUserName, projectPath }: Params): ReviewablePr => {
  const author = mr.author?.username ?? '';
  return {
    id: `gitlab:${mr.iid}`,
    provider: 'gitlab',
    repo: projectPath,
    number: mr.iid,
    title: mr.title,
    url: mr.webUrl,
    author,
    authorAvatarUrl: mr.author?.avatarUrl ?? null,
    mine: author !== '' && author === currentUserName,
    reviewRequested: (mr.reviewers ?? []).some((r) => r.username === currentUserName),
    state: deriveState({ mr }),
    baseBranch: mr.targetBranch,
    headBranch: mr.sourceBranch,
    isDraft: mr.draft,
    updatedAt: mr.updatedAt,
  };
};
