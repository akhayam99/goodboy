import { useEffect, useMemo, useState } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import type { KnownRepo } from '../../components/DetectedRepoList';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly detectedPaths?: ReadonlyArray<string>;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
};

export const useProjectAdoption = ({
  workspaceId,
  detectedPaths = [],
  initialConflicts = [],
}: Params) => {
  const adoptProjectAction = useAppStore((state) => state.adoptProject);
  const previewProjectAdoption = useAppStore((state) => state.previewProjectAdoption);
  const [conflicts, setConflicts] =
    useState<ReadonlyArray<ProjectAttachConflict>>(initialConflicts);
  const [knownConflicts, setKnownConflicts] = useState<
    Readonly<Record<string, ProjectAttachConflict>>
  >({});

  const pathsKey = detectedPaths.join('\n');
  useEffect(() => {
    if (pathsKey === '') {
      setKnownConflicts({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries: Array<[string, ProjectAttachConflict]> = [];
      for (const path of pathsKey.split('\n')) {
        const conflict = await previewProjectAdoption({ workspaceId, rootPath: path }).catch(
          () => null,
        );
        if (conflict !== null) {
          entries.push([path, conflict]);
        }
      }
      if (!cancelled) {
        setKnownConflicts(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathsKey, workspaceId, previewProjectAdoption]);

  const knownRepos = useMemo(() => {
    const entries = Object.entries(knownConflicts).map(([path, conflict]) => [
      path,
      {
        workspaceName: conflict.sourceWorkspace.name,
        sessionCount: conflict.sessionCount,
      } satisfies KnownRepo,
    ]);
    return Object.fromEntries(entries) as Readonly<Record<string, KnownRepo>>;
  }, [knownConflicts]);

  const noteConflicts = (items: ReadonlyArray<ProjectAttachConflict>) => {
    if (items.length === 0) {
      return;
    }
    setConflicts((current) => {
      const seen = new Set(current.map((conflict) => conflict.project.id));
      return [...current, ...items.filter((conflict) => !seen.has(conflict.project.id))];
    });
  };

  const dismissConflict = (projectId: ProjectId) => {
    setConflicts((current) => current.filter((conflict) => conflict.project.id !== projectId));
  };

  const adoptConflict = async (conflict: ProjectAttachConflict) => {
    if (workspaceId === null) {
      return;
    }
    await adoptProjectAction({ projectId: conflict.project.id, targetWorkspaceId: workspaceId });
    dismissConflict(conflict.project.id);
  };

  return { conflicts, knownConflicts, knownRepos, noteConflicts, dismissConflict, adoptConflict };
};
