import { detectRepoSlug, listOpenPrsForRepo } from '@goodboy/core';
import type { GitlabWorkspaceIntegration, ReviewablePr, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { gitlabFetchProjectMrs } from '../../../features/integrations/gitlab/client';
import { worktreeRemoteUrl } from '../../../features/worktree/worktree';
import { formatError } from '../../../shared/lib/errors';
import { projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';
import { mapGithubPr } from './mapGithubPr';
import { mapGitlabMr } from './mapGitlabMr';
import type { GetFn, SetFn } from './types';

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
    try {
      const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath, workspaceId);
      if (slug != null) {
        const prs = await listOpenPrsForRepo(tauriGhRunner, slug, {
          cwd: workspace.rootPath,
          workspaceId,
        });
        const currentUser = get().githubStatus?.user ?? null;
        items.push(...prs.map((pr) => mapGithubPr({ pr, currentUser, repo: slug })));
      }
    } catch (err) {
      errors.push(formatError(err));
    }
    const integration = (get().workspaceIntegrations[workspaceId] ?? []).find(
      (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
    );
    if (integration != null) {
      try {
        const remoteUrl = await worktreeRemoteUrl(workspace.rootPath);
        const projectPath = projectPathFromRemoteUrl(remoteUrl);
        if (projectPath != null) {
          const mrs = await gitlabFetchProjectMrs(
            workspaceId,
            integration.config.host,
            projectPath,
          );
          items.push(
            ...mrs.map((mr) =>
              mapGitlabMr({ mr, currentUserName: integration.config.userName, projectPath }),
            ),
          );
        }
      } catch (err) {
        errors.push(formatError(err));
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
