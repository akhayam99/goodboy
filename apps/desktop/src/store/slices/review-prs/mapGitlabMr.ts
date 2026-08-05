import type { ReviewablePr } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { gitlabMrStateKind } from '../../../features/integrations/gitlab/gitlabMrStateKind';

type Params = {
  mr: GitlabMergeRequest;
  currentUserName: string;
  projectPath: string;
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
    state: gitlabMrStateKind({ mr }),
    baseBranch: mr.targetBranch,
    headBranch: mr.sourceBranch,
    isDraft: mr.draft,
    updatedAt: mr.updatedAt,
  };
};
