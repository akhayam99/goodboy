import { useShallow } from 'zustand/react/shallow';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { BranchScope } from '../branches/branchScope';
import { storageOwnerMatchesScope } from '../storageOwnerMatchesScope';

type Params = {
  readonly scope: BranchScope;
};

export const useBranchProjects = ({ scope }: Params): ReadonlyArray<Project> =>
  useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.kind === 'repo' &&
          project.disconnectedAt === undefined &&
          storageOwnerMatchesScope({ ownerWorkspace: project.workspaceId, scope }),
      ),
    ),
  );
