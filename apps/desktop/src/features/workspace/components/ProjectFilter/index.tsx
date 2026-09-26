import { useMemo } from 'react';
import { ListFilter } from 'lucide-react';
import { Listbox } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  NO_PROJECT_FILTER_ID,
  useAppStore,
  useProjectMountsForSessions,
  useSelectedProjectIds,
} from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

type FilterOption = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly isStarred?: boolean;
};

export const ProjectFilter = ({ workspaceId, sessions }: Props) => {
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const projects = useAppStore((state) => state.projects);
  const sessionProjectMounts = useProjectMountsForSessions({ sessions });
  const options = useMemo(() => {
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
    const projectOptions: ReadonlyArray<FilterOption> = projects
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
      { id: NO_PROJECT_FILTER_ID, label: 'No project', count: noProjectCount },
    ];
  }, [projects, sessionProjectMounts, sessions, workspaceId]);

  const activeCount = selectedProjectIds.length;

  return (
    <Listbox
      multiple
      trigger="quiet"
      size="sm"
      align="end"
      noun="project"
      ariaLabel={activeCount > 0 ? `Project filter, ${activeCount} active` : 'Project filter'}
      value={selectedProjectIds}
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.count,
      }))}
      onChange={(next) => setSelectedProjectIds({ workspaceId, selectedProjectIds: next })}
      valueLabel={
        <>
          <ListFilter size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          {activeCount > 0 ? <span className="tabular-nums">{activeCount}</span> : null}
        </>
      }
    />
  );
};
