import { detectRepoSlug, listOpenPrsForRepo } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  GitlabWorkspaceIntegration,
  ReviewablePr,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { gitlabFetchProjectMrs } from '../../../features/integrations/gitlab/client';
import { worktreeRemoteUrl } from '../../../features/worktree/worktree';
import { classifyRemoteHost, projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';
import { mapGithubPr } from './mapGithubPr';
import { mapGitlabMr } from './mapGitlabMr';
import type { GetFn, SetFn } from './types';

type ReviewTarget = Readonly<{
  rootPath: string;
  mountWorkspaceId?: WorkspaceId;
}>;

type ReviewTargetsParams = {
  readonly workspace: Workspace;
};

const reviewTargets = ({ workspace }: ReviewTargetsParams): ReadonlyArray<ReviewTarget> => {
  if (workspace.kind === 'composite') {
    return (workspace.members ?? []).map((member) => ({
      rootPath: member.rootPath,
      mountWorkspaceId: member.workspaceId,
    }));
  }
  return [{ rootPath: workspace.rootPath }];
};

type AttributeParams = {
  readonly pr: ReviewablePr;
  readonly target: ReviewTarget;
};

const attributePr = ({ pr, target }: AttributeParams): ReviewablePr => {
  if (target.mountWorkspaceId == null) {
    return pr;
  }
  return {
    ...pr,
    id: `${pr.id}:${target.mountWorkspaceId}`,
    mountWorkspaceId: target.mountWorkspaceId,
  };
};

export const refreshReviewPrs = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId) => {
    if (get().reviewPrs[workspaceId]?.loading) {
      return;
    }
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (workspace == null) {
      return;
    }
    if (workspace.kind === 'simple') {
      return;
    }
    set((state) => ({
      reviewPrs: {
        ...state.reviewPrs,
        [workspaceId]: {
          items: state.reviewPrs[workspaceId]?.items ?? [],
          loading: true,
          error: null,
          fetchedAt: state.reviewPrs[workspaceId]?.fetchedAt ?? null,
        },
      },
    }));
    const items: ReviewablePr[] = [];
    const errors: string[] = [];
    const targets = reviewTargets({ workspace });
    const currentUser = get().githubStatus?.user ?? null;
    for (const target of targets) {
      try {
        const slug = await detectRepoSlug(
          tauriGhRunner,
          target.rootPath,
          workspaceId,
          target.mountWorkspaceId,
        );
        if (slug != null) {
          const prs = await listOpenPrsForRepo(tauriGhRunner, slug, {
            cwd: target.rootPath,
            workspaceId,
            ...(target.mountWorkspaceId != null
              ? { memberWorkspaceId: target.mountWorkspaceId }
              : {}),
          });
          items.push(
            ...prs.map((pr) =>
              attributePr({ pr: mapGithubPr({ pr, currentUser, repo: slug }), target }),
            ),
          );
        }
      } catch (err) {
        errors.push(formatError(err));
      }
    }
    const integration = (get().workspaceIntegrations[workspaceId] ?? []).find(
      (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
    );
    if (integration != null) {
      for (const target of targets) {
        try {
          const remoteUrl = await worktreeRemoteUrl(target.rootPath);
          const isGitlabRemote =
            classifyRemoteHost(remoteUrl, [integration.config.host]) === 'gitlab';
          const projectPath = isGitlabRemote ? projectPathFromRemoteUrl(remoteUrl) : null;
          if (projectPath != null) {
            const mrs = await gitlabFetchProjectMrs(
              workspaceId,
              integration.config.host,
              projectPath,
            );
            items.push(
              ...mrs.map((mr) =>
                attributePr({
                  pr: mapGitlabMr({
                    mr,
                    currentUserName: integration.config.userName,
                    projectPath,
                  }),
                  target,
                }),
              ),
            );
          }
        } catch (err) {
          errors.push(formatError(err));
        }
      }
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    set((state) => ({
      reviewPrs: {
        ...state.reviewPrs,
        [workspaceId]: {
          items,
          loading: false,
          error: errors.length > 0 ? errors.join('; ') : null,
          fetchedAt: new Date().toISOString(),
        },
      },
    }));
  };
};
