import { useMemo } from 'react';
import { ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { MountActionsMenu } from '../SessionOverviewPane/ProjectMountRows/MountActionsMenu';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly projectName: string;
  readonly count: number | null;
};

export const BoardProjectHead = ({ projectName, count }: Props) => {
  const ProjectIcon = CONCEPT_ICONS.projectRepo;
  const { session, rowById } = useBoardContext();
  const sessionId = session.id;
  const mountIds = useMemo(
    () =>
      new Set(
        [...rowById.values()].flatMap((row) =>
          row.projectName === projectName && row.mountId !== null ? [row.mountId] : [],
        ),
      ),
    [projectName, rowById],
  );
  const projectId = useAppStore(
    (state) =>
      (state.sessionProjectMounts[sessionId] ?? []).find((mount) => mountIds.has(mount.mountId))
        ?.projectId ?? null,
  );
  const project = useAppStore((state) =>
    projectId === null ? null : (projectById(state.projects, projectId) ?? null),
  );
  return (
    <div data-board-project-head="" className="flex h-7 min-w-0 items-center gap-2 px-2">
      <ProjectIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 truncate text-meta text-muted-foreground">{projectName}</span>
      {count === null ? null : (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
      )}
      {project === null ? null : (
        <>
          <span className="min-w-0 flex-1" />
          <MountActionsMenu
            sessionId={sessionId}
            projectId={project.id}
            workspaceId={project.workspaceId}
            projectName={project.name}
            worktreePath={project.rootPath}
          />
        </>
      )}
    </div>
  );
};
