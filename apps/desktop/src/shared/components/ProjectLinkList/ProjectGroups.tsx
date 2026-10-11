import { useMemo, useState, type ReactNode } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import { SectionHeader, cn } from '@goodboy/ui';
import { useFrozenOrder } from '../../hooks/useFrozenOrder';
import { useProjectGitStatuses } from '../../../features/workspace/hooks/useProjectGitStatuses';
import { GroupCount } from './GroupCount';
import { groupProjects } from './groupProjects';
import { ProjectLinkCompactRow } from './ProjectLinkCompactRow';
import { PROJECT_ROW_GRID } from './projectRowGrid';

const SHOWN_BEFORE_EXPAND = 8;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<Project>;
  readonly busy: boolean;
  readonly query: string;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
  readonly editorExtra?: (params: { readonly project: Project }) => ReactNode;
  readonly rowBadge?: (params: { readonly project: Project }) => ReactNode;
  readonly editorScripts?: (params: { readonly project: Project }) => ReactNode;
};

export const ProjectGroups = ({
  workspaceId,
  projects,
  busy,
  query,
  onUnlink,
  editorExtra,
  rowBadge,
  editorScripts,
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

  const hasStarred = groups.starred.length > 0;

  const row = (project: Project) => (
    <ProjectLinkCompactRow
      key={project.id}
      project={project}
      busy={busy}
      status={statusByProjectId.get(project.id) ?? null}
      onUnlink={onUnlink}
      editorExtra={editorExtra?.({ project })}
      badge={rowBadge?.({ project })}
      scripts={editorScripts?.({ project })}
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
      className={cn('grid gap-x-2 gap-y-4', PROJECT_ROW_GRID)}
    >
      {groups.starred.length > 0 ? (
        <section aria-label="Starred" className="col-span-full grid grid-cols-subgrid gap-y-1">
          <SectionHeader
            label="Starred"
            headingLevel={3}
            meta={<GroupCount count={groups.starred.length} />}
            hint="Agents and pickers list these first."
            className="col-span-full px-2"
          />
          <ul className="col-span-full grid grid-cols-subgrid gap-y-1">
            {groups.starred.map(row)}
          </ul>
        </section>
      ) : null}
      {groups.all.length > 0 ? (
        <section
          aria-label={hasStarred ? 'Other projects' : 'Projects'}
          className="col-span-full grid grid-cols-subgrid gap-y-1"
        >
          <SectionHeader
            label={hasStarred ? 'Other projects' : 'Projects'}
            headingLevel={3}
            meta={<GroupCount count={groups.all.length} />}
            hint={hasStarred ? undefined : 'Star the ones you use most.'}
            className="col-span-full px-2"
          />
          <ul className="col-span-full grid grid-cols-subgrid gap-y-1">{visibleAll.map(row)}</ul>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsAllExpanded(true)}
              className="col-span-full self-start justify-self-start px-2 py-2 text-label text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Show {hiddenCount} more
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
