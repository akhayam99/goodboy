import { useShallow } from 'zustand/react/shallow';
import type { Project, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { starredProjectsFirst } from '../../../../shared/utils/starredProjectsFirst';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useWorkspaceRepoProjects = ({ workspaceId }: Params): ReadonlyArray<Project> =>
  useAppStore(
    useShallow((state) =>
      starredProjectsFirst({
        projects: state.projects.filter(
          (project) => project.workspaceId === workspaceId && project.kind === 'repo',
        ),
      }),
    ),
  );
