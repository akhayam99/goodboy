import { useCallback, useMemo } from 'react';
import type { CrumbMenuGroup } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { mountRequestOf } from '../../../../store/slices/project-mounts/mountRowModel';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { branchMenuGroups } from '../../../session/trail/menus/branchMenu';
import { switchBranchMount } from '../../switchBranchMount';

type Params = {
  readonly sessionId: SessionId;
  readonly currentPath: string | null;
};

type CreateParams = {
  readonly branch: string;
};

export type BranchSwitcher = {
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly count: number;
  readonly canCreate: boolean;
  readonly create: (params: CreateParams) => Promise<boolean>;
};

export const useBranchSwitcher = ({ sessionId, currentPath }: Params): BranchSwitcher => {
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const mountGithub = useAppStore((s) => s.mountGithub);
  const mountGitlabMr = useAppStore((s) => s.mountGitlabMr);
  const mountBitbucketPr = useAppStore((s) => s.mountBitbucketPr);
  const projects = useAppStore((s) => s.projects);
  const forkMount = useAppStore((s) => s.forkMount);
  const reportError = useAppStore((s) => s.reportError);

  const groups = useMemo(
    () =>
      branchMenuGroups({
        mounts,
        currentPath,
        statOf: () => null,
        statusOf: () => null,
        isRequestMergedOf: () => false,
        requestOf: (mount) => {
          const request = mountRequestOf({
            state: { mountGithub, mountGitlabMr, mountBitbucketPr },
            mountId: mount.mountId,
          });
          return request === null
            ? null
            : { number: request.number, state: request.state, isDraft: request.isDraft };
        },
        onSelect: (mount) =>
          void switchBranchMount({
            sessionId,
            mountId: mount.mountId,
            worktreePath: mount.worktreePath,
          }),
      }),
    [currentPath, mountBitbucketPr, mountGithub, mountGitlabMr, mounts, sessionId],
  );

  const current = mounts.find((mount) => mount.worktreePath === currentPath) ?? mounts[0] ?? null;
  const project = projectById(projects, current?.projectId ?? null) ?? null;
  const canCreate = project !== null && project.kind === 'repo';

  const create = useCallback(
    async ({ branch }: CreateParams): Promise<boolean> => {
      if (project === null) {
        return false;
      }
      try {
        const view = await forkMount({
          sessionId,
          projectId: project.id,
          ...(branch === '' ? {} : { branch }),
        });
        if (view.worktreePath !== null) {
          await switchBranchMount({
            sessionId,
            mountId: view.id,
            worktreePath: view.worktreePath,
          });
        }
        return true;
      } catch (error) {
        void reportError({
          title: `Couldn't create a new branch of ${project.name}`,
          error,
          sessionId,
        });
        return false;
      }
    },
    [forkMount, project, reportError, sessionId],
  );

  return {
    groups,
    count: groups.reduce((total, group) => total + group.rows.length, 0),
    canCreate,
    create,
  };
};
