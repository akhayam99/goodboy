import { useMemo, useState } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { undoable } from '../../utils/undoable';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type UnlinkParams = {
  readonly project: Project;
};

const EMPTY_PROJECTS: ReadonlyArray<Project> = [];

export const useProjectLinking = ({ workspaceId }: Params) => {
  const projects = useAppStore((state) => state.projects ?? EMPTY_PROJECTS);
  const addProject = useAppStore((state) => state.addProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(
    () => projects.filter((project) => project.workspaceId === workspaceId),
    [projects, workspaceId],
  );

  const unlink = async ({ project }: UnlinkParams) => {
    setBusy(true);
    setError(null);
    try {
      await removeProject({ projectId: project.id });
      undoable({
        message: `Unlinked ${project.name}`,
        undo: async () => {
          await addProject({
            workspaceId,
            rootPath: project.rootPath,
            requireRepo: project.kind === 'repo',
          });
        },
      });
    } catch (unlinkError) {
      setError(formatError(unlinkError));
    } finally {
      setBusy(false);
    }
  };

  return { linked, busy, error, unlink };
};
