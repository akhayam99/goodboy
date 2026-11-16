import { useCallback, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type ToggleParams = {
  readonly project: Pick<Project, 'id' | 'name' | 'starredAt'>;
};

type ProjectStarToggle = {
  readonly pendingIds: ReadonlyArray<ProjectId>;
  readonly failure: string | null;
  readonly toggle: (params: ToggleParams) => void;
  readonly dismiss: () => void;
};

export const useProjectStarToggle = (): ProjectStarToggle => {
  const setProjectStarred = useAppStore((state) => state.setProjectStarred);
  const [pendingIds, setPendingIds] = useState<ReadonlyArray<ProjectId>>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = useCallback(
    ({ project }: ToggleParams) => {
      const isStarred = project.starredAt === undefined;
      setFailure(null);
      setPendingIds((ids) => [...ids, project.id]);
      void setProjectStarred({ projectId: project.id, isStarred })
        .catch((error: unknown) => {
          const verb = isStarred ? 'star' : 'unstar';
          setFailure(`Couldn't ${verb} ${project.name}: ${formatError(error)}`);
        })
        .finally(() => {
          setPendingIds((ids) => ids.filter((id) => id !== project.id));
        });
    },
    [setProjectStarred],
  );

  const dismiss = useCallback(() => setFailure(null), []);

  return useMemo(
    () => ({ pendingIds, failure, toggle, dismiss }),
    [pendingIds, failure, toggle, dismiss],
  );
};
