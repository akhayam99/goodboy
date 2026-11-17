import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { selectSessionDraft } from '../../../../../../store/slices/sessionDraft/selectSessionDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type DraftProjects = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectIds: ReadonlyArray<ProjectId>;
  readonly names: ReadonlyArray<string>;
};

export const useDraftProjects = ({ workspaceId }: Params): DraftProjects => {
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt == null,
      ),
    ),
  );
  const projectIds = useAppStore((state) => selectSessionDraft({ state, workspaceId }).projectIds);
  const names = useMemo(
    () =>
      projectIds.flatMap((id) =>
        projects.filter((project) => project.id === id).map((project) => project.name),
      ),
    [projectIds, projects],
  );
  return { projects, projectIds, names };
};
