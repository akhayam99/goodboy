import { useMemo, useState, type ReactNode } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import { Eyebrow } from '@goodboy/ui';
import { useFrozenOrder } from '../../hooks/useFrozenOrder';
import { useProjectGitStatuses } from '../../../features/workspace/hooks/useProjectGitStatuses';
import { groupProjects } from './groupProjects';
import { ProjectLinkCompactRow } from './ProjectLinkCompactRow';

const SHOWN_BEFORE_EXPAND = 8;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<Project>;
  readonly busy: boolean;
  readonly query: string;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
  readonly editorExtra?: (params: { readonly project: Project }) => ReactNode;
  readonly rowBadge?: (params: { readonly project: Project }) => ReactNode;
  readonly rowFooter?: (params: { readonly project: Project }) => ReactNode;
};

export const ProjectGroups = ({
  workspaceId,
  projects,
  busy,
  query,
  onUnlink,
  editorExtra,
  rowBadge,
  rowFooter,
}: Props) => {
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isFocusInside, setIsFocusInside] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const isSearching = query.trim() !== '';

  const statuses = useProjectGitStatuses({ workspaceId });
  const statusByProjectId = useMemo(
    () => new Map(statuses.map((entry) => [entry.project.id, entry.status])),
    [statuses],
  );

  const liveGroups = useMemo(() => groupProjects(projects), [projects]);
  const groups = useFrozenOrder({
    value: liveGroups,
    isFrozen: !isSearching && (isPointerInside || isFocusInside),
  });

  const visibleAll =
    isSearching || isAllExpanded ? groups.all : groups.all.slice(0, SHOWN_BEFORE_EXPAND);
  const hiddenCount = groups.all.length - visibleAll.length;

  const row = (project: Project) => (
    <ProjectLinkCompactRow
      key={project.id}
      project={project}
      busy={busy}
      status={statusByProjectId.get(project.id) ?? null}
      onUnlink={onUnlink}
      editorExtra={editorExtra?.({ project })}
      badge={rowBadge?.({ project })}
      footer={rowFooter?.({ project })}
    />
  );

  return (
    <div
      data-testid="project-groups"
      onMouseEnter={() => setIsPointerInside(true)}
      onMouseLeave={() => setIsPointerInside(false)}
      onFocus={() => setIsFocusInside(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocusInside(false);
        }
      }}
      className="flex flex-col"
    >
      {groups.starred.length > 0 ? (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Eyebrow label="Starred" />
            <span className="tabular-nums text-eyebrow text-foreground">
              {groups.starred.length}
            </span>
          </div>
          <ul className="flex flex-col">{groups.starred.map(row)}</ul>
        </div>
      ) : null}
      {groups.all.length > 0 ? (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Eyebrow label="All projects" />
            <span className="tabular-nums text-eyebrow text-foreground">{groups.all.length}</span>
          </div>
          <ul className="flex flex-col">{visibleAll.map(row)}</ul>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsAllExpanded(true)}
              className="self-start px-2 py-1.5 text-label text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Show {hiddenCount} more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
