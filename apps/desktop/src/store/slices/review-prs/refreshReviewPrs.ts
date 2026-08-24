import { detectRepoSlug, listOpenPrsForRepo } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  GitlabIntegrationBinding,
  Project,
  ProjectId,
  ReviewablePr,
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
  projectId: ProjectId;
}>;

type ReviewTargetsParams = {
  readonly projects: ReadonlyArray<Project>;
};

const reviewTargets = ({ projects }: ReviewTargetsParams): ReadonlyArray<ReviewTarget> =>
  projects
    .filter((project) => project.kind === 'repo')
    .map((project) => ({ rootPath: project.rootPath, projectId: project.id }));

type AttributeParams = {
  readonly pr: ReviewablePr;
  readonly target: ReviewTarget;
};

const attributePr = ({ pr, target }: AttributeParams): ReviewablePr => {
  return {
    ...pr,
    id: `${pr.id}:${target.projectId}`,
    projectId: target.projectId,
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
    const targets = reviewTargets({
      projects: get().projects.filter((project) => project.workspaceId === workspaceId),
    });
    const currentUser = get().githubStatus?.user ?? null;
    for (const target of targets) {
      try {
        const slug = await detectRepoSlug(
          tauriGhRunner,
          target.rootPath,
          workspaceId,
          target.projectId,
        );
        if (slug != null) {
          const prs = await listOpenPrsForRepo(tauriGhRunner, slug, {
            cwd: target.rootPath,
            workspaceId,
            ...(target.projectId != null ? { projectId: target.projectId } : {}),
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
      (i): i is GitlabIntegrationBinding => i.provider === 'gitlab',
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
