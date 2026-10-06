import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  NO_PROJECT_FILTER_ID,
  useAppStore,
  useProjectMountsForSessions,
} from '../../../../store';

export type ProjectFilterOption = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly isStarred: boolean;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const useProjectFilterOptions = ({
  workspaceId,
  sessions,
}: Params): ReadonlyArray<ProjectFilterOption> => {
  const projects = useAppStore((state) => state.projects);
  const sessionProjectMounts = useProjectMountsForSessions({ sessions });
  return useMemo(() => {
    const counts = new Map<string, number>();
    let noProjectCount = 0;
    for (const session of sessions) {
      const mounts = sessionProjectMounts[session.id] ?? EMPTY_ARRAY;
      if (mounts.length === 0) {
        noProjectCount += 1;
        continue;
      }
      for (const projectId of new Set(mounts.map((mount) => mount.projectId))) {
        counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
      }
    }
    const projectOptions: ReadonlyArray<ProjectFilterOption> = projects
      .filter((project) => project.workspaceId === workspaceId && counts.has(project.id))
      .map((project) => ({
        id: project.id,
        label: project.name,
        count: counts.get(project.id) ?? 0,
        isStarred: project.starredAt !== undefined,
      }))
      .sort(
        (left, right) =>
          Number(right.isStarred) - Number(left.isStarred) || left.label.localeCompare(right.label),
      );
    if (noProjectCount === 0) {
      return projectOptions;
    }
    return [
      ...projectOptions,
      { id: NO_PROJECT_FILTER_ID, label: 'No project', count: noProjectCount, isStarred: false },
    ];
  }, [projects, sessionProjectMounts, sessions, workspaceId]);
};
