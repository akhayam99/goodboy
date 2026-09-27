import { useState, type ReactNode } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { useProjectLinking } from '../../hooks/useProjectLinking';
import { DetectedRepoList } from '../DetectedRepoList';
import { ProjectAdoptionNotice } from '../ProjectAdoptionNotice';
import { ProjectAddPopover } from './ProjectAddPopover';
import { ProjectLinkAddRow } from './ProjectLinkAddRow';
import { ProjectLinkRow } from './ProjectLinkRow';
import { ProjectGroups } from './ProjectGroups';
import type { ProjectLinkDensity } from './projectLinkDensity';

const FILTER_VISIBLE_FROM = 10;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
  readonly emptyHint?: string;
  readonly editorExtra?: (params: { readonly project: Project }) => ReactNode;
  readonly rowBadge?: (params: { readonly project: Project }) => ReactNode;
  readonly density?: ProjectLinkDensity;
  readonly heading?: (params: { readonly count: number }) => ReactNode;
};

export const ProjectLinkList = ({
  workspaceId,
  initialConflicts,
  emptyHint,
  editorExtra,
  rowBadge,
  density = 'comfortable',
  heading,
}: Props) => {
  const linking = useProjectLinking({ workspaceId, initialConflicts });
  const isCompact = density === 'compact';
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-col gap-2">
      {isCompact && (
        <div className="flex min-w-0 items-center gap-2">
          {heading?.({ count: linking.linked.length })}
          <span className="flex-1" />
          {linking.linked.length >= FILTER_VISIBLE_FROM ? (
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter projects"
              aria-label="Filter projects"
              className="h-8 w-48 rounded-md border border-border-soft bg-background px-2 text-label text-foreground outline-none placeholder:text-faint-foreground focus:border-border"
            />
          ) : null}
          <ProjectAddPopover
            path={linking.path}
            busy={linking.busy}
            onPathChange={linking.setPath}
            onAdd={({ rootPath }) => void linking.link({ rootPath })}
            onBrowse={() => void linking.browse()}
            onNewProject={() => void linking.newProject()}
            onLinkPlainFolder={() => void linking.linkPlainFolder()}
          />
        </div>
      )}
      {linking.linked.length === 0 && emptyHint !== undefined && (
        <p className="text-body text-muted-foreground">{emptyHint}</p>
      )}
      {linking.linked.length > 0 && isCompact ? (
        <ProjectGroups
          workspaceId={workspaceId}
          projects={
            query.trim() === ''
              ? linking.linked
              : linking.linked.filter((project) =>
                  project.name.toLowerCase().includes(query.trim().toLowerCase()),
                )
          }
          busy={linking.busy}
          query={query}
          onUnlink={linking.unlink}
          editorExtra={editorExtra}
          rowBadge={rowBadge}
        />
      ) : null}
      {linking.linked.length > 0 && !isCompact ? (
        <ul className="flex flex-col gap-2">
          {linking.linked.map((project) => (
            <ProjectLinkRow
              key={project.id}
              project={project}
              busy={linking.busy}
              onUnlink={linking.unlink}
            />
          ))}
        </ul>
      ) : null}

      {!isCompact && (
        <ProjectLinkAddRow
          path={linking.path}
          busy={linking.busy}
          onPathChange={linking.setPath}
          onAdd={({ rootPath }) => void linking.link({ rootPath })}
          onBrowse={() => void linking.browse()}
          onNewProject={() => void linking.newProject()}
        />
      )}

      {linking.detected !== null && (
        <DetectedRepoList
          repos={linking.detected.repos}
          busy={linking.busy}
          known={linking.knownRepos}
          onConfirm={({ paths }) => void linking.linkDetected({ paths })}
          onDismiss={linking.dismissDetection}
        />
      )}

      {linking.conflicts.map((conflict) => (
        <ProjectAdoptionNotice
          key={conflict.project.id}
          conflict={conflict}
          busy={linking.busy}
          onMove={(entry) => void linking.moveConflict({ conflict: entry })}
          onKeep={(entry) => linking.keepConflict({ conflict: entry })}
        />
      ))}

      {!isCompact && (
        <button
          type="button"
          onClick={() => void linking.linkPlainFolder()}
          disabled={linking.busy}
          className="self-start text-label font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Link a plain folder (no git)
        </button>
      )}

      {linking.error !== null && (
        <p role="alert" className="text-label text-danger">
          {linking.error}
        </p>
      )}
    </div>
  );
};
